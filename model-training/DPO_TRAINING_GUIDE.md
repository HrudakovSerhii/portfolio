# DPO Training Guide: RAG-Optimized TinyLlama-1.1B

## Overview

This guide explains how to train TinyLlama-1.1B using **Direct Preference Optimization (DPO)** to improve instruction following and RAG context adherence for your CV chatbot.

### The Problem

Your current 0.5B model:
- ❌ Re-invents or hallucinates information
- ❌ Misses important context from RAG chunks
- ❌ Poor instruction following despite SFT training

### The Solution: DPO Training

DPO teaches the model to **prefer** responses that:
- ✅ Faithfully use RAG context
- ✅ Avoid hallucination and invention
- ✅ Follow the role-specific instruction style (HR, Engineer, Friend)

---

## DPO Dataset Structure

### Format

Each training example contains:
- **`prompt`**: User query + RAG context (with markers)
- **`chosen`**: GOOD response (uses RAG context correctly)
- **`rejected`**: BAD response (generic, ignores context, or hallucinates)

### Example

```json
{
  "prompt": "Context: [RAG_START]At EriksDigital, I migrated a monolith built on WebSphere to a hybrid micro-frontend architecture. We improved Google Lighthouse performance scores significantly.[RAG_END]\n\nYou are Serhii Hrudakov. You are speaking to a Senior Engineer.\n\nUser: Tell me about a legacy migration project.",

  "chosen": "At EriksDigital, I migrated a massive monolith built on WebSphere to a hybrid micro-frontend architecture. It involved reverse-engineering old modules that were poorly documented. Despite the system constraints, we managed to improve Google Lighthouse performance scores significantly.",

  "rejected": "I have experience with various migration projects. I once worked on modernizing a large enterprise application by breaking it down into smaller services. The project involved updating old code and implementing new patterns to improve overall performance."
}
```

### Why This Works

**Chosen response:**
- Uses EXACT details from RAG context (EriksDigital, WebSphere, micro-frontend, Lighthouse)
- Maintains Serhii's voice and specificity
- Stays grounded in provided facts

**Rejected response:**
- Generic and vague ("various projects", "large enterprise")
- Invents details not in RAG context
- Could apply to anyone

DPO training teaches the model to maximize the probability of "chosen" and minimize "rejected".

---

## Dataset: `rag-dpo-preference-data.jsonl`

### Created Dataset

I've created 15 preference pairs based on your existing training data:

| Category | Count | Examples |
|----------|-------|----------|
| **Technical (Engineer)** | 8 | Migration projects, tech stack, architecture decisions |
| **Leadership (HR)** | 5 | Business impact, team conflict, career decisions |
| **Personal (Friend)** | 2 | Hiking stories, vacation, books |

**Location:** `/model-training/data/rag-dpo-preference-data.jsonl`

### Key Patterns

Each rejected response exhibits one or more problems:
1. **Generic language** - Could apply to anyone
2. **Missing specifics** - No company names, metrics, or technical details
3. **Vague outcomes** - "Improved performance" vs "5x faster page loads, 100% revenue increase"
4. **Wrong tone** - Formal when should be casual, or vice versa

---

## Training Process

### Step 1: Upload Dataset to Hugging Face Hub

```bash
# Install Hugging Face CLI
pip install huggingface-hub

# Login (you'll need your HF_TOKEN)
huggingface-cli login

# Create dataset repository
huggingface-cli repo create rag-cv-preference-data --type dataset

# Upload dataset
huggingface-cli upload rag-cv-preference-data \
  model-training/data/rag-dpo-preference-data.jsonl \
  rag-dpo-preference-data.jsonl
```

### Step 2: Submit Training Job

**Option A: Using MCP Tool (Recommended)**

```python
hf_jobs("uv", {
    "script": open("model-training/train_tinyllama_dpo.py").read(),
    "flavor": "a10g-large",
    "timeout": "3h",
    "secrets": {"HF_TOKEN": "$HF_TOKEN"}
})
```

