# /// script
# dependencies = ["torch", "transformers", "peft", "huggingface_hub", "sentencepiece", "protobuf", "gguf"]
# ///
"""
Merge LoRA adapter with base model and convert to GGUF Q4_K_M

Run with: hf jobs uv run --flavor a10g-large --timeout 45m --secrets HF_TOKEN convert_to_gguf_hf.py
"""

import os
import subprocess
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from huggingface_hub import HfApi

# ============================================================================
# Configuration
# ============================================================================
BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
LORA_ADAPTER = "HrudakovSerhii/tinyllama-1.1b-rag-cv-v1"
OUTPUT_REPO = "HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf"
QUANT_TYPE = "Q4_K_M"

print("=" * 60)
print("LoRA Merge + GGUF Conversion")
print(f"Base: {BASE_MODEL}")
print(f"LoRA: {LORA_ADAPTER}")
print(f"Output: {OUTPUT_REPO}")
print(f"Quantization: {QUANT_TYPE}")
print("=" * 60)

# ============================================================================
# Step 1: Install build tools
# ============================================================================
print("\n[1/6] Installing cmake...")
subprocess.run(["apt-get", "update", "-qq"], check=True)
subprocess.run(["apt-get", "install", "-y", "-qq", "cmake", "build-essential"], check=True)

# ============================================================================
# Step 2: Load and merge model
# ============================================================================
print("\n[2/6] Loading and merging model...")
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model = PeftModel.from_pretrained(base_model, LORA_ADAPTER)
merged = model.merge_and_unload()

MERGED_DIR = "./merged"
merged.save_pretrained(MERGED_DIR, safe_serialization=True)
tokenizer.save_pretrained(MERGED_DIR)
print("Model merged and saved")

# ============================================================================
# Step 3: Setup llama.cpp
# ============================================================================
print("\n[3/6] Setting up llama.cpp...")
subprocess.run(["git", "clone", "--depth=1", "https://github.com/ggerganov/llama.cpp.git"], check=True)
subprocess.run(["pip", "install", "-q", "-r", "llama.cpp/requirements/requirements-convert_hf_to_gguf.txt"], check=True)

# ============================================================================
# Step 4: Convert to F16 GGUF
# ============================================================================
print("\n[4/6] Converting to F16 GGUF...")
F16_FILE = "model-f16.gguf"
subprocess.run([
    "python", "llama.cpp/convert_hf_to_gguf.py",
    MERGED_DIR,
    "--outfile", F16_FILE,
    "--outtype", "f16"
], check=True)
f16_size = os.path.getsize(F16_FILE) / (1024 * 1024)
print(f"F16 created: {f16_size:.1f} MB")

# ============================================================================
# Step 5: Build quantizer and quantize
# ============================================================================
print(f"\n[5/6] Building quantizer and quantizing to {QUANT_TYPE}...")
os.makedirs("llama.cpp/build", exist_ok=True)
subprocess.run(["cmake", ".."], cwd="llama.cpp/build", check=True)
subprocess.run(["cmake", "--build", ".", "--config", "Release", "-j", "4"], cwd="llama.cpp/build", check=True)

# Generate output filename from config
model_name = LORA_ADAPTER.split("/")[-1].replace("-v1", "")
Q4_FILE = f"{model_name}-{QUANT_TYPE.lower()}.gguf"

subprocess.run([
    "llama.cpp/build/bin/llama-quantize",
    F16_FILE,
    Q4_FILE,
    QUANT_TYPE
], check=True)

size_mb = os.path.getsize(Q4_FILE) / (1024 * 1024)
print(f"{QUANT_TYPE} created: {size_mb:.1f} MB")

# ============================================================================
# Step 6: Upload to Hub
# ============================================================================
print("\n[6/6] Uploading to Hub...")
api = HfApi()

# Create repo if needed
try:
    api.create_repo(OUTPUT_REPO, exist_ok=True, repo_type="model")
except Exception as e:
    print(f"Repo exists or error: {e}")

# Upload GGUF file
api.upload_file(
    path_or_fileobj=Q4_FILE,
    path_in_repo=Q4_FILE,
    repo_id=OUTPUT_REPO
)

# Upload tokenizer files
for f in os.listdir(MERGED_DIR):
    if f.endswith('.json') or f == 'tokenizer.model':
        api.upload_file(
            path_or_fileobj=os.path.join(MERGED_DIR, f),
            path_in_repo=f,
            repo_id=OUTPUT_REPO
        )

# ============================================================================
# Done
# ============================================================================
print("\n" + "=" * 60)
print("CONVERSION COMPLETE!")
print("=" * 60)
print(f"Model: https://huggingface.co/{OUTPUT_REPO}")
print(f"File: {Q4_FILE} ({size_mb:.1f} MB)")
print("=" * 60)
