# Serhii Hrudakov AI - Model Training

Fine-tuned language model to respond as Serhii Hrudakov with different personas (HR, Developer, Friend) for interactive portfolio.

## Current Status (v3)

**Active Model:** Qwen2.5-0.5B-Instruct with LoRA (v3)
**Training:** Hugging Face Jobs (cloud GPU)
**Output:** ONNX format for browser deployment (Transformers.js)
**Final Size:** ~250MB quantized

### Key Parameters (Anti-Overfitting)

| Parameter | Value | Why |
|-----------|-------|-----|
| Epochs | **3** | Reduced from 10 (v2) |
| LoRA Rank | **32** | Reduced from 64 (v2) |
| Learning Rate | **2e-4** | Reduced from 5e-4 (v2) |
| Dropout | **0.1** | Increased from 0.05 |
| Weight Decay | **0.02** | Increased from 0.01 |
| Early Stopping | **Enabled** | New in v3 |

## Quick Start

```bash
# Submit training job to HF Jobs
hf jobs create train_hf_jobs.py \
  --name "serhii-qwen-lora-v3" \
  --hardware "a10" \
  --runtime "1h"

# See: HF_JOBS_TRAINING_GUIDE.md for full instructions
```

## Files Structure

```
model-training/
├── README.md                      # This file
├── HF_JOBS_TRAINING_GUIDE.md     # Complete training guide
├── IMPLEMENTATION_PATH.md         # RAG + LLM hybrid implementation
├── TRACKIO_METRICS_GUIDE.md      # Understanding training metrics
│
├── data/
│   └── cv-training-data.jsonl    # 569 Q&A pairs (system, user, assistant)
│
├── rag/                           # RAG knowledge base (embeddings)
│   ├── create_knowledge_base.py   # JSONL → structured chunks
│   ├── generate_embeddings.py     # sentence-transformers embeddings
│   ├── export_browser_embeddings.py  # Export to browser JSON
│   └── knowledge_base/
│       ├── chunks.json            # Structured Q&A chunks
│       ├── embeddings.npy         # 384-dim embeddings (gitignored)
│       └── embedding_metadata.json
│
├── train_hf_jobs.py              # HF Jobs training script (v3)
├── train_local.py                # Local training (Mac M2) - archived
├── test/
│   └── test_qwen_model.py        # Test model responses
│
└── serhii-qwen-lora-v2/          # Previous training output (v2)
```

## History & Learnings

### v1: SmolLM2-135M-Instruct (Abandoned)

**Issues:**
- Too small (135M params) - poor retention
- Multilingual contamination (Slavic language in responses)
- Hallucinating facts not in training data
- Quantization damage (INT8)

**Lesson:** Larger, English-focused model needed

### v2: Qwen2.5-0.5B-Instruct (Overfitting)

**Training:** Local Mac M2, 10 epochs, r=64, lr=5e-4
**Issues:**
- **Severe overfitting** - memorized training data
- Train loss: 0.42, Eval loss: 1.72 (gap: 1.3)
- 10 epochs = model saw each example 10 times
- High LoRA rank (64) = too much capacity to memorize

**Lesson:** Reduce epochs, LoRA rank, learning rate; add early stopping

### v3: Qwen2.5-0.5B-Instruct (Current)

**Training:** HF Jobs (cloud GPU), 3 epochs, r=32, lr=2e-4
**Improvements:**
- ✅ 3 epochs instead of 10 (70% reduction)
- ✅ LoRA rank 32 instead of 64 (50% reduction)
- ✅ Learning rate 2e-4 instead of 5e-4 (60% reduction)
- ✅ Dropout 0.1 instead of 0.05 (2x regularization)
- ✅ Weight decay 0.02 instead of 0.01
- ✅ Early stopping (patience=3)
- ✅ Cosine LR schedule

**Expected:** Better generalization, no hallucinations, factual responses

## RAG Knowledge Base

**Purpose:** Hybrid RAG + LLM system for factual grounding

### Pipeline (Completed)

1. **Extract knowledge:** `create_knowledge_base.py`
   - Input: `cv-training-data.jsonl` (569 examples)
   - Output: `chunks.json` (structured with categories, keywords, companies)

