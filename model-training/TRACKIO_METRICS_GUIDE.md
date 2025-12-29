# Understanding Trackio Training Metrics

This guide explains the key metrics you'll see in your Trackio dashboard at https://huggingface.co/HrudakovSerhii/trackio

## 1. Training Loss (`train/loss`)

**What it means:** How well the model predicts the next token during training. Lower = better.

**How to read it:**
- Should **steadily decrease** over time
- Smooth downward curve indicates healthy learning
- Jagged/noisy is normal but should trend down

**Good vs Bad Values:**

```
✅ GOOD:
Step 0:    loss = 3.5  (starting point)
Step 100:  loss = 2.1  (decreasing)
Step 200:  loss = 1.4  (still decreasing)
Step 300:  loss = 0.8  (converging)
Final:     loss = 0.6  (low, model learned well)

Trend: 3.5 → 2.1 → 1.4 → 0.8 → 0.6 (steady decrease)

❌ BAD:
Step 0:    loss = 3.5
Step 100:  loss = 3.2  (barely decreasing - learning too slow)
Step 200:  loss = 3.4  (going back up - unstable)
Step 300:  loss = 4.8  (increasing - model diverging)

❌ BAD (Overfitting):
Step 0:    loss = 3.5
Step 100:  loss = 0.3  (too fast - likely overfitting)
Step 200:  loss = 0.05 (unrealistically low)
Step 300:  loss = 0.01 (model memorizing, not learning)
```

**Your Expected Range:**
- Start: 2.5-4.0
- Mid-training: 1.0-2.0
- End: 0.5-1.2 (for 568 examples, 3 epochs)

**Warning Signs:**
- Loss not decreasing after 50-100 steps → learning rate too low
- Loss exploding (going to 10+) → learning rate too high
- Loss goes to 0.01 very quickly → overfitting

---

## 2. Evaluation Loss (`eval/loss`)

**What it means:** How well the model performs on data it hasn't seen (10% validation set). This is the TRUE measure of learning.

**How to read it:**
- Should decrease similarly to training loss
- Compare to training loss to detect overfitting

**Good vs Bad Values:**

```
✅ GOOD (Healthy Learning):
Step    Train Loss    Eval Loss    Gap
100     2.1          2.3          0.2  ✅ Small gap
200     1.4          1.6          0.2  ✅ Small gap
300     0.8          0.9          0.1  ✅ Small gap

Pattern: Both decreasing, eval slightly higher (normal)

⚠️ WARNING (Overfitting Starting):
Step    Train Loss    Eval Loss    Gap
100     2.1          2.3          0.2  ✅ OK
200     1.4          1.8          0.4  ⚠️ Gap growing
300     0.8          1.6          0.8  ❌ Gap too large

Pattern: Train keeps decreasing, eval plateaus/increases

❌ BAD (Severe Overfitting):
Step    Train Loss    Eval Loss    Gap
100     2.1          2.3          0.2
200     0.5          2.1          1.6  ❌ Huge gap
300     0.1          2.4          2.3  ❌ Model memorizing training data

Pattern: Train → 0, Eval → stuck or increasing
```

**Your Expected Range:**
- Should be 0.1-0.3 higher than training loss
- If gap > 0.5, model is overfitting
- If eval loss starts increasing while train decreases → STOP TRAINING

**What to do if overfitting:**
- Stop training early (use best checkpoint)
- Increase dropout (currently 0.05, try 0.1)
- Reduce epochs (from 3 to 2)
- Add more training data

---

## 3. Learning Rate (`train/learning_rate`)

**What it means:** How big the steps are when updating the model. Your config uses 2e-4 (0.0002).

**How to read it:**
- Starts with warmup (50 steps, gradually increasing)
- Then stays constant or decreases
- You're using constant learning rate

**Good vs Bad Values:**

```
✅ GOOD (Your Configuration):
Step 0:    lr = 0.00001  (warmup starting)
Step 25:   lr = 0.0001   (warmup midpoint)
Step 50:   lr = 0.0002   (target reached)
Step 100:  lr = 0.0002   (constant)
Step 200:  lr = 0.0002   (constant)

Pattern: Smooth warmup, then stable

❌ BAD (If you see):
Step 0:    lr = 0.0002   (no warmup - can cause instability)
Step 100:  lr = 0.0      (lr went to zero - training stopped)
Step 200:  lr = 0.002    (10x too high - will diverge)
```

**Your Configuration:**
- Warmup: 50 steps (0 → 2e-4)
- Main training: 2e-4 (constant)
- This is appropriate for LoRA fine-tuning

