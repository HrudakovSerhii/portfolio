# Local Training Guide - Mac M2

## Quick Start

### 1. Install Dependencies

```bash
cd model-training
pip3 install -r requirements.txt
```

**Note:** This will download ~2-3GB of packages. Takes 5-10 minutes.

### 2. Run Training

```bash
python3 train_local.py
```

## What to Expect

### First Time Setup (~10 minutes)
```
🚀 Starting Local Training on Mac M2
============================================================
✅ Apple Silicon (MPS) detected - using GPU acceleration
Device: mps
============================================================

📂 Loading training data...
✅ Loaded 568 training examples

🔧 Loading tokenizer...
✅ Tokenizer loaded

🤖 Loading base model: Qwen/Qwen2.5-0.5B-Instruct
⏳ This may take a few minutes...
```

**Download size:** ~1GB for Qwen2.5-0.5B model

### Training Progress
```
🎓 Starting training...
============================================================
📊 You can monitor progress with TensorBoard:
   tensorboard --logdir ./serhii-qwen-lora-v2/logs
============================================================

Epoch 1/5:  10%|████      | 50/500 [02:15<20:30, 2.73s/it]
  train_loss: 2.134
  learning_rate: 0.0001

Epoch 1/5:  20%|████████  | 100/500 [04:30<18:15, 2.74s/it]
  train_loss: 1.856
  eval_loss: 1.923
```

### Estimated Training Time

**On Mac Mini M2 16GB:**
- **Total time:** 2-3 hours
- **Per epoch:** ~30-40 minutes
- **5 epochs total**

**Memory usage:** ~8-10GB RAM

### Completion
```
✨ Training complete!
============================================================
📦 Model saved to: ./serhii-qwen-lora-v2
⏱️  Training time: 2h 34m 12s

📊 Training metrics:
   Final training loss: 0.645
   Final eval loss: 0.721

🎯 Next steps:
   1. Test the model
   2. Convert to ONNX for browser use
   3. Push to HuggingFace Hub (optional)
```

## Monitoring Training

### Option 1: Watch Console Output

The training script shows progress in terminal:
- Loss values every 10 steps
- Evaluation every 50 steps
- Progress bar with ETA

### Option 2: TensorBoard (Real-time Graphs)

Open a new terminal window:

```bash
cd model-training
tensorboard --logdir ./serhii-qwen-lora-v2/logs
```

Then open browser: http://localhost:6006

You'll see graphs for:
- Training loss (should decrease)
- Eval loss (should decrease)
- Learning rate (increases then stays constant)

## Configuration Details

### Model
- **Base:** Qwen/Qwen2.5-0.5B-Instruct (500M params)
- **Method:** LoRA (Low-Rank Adaptation)
- **Trainable:** 1.8M params (~0.36% of total)

### Training Settings
- **Epochs:** 5 (vs 3 previously)
- **Batch size:** 2 (per device)
- **Gradient accumulation:** 8 (effective batch = 16)
- **Learning rate:** 3e-4 (higher than before)
- **LoRA rank:** 32 (vs 16 previously)

### Why These Settings?

**More epochs (5 vs 3):**
- Better model needs more training
- 568 examples need multiple passes

**Smaller batch (2 vs 4):**
- Fits in 16GB RAM
- Gradient accumulation maintains effective batch size

**Higher LoRA rank (32 vs 16):**
- More capacity to learn your specific style
- Better results for larger base model

**Higher learning rate (3e-4 vs 2e-4):**
- Faster convergence
- Works well with LoRA

## Stopping Training Early

If you need to stop (Ctrl+C):
```
⚠️  Training interrupted by user
💾 Saving current state...
✅ Model saved!
```

The current progress is saved. You can:
1. Resume training (manually edit script)
2. Test the partially trained model
3. Start over

## Testing After Training

### Quick Test

```bash
cd test
python3 test_local_model.py
```

### What Good Results Look Like

