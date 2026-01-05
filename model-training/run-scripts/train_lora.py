#!/usr/bin/env python3
"""
Fine-tune smolLM2-135M-instruct using LoRA on custom training data.
This script loads training data from output.jsonl and fine-tunes the model
to respond as Serhii Hrudakov with different personas.
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
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import BitsAndBytesConfig
import os

# Configuration
MODEL_NAME = "HuggingFaceTB/smolLM2-135M-instruct"
DATA_FILE = "output.jsonl"
OUTPUT_DIR = "./serhii-lora-model"
MAX_LENGTH = 512

def load_training_data(file_path):
    """Load training data from JSONL file."""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            data.append(json.loads(line))
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

    # Tokenize
    model_inputs = tokenizer(
        texts,
        max_length=MAX_LENGTH,
        truncation=True,
        padding=False,
    )

    # For causal language modeling, labels are the same as input_ids
    model_inputs["labels"] = model_inputs["input_ids"].copy()

    return model_inputs

def main():
    print("🚀 Starting LoRA fine-tuning for smolLM2-135M-instruct")

    # Load training data
    print(f"📂 Loading training data from {DATA_FILE}...")
    raw_data = load_training_data(DATA_FILE)
    dataset = Dataset.from_list(raw_data)
    print(f"✅ Loaded {len(dataset)} training examples")

    # Load tokenizer
    print(f"🔧 Loading tokenizer for {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Configure 4-bit quantization for efficient training
    print("⚙️  Configuring 4-bit quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    # Load base model
    print(f"🤖 Loading base model {MODEL_NAME}...")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )

    # Prepare model for k-bit training
    print("🔧 Preparing model for k-bit training...")
    model = prepare_model_for_kbit_training(model)

    # Configure LoRA
    print("🎯 Configuring LoRA...")
    lora_config = LoraConfig(
        r=16,  # Rank
        lora_alpha=32,  # Scaling factor
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )

    # Get PEFT model
    print("🔗 Creating PEFT model with LoRA...")
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Preprocess dataset
    print("📝 Preprocessing dataset...")
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

    print(f"📊 Training samples: {len(train_dataset)}")
    print(f"📊 Validation samples: {len(eval_dataset)}")

    # Training arguments
    print("⚙️  Configuring training arguments...")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        weight_decay=0.01,
        logging_dir=f"{OUTPUT_DIR}/logs",
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=100,
        save_total_limit=3,
        load_best_model_at_end=True,
        fp16=torch.cuda.is_available(),
        warmup_steps=100,
        report_to=["tensorboard"],
        remove_unused_columns=False,
    )

    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
        pad_to_multiple_of=8
    )

    # Initialize Trainer
    print("🏋️  Initializing Trainer...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
    )

    # Start training
    print("🎓 Starting training...")
    trainer.train()

    # Save the final model
    print(f"💾 Saving fine-tuned model to {OUTPUT_DIR}...")
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    print("✨ Training complete!")
    print(f"📦 Fine-tuned model saved to: {OUTPUT_DIR}")
    print("\nNext steps:")
    print("1. Convert to ONNX format")
    print("2. Apply quantization for deployment")

if __name__ == "__main__":
    main()
