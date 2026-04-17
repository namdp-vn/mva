#!/usr/bin/env python3
"""
Prepare Opus-MT models for Android deployment.

Downloads Helsinki-NLP Opus-MT models and converts them to ONNX int8 format
for use with the OpusMtTranslatorModule on Android.

Usage:
    python3 scripts/prepare_opus_mt_android.py

Output:
    models/opus-mt/
    ├── en-vi/
    │   ├── model.onnx
    │   ├── source_vocab.json
    │   └── target_vocab.json
    ├── ja-en/
    ├── ko-en/
    └── zh-en/
"""

import os
import sys
import json
import subprocess
import shutil
from pathlib import Path

# Models to download from Helsinki-NLP
MODELS = {
    "en-vi": "Helsinki-NLP/opus-mt-en-vi",
    "ja-en": "Helsinki-NLP/opus-mt-ja-en",
    "ko-en": "Helsinki-NLP/opus-mt-ko-en",
    "zh-en": "Helsinki-NLP/opus-mt-zh-en",
}

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_BASE = PROJECT_ROOT / "models" / "opus-mt"
VENV_DIR = PROJECT_ROOT / ".venv"


def run_in_venv(args):
    """Run a command in the virtual environment."""
    venv_python = VENV_DIR / "bin" / "python"
    return subprocess.run([str(venv_python)] + args).returncode


def install_requirements():
    """Install required packages in a virtual environment."""
    if VENV_DIR.exists():
        print("Virtual environment already exists")
        venv_python = VENV_DIR / "bin" / "python"
    else:
        print("Creating virtual environment...")
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])
        venv_python = VENV_DIR / "bin" / "python"

    print("Upgrading pip...")
    subprocess.check_call(
        [str(venv_python), "-m", "pip", "install", "-q", "--upgrade", "pip"]
    )

    packages = [
        "transformers",
        "torch",
        "onnx",
        "optimum[onnxruntime]",
        "sentencepiece",
    ]
    print("Installing required packages...")
    subprocess.check_call([str(venv_python), "-m", "pip", "install", "-q"] + packages)
    print("Requirements installed successfully")
    return venv_python


def download_and_convert_model(pair_name: str, model_id: str, venv_python: Path):
    """Download model from HuggingFace and convert to ONNX."""
    output_dir = OUTPUT_BASE / pair_name
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 60}")
    print(f"Processing: {pair_name} ({model_id})")
    print(f"{'=' * 60}")

    # Check if model already converted
    onnx_files = list(output_dir.glob("*.onnx"))
    if onnx_files:
        print(f"  ONNX model already exists at {onnx_files[0]}, skipping...")
        return

    try:
        # Create a conversion script to run in venv
        convert_script = f"""
import sys
from pathlib import Path

pair_name = "{pair_name}"
model_id = "{model_id}"
output_dir = Path("{output_dir}")

print(f"  Downloading model from HuggingFace...")

# Import transformers
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

tokenizer = AutoTokenizer.from_pretrained("{model_id}")
model = AutoModelForSeq2SeqLM.from_pretrained("{model_id}")

# Save tokenizer
print(f"  Saving tokenizer files...")
tokenizer.save_pretrained(output_dir)

# Export to ONNX using optimum
print(f"  Converting to ONNX (fp32)...")
from optimum.onnxruntime import ORTModelForSeq2SeqLM

onnx_model = ORTModelForSeq2SeqLM.from_pretrained(
    "{model_id}",
    export=True,
    provider="CPUExecutionProvider",
)
onnx_model.save_pretrained(output_dir)
print(f"  Saved ONNX model to {{output_dir}}")

# Try to quantize to int8
print(f"  Attempting int8 quantization...")
try:
    from optimum.onnxruntime import ORTQuantizer
    from optimum.onnxruntime.configuration import AutoQuantizationConfig

    quantizer = ORTQuantizer.from_pretrained(output_dir)
    qconfig = AutoQuantizationConfig.int8(disable_execution_provider=[])
    quantizer.quantize(save_dir=output_dir, quantization_config=qconfig)
    print(f"  Quantized model saved")
except Exception as e:
    print(f"  Warning: Quantization failed ({{e}})")
    print(f"  Using fp32 model - to quantize manually, run:")
    print(f"    optimum-cli export onnx -m {{model_id}} --quantize int8 {{output_dir}}")

# Report size
for f in output_dir.glob("*.onnx"):
    size_mb = f.stat().st_size / (1024 * 1024)
    print(f"  Model size: {{size_mb:.1f}} MB")
"""

        # Write and run the conversion script
        script_path = OUTPUT_BASE / f"_convert_{pair_name}.py"
        with open(script_path, "w") as f:
            f.write(convert_script)

        result = subprocess.run(
            [str(venv_python), str(script_path)], capture_output=True, text=True
        )

        # Print output
        for line in result.stdout.splitlines():
            if line.strip():
                print(f"  {line}")

        if result.returncode != 0:
            print(f"  ERROR: {result.stderr}")
            raise Exception(f"Conversion failed for {pair_name}")

        # Clean up conversion script
        script_path.unlink()

    except Exception as e:
        print(f"  ERROR: Failed to process {pair_name}: {e}")
        raise