2. **Generate embeddings:** `generate_embeddings.py`
   - Model: sentence-transformers/all-MiniLM-L6-v2 (384-dim)
   - Output: `embeddings.npy` (569 vectors, L2 normalized)
   - Text format: "Q: {question}\nA: {content}"

3. **Export for browser:** `export_browser_embeddings.py`
   - Role filtering: hr → professional, developer → technical, friend → personal
   - Output: `public/data/embeddings-{role}.json` (browser-loadable)
   - Total size: 6.1 MB (split by role)

**Browser Integration:** cv-data-service.js loads embeddings, chat-bot-qa-router.js performs vector search

## Training Data

**Format:** JSONL with 569 conversation examples

```
{"messages":[
  {"role":"system","content":"You are Serhii Hrudakov. Speaking to {persona}"},
  {"role":"user","content":"Question"},
  {"role":"assistant","content":"Answer"}
]}
```

**Personas:**
- Recruiter (HR): 174 examples → professional focus
- Senior Engineer: 226 examples → technical focus
- Friend: 169 examples → personal focus

**Coverage:**
- 10 categories (technical_project, professional_leadership, personal_outdoor, etc.)
- 10 companies (Hexaware, Mobiquity, EriksDigital, A-Dam, etc.)
- Keywords: Technologies, metrics, project names

## Common Mistakes to Avoid

### ❌ DON'T

1. **Train for too many epochs**
   - v2: 10 epochs → overfitting
   - v3: 3 epochs (for 569 examples)

2. **Use too high LoRA rank**
   - High rank = model can memorize instead of generalize
   - v2: r=64 → overfitting
   - v3: r=32

3. **Use aggressive learning rate**
   - High LR with many epochs = unstable overfitting
   - v2: 5e-4 → too fast
   - v3: 2e-4 with cosine decay

4. **Ignore evaluation metrics**
   - Watch the gap: `eval_loss - train_loss`
   - Gap > 0.5 = overfitting

5. **Skip early stopping**
   - v2: Trained all 10 epochs even as eval loss increased
   - v3: Stops automatically if no improvement

### ✅ DO

1. **Monitor Trackio metrics** (see TRACKIO_METRICS_GUIDE.md)
   - Check every 15 minutes during training
   - Stop if eval loss increases while train decreases

2. **Use appropriate hardware**
   - A10 GPU: ~45min, ~$0.80 (recommended)
   - T4 GPU: ~1h, ~$0.50 (budget)

3. **Test incrementally**
   - Use checkpoints (saved every 50 steps)
   - Test responses before converting to ONNX

4. **Validate generalization**
   - Test with questions NOT in training data
   - Ensure factual responses, no hallucinations

## Expected Training Metrics (Healthy)

```
Step    Train Loss    Eval Loss    Gap     Status
0       3.2          3.4          0.2     ✅ Starting
100     1.8          2.0          0.2     ✅ Learning
200     1.2          1.4          0.2     ✅ Improving
300     0.7          0.9          0.2     ✅ Excellent
```

**Red Flags:**
- Gap > 0.5 → Overfitting
- Eval loss increasing → Stop training
- Train loss < 0.3 → Likely memorizing

## Next Steps After Training

1. **Test model responses**
   ```bash
   cd test
   python3 test_qwen_model.py
   ```

2. **Verify no overfitting**
   - Check final train/eval gap < 0.3
   - Test with unseen questions

3. **Convert to ONNX** (if satisfied)
   ```bash
   python3 convert_to_onnx.py
   ```

4. **Deploy to browser**
   - Integrate with portfolio chat UI
   - Use transformers.js for client-side inference

## Resources

- **Training:** HF_JOBS_TRAINING_GUIDE.md
- **Metrics:** TRACKIO_METRICS_GUIDE.md
- **RAG Implementation:** IMPLEMENTATION_PATH.md
- **Model Hub:** https://huggingface.co/HrudakovSerhii

## Cost Estimate

**HF Jobs (v3):**
- Hardware: A10 GPU
- Duration: ~45 minutes
- Cost: ~$0.80 per training run

**RAG Embeddings:**
- Free (runs locally)
- Time: ~3 seconds for 569 embeddings

## Hardware Requirements

**HF Jobs (Cloud):**
- No local requirements
- Runs on HF infrastructure

**Local Testing:**
- 8GB RAM minimum
- 16GB RAM recommended
- Python 3.10+