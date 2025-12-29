# Serhii Hrudakov Model - Complete Usage Guide

You now have **3 versions** of your fine-tuned model, each optimized for different use cases.

## 📦 Your Models

### 1. LoRA Adapter (Original Training Output)
**Repository:** https://huggingface.co/HrudakovSerhii/serhii-smollm-lora
**Size:** ~7.4 MB
**Format:** LoRA adapter weights
**Use Case:** Requires base model to work

### 2. ONNX Model (Browser & Python)
**Repository:** https://huggingface.co/HrudakovSerhii/serhii-smollm-onnx
**Size:** ~518 MB (unquantized)
**Format:** ONNX
**Use Case:** Fast inference in browser (Transformers.js) or Python (ONNX Runtime)

### 3. Quantized ONNX Model (Browser - Smaller)
**Repository:** https://huggingface.co/HrudakovSerhii/serhii-smollm-onnx-quantized
**Size:** ~130 MB (estimated after quantization)
**Format:** ONNX with INT8 quantization
**Use Case:** Faster browser loading, slightly reduced quality

### 4. GGUF Model (LM Studio & Local Apps)
**Repository:** https://huggingface.co/HrudakovSerhii/serhii-smollm-gguf
**Size:** Multiple versions (80MB - 270MB)
**Format:** GGUF (llama.cpp format)
**Use Case:** LM Studio, Ollama, llama.cpp, GPT4All

---

## 🚀 Usage Instructions

### Option 1: Use in Browser (Transformers.js)

**Best for:** Your portfolio website, client-side chat

**Model to use:** `HrudakovSerhii/serhii-smollm-onnx-quantized` (smaller, faster)

#### Installation

```bash
npm install @xenova/transformers
```

#### Code Example

```javascript
import { pipeline } from '@xenova/transformers';

// Load the model (happens once, then cached)
const generator = await pipeline(
  'text-generation',
  'HrudakovSerhii/serhii-smollm-onnx-quantized'
);

// Create a chat interface
async function chat(userMessage, persona = "Recruiter (HR)") {
  const messages = [
    {
      role: "system",
      content: `You are Serhii Hrudakov. You are speaking to a ${persona}. Focus on leadership, business impact, and professional growth.`
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  const result = await generator(messages, {
    max_new_tokens: 200,
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.1
  });

  return result[0].generated_text;
}

// Example usage
const response = await chat("What is your experience with React?");
console.log(response);
```

#### Different Personas

```javascript
// For recruiters
await chat("Tell me about your leadership experience", "Recruiter (HR)");

// For technical interviews
await chat("Explain your React architecture decisions", "Technical Interviewer (Engineer)");

// For casual conversation
await chat("What are your hobbies?", "Friend");
```

#### Progressive Loading (Better UX)

```javascript
// Show loading state
const loadingDiv = document.getElementById('loading');
loadingDiv.textContent = 'Loading model...';

const generator = await pipeline(
  'text-generation',
  'HrudakovSerhii/serhii-smollm-onnx-quantized',
  {
    progress_callback: (progress) => {
      loadingDiv.textContent = `Loading: ${progress.status} ${Math.round(progress.progress || 0)}%`;
    }
  }
);

loadingDiv.style.display = 'none';
```

---

### Option 2: Use in Python (Development/Testing)

**Best for:** Testing, backend services, API endpoints

**Model to use:** `HrudakovSerhii/serhii-smollm-onnx`

#### Installation

```bash
pip install optimum[onnxruntime] transformers
```

#### Code Example

```python
from optimum.onnxruntime import ORTModelForCausalLM
from transformers import AutoTokenizer

# Load model and tokenizer
model = ORTModelForCausalLM.from_pretrained("HrudakovSerhii/serhii-smollm-onnx")
tokenizer = AutoTokenizer.from_pretrained("HrudakovSerhii/serhii-smollm-onnx")

def chat(user_message, persona="Recruiter (HR)"):
    messages = [
        {
            "role": "system",
            "content": f"You are Serhii Hrudakov. You are speaking to a {persona}."
        },
        {
            "role": "user",
            "content": user_message
        }
    ]

    # Format with chat template
    input_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    # Tokenize
    inputs = tokenizer(input_text, return_tensors="pt")

    # Generate
    outputs = model.generate(
        **inputs,
        max_new_tokens=200,
        temperature=0.7,
        top_p=0.9,
        repetition_penalty=1.1,
        do_sample=True
    )

    # Decode
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract assistant's response (after the prompt)
    assistant_response = response.split("assistant\\n")[-1].strip()
    return assistant_response

# Example usage
print(chat("What is your React experience?"))
print(chat("Tell me about a complex migration you led", "Technical Interviewer"))
print(chat("What do you do for fun?", "Friend"))
```