def create_metadata():
    """Create metadata file for the model set."""
    metadata = {
        "version": "1.0.0",
        "models": {
            pair: {
                "source": repo,
                "direction": pair.upper().replace("-", " → "),
            }
            for pair, repo in MODELS.items()
        },
        "ram_per_model_mb": "~50MB (int8)",
        "note": "Two-hop translation: JA/KO/ZH → EN → VI",
    }

    metadata_path = OUTPUT_BASE / "metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"\nMetadata saved to {metadata_path}")


def print_android_instructions():
    """Print instructions for copying models to Android assets."""
    print("\n" + "=" * 60)
    print("CONVERSION COMPLETE")
    print("=" * 60)
    print(f"\nModels saved to: {OUTPUT_BASE}")
    print("\nDirectory structure:")
    for pair_dir in sorted((OUTPUT_BASE).glob("*")):
        if pair_dir.is_dir():
            files = list(pair_dir.glob("*"))
            print(f"  {pair_dir.name}/")
            for f in files:
                if f.is_file():
                    size_mb = f.stat().st_size / (1024 * 1024)
                    print(f"    {f.name} ({size_mb:.1f} MB)")

    print("\n" + "-" * 60)
    print("To deploy on Android:")
    print("-" * 60)
    android_models_dir = (
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
    print(f"\n  1. Copy models to Android assets:")
    print(f"     mkdir -p {android_models_dir}")
    print(f"     cp -r {OUTPUT_BASE}/* {android_models_dir}/")
    print("\n  2. Ensure directory structure:")
    print("     android/.../assets/models/opus-mt/")
    print("     ├── en-vi/model.onnx (+ vocab files)")
    print("     ├── ja-en/model.onnx (+ vocab files)")
    print("     ├── ko-en/model.onnx (+ vocab files)")
    print("     └── zh-en/model.onnx (+ vocab files)")
    print("\n  3. Rebuild Android app")


def main():
    print("Opus-MT Model Preparation for Android")
    print("=" * 60)

    # Check Python version
    if sys.version_info < (3, 8):
        print("ERROR: Python 3.8+ required")
        sys.exit(1)

    # Create output directory
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

    # Install requirements
    venv_python = install_requirements()

    # Download and convert each model
    for pair_name, model_id in MODELS.items():
        try:
            download_and_convert_model(pair_name, model_id, venv_python)
        except Exception as e:
            print(f"\nERROR processing {pair_name}: {e}")
            print("Continuing with other models...")

    # Create metadata
    create_metadata()

    # Print instructions
    print_android_instructions()

    print("\nDone!")


if __name__ == "__main__":
    main()
