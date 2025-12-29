# Model Quality Improvement Plan

## Current Issues

### Test Results Analysis
1. ❌ **Hallucinating facts** not in training data (Amazon MTR, Angular/Inflection)
2. ❌ **Language contamination** (Slavic language in response #3)
3. ❌ **Not recalling training examples** (should mention A-Dam, EriksDigital, specific projects)
4. ❌ **Wrong technical details** (says NodeJS focus instead of React)

### Root Causes
1. **Base model too small and multilingual** (smolLM2-135M)
2. **Possible quantization damage** (INT8 quantization)
3. **Training configuration** (LoRA rank, epochs)

---

## 🎯 Solution 1: Better Base Model (RECOMMENDED)

### Option A: Qwen2.5-0.5B (English-focused, larger)
**Best balance of size and quality**

```yaml
Base Model: Qwen/Qwen2.5-0.5B-Instruct
Size: 500M parameters (vs 135M)
Language: Primarily English
Training: Same LoRA approach
Expected size: ~1GB ONNX, ~250MB quantized
Quality: Much better, more stable
```

**Pros:**
- ✅ Larger model = better retention
- ✅ Primarily English-focused
- ✅ Better instruction following
- ✅ Still runs in browser

**Cons:**
- ⚠️ Larger file size (~250MB vs 136MB)
- ⚠️ Slightly slower inference

### Option B: SmolLM2-360M-Instruct (English-only)
**Same family, 3x bigger**

```yaml
Base Model: HuggingFaceTB/SmolLM2-360M-Instruct
Size: 360M parameters
Language: English-only variant
Expected size: ~700MB ONNX, ~180MB quantized
```

**Pros:**
- ✅ Same model family (easier comparison)
- ✅ English-only version available
- ✅ Better capacity for your data

**Cons:**
- ⚠️ Larger than Qwen2.5-0.5B

### Option C: Phi-2 (High quality, English)
**Microsoft's model, very high quality**

```yaml
Base Model: microsoft/phi-2
Size: 2.7B parameters
Language: English
Expected size: ~5GB ONNX, ~1.3GB quantized
Quality: Excellent
```

**Pros:**
- ✅ Very high quality responses
- ✅ Strong English language model
- ✅ Better at following instructions

**Cons:**
- ⚠️ Much larger (may be too big for browser)
- ⚠️ Slower inference

---

## 🎯 Solution 2: Test Without Quantization

**Immediate test:** Use full ONNX model to see if quantization is the issue

```python
# Test with FULL model (518MB, no quantization)
model = ORTModelForCausalLM.from_pretrained("HrudakovSerhii/serhii-smollm-onnx")
```

**If this works better:**
- Problem is quantization
- Use full model or try different quantization (FP16 instead of INT8)

**If this still has issues:**
- Problem is base model or training
- Need to retrain with different base model

---

## 🎯 Solution 3: Improve Training Configuration

### Better LoRA Settings

```python
LoraConfig(
    r=32,              # Double the rank (was 16)
    lora_alpha=64,     # Double the alpha (was 32)
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
```

### More Training

```python
SFTConfig(
    num_train_epochs=5,              # Increase from 3 to 5
    per_device_train_batch_size=2,   # Smaller batch
    gradient_accumulation_steps=8,    # More accumulation
    learning_rate=3e-4,               # Slightly higher LR
    warmup_steps=100,                 # More warmup
)
```

---

## 🎯 Solution 4: Better Dataset Preparation

### Add More Diverse Examples

Your current dataset has 568 examples. Consider:
1. **Add more varied questions** for each topic
2. **Include edge cases** (unusual questions)
3. **Add negative examples** (what NOT to say)

### Improve System Prompts

Make them more specific:

```json
{
  "role": "system",
  "content": "You are Serhii Hrudakov, a Senior Frontend Engineer with 10+ years experience. You worked at DigitalChefs, A-Dam, EriksDigital, and Hexaware/Mobiquity. You specialize in React, NextJS, TypeScript, and have led complex migrations. You are speaking to a Recruiter. ONLY provide factual information from your real experience. Do not invent or hallucinate information."
}
```

---

## 📊 Recommended Action Plan

### Phase 1: Quick Tests (Today)

1. **Test without quantization** (5 min)
   ```bash
   # Edit test_model.py, change model to:
   MODEL_NAME = "HrudakovSerhii/serhii-smollm-onnx"  # Full model
   ```

2. **Check training logs** - Did loss decrease properly?
   - Login to Trackio: https://huggingface.co/HrudakovSerhii/trackio
   - Check final train/eval loss values

### Phase 2: Retrain with Better Base Model (1-2 hours)

**Recommended: Qwen2.5-0.5B**

```python
# New training configuration
trainer = SFTTrainer(
    model="Qwen/Qwen2.5-0.5B-Instruct",  # Better base model
    train_dataset=dataset_split["train"],
    eval_dataset=dataset_split["test"],
    peft_config=LoraConfig(
        r=32,                # Higher rank
        lora_alpha=64,       # Higher alpha
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    ),
    args=SFTConfig(
        output_dir="serhii-lora-qwen-v2",
        push_to_hub=True,
        hub_model_id="HrudakovSerhii/serhii-qwen-lora-v2",
        num_train_epochs=5,              # More epochs
        per_device_train_batch_size=2,   # Smaller batch
        gradient_accumulation_steps=8,   # More accumulation
        learning_rate=3e-4,              # Higher LR
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=100,
    )
)
```

### Phase 3: Better Quantization (If needed)

Try **FP16 quantization** instead of INT8:
- Better quality than INT8
- Smaller than full model
- Good compromise

---

## 🎯 My Recommendation

### Immediate (Next 10 minutes):
1. ✅ Test with full ONNX model (no quantization)
2. ✅ Run the test script with these questions:
   - "Tell me about your work at A-Dam"
   - "What was your biggest business impact?"
   - "Describe the EriksDigital migration"

### If full model also fails:
**Retrain with Qwen2.5-0.5B** - This will solve:
- ❌ Multilingual contamination
- ❌ Model too small
- ❌ Better English understanding

### Expected Results with Qwen2.5-0.5B:
```
Q: Tell me about your work at A-Dam
A: At A-Dam, I developed their web-shop platform using React and GraphQL.
   The new platform contributed to increasing the brand's yearly revenue by
   over 100%. We also migrated to NestJS, which boosted performance and
   helped retain about 75% of clients.
```

This should be factual and match your training data exactly.

---

## 📝 Next Steps

1. **Run this test NOW**:
   ```bash
   cd model-training/test
   # Edit test_model.py line 13 to use full model
   python3 test_model.py
   ```

2. **Share results** - If still bad, we retrain immediately

3. **Choose base model** - I recommend Qwen2.5-0.5B

Would you like me to:
- A) Create a test script for the full (non-quantized) model?
- B) Submit a new training job with Qwen2.5-0.5B right now?
- C) Both?