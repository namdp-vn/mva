#!/usr/bin/env python3
"""
Direct ONNX export for Opus-MT models using PyTorch.
Disables SDPA to avoid export issues.
"""

import os
import sys
import torch
from pathlib import Path

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
    """Export a MarianMT model to ONNX format with SDPA disabled."""
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

    output_dir = OUTPUT_BASE / pair_name
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 60}")
    print(f"Exporting: {pair_name} ({model_id})")
    print(f"{'=' * 60}")

    onnx_path = output_dir / "model.onnx"
    if onnx_path.exists():
        size_mb = onnx_path.stat().st_size / (1024 * 1024)
        print(f"  ONNX model already exists ({size_mb:.1f} MB), skipping")
        return True

    try:
        print(f"  Loading model and tokenizer...")
        # Disable SDPA to avoid export issues
        with torch.no_grad():
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_id,
                attn_implementation="eager",  # Disable SDPA
            )
            model.eval()

        print(f"  Testing translation...")
        test_input = tokenizer("Hello", return_tensors="pt", padding=True)
        with torch.no_grad():
            test_output = model.generate(**test_input)
        test_text = tokenizer.decode(test_output[0], skip_special_tokens=True)
        print(f"  Test translation: 'Hello' -> '{test_text}'")

        print(f"  Exporting to ONNX...")

        # Create dummy input with fixed sequence length
        dummy_input = tokenizer(
            "test", return_tensors="pt", padding=True, max_length=32
        )
        input_ids = dummy_input["input_ids"]
        attention_mask = dummy_input.get("attention_mask")

        # Export to ONNX with older API
        torch.onnx.export(
            model,
            (input_ids, attention_mask) if attention_mask is not None else (input_ids,),
            str(onnx_path),
            input_names=["input_ids", "attention_mask"]
            if attention_mask is not None
            else ["input_ids"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch", 1: "sequence"},
                "attention_mask": {0: "batch", 1: "sequence"}
                if attention_mask is not None
                else None,
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
        import traceback

        traceback.print_exc()
        return False


def main():
    print("Direct ONNX Export for Opus-MT Models (SDPA Disabled)")
    print("=" * 60)

    if sys.version_info < (3, 8):
        print("ERROR: Python 3.8+ required")
        sys.exit(1)

    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

    print(f"PyTorch version: {torch.__version__}")
    print(f"ONNX support: {hasattr(torch, 'onnx')}")

    results = {}
    for pair_name, model_id in MODELS.items():
        success = export_model_to_onnx(pair_name, model_id)
        results[pair_name] = success

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

    if all(results.values()):
        print("\nAll models exported successfully!")
    else:
        print("\nSome models failed. Please check errors above.")


if __name__ == "__main__":
    main()
