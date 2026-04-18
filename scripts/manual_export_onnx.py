#!/usr/bin/env python3
"""Manual ONNX export for Marian/Opus-MT models using eager attention."""

import sys
import os
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, AutoConfig

MODEL_DIR = "/Users/nghinh/Downloads/projects/vibevoice/models/opus-mt/en-vi"
os.makedirs(MODEL_DIR, exist_ok=True)

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained("Helsinki-NLP/opus-mt-en-vi")
tokenizer.save_pretrained(MODEL_DIR)
print("Tokenizer saved.")

print("Loading model with eager attention...")
config = AutoConfig.from_pretrained("Helsinki-NLP/opus-mt-en-vi")
config._attn_implementation = "eager"
model = AutoModelForSeq2SeqLM.from_pretrained("Helsinki-NLP/opus-mt-en-vi", config=config)
model.eval()
print("Model loaded.")

encoder = model.get_encoder()
decoder = model.get_decoder()
lm_head = model.lm_head

# Encoder export
print("\nExporting encoder...")
encoder_ids = torch.randint(0, 100, (1, 16), dtype=torch.int64)
encoder_attention_mask = torch.ones(1, 16, dtype=torch.int64)

torch.onnx.export(
    encoder,
    (encoder_ids, encoder_attention_mask),
    os.path.join(MODEL_DIR, "encoder_model.onnx"),
    input_names=["input_ids", "attention_mask"],
    output_names=["hidden_states"],
    dynamic_axes={
        "input_ids": {0: "batch_size", 1: "seq_len"},
        "attention_mask": {0: "batch_size", 1: "seq_len"},
        "hidden_states": {0: "batch_size", 1: "seq_len"},
    },
    opset_version=18,
    do_constant_folding=True,
)
print("Encoder exported.")

# Decoder export (step - single token for autoregressive decoding)
# Marian decoder expects input_ids of [batch, 1] during autoregressive step
print("\nExporting decoder (step)...")
decoder_ids = torch.randint(0, 100, (1, 1), dtype=torch.int64)  # seq_len=1 for single token
decoder_attention_mask = torch.ones(1, 1, dtype=torch.int64)
encoder_hidden_states = torch.randn(1, 16, 512)

torch.onnx.export(
    decoder,
    (decoder_ids, encoder_hidden_states, decoder_attention_mask),
    os.path.join(MODEL_DIR, "decoder_model.onnx"),
    input_names=["input_ids", "encoder_hidden_states", "attention_mask"],
    output_names=["hidden_states"],
    dynamic_axes={
        "input_ids": {0: "batch_size", 1: "dec_seq_len"},
        "encoder_hidden_states": {0: "batch_size", 1: "enc_seq_len"},
        "attention_mask": {0: "batch_size", 1: "dec_seq_len"},
        "hidden_states": {0: "batch_size", 1: "dec_seq_len"},
    },
    opset_version=18,
    do_constant_folding=True,
)
print("Decoder exported.")

# LM Head (proj) export
print("\nExporting lm_head...")
dummy_input = torch.randn(1, 1, 512)
torch.onnx.export(
    lm_head,
    dummy_input,
    os.path.join(MODEL_DIR, "lm_head_model.onnx"),
    input_names=["hidden_states"],
    output_names=["logits"],
    dynamic_axes={
        "hidden_states": {0: "batch_size", 1: "dec_seq_len"},
        "logits": {0: "batch_size", 1: "dec_seq_len"},
    },
    opset_version=18,
    do_constant_folding=True,
)
print("LM head exported.")

print("\nDone! Files in", MODEL_DIR)
for f in os.listdir(MODEL_DIR):
    fp = os.path.join(MODEL_DIR, f)
    if os.path.isfile(fp):
        size_mb = os.path.getsize(fp) / (1024 * 1024)
        print(f"  {f} ({size_mb:.1f} MB)")