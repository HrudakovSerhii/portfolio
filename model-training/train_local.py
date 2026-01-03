#!/usr/bin/env python3
"""
Local training script for Mac M2
Trains Qwen2.5-0.5B with LoRA using your conversation data
Optimized for 16GB RAM
"""

import json
import torch
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model
import os
from datetime import datetime

print("🚀 Starting Local Training on Mac M2")
print("=" * 60)

# Configuration
BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
DATA_FILE = "./data/cv-training-data.jsonl"
OUTPUT_DIR = "./serhii-qwen-lora-v2"
MAX_LENGTH = 512

# Check if MPS is available
if torch.backends.mps.is_available():
    device = "mps"
    print("✅ Apple Silicon (MPS) detected - using GPU acceleration")
elif torch.cuda.is_available():
    device = "cuda"
    print("✅ CUDA GPU detected")
else:
    device = "cpu"
    print("⚠️  CPU mode - training will be slower")

print(f"Device: {device}")
print("=" * 60 + "\n")


def load_training_data(file_path):
    """Load training data from JSONL file."""
    data = []
    print(f"📂 Loading training data from {file_path}...")

    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            data.append(json.loads(line))

    print(f"✅ Loaded {len(data)} training examples")
    return data


def format_chat_template(messages, tokenizer):
    """Format messages using the tokenizer's chat template."""
    formatted = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False
    )
    return formatted


def preprocess_function(examples, tokenizer):
    """Preprocess the dataset for training."""
    texts = []
    for message_list in examples['messages']:
        formatted = format_chat_template(message_list, tokenizer)
        texts.append(formatted)

    # Tokenize - DataCollatorForLanguageModeling will create labels automatically
    model_inputs = tokenizer(
        texts,
        max_length=MAX_LENGTH,
        truncation=True,
        padding=False,
        return_tensors=None,  # Return as lists, not tensors
    )

    return model_inputs


