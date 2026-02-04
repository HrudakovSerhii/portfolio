# Test Your Fine-tuned Model Locally

## Quick Start

### 1. Install Dependencies

```bash
cd model-training/test
pip install -r requirements.txt
```

### 2. Run the Test Script

```bash
python test_model.py
```

## What It Does

The script will:

1. **Download the model** (136MB, only on first run - then cached)
2. **Run automated tests** with different personas:
   - Recruiter (HR) - Business/leadership questions
   - Technical Interviewer - Tech stack questions
   - Friend - Personal/hobby questions

3. **Offer interactive mode** where you can chat freely

## Example Output

```
🚀 Loading Serhii's Fine-tuned Model...
============================================================
📥 Downloading model: HrudakovSerhii/serhii-smollm-onnx-quantized
⏳ This may take 1-2 minutes on first run...
✅ Model loaded in 12.34 seconds
============================================================

🧪 TESTING DIFFERENT PERSONAS
============================================================

------------------------------------------------------------
👔 PERSONA: Recruiter (HR)
------------------------------------------------------------
Q: What is your experience with React and frontend development?
💭 Thinking... (1.23s)
A: I have extensive experience with React...
```

## Interactive Mode

After automated tests, you can chat interactively:

```
💬 INTERACTIVE MODE
============================================================
Type your questions and press Enter.
Commands:
  /persona <name>  - Change persona (Recruiter/Engineer/Friend)
  /quit or /exit   - Exit interactive mode
============================================================

Current persona: Recruiter (HR)

You: What is your experience with React?
💭 Thinking... (1.23s)
Serhii: I have 8+ years of experience with React...

You: /persona friend
✅ Persona changed to: Friend

You: What do you do for fun?
💭 Thinking... (1.45s)
Serhii: I love hiking in the Alps...

You: /quit
👋 Goodbye!
```

## Available Personas

- **Recruiter (HR)** - Focuses on leadership, business impact, professional growth
- **Technical Interviewer (Engineer)** - Focuses on tech stack, architecture, problem-solving
- **Friend** - Casual tone, hobbies, personal stories

Change persona in interactive mode:
- `/persona recruiter` or `/persona hr`
- `/persona engineer` or `/persona tech`
- `/persona friend` or `/persona casual`

## Customization

Edit `test_model.py` to adjust:
- `max_tokens` - Response length (default: 200)
- `temperature` - Creativity (0.7 = balanced, lower = focused, higher = creative)
- `top_p` - Sampling diversity (default: 0.9)

## Troubleshooting

### Installation Issues

If you get errors installing packages:

```bash
# Try with Python 3.9-3.11 (best compatibility)
python3.11 -m pip install -r requirements.txt
```

### Model Download Issues

If download fails:
- Check internet connection
- Try again (downloads resume automatically)
- Model is cached in `~/.cache/huggingface/`

### Slow Performance

First run is slower (loading model). Subsequent runs are faster.

On M2 Mac: ~1-2 seconds per response
On CPU: ~3-5 seconds per response

## Using in Your Code

```python
from optimum.onnxruntime import ORTModelForCausalLM
from transformers import AutoTokenizer

model = ORTModelForCausalLM.from_pretrained("HrudakovSerhii/serhii-smollm-onnx-quantized")
tokenizer = AutoTokenizer.from_pretrained("HrudakovSerhii/serhii-smollm-onnx-quantized")

messages = [
    {"role": "system", "content": "You are Serhii Hrudakov. You are speaking to a Recruiter (HR)."},
    {"role": "user", "content": "What is your React experience?"}
]

input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(input_text, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=200)
response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)
```