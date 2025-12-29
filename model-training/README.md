# Serhii Hrudakov LLM Training

Fine-tune a small language model to respond as Serhii Hrudakov with different personas (HR/Recruiter, Technical Interviewer, Friend).

## Model Details

- **Base Model**: `HuggingFaceTB/smolLM2-135M-instruct` (135M parameters)
- **Method**: LoRA (Low-Rank Adaptation) - efficient fine-tuning
- **Output Format**: ONNX with 4-bit quantization (Q4)
- **Final Size**: ~85MB (suitable for browser deployment with Transformers.js)

## Training Data

The training data is in `output.jsonl` with 568 conversation examples formatted as:

```json
{"messages":[
  {"role":"system","content":"You are Serhii Hrudakov. You are speaking to a..."},
  {"role":"user","content":"..."},
  {"role":"assistant","content":"..."}
]}
```

Each example teaches the model how to respond with the appropriate tone and information based on the audience.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Train the Model

```bash
python train_lora.py
```

This will:
- Load the base model with 4-bit quantization
- Apply LoRA adapters
- Train for 3 epochs on your data
- Save checkpoints to `./serhii-lora-model`

**Training time**: Approximately 30-60 minutes on GPU, 2-4 hours on CPU (with M2 chip)

### 3. Convert to ONNX

```bash
python convert_to_onnx.py
```

This will:
- Merge LoRA weights with the base model → `./serhii-merged-model`
- Convert to ONNX format → `./serhii-onnx-model`
- Apply 4-bit quantization → `./serhii-onnx-model-q4`

The final quantized ONNX model will be ~85MB and ready for Transformers.js.

## Hardware Requirements

- **Minimum**: 8GB RAM (CPU training)
- **Recommended**: 16GB RAM + Apple Silicon M-series chip or NVIDIA GPU
- **Disk Space**: ~5GB (for models and checkpoints)

## Using the Fine-tuned Model

### With Python (Transformers)

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained("HuggingFaceTB/smolLM2-135M-instruct")
model = PeftModel.from_pretrained(base_model, "./serhii-lora-model")
tokenizer = AutoTokenizer.from_pretrained("./serhii-lora-model")

messages = [
    {"role": "system", "content": "You are Serhii Hrudakov. You are speaking to a Recruiter (HR)."},
    {"role": "user", "content": "Tell me about your experience with React."}
]

input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(input_text, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=200)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

### With JavaScript (Transformers.js)

```javascript
import { pipeline } from '@xenova/transformers';

const generator = await pipeline('text-generation', './serhii-onnx-model-q4');

const messages = [
  { role: 'system', content: 'You are Serhii Hrudakov. You are speaking to a Friend.' },
  { role: 'user', content: 'What do you like to do for fun?' }
];

const result = await generator(messages, { max_new_tokens: 200 });
console.log(result);
```

## Training Customization

You can adjust training parameters in `train_lora.py`:

- `num_train_epochs`: Number of passes through the dataset (default: 3)
- `learning_rate`: How fast the model learns (default: 2e-4)
- `r`: LoRA rank - higher = more capacity but slower (default: 16)
- `lora_alpha`: LoRA scaling factor (default: 32)

## Troubleshooting

### Out of Memory
- Reduce `per_device_train_batch_size` in training_args
- Increase `gradient_accumulation_steps`

### Slow Training
- Ensure you have GPU/MPS acceleration enabled
- Reduce dataset size for testing
- Use fewer epochs

### ONNX Conversion Fails
- Make sure training completed successfully
- Check that the merged model exists
- Verify optimum package is installed correctly

## Next Steps

After training and conversion:

1. Test the model with different personas
2. Integrate into your portfolio chat UI
3. Deploy to web using Transformers.js
4. Monitor performance and collect feedback

## References

- [HuggingFace smolLM2](https://huggingface.co/HuggingFaceTB/smolLM2-135M-instruct)
- [PEFT (LoRA) Documentation](https://huggingface.co/docs/peft)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [ONNX Runtime](https://onnxruntime.ai/)