```
Q: Tell me about your work at A-Dam
A: At A-Dam, I developed their web-shop platform using React and GraphQL.
   The new platform contributed to increasing the brand's yearly revenue
   by over 100%. We also migrated to NestJS...

✅ Contains: A-Dam, React, GraphQL, revenue, 100%
```

### What Bad Results Look Like

```
Q: Tell me about your work at A-Dam
A: I worked on various projects using different technologies...

❌ Missing: specific company names, metrics, details
```

## Memory Management

### If You Run Out of Memory

Edit `train_local.py`:

```python
# Reduce batch size
per_device_train_batch_size=1,  # Was 2

# Or reduce gradient accumulation
gradient_accumulation_steps=4,  # Was 8
```

### Checking Memory Usage

```bash
# In another terminal
top -o MEM
# Look for Python process
```

## Troubleshooting

### "MPS backend out of memory"

**Solution 1:** Reduce batch size
```python
per_device_train_batch_size=1
```

**Solution 2:** Use CPU (slower but works)
```python
# In train_local.py, change:
device = "cpu"  # Force CPU
```

### "No module named 'peft'"

```bash
pip3 install peft
```

### Training seems stuck

- Check Activity Monitor - Python should use 100-200% CPU
- Wait 5 minutes - first epoch is slowest
- Check tensorboard for progress

### Loss not decreasing

If after 1 epoch, loss is still > 2.0:
- Might need more epochs (wait for epoch 2)
- Check eval_loss - should be close to train_loss
- If eval_loss >> train_loss → overfitting

### Loss decreasing too fast

If loss drops to < 0.5 in epoch 1:
- Might be overfitting
- Check eval_loss - if it's increasing, stop training

## Expected Loss Values

### Good Training Pattern
```
Epoch 1: train=2.1, eval=2.3  ← Starting to learn
Epoch 2: train=1.4, eval=1.6  ← Good progress
Epoch 3: train=0.9, eval=1.1  ← Converging
Epoch 4: train=0.7, eval=0.8  ← Good fit
Epoch 5: train=0.6, eval=0.7  ← Excellent!
```

Gap between train/eval should stay < 0.3

### Bad Training Pattern (Overfitting)
```
Epoch 1: train=2.1, eval=2.3  ✅
Epoch 2: train=1.4, eval=1.6  ✅
Epoch 3: train=0.5, eval=1.8  ❌ Gap too large!
Epoch 4: train=0.2, eval=2.1  ❌ Overfitting!
```

If this happens, use earlier checkpoint.

## After Training

### 1. Test Locally

Create `test/test_local_model.py`:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")
model = PeftModel.from_pretrained(base_model, "../serhii-qwen-lora-v2")
tokenizer = AutoTokenizer.from_pretrained("../serhii-qwen-lora-v2")

# Test it!
```

### 2. Convert to ONNX

If tests are good, convert for browser use:

```bash
python3 convert_to_onnx_local.py
```

### 3. Upload to HuggingFace (Optional)

```bash
huggingface-cli login
huggingface-cli upload HrudakovSerhii/serhii-qwen-lora-v2 ./serhii-qwen-lora-v2
```

## Tips for Best Results

1. **Let it run overnight** - 2-3 hours uninterrupted
2. **Monitor tensorboard** - watch losses decrease
3. **Don't stop early** - needs all 5 epochs
4. **Test after each epoch** - can use checkpoints
5. **Close other apps** - free up RAM

## Files Created

```
model-training/
├── train_local.py              ← Main training script
├── requirements.txt             ← Dependencies
├── serhii-qwen-lora-v2/        ← Output (created during training)
│   ├── adapter_model.bin       ← LoRA weights (~7MB)
│   ├── adapter_config.json     ← LoRA config
│   ├── tokenizer files...      ← Tokenizer
│   └── logs/                   ← TensorBoard logs
└── LOCAL_TRAINING_GUIDE.md     ← This file
```

## Ready to Start?

```bash
cd model-training
pip3 install -r requirements.txt
python3 train_local.py
```

Good luck! 🚀