#### Using LoRA Adapter (Smaller Download)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

# Load base model
base_model = AutoModelForCausalLM.from_pretrained("HuggingFaceTB/smolLM2-135M-instruct")

# Load LoRA adapter (only 7.4MB!)
model = PeftModel.from_pretrained(base_model, "HrudakovSerhii/serhii-smollm-lora")
tokenizer = AutoTokenizer.from_pretrained("HrudakovSerhii/serhii-smollm-lora")

# Use same way as above
```

---

### Option 3: Use in LM Studio

**Best for:** Local testing, desktop app, experimenting with different settings

**Model to use:** `HrudakovSerhii/serhii-smollm-gguf`

#### Step-by-Step Guide

**1. Install LM Studio**
- Download from: https://lmstudio.ai/
- Install and open the app

**2. Search for Your Model**
- In LM Studio, go to the **"Search"** or **"Discover"** tab
- In the search box, type: `HrudakovSerhii/serhii-smollm-gguf`
- Press Enter

**3. Choose a Quantization**

You'll see multiple versions:

| File | Size | Quality | Speed | Recommended For |
|------|------|---------|-------|-----------------|
| `model-q4_k_m.gguf` | ~80-100MB | Good | Fast | **RECOMMENDED - Best balance** |
| `model-q5_k_m.gguf` | ~100-120MB | Better | Medium | Higher quality responses |
| `model-q8_0.gguf` | ~140-160MB | Best | Slower | Maximum quality |
| `model-f16.gguf` | ~270MB | Perfect | Slowest | If you have the space |

**Recommendation:** Start with `model-q4_k_m.gguf`

**4. Download**
- Click the **Download** button next to `model-q4_k_m.gguf`
- Wait for download to complete

**5. Load the Model**
- Go to the **"Chat"** tab
- At the top, click **"Select a model to load"**
- Choose `HrudakovSerhii/serhii-smollm-gguf` (Q4_K_M)
- Click **"Load Model"**

**6. Configure System Prompt**

In the system prompt box, paste one of these:

**For Recruiter/HR:**
```
You are Serhii Hrudakov. You are speaking to a Recruiter (HR). Focus on leadership, business impact, and professional growth.
```

**For Technical Interviews:**
```
You are Serhii Hrudakov. You are speaking to a Technical Interviewer (Engineer). Focus on tech stack, architecture, and problem-solving.
```

**For Casual Chat:**
```
You are Serhii Hrudakov. You are speaking to a Friend. Focus on hobbies, personality, and personal stories.
```

**7. Adjust Settings (Optional)**

Recommended settings for best results:
- **Temperature:** 0.7
- **Top P:** 0.9
- **Repetition Penalty:** 1.1
- **Max Tokens:** 200-300

**8. Start Chatting!**

Try these example prompts:
- "Tell me about your experience with React"
- "What was your proudest achievement?"
- "Describe a complex migration you led"
- "What do you do for fun?"

---

### Option 4: Use with Ollama (Terminal/CLI)

**Best for:** Command-line use, server deployment, Docker

**Model to use:** `HrudakovSerhii/serhii-smollm-gguf`

#### Setup

**1. Install Ollama**
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

**2. Create Modelfile**

Create a file named `Modelfile`:

```dockerfile
FROM HrudakovSerhii/serhii-smollm-gguf:q4_k_m

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1

SYSTEM You are Serhii Hrudakov. You are speaking to a Recruiter (HR). Focus on leadership, business impact, and professional growth.
```

**3. Create the Model**

```bash
ollama create serhii-chat -f Modelfile
```

**4. Run**

```bash
ollama run serhii-chat
```

Then just type your questions!

#### API Usage (Server Mode)

```bash
# Start Ollama server
ollama serve

# In another terminal, make requests
curl http://localhost:11434/api/generate -d '{
  "model": "serhii-chat",
  "prompt": "What is your experience with React?",
  "stream": false
}'
```

---

## 🎨 Integration Examples

### React Component Example

```jsx
import { useState, useEffect } from 'react';
import { pipeline } from '@xenova/transformers';