**Typical Ranges:**
- Full fine-tuning: 1e-5 to 5e-5
- LoRA fine-tuning: 1e-4 to 3e-4 (you're using 2e-4 ✅)
- Pre-training: 1e-3 to 6e-3

---

## 4. Gradient Norm (`train/grad_norm`)

**What it means:** Size of the gradients (updates to the model). Indicates training stability.

**How to read it:**
- Should be stable, not exploding
- Some variation is normal
- Very high values = instability

**Good vs Bad Values:**

```
✅ GOOD (Stable Training):
Step 0:    grad_norm = 2.5
Step 100:  grad_norm = 1.8
Step 200:  grad_norm = 1.2
Step 300:  grad_norm = 0.9

Pattern: Steady, decreases over time, stays < 5

⚠️ WARNING (Unstable):
Step 0:    grad_norm = 2.5
Step 100:  grad_norm = 8.3  ⚠️ Spiking
Step 200:  grad_norm = 12.1 ⚠️ Getting worse
Step 300:  grad_norm = 4.2  ⚠️ Volatile

Pattern: Large spikes, inconsistent

❌ BAD (Exploding Gradients):
Step 0:    grad_norm = 2.5
Step 100:  grad_norm = 45.0   ❌ Exploding
Step 200:  grad_norm = 150.0  ❌ Severe
Step 300:  grad_norm = NaN    ❌ Training failed

Pattern: Exponential growth → crash
```

**Your Expected Range:**
- Start: 2-5
- Mid-training: 1-3
- End: 0.5-2

**Warning Signs:**
- Consistently > 10 → reduce learning rate
- Spikes > 50 → training about to crash
- NaN/Inf → training failed, restart with lower LR

---

## 5. Training Speed

### Samples per Second (`train/samples_per_second`)

**What it means:** How fast the model processes training examples.

**Your Expected Values:**

```
✅ GOOD (A10G Large GPU):
samples_per_second: 15-25

With batch_size=4, gradient_accumulation=4 (effective batch=16):
- Processing ~15-25 samples/second
- ~380-640 steps total (512 train samples, 3 epochs)
- Expected time: 25-40 minutes

❌ SLOW:
samples_per_second: < 5
- Indicates bottleneck (data loading, GPU underutilized)
- Training will take 2-3x longer

🚀 FAST:
samples_per_second: > 30
- Great! Efficient training
- May finish in 15-20 minutes
```

### Steps per Second (`train/steps_per_second`)

**Your Expected Values:**

```
✅ GOOD:
steps_per_second: 1.0-2.0 steps/sec
- With ~380 total steps: 6-13 minutes per epoch
- 3 epochs: 18-39 minutes total

❌ SLOW:
steps_per_second: < 0.5 steps/sec
- Training will take 1+ hour
```

---

## 6. Epoch Progress (`train/epoch`)

**What it means:** How many full passes through the dataset.

**How to read it:**

```
Step 0:    epoch = 0.0   (starting)
Step 127:  epoch = 1.0   (completed first pass)
Step 254:  epoch = 2.0   (completed second pass)
Step 381:  epoch = 3.0   (training complete)
```

You should see eval loss measured at:
- Epoch 1.0 (after ~127 steps)
- Epoch 2.0 (after ~254 steps)
- Epoch 3.0 (after ~381 steps)

---

## Quick Health Check: Is My Training Going Well?

### ✅ Healthy Training Looks Like:

```
Metric              Step 0    Step 100   Step 200   Step 300   Status
---------------------------------------------------------------------------
train/loss          3.2       1.8        1.2        0.7        ✅ Decreasing
eval/loss           3.4       2.0        1.4        0.9        ✅ Decreasing
Gap (eval-train)    0.2       0.2        0.2        0.2        ✅ Small gap
learning_rate       0.0001    0.0002     0.0002     0.0002     ✅ Stable after warmup
grad_norm           2.5       1.8        1.4        1.1        ✅ Stable, decreasing
samples_per_sec     20        20         20         20         ✅ Consistent
```

**Graph pattern:**
- Both losses: Smooth downward curve
- Learning rate: Ramp up (warmup), then flat
- Gradient norm: Stable, slight decrease

### ❌ Problem Training Looks Like:

```
Metric              Step 0    Step 100   Step 200   Step 300   Problem
---------------------------------------------------------------------------
train/loss          3.2       0.1        0.01       0.005      ❌ Too fast → overfitting
eval/loss           3.4       2.1        2.5        3.0        ❌ Increasing → overfitting
Gap                 0.2       2.0        2.49       2.995      ❌ Large gap → overfitting

OR:

train/loss          3.2       4.5        12.8       NaN        ❌ Exploding → LR too high
grad_norm           2.5       18.0       85.0       NaN        ❌ Exploding gradients

OR:

train/loss          3.2       3.1        3.0        2.9        ❌ Too slow → LR too low
eval/loss           3.4       3.3        3.2        3.1        ❌ Barely learning
```

---

## What to Look For During Your Training

### First 10 Minutes (Steps 0-50):

**Check:**
- ✅ Loss starts decreasing (should drop from ~3.5 to ~2.5)
- ✅ Learning rate warms up smoothly (0 → 0.0002)
- ✅ Gradient norm stable (< 5)
- ✅ No errors in logs

**Red flags:**
- ❌ Loss stuck at initial value
- ❌ Loss exploding (> 10)
- ❌ Gradient norm > 20

### Mid-Training (Steps 100-200):

**Check:**
- ✅ Train loss: 1.5-2.0
- ✅ Eval loss: 1.7-2.2
- ✅ Gap between them: < 0.3
- ✅ Smooth loss curves

**Red flags:**
- ❌ Train loss < 0.5 (too fast, likely overfitting)
- ❌ Eval loss > 2.5 (not learning)
- ❌ Gap > 0.5 (overfitting starting)

### Final Epoch (Steps 300-381):

**Check:**
- ✅ Train loss: 0.5-1.0
- ✅ Eval loss: 0.6-1.2
- ✅ Gap: < 0.3
- ✅ Losses still decreasing or flat

**Red flags:**
- ❌ Train loss < 0.3, Eval loss > 1.5 (severe overfitting)
- ❌ Both losses increasing (model degrading)

---

## Example: Perfect Training Run

```
EPOCH 1 (Steps 0-127):
├─ Step 10:   train_loss=3.1, eval_loss=3.3, lr=0.00004  ✅
├─ Step 50:   train_loss=2.3, eval_loss=2.4, lr=0.0002   ✅
└─ Step 127:  train_loss=1.6, eval_loss=1.7, lr=0.0002   ✅ Good progress

EPOCH 2 (Steps 128-254):
├─ Step 150:  train_loss=1.4, eval_loss=1.5, lr=0.0002   ✅
├─ Step 200:  train_loss=1.0, eval_loss=1.1, lr=0.0002   ✅
└─ Step 254:  train_loss=0.8, eval_loss=0.9, lr=0.0002   ✅ Continuing to improve

EPOCH 3 (Steps 255-381):
├─ Step 300:  train_loss=0.7, eval_loss=0.8, lr=0.0002   ✅
├─ Step 350:  train_loss=0.6, eval_loss=0.75, lr=0.0002  ✅
└─ Step 381:  train_loss=0.55, eval_loss=0.7, lr=0.0002  ✅ Excellent!

RESULT: Model learned well, no overfitting, ready to use!
```

---

## When to Worry and What to Do

### Issue 1: Overfitting Detected

**Symptoms:**
- Train loss < 0.5, Eval loss > 1.5
- Gap > 0.5 and growing

**Action:**
- Use checkpoint from earlier step (when gap was small)
- Don't train further, model is degrading

### Issue 2: Training Too Slow

**Symptoms:**
- After 100 steps, loss still > 2.5
- Barely decreasing

**Action:**
- This might actually be OK for your small dataset
- Wait until step 200 to judge
- If still > 2.0, consider increasing learning rate next time

### Issue 3: Training Crashed

**Symptoms:**
- Loss → NaN
- Grad norm → NaN
- Job failed

**Action:**
- Restart with lower learning rate (try 1e-4 instead of 2e-4)
- Reduce batch size if OOM error

---

## Your Specific Training: Expected Timeline

**Timeline:**

```
0:00 - 0:05     Setup (installing packages, loading model)
0:05 - 0:10     Loading dataset, tokenizing
0:10 - 0:20     Epoch 1 (should see loss drop from 3.5 → 1.5)
0:20 - 0:30     Epoch 2 (should see loss drop from 1.5 → 0.9)
0:30 - 0:40     Epoch 3 (should see loss drop from 0.9 → 0.6)
0:40 - 0:45     Saving model to Hub
```

**Check at 15 minutes:**
- Should be in Epoch 1-2
- Train loss should be 1.5-2.0
- If loss still > 2.5, might need to wait longer

**Check at 30 minutes:**
- Should be in Epoch 2-3
- Train loss should be 0.8-1.2
- Eval loss should be 0.9-1.4

**Final (40-45 minutes):**
- Both losses should be 0.5-1.0
- Model saved to HuggingFace Hub
- Ready for ONNX conversion!

---

## Summary: Key Metrics Cheat Sheet

| Metric | Start | Mid | End | Warning Sign |
|--------|-------|-----|-----|--------------|
| `train/loss` | 2.5-4.0 | 1.0-2.0 | 0.5-1.0 | Not decreasing |
| `eval/loss` | 2.7-4.2 | 1.2-2.2 | 0.6-1.2 | Gap > 0.5 from train |
| `learning_rate` | 0→0.0002 | 0.0002 | 0.0002 | Zero or too high |
| `grad_norm` | 2-5 | 1-3 | 0.5-2 | > 10 |
| `samples_per_sec` | 15-25 | 15-25 | 15-25 | < 5 |

**The ONE metric to watch:** `eval/loss` - if it's decreasing, you're good!
