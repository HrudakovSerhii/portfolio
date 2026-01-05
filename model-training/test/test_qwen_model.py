#!/usr/bin/env python3
"""
Test the new Qwen2.5-0.5B based model
This should show improved quality compared to SmolLM2-135M
"""

from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import time

print("🧪 Testing Qwen2.5-0.5B LoRA Model")
print("=" * 60)
print("📂 Loading model from: ../serhii-qwen-lora-v2")
print("=" * 60 + "\n")

# Load base model and LoRA adapter
BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
LORA_PATH = "../serhii-qwen-lora-v2"

print(f"⏳ Loading base model: {BASE_MODEL}...")
start_time = time.time()
base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL)
model = PeftModel.from_pretrained(base_model, LORA_PATH)
tokenizer = AutoTokenizer.from_pretrained(LORA_PATH)
load_time = time.time() - start_time

print(f"✅ Model loaded in {load_time:.2f} seconds")
print("=" * 60 + "\n")


def chat(message, persona="Recruiter (HR)", max_tokens=200, temperature=0.7):
    """Generate a response using the trained model."""
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
        max_new_tokens=max_tokens,
        temperature=temperature,
        top_p=0.9,
        do_sample=True,
        repetition_penalty=1.1
    )

    gen_time = time.time() - start
    print(f" ({gen_time:.2f}s)")

    full_response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract just the assistant's response
    if "assistant" in full_response:
        response = full_response.split("assistant")[-1].strip()
    else:
        response = full_response.strip()

    return response


# Critical tests - these should contain FACTUAL information from training data
print("🎯 CRITICAL TESTS - FACTUAL RECALL")
print("=" * 60 + "\n")

tests = [
    {
        "question": "Tell me about your work at A-Dam and the business impact.",
        "persona": "Recruiter (HR)",
        "expected_keywords": ["A-Dam", "100%", "revenue", "NextJS", "React", "GraphQL", "75%"],
        "description": "Should mention A-Dam web-shop, 100% revenue increase, 75% client retention"
    },
    {
        "question": "What was the EriksDigital migration project?",
        "persona": "Technical Interviewer (Engineer)",
        "expected_keywords": ["EriksDigital", "migration", "monolith", "micro-frontend", "WebSphere"],
        "description": "Should describe the monolith to micro-frontend migration"
    },
    {
        "question": "Describe your React and NextJS experience.",
        "persona": "Technical Interviewer (Engineer)",
        "expected_keywords": ["React", "NextJS", "TypeScript", "frontend"],
        "description": "Should focus on React/NextJS, not Angular or other frameworks"
    },
    {
        "question": "Why did you leave Hexaware/Mobiquity?",
        "persona": "Recruiter (HR)",
        "expected_keywords": ["Hexaware", "Mobiquity", "restructur", "bench", "India"],
        "description": "Should explain company restructuring and bench situation"
    },
    {
        "question": "What do you like to do in your free time?",
        "persona": "Friend",
        "expected_keywords": ["hiking", "Alps", "outdoor", "sport"],
        "description": "Should mention outdoor activities, hiking in Alps"
    },
]

results = []
for i, test in enumerate(tests, 1):
    print(f"{'='*60}")
    print(f"TEST {i}/5: {test['description']}")
    print(f"{'='*60}")
    print(f"Persona: {test['persona']}")
    print(f"Q: {test['question']}")

    response = chat(test['question'], test['persona'])
    print(f"A: {response}")

    # Check for expected keywords
    print(f"\n🔍 Fact Check:")
    print(f"   Expected: {', '.join(test['expected_keywords'])}")

    found = [k for k in test['expected_keywords'] if k.lower() in response.lower()]
    missing = [k for k in test['expected_keywords'] if k.lower() not in response.lower()]

    if found:
        print(f"   ✅ Found: {', '.join(found)}")
    if missing:
        print(f"   ❌ Missing: {', '.join(missing)}")

    # Check for hallucinations (things NOT in training data)
    hallucination_check = ["Amazon", "Angular", "Inflection", "Google", "Microsoft"]
    hallucinations = [h for h in hallucination_check if h.lower() in response.lower()]

    if hallucinations:
        print(f"   ⚠️  Possible hallucination: {', '.join(hallucinations)}")

    # Check for non-English text
    if not all(ord(c) < 128 or c.isspace() for c in response):
        print(f"   ⚠️  Non-ASCII characters detected (possible language contamination)")

    score = len(found) / len(test['expected_keywords']) * 100
    results.append({
        "test": i,
        "score": score,
        "found": len(found),
        "total": len(test['expected_keywords']),
        "hallucinations": len(hallucinations) > 0
    })

    print()

# Summary
print("\n" + "=" * 60)
print("📊 TEST SUMMARY")
print("=" * 60)

total_score = sum(r['score'] for r in results) / len(results)
hallucination_count = sum(1 for r in results if r['hallucinations'])

print(f"\n🎯 Overall Accuracy: {total_score:.1f}%")
print(f"✅ Tests with hallucinations: {hallucination_count}/{len(results)}")

if total_score >= 70 and hallucination_count == 0:
    print("\n🎉 EXCELLENT! Model quality is much better!")
    print("   ✅ Good factual recall")
    print("   ✅ No hallucinations detected")
    print("   ➡️  Ready for ONNX conversion")
elif total_score >= 50:
    print("\n👍 GOOD! Model quality improved")
    print("   ⚠️  Some facts missing, but much better than before")
    print("   ➡️  Consider testing more or proceeding with ONNX conversion")
else:
    print("\n❌ NEEDS IMPROVEMENT")
    print("   ⚠️  Still missing too many facts")
    print("   ➡️  May need to retrain with more epochs or better data")

print("\n" + "=" * 60)