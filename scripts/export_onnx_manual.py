#!/usr/bin/env python3
"""
Direct ONNX export for Opus-MT models using PyTorch.
Avoids optimum library compatibility issues.
"""

import os
import sys
import torch
from pathlib import Path

# Add project root to path
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

MODELS = {
    "en-vi": "Helsinki-NLP/opus-mt-en-vi",
    "ja-en": "Helsinki-NLP/opus-mt-ja-en",
    "ko-en": "Helsinki-NLP/opus-mt-ko-en",
    "zh-en": "Helsinki-NLP/opus-mt-zh-en",
}

OUTPUT_BASE = PROJECT_ROOT / "models" / "opus-mt"


def export_model_to_onnx(pair_name: str, model_id: str):
    """Export a MarianMT model to ONNX format."""
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

    output_dir = OUTPUT_BASE / pair_name
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 60}")
    print(f"Exporting: {pair_name} ({model_id})")
    print(f"{'=' * 60}")

    # Check if already exported
    onnx_path = output_dir / "model.onnx"
    if onnx_path.exists():
        size_mb = onnx_path.stat().st_size / (1024 * 1024)
        print(f"  ONNX model already exists ({size_mb:.1f} MB), skipping")
        return True

    try:
        print(f"  Loading model and tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
        model.eval()

        # Test translation to verify model works
        print(f"  Testing translation...")
        test_input = tokenizer("Hello", return_tensors="pt", padding=True)
        with torch.no_grad():
            test_output = model.generate(**test_input)
        test_text = tokenizer.decode(test_output[0], skip_special_tokens=True)
        print(f"  Test translation: 'Hello' -> '{test_text}'")

        # Export to ONNX
        print(f"  Exporting to ONNX...")

        # Create dummy input for tracing
        dummy_input = tokenizer(
            "test", return_tensors="pt", padding=True, max_length=64
        )

        # Export using torch.onnx
        # MarianMT models are seq2seq, so we need to export the forward pass
        torch.onnx.export(
            model,
            (dummy_input["input_ids"], dummy_input.get("attention_mask")),
            str(onnx_path),
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch", 1: "sequence"},
                "attention_mask": {0: "batch", 1: "sequence"},
                "logits": {0: "batch", 1: "sequence"},
            },
            opset_version=14,
            do_constant_folding=True,
        )

        size_mb = onnx_path.stat().st_size / (1024 * 1024)
        print(f"  Exported successfully: {size_mb:.1f} MB")
        return True

    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    print("Direct ONNX Export for Opus-MT Models")
    print("=" * 60)

    # Check Python version
    if sys.version_info < (3, 8):
        print("ERROR: Python 3.8+ required")
        sys.exit(1)

    # Create output directory
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

    # Check PyTorch
    print(f"PyTorch version: {torch.__version__}")
    print(f"ONNX support: {hasattr(torch, 'onnx')}")

    # Export each model
    results = {}
    for pair_name, model_id in MODELS.items():
        success = export_model_to_onnx(pair_name, model_id)
        results[pair_name] = success

    # Summary
    print("\n" + "=" * 60)
    print("EXPORT SUMMARY")
    print("=" * 60)
    for pair_name, success in results.items():
        status = "SUCCESS" if success else "FAILED"
        onnx_path = OUTPUT_BASE / pair_name / "model.onnx"
        if onnx_path.exists():
            size_mb = onnx_path.stat().st_size / (1024 * 1024)
            print(f"  {pair_name}: {status} ({size_mb:.1f} MB)")
        else:
            print(f"  {pair_name}: {status}")

    # Copy to Android assets
    print("\n" + "=" * 60)
    print("NEXT STEPS")
    print("=" * 60)
    android_dir = (
        PROJECT_ROOT
        / "mobile"
        / "android"
        / "app"
        / "src"
        / "main"
        / "assets"
        / "models"
        / "opus-mt"
    )
    print(f"\nTo copy models to Android:")
    print(f"  mkdir -p {android_dir}")
    print(f"  cp -r {OUTPUT_BASE}/* {android_dir}/")

    if all(results.values()):
        print("\nAll models exported successfully!")
    else:
        print("\nSome models failed. Please check errors above.")


if __name__ == "__main__":
    main()
