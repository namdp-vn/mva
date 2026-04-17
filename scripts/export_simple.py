#!/usr/bin/env python3
"""
Simple ONNX export using legacy torch.onnx.export API.
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


def export_simple(pair_name: str, model_id: str):
    """Export using simple torch.onnx.export."""
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

    output_dir = OUTPUT_BASE / pair_name
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 60}")
    print(f"Exporting: {pair_name}")
    print(f"{'=' * 60}")

    onnx_path = output_dir / "model.onnx"
    if onnx_path.exists():
        print(f"  Already exists, skipping")
        return True

    try:
        # Load model with eager attention to avoid SDPA issues
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            model_id,
            attn_implementation="eager",
        )
        model.eval()

        # Test
        test_ids = tokenizer("Hello", return_tensors="pt", padding=True)
        with torch.no_grad():
            out = model.generate(**test_ids)
        print(f"  Test: Hello -> {tokenizer.decode(out[0])}")

        # Export - use simple API
        print(f"  Exporting...")
        dummy = tokenizer("x", return_tensors="pt", padding=True, max_length=16)

        # Simple export without dynamic axes for now
        torch.onnx.export(
            model,
            (dummy["input_ids"],),
            str(onnx_path),
            input_names=["input_ids"],
            output_names=["output"],
            opset_version=14,
        )

        size = onnx_path.stat().st_size / 1024 / 1024
        print(f"  Success: {size:.1f} MB")
        return True

    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    print("Simple ONNX Export")
    print("=" * 60)

    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

    results = {}
    for pair, model_id in MODELS.items():
        results[pair] = export_simple(pair, model_id)

    print("\n" + "=" * 60)
    print("Summary:")
    for pair, ok in results.items():
        print(f"  {pair}: {'OK' if ok else 'FAIL'}")

    if all(results.values()):
        print("\nAll exported!")
    else:
        print("\nSome failed.")


if __name__ == "__main__":
    main()