**Option B: Using HF Jobs CLI**

```bash
hf jobs uv run \
  --flavor a10g-large \
  --timeout 3h \
  --secrets HF_TOKEN \
  "model-training/train_tinyllama_dpo.py"
```

### Step 3: Monitor Training

**Trackio Dashboard:**
- URL: `https://huggingface.co/spaces/HrudakovSerhii/trackio`
- Run name: `tinyllama-rag-dpo-v1`
- Metrics to watch:
  - `train/loss` - Should decrease over time
  - `eval/loss` - Should track train loss (not diverge)
  - `train/rewards/chosen` - Should increase (model prefers good responses)
  - `train/rewards/rejected` - Should decrease (model dislikes bad responses)

**Expected Training Time:** 2-3 hours on a10g-large

---

## After Training: GGUF Conversion

### Why GGUF?

Your target is **200-550MB** for browser deployment. TinyLlama-1.1B at full precision is ~2.2GB, so quantization is required.

### Conversion Script

Save this as `convert_to_gguf.py`:

```python
# /// script
# dependencies = ["huggingface_hub"]
# ///

import subprocess
import os
from huggingface_hub import HfApi, login

# Authenticate
login(os.environ["HF_TOKEN"])

# Configuration
ADAPTER_MODEL = "HrudakovSerhii/tinyllama-1.1b-rag-cv-v1"  # Your trained model
BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
OUTPUT_REPO = "HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf"

# Clone llama.cpp
subprocess.run(["git", "clone", "https://github.com/ggerganov/llama.cpp"], check=True)
os.chdir("llama.cpp")

# Build
subprocess.run(["make", "LLAMA_CUDA=1"], check=True)

# Download model
from huggingface_hub import snapshot_download
model_path = snapshot_download(ADAPTER_MODEL)

# Convert to GGUF
subprocess.run([
    "python3", "convert_hf_to_gguf.py",
    model_path,
    "--outfile", "model-f16.gguf",
    "--outtype", "f16"
], check=True)

# Quantize to multiple levels
quants = {
    "Q8_0": "~1.2GB (minimal quality loss)",
    "Q6_K": "~900MB (very small quality loss)",
    "Q5_K_M": "~750MB (small quality loss)",
    "Q4_K_M": "~650MB (moderate quality loss)",
    "Q4_0": "~550MB (acceptable quality loss) ← TARGET",
    "Q3_K_M": "~450MB (noticeable quality loss)",
    "Q2_K": "~350MB (significant quality loss)"
}

for quant, desc in quants.items():
    print(f"Creating {quant} - {desc}")
    subprocess.run([
        "./llama-quantize",
        "model-f16.gguf",
        f"model-{quant}.gguf",
        quant
    ], check=True)

# Upload all to Hub
api = HfApi()
api.create_repo(OUTPUT_REPO, repo_type="model", exist_ok=True)

for quant in quants.keys():
    print(f"Uploading {quant}...")
    api.upload_file(
        path_or_fileobj=f"model-{quant}.gguf",
        path_in_repo=f"model-{quant}.gguf",
        repo_id=OUTPUT_REPO,
        repo_type="model"
    )

print("All quantizations uploaded!")
```

### Submit Conversion Job

```python
hf_jobs("uv", {
    "script": open("convert_to_gguf.py").read(),
    "flavor": "a10g-large",
    "timeout": "1h",
    "secrets": {"HF_TOKEN": "$HF_TOKEN"}
})
```

---

## Testing Your Model

### 1. Download Quantized Model

```bash
huggingface-cli download HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf model-Q4_0.gguf
```

### 2. Test with llama.cpp

```bash
# Install llama.cpp locally
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# Test inference
./llama-cli -m model-Q4_0.gguf -p "Context: [RAG_START]At EriksDigital...[RAG_END]\n\nYou are Serhii Hrudakov speaking to a Senior Engineer.\n\nUser: Tell me about a legacy migration project.\nAssistant:"
```

