#!/usr/bin/env python3
"""
Test Serhii's fine-tuned model locally
Run: python test_model.py
"""

from optimum.onnxruntime import ORTModelForCausalLM
from transformers import AutoTokenizer
import time

print("🚀 Loading Serhii's Fine-tuned Model...")
print("=" * 60)

# Load model and tokenizer (136MB download on first run, then cached)
MODEL_NAME = "HrudakovSerhii/serhii-smollm-onnx-quantized"

print(f"📥 Downloading model: {MODEL_NAME}")
print("⏳ This may take 1-2 minutes on first run...")

start_time = time.time()
model = ORTModelForCausalLM.from_pretrained(MODEL_NAME)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
load_time = time.time() - start_time

print(f"✅ Model loaded in {load_time:.2f} seconds")
print("=" * 60)


def chat(message, persona="Recruiter (HR)", max_tokens=200, temperature=0.7, show_prompt=False):
    """
    Chat with Serhii's AI model

    Args:
        message: Your question/message
        persona: Who you're pretending to be (Recruiter, Technical Interviewer, Friend)
        max_tokens: Maximum response length
        temperature: Creativity (0.7 = balanced, lower = focused, higher = creative)
        show_prompt: Whether to show the full prompt (for debugging)

    Returns:
        The model's response
    """
    # Construct the conversation
    messages = [
        {
            "role": "system",
            "content": f"You are Serhii Hrudakov. You are speaking to a {persona}."
        },
        {
            "role": "user",
            "content": message
        }
    ]

    # Format using chat template
    input_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    if show_prompt:
        print("\n📝 Full prompt sent to model:")
        print("-" * 60)
        print(input_text)
        print("-" * 60 + "\n")

    # Tokenize
    inputs = tokenizer(input_text, return_tensors="pt")

    # Generate
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

    # Decode
    full_response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract just the assistant's response (after the last "assistant" marker)
    if "assistant" in full_response:
        response = full_response.split("assistant")[-1].strip()
    else:
        response = full_response.strip()

    return response


def test_personas():
    """Test the model with different personas"""

    print("\n" + "=" * 60)
    print("🧪 TESTING DIFFERENT PERSONAS")
    print("=" * 60)

    # Test 1: Recruiter/HR
    print("\n" + "-" * 60)
    print("👔 PERSONA: Recruiter (HR)")
    print("-" * 60)
    question1 = "What is your experience with React and frontend development?"
    print(f"Q: {question1}")
    print(f"A: {chat(question1, persona='Recruiter (HR)', max_tokens=150)}\n")

    # Test 2: Technical Interviewer
    print("-" * 60)
    print("💻 PERSONA: Technical Interviewer (Engineer)")
    print("-" * 60)
    question2 = "Describe a complex migration you led."
    print(f"Q: {question2}")
    print(f"A: {chat(question2, persona='Technical Interviewer (Engineer)', max_tokens=150)}\n")

    # Test 3: Friend (Casual)
    print("-" * 60)
    print("🎯 PERSONA: Friend")
    print("-" * 60)
    question3 = "What do you like to do for fun?"
    print(f"Q: {question3}")
    print(f"A: {chat(question3, persona='Friend', max_tokens=150)}\n")

    # Test 4: Business Focus
    print("-" * 60)
    print("👔 PERSONA: Recruiter (HR) - Business Impact")
    print("-" * 60)
    question4 = "Tell me about a time when your work directly impacted business revenue."
    print(f"Q: {question4}")
    print(f"A: {chat(question4, persona='Recruiter (HR)', max_tokens=150)}\n")


def interactive_mode():
    """Interactive chat mode"""

    print("\n" + "=" * 60)
    print("💬 INTERACTIVE MODE")
    print("=" * 60)
    print("Type your questions and press Enter.")
    print("Commands:")
    print("  /persona <name>  - Change persona (Recruiter/Engineer/Friend)")
    print("  /quit or /exit   - Exit interactive mode")
    print("=" * 60 + "\n")

    current_persona = "Recruiter (HR)"
    print(f"Current persona: {current_persona}\n")

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            # Commands
            if user_input.lower() in ['/quit', '/exit']:
                print("👋 Goodbye!")
                break

            if user_input.lower().startswith('/persona '):
                persona_map = {
                    'recruiter': 'Recruiter (HR)',
                    'hr': 'Recruiter (HR)',
                    'engineer': 'Technical Interviewer (Engineer)',
                    'technical': 'Technical Interviewer (Engineer)',
                    'tech': 'Technical Interviewer (Engineer)',
                    'friend': 'Friend',
                    'casual': 'Friend'
                }

                persona_key = user_input[9:].strip().lower()
                if persona_key in persona_map:
                    current_persona = persona_map[persona_key]
                    print(f"✅ Persona changed to: {current_persona}\n")
                else:
                    print(f"❌ Unknown persona. Use: recruiter, engineer, or friend\n")
                continue

            # Get response
            response = chat(user_input, persona=current_persona, max_tokens=200)
            print(f"Serhii: {response}\n")

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}\n")


def main():
    """Main test function"""

    # Run automated tests
    test_personas()

    # Ask if user wants interactive mode
    print("\n" + "=" * 60)
    choice = input("Would you like to try interactive mode? (y/n): ").strip().lower()

    if choice in ['y', 'yes']:
        interactive_mode()
    else:
        print("\n✅ Testing complete!")
        print("\n💡 To run interactive mode, uncomment the interactive_mode() call in main()")


if __name__ == "__main__":
    main()