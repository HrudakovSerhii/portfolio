# /// script
# dependencies = ["trl>=0.12.0", "peft>=0.7.0", "trackio", "datasets", "transformers>=4.44.0", "accelerate", "bitsandbytes"]
# ///

"""
TinyLlama-1.1B DPO Training on Hugging Face Jobs Infrastructure
Following HF Skills Training Best Practices

This script trains TinyLlama-1.1B using Direct Preference Optimization (DPO)
to improve RAG context adherence and reduce hallucination.

Author: HrudakovSerhii
Dataset: HrudakovSerhii/rag-cv-preference-data
Output Model: HrudakovSerhii/tinyllama-1.1b-rag-cv-v1

Training Configuration:
- Base Model: TinyLlama/TinyLlama-1.1B-Chat-v1.0
- Method: DPO (Direct Preference Optimization)
- Hardware: a10g-large (16GB VRAM)
- Estimated Time: 2-3 hours
- Estimated Cost: $12-15
- Real-time Monitoring: Trackio dashboard

Expected Output:
- Full precision model: ~2.2GB
- After Q4_0 quantization: ~550MB (browser-compatible)
"""

import os
from datasets import load_dataset
from peft import LoraConfig
from trl import DPOTrainer, DPOConfig
import trackio

print("=" * 80)
print("TinyLlama-1.1B DPO Training for RAG-Optimized CV Chatbot")
print("=" * 80)

# ============================================================================
# Configuration
# ============================================================================

# Model Configuration
BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
DATASET_NAME = "HrudakovSerhii/portfolio-dpo-dataset"
OUTPUT_DIR = "tinyllama-rag-cv-dpo"
HUB_MODEL_ID = "HrudakovSerhii/tinyllama-1.1b-rag-cv-v1"

# Trackio Configuration (Real-time Monitoring)
TRACKIO_SPACE = "HrudakovSerhii/trackio"  # Your Trackio dashboard
PROJECT_NAME = "cv-chatbot-training"       # Project grouping
RUN_NAME = "tinyllama-dpo-rag-v1"         # This specific run

print(f"Base Model: {BASE_MODEL}")
print(f"Dataset: {DATASET_NAME}")
print(f"Output: {HUB_MODEL_ID}")
print(f"Trackio Dashboard: https://huggingface.co/spaces/{TRACKIO_SPACE}")
print("=" * 80)

# ============================================================================
# Step 1: Load and Validate Dataset
# ============================================================================

print("\n[Step 1/4] Loading dataset...")
try:
    dataset = load_dataset(DATASET_NAME, split="train")
    print(f"✅ Dataset loaded successfully: {len(dataset)} examples")

    # Validate DPO format (required columns: prompt, chosen, rejected)
    required_columns = {"prompt", "chosen", "rejected"}
    dataset_columns = set(dataset.column_names)

    if not required_columns.issubset(dataset_columns):
        missing = required_columns - dataset_columns
        raise ValueError(f"❌ Missing required columns: {missing}")

    print(f"✅ Dataset format validated: {dataset_columns}")

    # Show sample
    print("\n📋 Sample example:")
    sample = dataset[0]
    print(f"  Prompt length: {len(sample['prompt'])} chars")
    print(f"  Chosen length: {len(sample['chosen'])} chars")
    print(f"  Rejected length: {len(sample['rejected'])} chars")

except Exception as e:
    print(f"❌ Dataset loading failed: {e}")
    print("\nTroubleshooting:")
    print("1. Ensure dataset is uploaded to HuggingFace Hub")
    print("2. Check dataset name format: 'HrudakovSerhii/rag-cv-preference-data'")
    print("3. Verify dataset is public or you have access")
    raise

# ============================================================================
# Step 2: Create Train/Eval Split
# ============================================================================

print("\n[Step 2/4] Creating train/eval split...")

