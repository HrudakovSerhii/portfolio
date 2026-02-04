#!/usr/bin/env python3
"""
Test the FULL (non-quantized) ONNX model to see if quantization caused the issues
Run: python test_full_model.py
"""

from optimum.onnxruntime import ORTModelForCausalLM
from transformers import AutoTokenizer
import time

print("🧪 Testing FULL (Non-Quantized) Model")
print("=" * 60)
print("⚠️  This is 518MB vs 136MB quantized version")
print("=" * 60 + "\n")

# Use FULL model (no quantization)
MODEL_NAME = "HrudakovSerhii/serhii-smollm-onnx"

print(f"📥 Downloading: {MODEL_NAME}")
print("⏳ This will take longer (~518MB)...\n")

start_time = time.time()
model = ORTModelForCausalLM.from_pretrained(MODEL_NAME)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
load_time = time.time() - start_time

print(f"✅ Model loaded in {load_time:.2f} seconds")
print("=" * 60 + "\n")


def chat(message, persona="Recruiter (HR)"):
    messages = [
        {"role": "system", "content": f"You are Serhii Hrudakov. You are speaking to a {persona}."},
        {"role": "user", "content": message}
    ]

    input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(input_text, return_tensors="pt")

    print("💭 Thinking...", end="", flush=True)
    start = time.time()

    outputs = model.generate(
        **inputs,
        max_new_tokens=200,
        temperature=0.7,
        top_p=0.9,
        do_sample=True,
        repetition_penalty=1.1
    )

    gen_time = time.time() - start
    print(f" ({gen_time:.2f}s)")

    full_response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    if "assistant" in full_response:
        response = full_response.split("assistant")[-1].strip()
    else:
        response = full_response.strip()

    return response


# Test with SPECIFIC questions that should match training data
print("🎯 TESTING WITH FACTUAL QUESTIONS FROM TRAINING DATA")
print("=" * 60 + "\n")

tests = [
    ("Tell me about your work at A-Dam and the impact on revenue.", "Recruiter (HR)"),
    ("What was the EriksDigital migration project?", "Technical Interviewer (Engineer)"),
    ("Describe your experience with React and NextJS.", "Technical Interviewer (Engineer)"),
    ("Why did you leave Hexaware/Mobiquity?", "Recruiter (HR)"),
    ("What do you like to do outdoors?", "Friend"),
]

for i, (question, persona) in enumerate(tests, 1):
    print(f"\n{'='*60}")
    print(f"TEST {i}/5")
    print(f"{'='*60}")
    print(f"Persona: {persona}")
    print(f"Q: {question}")
    response = chat(question, persona)
    print(f"A: {response}")

    # Check if response contains expected keywords
    print("\n🔍 Fact Check:")

    if i == 1:  # A-Dam question
        keywords = ["A-Dam", "100%", "revenue", "NextJS", "React", "GraphQL"]
        found = [k for k in keywords if k.lower() in response.lower()]
        print(f"   Expected keywords: {', '.join(keywords)}")
        print(f"   Found: {', '.join(found) if found else '❌ NONE'}")

    elif i == 2:  # EriksDigital
        keywords = ["EriksDigital", "migration", "monolith", "micro-frontend", "WebSphere"]
        found = [k for k in keywords if k.lower() in response.lower()]
        print(f"   Expected keywords: {', '.join(keywords)}")
        print(f"   Found: {', '.join(found) if found else '❌ NONE'}")

    elif i == 3:  # React/NextJS
        keywords = ["React", "NextJS", "TypeScript", "frontend"]
        found = [k for k in keywords if k.lower() in response.lower()]
        print(f"   Expected keywords: {', '.join(keywords)}")
        print(f"   Found: {', '.join(found) if found else '❌ NONE'}")

    elif i == 4:  # Hexaware
        keywords = ["Hexaware", "Mobiquity", "restructur", "bench", "India"]
        found = [k for k in keywords if k.lower() in response.lower()]
        print(f"   Expected keywords: {', '.join(keywords)}")
        print(f"   Found: {', '.join(found) if found else '❌ NONE'}")

    elif i == 5:  # Outdoor
        keywords = ["hiking", "Alps", "outdoor", "sport"]
        found = [k for k in keywords if k.lower() in response.lower()]
        print(f"   Expected keywords: {', '.join(keywords)}")
        print(f"   Found: {', '.join(found) if found else '❌ NONE'}")

print("\n" + "="*60)
print("📊 COMPARISON TEST COMPLETE")
print("="*60)
print("\nIf this model also hallucinates:")
print("  → Problem is BASE MODEL or TRAINING")
print("  → Recommend: Retrain with Qwen2.5-0.5B")
print("\nIf this model works well:")
print("  → Problem is QUANTIZATION")
print("  → Use full model or try FP16 quantization")