### 3. Integrate with Your RAG Pipeline

Update `src/scripts/workers/optimized-ml-worker.js`:

```javascript
// Replace model path
const MODEL_PATH = "HrudakovSerhii/tinyllama-1.1b-rag-cv-gguf/model-Q4_0.gguf";
```

---

## Expected Results

### Quality Improvements

**Before DPO (0.5B model):**
- Generic responses
- Ignores RAG context
- Invents information

**After DPO (TinyLlama-1.1B):**
- Grounded in RAG chunks
- Uses specific details
- Maintains role-appropriate tone

### Size Comparison

| Model | Precision | Size | Browser Compatible |
|-------|-----------|------|-------------------|
| Qwen 0.5B (current) | Q4_0 | ~300MB | ✅ Yes |
| TinyLlama 1.1B (proposed) | Q4_0 | ~550MB | ✅ Yes (with optimization) |
| TinyLlama 1.1B | Q6_K | ~900MB | ⚠️ Borderline |

### Trade-offs

**Pros:**
- Better instruction following
- More grounded responses
- 1.1B parameters > 0.5B (more capacity)

**Cons:**
- 550MB vs 300MB (1.8x larger)
- Slightly slower inference
- May need WebAssembly optimizations

---

## Cost Breakdown

| Task | Hardware | Time | Cost |
|------|----------|------|------|
| DPO Training | a10g-large | 2-3h | ~$12-15 |
| GGUF Conversion | a10g-large | 30-45min | ~$3-4 |
| **Total** | | | **~$15-19** |

---

## Troubleshooting

### "Dataset not found"

Make sure you uploaded to Hub:
```bash
huggingface-cli upload rag-cv-preference-data \
  model-training/data/rag-dpo-preference-data.jsonl \
  rag-dpo-preference-data.jsonl
```

Update script with your dataset name:
```python
DATASET_NAME = "YourUsername/rag-cv-preference-data"
```

### "Out of Memory"

Reduce batch size in `train_tinyllama_dpo.py`:
```python
per_device_train_batch_size=1,  # Was 2
gradient_accumulation_steps=16,  # Was 8
```

### "Model not improving"

Check Trackio metrics:
- `train/rewards/margins` - Should be positive and increasing
- `eval/loss` - Should decrease

If not improving, try:
1. Increase `beta` (stronger preference signal): `beta=0.2`
2. Lower learning rate: `learning_rate=2e-5`
3. Add more diverse preference pairs to dataset

---

## Next Steps

1. **Review the dataset** - `model-training/data/rag-dpo-preference-data.jsonl`
2. **Upload to Hub** - Create dataset repository
3. **Submit training job** - Use `train_tinyllama_dpo.py`
4. **Monitor on Trackio** - Watch metrics in real-time
5. **Convert to GGUF** - After training completes
6. **Test in browser** - Compare Q4_0 vs Q6_K vs current 0.5B

---

## Questions?

- **DPO vs SFT?** DPO is better for "preference learning" (choosing good responses over bad). SFT is better for learning new tasks.
- **Why TinyLlama?** Already well-trained (3T tokens), good instruction following baseline, Apache 2.0 license.
- **Can I use a smaller model?** Yes, but quality will suffer. Qwen2.5-0.5B with DPO is possible but has less capacity than TinyLlama-1.1B.
- **What about the 200MB target?** Unrealistic for quality 1.1B model. Q4_0 at 550MB is the practical minimum. Consider Q3_K_M (450MB) if quality is acceptable.

---

## References

- [TRL DPO Documentation](https://huggingface.co/docs/trl/dpo_trainer)
- [TinyLlama Model Card](https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0)
- [GGUF Quantization Guide](https://github.com/ggerganov/llama.cpp/blob/master/examples/quantize/README.md)
- [Trackio Monitoring](https://huggingface.co/spaces/huggingface/trackio)