def main():
    start_time = datetime.now()

    # Load training data
    raw_data = load_training_data(DATA_FILE)
    dataset = Dataset.from_list(raw_data)

    # Load tokenizer
    print(f"\n🔧 Loading tokenizer for {BASE_MODEL}...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    print("✅ Tokenizer loaded")

    # Load base model
    print(f"\n🤖 Loading base model: {BASE_MODEL}")
    print("⏳ This may take a few minutes...")

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float32,  # Use float32 for MPS
        trust_remote_code=True
    )

    # Move to MPS device
    model = model.to(device)
    print(f"✅ Model loaded on {device}")

    # Configure LoRA - anti-overfitting settings
    print("\n🎯 Configuring LoRA...")
    lora_config = LoraConfig(
        r=32,  # Lower rank to prevent overfitting
        lora_alpha=64,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.1,  # Higher dropout for regularization
        bias="none",
        task_type="CAUSAL_LM"
    )

    # Get PEFT model
    print("🔗 Creating PEFT model with LoRA...")
    model = get_peft_model(model, lora_config)

    # Print trainable parameters
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    trainable_pct = 100 * trainable_params / total_params

    print(f"✅ LoRA applied:")
    print(f"   Trainable params: {trainable_params:,}")
    print(f"   Total params: {total_params:,}")
    print(f"   Trainable: {trainable_pct:.2f}%")

    # Preprocess dataset
    print("\n📝 Preprocessing dataset...")
    tokenized_dataset = dataset.map(
        lambda x: preprocess_function(x, tokenizer),
        batched=True,
        remove_columns=dataset.column_names,
        desc="Tokenizing dataset"
    )

    # Split dataset (90% train, 10% validation)
    split_dataset = tokenized_dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split_dataset["train"]
    eval_dataset = split_dataset["test"]

    print(f"\n📊 Dataset split:")
    print(f"   Training samples: {len(train_dataset)}")
    print(f"   Validation samples: {len(eval_dataset)}")

    # Training arguments - anti-overfitting configuration
    print("\n⚙️  Configuring training arguments...")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=3,  # Reduced from 10 to prevent overfitting
        per_device_train_batch_size=4,  # Match train_hf_jobs.py
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=4,  # Effective batch size = 16
        learning_rate=2e-4,  # Lower learning rate
        weight_decay=0.02,  # Weight decay for regularization
        lr_scheduler_type="cosine",  # Cosine decay
        warmup_steps=100,
        logging_dir=f"{OUTPUT_DIR}/logs",
        logging_steps=10,
        logging_first_step=True,
        eval_strategy="steps",
        eval_steps=25,  # More frequent evaluation
        save_strategy="steps",
        save_steps=50,  # Save checkpoints more often
        save_total_limit=2,  # Keep only 2 best checkpoints
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        fp16=False,  # MPS doesn't support fp16
        report_to=["tensorboard"],
        remove_unused_columns=False,
        dataloader_num_workers=0,  # Important for MPS
        use_cpu=False,  # Use MPS
    )

    print("✅ Training configuration:")
    print(f"   Epochs: {training_args.num_train_epochs}")
    print(f"   Batch size: {training_args.per_device_train_batch_size}")
    print(f"   Gradient accumulation: {training_args.gradient_accumulation_steps}")
    print(f"   Effective batch size: {training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps}")
    print(f"   Learning rate: {training_args.learning_rate}")
    print(f"   Total training steps: ~{len(train_dataset) // (training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps) * training_args.num_train_epochs}")

    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
        pad_to_multiple_of=8
    )

    # Initialize Trainer
    print("\n🏋️  Initializing Trainer...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
    )

    # Start training
    print("\n🎓 Starting training...")
    print("=" * 60)
    print("📊 You can monitor progress with TensorBoard:")
    print(f"   tensorboard --logdir {OUTPUT_DIR}/logs")
    print("=" * 60 + "\n")

    try:
        trainer.train()
    except KeyboardInterrupt:
        print("\n\n⚠️  Training interrupted by user")
        print("💾 Saving current state...")
        trainer.save_model(OUTPUT_DIR)
        tokenizer.save_pretrained(OUTPUT_DIR)
        print("✅ Model saved!")
        return

    # Save the final model
    print(f"\n💾 Saving fine-tuned model to {OUTPUT_DIR}...")
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    # Calculate training time
    end_time = datetime.now()
    duration = end_time - start_time
    hours, remainder = divmod(duration.total_seconds(), 3600)
    minutes, seconds = divmod(remainder, 60)

    print("\n" + "=" * 60)
    print("✨ Training complete!")
    print("=" * 60)
    print(f"📦 Model saved to: {OUTPUT_DIR}")
    print(f"⏱️  Training time: {int(hours)}h {int(minutes)}m {int(seconds)}s")
    print("\n📊 Training metrics:")

    # Get final metrics
    metrics = trainer.state.log_history
    if metrics:
        final_train_loss = None
        final_eval_loss = None

        for entry in reversed(metrics):
            if 'loss' in entry and final_train_loss is None:
                final_train_loss = entry['loss']
            if 'eval_loss' in entry and final_eval_loss is None:
                final_eval_loss = entry['eval_loss']
            if final_train_loss and final_eval_loss:
                break

        if final_train_loss:
            print(f"   Final training loss: {final_train_loss:.4f}")
        if final_eval_loss:
            print(f"   Final eval loss: {final_eval_loss:.4f}")

    print("\n🎯 Next steps:")
    print("   1. Test the model:")
    print("      cd ../test")
    print(f"      # Edit test_model.py to use: {OUTPUT_DIR}")
    print("      python test_model.py")
    print("\n   2. If results are good, convert to ONNX for browser use")
    print("\n   3. Push to HuggingFace Hub (optional):")
    print("      huggingface-cli login")
    print(f"      huggingface-cli upload HrudakovSerhii/serhii-qwen-lora-v2 {OUTPUT_DIR}")


if __name__ == "__main__":
    main()