# Use 15% for evaluation (monitoring training progress)
dataset_split = dataset.train_test_split(test_size=0.15, seed=42)
train_dataset = dataset_split["train"]
eval_dataset = dataset_split["test"]

print(f"✅ Train examples: {len(train_dataset)}")
print(f"✅ Eval examples: {len(eval_dataset)}")

# ============================================================================
# Step 3: Configure LoRA (Parameter-Efficient Fine-Tuning)
# ============================================================================

print("\n[Step 3/4] Configuring LoRA...")

lora_config = LoraConfig(
    r=16,                          # LoRA rank (16 = good quality/memory balance)
    lora_alpha=32,                 # LoRA scaling (typically 2*r)
    target_modules=[               # Apply LoRA to attention layers
        "q_proj",                  # Query projection
        "v_proj",                  # Value projection
        "k_proj",                  # Key projection
        "o_proj",                  # Output projection
        "gate_proj",               # MLP gate
        "up_proj",                 # MLP up
        "down_proj"                # MLP down
    ],
    lora_dropout=0.05,             # Regularization
    bias="none",                   # Don't train bias terms
    task_type="CAUSAL_LM"          # Language modeling task
)

print("✅ LoRA configuration:")
print(f"  Rank: {lora_config.r}")
print(f"  Alpha: {lora_config.lora_alpha}")
print(f"  Target modules: {len(lora_config.target_modules)}")
print(f"  Dropout: {lora_config.lora_dropout}")

# ============================================================================
# Step 4: Configure DPO Training
# ============================================================================

print("\n[Step 4/4] Configuring DPO training...")

# Calculate training steps for logging
steps_per_epoch = len(train_dataset) // (2 * 8)  # batch_size * grad_accum
total_steps = steps_per_epoch * 3  # 3 epochs

training_args = DPOConfig(
    # ========================================================================
    # Output Configuration (CRITICAL for ephemeral Jobs environment)
    # ========================================================================
    output_dir=OUTPUT_DIR,
    push_to_hub=True,                       # MUST push to Hub (environment is ephemeral)
    hub_model_id=HUB_MODEL_ID,
    hub_strategy="every_save",              # Upload checkpoints to Hub
    hub_private_repo=False,                 # Make model public

    # ========================================================================
    # Training Hyperparameters
    # ========================================================================
    num_train_epochs=3,                     # Number of training passes
    per_device_train_batch_size=2,          # Batch size per GPU
    per_device_eval_batch_size=2,           # Eval batch size
    gradient_accumulation_steps=8,          # Effective batch size = 2 * 8 = 16
    gradient_checkpointing=True,            # Save memory (trade speed for VRAM)

    # ========================================================================
    # Learning Rate Schedule (Cosine Decay - HF Blog Recommendation)
    # ========================================================================
    learning_rate=5e-5,                     # DPO uses lower LR than SFT
    lr_scheduler_type="cosine",             # Smooth decay to 0
    warmup_ratio=0.1,                       # 10% warmup steps

    # ========================================================================
    # DPO-Specific Parameters
    # ========================================================================
    beta=0.1,                               # DPO temperature (controls preference strength)
    loss_type="sigmoid",                    # DPO loss function

    # ========================================================================
    # Evaluation and Checkpointing (HF Blog Best Practices)
    # ========================================================================
    eval_strategy="steps",                  # Evaluate periodically
    eval_steps=50,                          # Evaluate every 50 steps
    save_strategy="steps",                  # Save checkpoints
    save_steps=100,                         # Save every 100 steps
    save_total_limit=3,                     # Keep only 3 most recent checkpoints
    logging_steps=10,                       # Log metrics every 10 steps

    # ========================================================================
    # Trackio Integration (Real-time Monitoring)
    # ========================================================================
    report_to="trackio",                    # Send metrics to Trackio
    run_name=RUN_NAME,                      # Descriptive run name

    # ========================================================================
    # Optimization
    # ========================================================================
    bf16=True,                              # Use bfloat16 (faster, less memory)
    optim="adamw_torch",                    # Optimizer
    max_grad_norm=1.0,                      # Gradient clipping

    # ========================================================================
    # Reproducibility
    # ========================================================================
    seed=42,                                # Random seed
    dataloader_num_workers=4,               # Parallel data loading
    remove_unused_columns=False,            # DPO needs all columns
)

