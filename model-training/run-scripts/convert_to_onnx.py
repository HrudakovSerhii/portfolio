#!/usr/bin/env python3
"""
Convert the fine-tuned LoRA model to ONNX format for use with Transformers.js.
This script merges the LoRA weights with the base model and exports to ONNX.
"""

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
from optimum.onnxruntime import ORTModelForCausalLM
from optimum.onnxruntime.configuration import AutoQuantizationConfig
from pathlib import Path
import shutil

# Configuration
BASE_MODEL = "HuggingFaceTB/smolLM2-135M-instruct"
LORA_MODEL_PATH = "./serhii-lora-model"
MERGED_MODEL_PATH = "./serhii-merged-model"
ONNX_MODEL_PATH = "./serhii-onnx-model"

def merge_lora_weights():
    """Merge LoRA weights with base model."""
    print("🔄 Loading base model...")
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )

    print("🔗 Loading LoRA adapter...")
    model = PeftModel.from_pretrained(base_model, LORA_MODEL_PATH)

    print("🔀 Merging LoRA weights with base model...")
    merged_model = model.merge_and_unload()

    print(f"💾 Saving merged model to {MERGED_MODEL_PATH}...")
    merged_model.save_pretrained(MERGED_MODEL_PATH)

    # Also save tokenizer
    tokenizer = AutoTokenizer.from_pretrained(LORA_MODEL_PATH)
    tokenizer.save_pretrained(MERGED_MODEL_PATH)

    print("✅ LoRA weights merged successfully!")
    return MERGED_MODEL_PATH

def convert_to_onnx(model_path):
    """Convert merged model to ONNX format."""
    print("\n🔧 Converting to ONNX format...")

    # Load the merged model
    print(f"📂 Loading model from {model_path}...")
    model = ORTModelForCausalLM.from_pretrained(
        model_path,
        export=True,
        provider="CPUExecutionProvider"
    )

    # Save ONNX model
    print(f"💾 Saving ONNX model to {ONNX_MODEL_PATH}...")
    model.save_pretrained(ONNX_MODEL_PATH)

    # Copy tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    tokenizer.save_pretrained(ONNX_MODEL_PATH)

    print("✅ ONNX conversion complete!")
    return ONNX_MODEL_PATH

def apply_quantization(onnx_path):
    """Apply 4-bit quantization to ONNX model."""
    print("\n⚡ Applying 4-bit quantization (Q4)...")

    output_path = f"{onnx_path}-q4"

    # Configure quantization
    qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)

    print(f"📂 Loading ONNX model from {onnx_path}...")
    model = ORTModelForCausalLM.from_pretrained(onnx_path)

    print("🔧 Applying quantization...")
    model.quantize(save_dir=output_path, quantization_config=qconfig)

    # Copy tokenizer
    tokenizer = AutoTokenizer.from_pretrained(onnx_path)
    tokenizer.save_pretrained(output_path)

    print(f"✅ Quantized model saved to {output_path}")

    # Calculate approximate size
    import os
    model_size = sum(
        os.path.getsize(os.path.join(output_path, f))
        for f in os.listdir(output_path)
        if os.path.isfile(os.path.join(output_path, f))
    )
    size_mb = model_size / (1024 * 1024)
    print(f"📦 Approximate model size: {size_mb:.2f} MB")

    return output_path

def main():
    print("🚀 Starting ONNX conversion pipeline\n")
    print("=" * 60)

    # Step 1: Merge LoRA weights
    print("\n📍 STEP 1: Merging LoRA weights with base model")
    print("-" * 60)
    merged_path = merge_lora_weights()

    # Step 2: Convert to ONNX
    print("\n📍 STEP 2: Converting to ONNX format")
    print("-" * 60)
    onnx_path = convert_to_onnx(merged_path)

    # Step 3: Apply quantization
    print("\n📍 STEP 3: Applying 4-bit quantization")
    print("-" * 60)
    quantized_path = apply_quantization(onnx_path)

    print("\n" + "=" * 60)
    print("✨ Conversion pipeline complete!")
    print("\n📦 Final outputs:")
    print(f"   • Merged model: {merged_path}")
    print(f"   • ONNX model: {onnx_path}")
    print(f"   • Quantized ONNX (Q4): {quantized_path}")
    print("\n🎉 Your model is ready for Transformers.js!")
    print(f"   Use the model from: {quantized_path}")

if __name__ == "__main__":
    main()