function SerhiiChat() {
  const [generator, setGenerator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [persona, setPersona] = useState('Recruiter (HR)');

  useEffect(() => {
    async function loadModel() {
      const gen = await pipeline(
        'text-generation',
        'HrudakovSerhii/serhii-smollm-onnx-quantized'
      );
      setGenerator(gen);
      setLoading(false);
    }
    loadModel();
  }, []);

  async function sendMessage() {
    if (!message.trim() || !generator) return;

    const userMsg = message;
    setMessage('');
    setConversation([...conversation, { role: 'user', content: userMsg }]);

    const messages = [
      {
        role: 'system',
        content: `You are Serhii Hrudakov. You are speaking to a ${persona}.`
      },
      ...conversation,
      { role: 'user', content: userMsg }
    ];

    const result = await generator(messages, {
      max_new_tokens: 200,
      temperature: 0.7
    });

    const response = result[0].generated_text;
    setConversation([
      ...conversation,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: response }
    ]);
  }

  if (loading) return <div>Loading Serhii's AI...</div>;

  return (
    <div className="chat-container">
      <select value={persona} onChange={(e) => setPersona(e.target.value)}>
        <option>Recruiter (HR)</option>
        <option>Technical Interviewer (Engineer)</option>
        <option>Friend</option>
      </select>

      <div className="messages">
        {conversation.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="Ask me anything..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default SerhiiChat;
```

### Next.js API Route Example

```javascript
// app/api/chat/route.js
import { ORTModelForCausalLM } from 'optimum/onnxruntime';
import { AutoTokenizer } from 'transformers';

let model, tokenizer;

async function loadModel() {
  if (!model) {
    model = await ORTModelForCausalLM.from_pretrained(
      'HrudakovSerhii/serhii-smollm-onnx'
    );
    tokenizer = await AutoTokenizer.from_pretrained(
      'HrudakovSerhii/serhii-smollm-onnx'
    );
  }
}

export async function POST(request) {
  await loadModel();

  const { message, persona = 'Recruiter (HR)' } = await request.json();

  const messages = [
    {
      role: 'system',
      content: `You are Serhii Hrudakov. You are speaking to a ${persona}.`
    },
    { role: 'user', content: message }
  ];

  const input = tokenizer.apply_chat_template(messages, { tokenize: false });
  const inputs = tokenizer(input, { return_tensors: 'pt' });
  const outputs = await model.generate(inputs, {
    max_new_tokens: 200,
    temperature: 0.7
  });

  const response = tokenizer.decode(outputs[0], { skip_special_tokens: true });

  return Response.json({ response });
}
```

---

## 📊 Model Comparison

| Feature | ONNX Full | ONNX Quantized | GGUF Q4 | GGUF Q8 |
|---------|-----------|----------------|---------|---------|
| **Size** | 518 MB | ~130 MB | ~85 MB | ~160 MB |
| **Quality** | Best | Very Good | Good | Excellent |
| **Browser** | ✅ Yes | ✅ Yes (Faster) | ❌ No | ❌ No |
| **Python** | ✅ Yes | ✅ Yes | ⚠️ With llama-cpp-python | ⚠️ With llama-cpp-python |
| **LM Studio** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Ollama** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Loading Time** | Slow | Fast | Very Fast | Fast |

---

## 🎯 Recommended Setup for Your Portfolio

**Frontend (Browser):**
```javascript
// Use quantized ONNX for fastest loading
import { pipeline } from '@xenova/transformers';
const generator = await pipeline(
  'text-generation',
  'HrudakovSerhii/serhii-smollm-onnx-quantized'
);
```

**Backend (Optional API):**
```python
# Use full ONNX for best quality
from optimum.onnxruntime import ORTModelForCausalLM
model = ORTModelForCausalLM.from_pretrained(
  "HrudakovSerhii/serhii-smollm-onnx"
)
```

**Local Testing:**
```
Use LM Studio with GGUF Q4_K_M for quick experimentation
```

---

## 🔧 Troubleshooting

### Browser: Model Loading Too Slow
- Use the quantized version: `serhii-smollm-onnx-quantized`
- Enable caching (Transformers.js does this automatically)
- Show a loading progress bar

### Browser: Out of Memory
- Use smaller quantized model
- Reduce `max_new_tokens` to 100-150
- Clear browser cache and reload

### Python: Import Errors
```bash
pip install --upgrade optimum[onnxruntime] transformers torch
```

### LM Studio: Can't Find Model
- Make sure you're searching for exact repo: `HrudakovSerhii/serhii-smollm-gguf`
- Check you have internet connection
- Try manual download from HuggingFace and import in LM Studio

### Response Quality Issues
- Adjust temperature (lower = more focused, higher = more creative)
- Change the system prompt to be more specific
- Try a higher quality quantization (Q5 or Q8 instead of Q4)

---

## 📝 Notes

- **First load:** Model downloads once, then caches locally
- **Browser cache:** ~130-518 MB depending on version
- **Generation speed:** ~2-5 tokens/second in browser, ~20-50 tokens/second with ONNX Runtime
- **Context length:** 2048 tokens maximum

---

## 🎉 Next Steps

1. **Test in browser:** Start with the Transformers.js example
2. **Try LM Studio:** Download and chat locally
3. **Integrate:** Add to your portfolio website
4. **Customize:** Adjust prompts and personas for your use case

Your model is ready to use! 🚀