print("✅ Training configuration:")
print(f"  Epochs: {training_args.num_train_epochs}")
print(f"  Effective batch size: {training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps}")
print(f"  Total training steps: ~{total_steps}")
print(f"  Evaluation every: {training_args.eval_steps} steps")
print(f"  Checkpoints every: {training_args.save_steps} steps")
print(f"  Learning rate: {training_args.learning_rate}")
print(f"  DPO beta: {training_args.beta}")

# ============================================================================
# Initialize DPO Trainer
# ============================================================================

print("\n" + "=" * 80)
print("Initializing DPO Trainer...")
print("=" * 80)

trainer = DPOTrainer(
    model=BASE_MODEL,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    peft_config=lora_config,
    args=training_args,
)

print("✅ Trainer initialized successfully")

# ============================================================================
# Start Training
# ============================================================================

print("\n" + "=" * 80)
print("Starting DPO Training...")
print("=" * 80)
print(f"\n📊 Real-time monitoring:")
print(f"   https://huggingface.co/spaces/{TRACKIO_SPACE}")
print(f"\n   Project: {PROJECT_NAME}")
print(f"   Run: {RUN_NAME}")
print("\n💡 Key metrics to watch:")
print("   - train/loss (should decrease)")
print("   - eval/loss (should track train/loss)")
print("   - train/rewards/chosen (should increase)")
print("   - train/rewards/rejected (should decrease)")
print("   - train/rewards/margins (should be positive and increasing)")
print("\n⏱️  Estimated time: 2-3 hours")
print("💰 Estimated cost: $12-15")
print("=" * 80 + "\n")

# Train!
trainer.train()

# ============================================================================
# Save and Upload Model
# ============================================================================

print("\n" + "=" * 80)
print("Training Complete! Saving model...")
print("=" * 80)

trainer.save_model(OUTPUT_DIR)
print(f"✅ Model saved locally to: {OUTPUT_DIR}")

print(f"\nPushing to Hugging Face Hub: {HUB_MODEL_ID}")
trainer.push_to_hub()
print(f"✅ Model uploaded to: https://huggingface.co/{HUB_MODEL_ID}")

# ============================================================================
# Training Summary
# ============================================================================

print("\n" + "=" * 80)
print("🎉 TRAINING COMPLETE!")
print("=" * 80)
print(f"\n📦 Model Details:")
print(f"   Hub: https://huggingface.co/{HUB_MODEL_ID}")
print(f"   Size (full precision): ~2.2GB")
print(f"   Size (Q4_0 quantized): ~550MB")
print(f"\n📊 Training Metrics:")
print(f"   Dashboard: https://huggingface.co/spaces/{TRACKIO_SPACE}")
print(f"   Run: {RUN_NAME}")
print(f"\n🚀 Next Steps:")
print(f"   1. Review training metrics on Trackio")
print(f"   2. Convert to GGUF for browser deployment:")
print(f"      - Run GGUF conversion script")
print(f"      - Target: Q4_0 quantization (~550MB)")
print(f"   3. Test with your RAG pipeline:")
print(f"      - Compare against current 0.5B model")
print(f"      - Evaluate context adherence")
print(f"      - Check for hallucination reduction")
print(f"\n💡 Model Usage:")
print(f"   from transformers import AutoModelForCausalLM, AutoTokenizer")
print(f"   model = AutoModelForCausalLM.from_pretrained('{HUB_MODEL_ID}')")
print(f"   tokenizer = AutoTokenizer.from_pretrained('{HUB_MODEL_ID}')")
print("=" * 80)
