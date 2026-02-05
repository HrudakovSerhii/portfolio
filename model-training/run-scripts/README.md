# Model Training & Conversion Scripts

Scripts for training and converting models on Hugging Face Jobs infrastructure.

## Prerequisites

- Hugging Face account with Pro/Team plan (for Jobs)
- `HF_TOKEN` with write permissions
- Dataset uploaded to HF Hub

## 1. DPO Training (`train_hf_jobs.py`)

Trains TinyLlama-1.1B using Direct Preference Optimization with LoRA.

**Run command:**
```bash
hf jobs uv run --flavor a10g-large --timeout 2h --secrets HF_TOKEN train_hf_jobs.py
```

**Configuration (edit in script):**
```python
BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
DATASET_NAME = "HrudakovSerhii/portfolio-dpo-dataset"
HUB_MODEL_ID = "HrudakovSerhii/tinyllama-1.1b-rag-cv-v1"
```

**Output:** LoRA adapter uploaded to Hub

---

## 2. GGUF Conversion (Merge + Quantize)

Merges LoRA adapter with base model and converts to GGUF Q4_K_M for browser deployment.

**Run via MCP or save as `convert_to_gguf_hf.py`:**

```python
# /// script
# dependencies = ["torch", "transformers", "peft", "huggingface_hub", "sentencepiece", "protobuf", "gguf"]
# ///

import os
import subprocess
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from huggingface_hub import HfApi

# Configuration
BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
LORA_ADAPTER = "HrudakovSerhii/tinyllama-1.1b-rag-cv-v1"
OUTPUT_REPO = "HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf"

print("[1/6] Installing cmake...")
subprocess.run(["apt-get", "update", "-qq"], check=True)
subprocess.run(["apt-get", "install", "-y", "-qq", "cmake", "build-essential"], check=True)

print("[2/6] Loading and merging model...")
base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float16, device_map="auto")
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model = PeftModel.from_pretrained(base_model, LORA_ADAPTER)
merged = model.merge_and_unload()

MERGED_DIR = "./merged"
merged.save_pretrained(MERGED_DIR, safe_serialization=True)
tokenizer.save_pretrained(MERGED_DIR)
print("Model merged and saved")

print("[3/6] Setting up llama.cpp...")
subprocess.run(["git", "clone", "--depth=1", "https://github.com/ggerganov/llama.cpp.git"], check=True)
subprocess.run(["pip", "install", "-q", "-r", "llama.cpp/requirements/requirements-convert_hf_to_gguf.txt"], check=True)

print("[4/6] Converting to F16 GGUF...")
F16_FILE = "model-f16.gguf"
subprocess.run(["python", "llama.cpp/convert_hf_to_gguf.py", MERGED_DIR, "--outfile", F16_FILE, "--outtype", "f16"], check=True)
print(f"F16 created: {os.path.getsize(F16_FILE)/1024/1024:.1f} MB")

print("[5/6] Building quantizer and quantizing to Q4_K_M...")
os.makedirs("llama.cpp/build", exist_ok=True)
subprocess.run(["cmake", ".."], cwd="llama.cpp/build", check=True)
subprocess.run(["cmake", "--build", ".", "--config", "Release", "-j", "4"], cwd="llama.cpp/build", check=True)

Q4_FILE = "tinyllama-1.1b-rag-cv-q4_k_m.gguf"
subprocess.run(["llama.cpp/build/bin/llama-quantize", F16_FILE, Q4_FILE, "Q4_K_M"], check=True)
size_mb = os.path.getsize(Q4_FILE) / (1024 * 1024)
print(f"Q4_K_M created: {size_mb:.1f} MB")

print("[6/6] Uploading...")
api = HfApi()
api.upload_file(path_or_fileobj=Q4_FILE, path_in_repo=Q4_FILE, repo_id=OUTPUT_REPO)

print(f"\nDone! https://huggingface.co/{OUTPUT_REPO}")
print(f"File: {Q4_FILE} ({size_mb:.1f} MB)")
```

**Run command:**
```bash
hf jobs uv run --flavor a10g-large --timeout 45m --secrets HF_TOKEN convert_to_gguf_hf.py
```

**Output:** Q4_K_M GGUF (~637MB) uploaded to Hub

---

## 3. Upload Tokenizer Files (if missing)

If GGUF conversion fails due to missing tokenizer, run this:

```python
# /// script
# dependencies = ["huggingface_hub", "transformers"]
# ///

from huggingface_hub import HfApi, hf_hub_download

BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
OUTPUT_REPO = "HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf"

api = HfApi()
files = ["tokenizer.model", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"]

for f in files:
    try:
        path = hf_hub_download(repo_id=BASE_MODEL, filename=f)
        api.upload_file(path_or_fileobj=path, path_in_repo=f, repo_id=OUTPUT_REPO)
        print(f"Uploaded: {f}")
    except Exception as e:
        print(f"Skipped {f}: {e}")
```

---

## Quick Reference

| Task | Hardware | Timeout | Command |
|------|----------|---------|---------|
| DPO Training | a10g-large | 2h | `hf jobs uv run --flavor a10g-large --timeout 2h --secrets HF_TOKEN train_hf_jobs.py` |
| GGUF Conversion | a10g-large | 45m | `hf jobs uv run --flavor a10g-large --timeout 45m --secrets HF_TOKEN convert_to_gguf_hf.py` |
| Tokenizer Upload | cpu-basic | 10m | `hf jobs uv run --flavor cpu-basic --timeout 10m --secrets HF_TOKEN upload_tokenizer.py` |

## Output Models

| File | Size | Use Case |
|------|------|----------|
| `tinyllama-1.1b-rag-cv-q8_0.gguf` | 1.1GB | Higher quality, local testing |
| `tinyllama-1.1b-rag-cv-q4_k_m.gguf` | 637MB | Browser deployment |

## Testing with Ollama

```bash
# Q4_K_M (smaller)
ollama run hf.co/HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf:q4_k_m

# Q8_0 (higher quality)
ollama run hf.co/HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf:q8_0
```

## Important Notes

1. **Ephemeral environment**: HF Jobs environment is temporary - always push to Hub
2. **Can't requantize Q8_0**: Must go F16 → Q4_K_M (not Q8_0 → Q4_K_M)
3. **cmake required**: For quantization, install cmake via apt-get
4. **Tokenizer files**: Ensure tokenizer.model is uploaded for GGUF spaces to work
