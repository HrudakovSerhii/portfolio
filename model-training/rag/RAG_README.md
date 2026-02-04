# RAG Test Script Agent Readme

## Mission
Build a Python test script that demonstrates RAG (Retrieval-Augmented Generation) by:
1. Accepting a test query string
2. Generating embeddings for the query
3. Searching for the best matching chunks in role-specific embedding JSON files
4. Passing retrieved context to the fine-tuned Qwen model
5. Generating a response using both RAG context and the fine-tuned model

## Existing Infrastructure

### Embedding Files (Already Generated)
**Location:** `/Users/serhiihrudakov/Documents/Code/FE/portfolio/model-training/rag/embedding-data/`

Three role-specific JSON files:
- `embeddings-hr.json` (1.9 MB, 174 chunks) - Professional/leadership focus
- `embeddings-developer.json` (2.4 MB, 226 chunks) - Technical focus
- `embeddings-friend.json` (1.8 MB, 169 chunks) - Personal/hobbies focus

**Format:**
```json
[
  {
    "id": "professional_leadership_eriksdigital_chunk_0",
    "text": "Q: Can you describe a time you had to manage conflict?\nA: Yes, during my time at EriksDigital...",
    "embedding": [0.123, -0.045, ...],  // 384-dimensional vector
    "metadata": {
      "category": "professional_leadership",
      "company": "EriksDigital",
      "keywords": ["EriksDigital", "team", "conflict"]
    }
  }
]
```

### Embedding Model
**Model:** `sentence-transformers/all-MiniLM-L6-v2`
- **Dimension:** 384
- **Normalization:** L2 normalized (cosine similarity optimized)
- **Install:** `pip install sentence-transformers`

### Fine-tuned Model
**Local Model:** `/Users/serhiihrudakov/Documents/Code/FE/portfolio/model-training/serhii-qwen-lora-v2/`
- Base: Qwen2.5-0.5B-Instruct with LoRA
- Trained on 568 CV Q&A pairs
- Supports chat template format

## Script Requirements

### Input
- **Test query string** (e.g., "What was your impact at A-Dam?")
- **Role selection** (hr, developer, or friend)
- **Number of chunks to retrieve** (default: 5, configurable)
- **Similarity threshold** (default: 0.7, configurable)

### Output
The script should display:

1. **Query Information:**
   - Test query
   - Selected role
   - Query embedding dimensions

2. **Retrieved Chunks:**
   - Top-K chunks with similarity scores
   - Chunk ID, category, company
   - First 100 characters of chunk text
   - Similarity score (0-1 range)

3. **RAG Context:**
   - Combined context passed to LLM
   - Number of chunks used
   - Total context length

4. **Model Response:**
   - Response with RAG context
   - Response without RAG context (baseline comparison)
   - Response time for each

5. **Evaluation:**
   - Response quality comparison
   - Fact accuracy check (if applicable)
   - Hallucination detection

## Technical Implementation Steps

### Step 1: Load Embedding Model
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
```

### Step 2: Load Role-Specific Embeddings

```python
import json


def load_embeddings(role):
   """Load embeddings for specified role (hr, developer, friend)"""
   base_path = "/data"
   file_path = f"{base_path}/embeddings-{role}.json"

   with open(file_path, 'r') as f:
      chunks = json.load(f)

   return chunks
```

### Step 3: Generate Query Embedding
```python
import numpy as np

def generate_query_embedding(query, model):
    """Generate L2-normalized embedding for query"""
    embedding = model.encode(query, normalize_embeddings=True)
    return embedding
```

### Step 4: Find Similar Chunks (Cosine Similarity)
```python
def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def find_top_chunks(query_embedding, chunks, top_k=5, threshold=0.7):
    """Find top-K most similar chunks above threshold"""
    results = []

    for chunk in chunks:
        chunk_embedding = np.array(chunk['embedding'])
        similarity = cosine_similarity(query_embedding, chunk_embedding)

        if similarity >= threshold:
            results.append({
                'chunk': chunk,
                'similarity': similarity
            })

    # Sort by similarity descending
    results.sort(key=lambda x: x['similarity'], reverse=True)

    return results[:top_k]
```

### Step 5: Build RAG Context
```python
def build_rag_context(retrieved_chunks):
    """Combine retrieved chunks into context string"""
    context_parts = []

    for i, result in enumerate(retrieved_chunks, 1):
        chunk = result['chunk']
        similarity = result['similarity']

        context_parts.append(
            f"[Context {i}] (Similarity: {similarity:.3f})\n{chunk['text']}"
        )

    return "\n\n".join(context_parts)
```

### Step 6: Load Fine-tuned Model
```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

def load_finetuned_model():
    """Load locally trained Qwen model"""
    model_path = "/Users/serhiihrudakov/Documents/Code/FE/portfolio/model-training/serhii-qwen-lora-v2"

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.float32,
        device_map="auto"
    )

    return tokenizer, model
```

### Step 7: Generate Response with RAG
```python
def generate_response(query, role, context, tokenizer, model, max_tokens=200):
    """Generate response using RAG context"""

    # Role descriptions
    role_descriptions = {
        "hr": "You are Serhii Hrudakov. You are speaking to a Recruiter (HR). Focus on leadership, business impact, and professional growth.",
        "developer": "You are Serhii Hrudakov. You are speaking to a Senior Engineer. Focus on technical details, architecture, and problem-solving.",
        "friend": "You are Serhii Hrudakov. You are speaking to a Friend. Be casual and personal."
    }

    # Build messages with RAG context
    messages = [
        {"role": "system", "content": role_descriptions.get(role, role_descriptions["hr"])},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
    ]

    # Format using chat template
    input_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    # Tokenize and generate
    inputs = tokenizer(input_text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )

    # Decode response
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract assistant response (after last "assistant" marker)
    if "assistant" in response:
        response = response.split("assistant")[-1].strip()

    return response
```

### Step 8: Generate Baseline Response (No RAG)
```python
def generate_baseline_response(query, role, tokenizer, model, max_tokens=200):
    """Generate response WITHOUT RAG context for comparison"""

    role_descriptions = {
        "hr": "You are Serhii Hrudakov. You are speaking to a Recruiter (HR). Focus on leadership, business impact, and professional growth.",
        "developer": "You are Serhii Hrudakov. You are speaking to a Senior Engineer. Focus on technical details, architecture, and problem-solving.",
        "friend": "You are Serhii Hrudakov. You are speaking to a Friend. Be casual and personal."
    }

    messages = [
        {"role": "system", "content": role_descriptions.get(role, role_descriptions["hr"])},
        {"role": "user", "content": query}
    ]

    input_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer(input_text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    if "assistant" in response:
        response = response.split("assistant")[-1].strip()

    return response
```

## Expected Output Format

```
================================================================================
RAG TEST SCRIPT - Retrieval-Augmented Generation
================================================================================

QUERY INFORMATION
--------------------------------------------------------------------------------
Query: "What was your impact at A-Dam?"
Role: hr
Query embedding dimensions: 384

RETRIEVED CHUNKS (Top 5)
--------------------------------------------------------------------------------
[1] Similarity: 0.876
    ID: professional_impact_adam_chunk_0
    Category: professional_impact
    Company: A-Dam
    Text: "Q: What was your impact at A-Dam?\nA: I helped them increase revenue by 100%..."

[2] Similarity: 0.843
    ID: professional_impact_adam_chunk_1
    Category: professional_impact
    Company: A-Dam
    Text: "Q: How did you improve the platform?\nA: We migrated to NextJS 14 with React Server..."

[3] Similarity: 0.812
    ...

RAG CONTEXT
--------------------------------------------------------------------------------
Total chunks: 5
Total context length: 1,234 characters

Context passed to model:
[Context 1] (Similarity: 0.876)
Q: What was your impact at A-Dam?
A: I helped them increase revenue by 100%...

[Context 2] (Similarity: 0.843)
...

MODEL RESPONSE (WITH RAG)
--------------------------------------------------------------------------------
Response time: 2.34s

At A-Dam, I had significant business impact. I helped them increase revenue by 100%
and improve customer retention to 75%. We achieved this by migrating to NextJS 14
with React Server Components, implementing GraphQL for better data management, and
optimizing the platform architecture. The technical improvements directly translated
to business outcomes.

BASELINE RESPONSE (WITHOUT RAG)
--------------------------------------------------------------------------------
Response time: 1.87s

I worked at A-Dam on improving their platform using NextJS and React. We focused on
technical improvements and business growth.

COMPARISON
--------------------------------------------------------------------------------
RAG Response: ✅ Includes specific metrics (100%, 75%)
RAG Response: ✅ Mentions specific technologies (NextJS 14, GraphQL, RSC)
RAG Response: ✅ Connects technical work to business impact

Baseline Response: ❌ Generic, lacks specifics
Baseline Response: ❌ No metrics or concrete achievements

VERDICT: RAG significantly improves factual accuracy and detail richness
================================================================================
```

## Test Cases

The agent should create at least 5 test cases covering:

1. **HR Role - Business Impact:**
   - Query: "What was your impact at A-Dam?"
   - Expected: Retrieves impact metrics (100% revenue, 75% retention)

2. **Developer Role - Technical Architecture:**
   - Query: "How did you migrate EriksDigital from monolith to micro-frontend?"
   - Expected: Retrieves technical migration details

3. **Developer Role - Technology Stack:**
   - Query: "What's your experience with React and NextJS?"
   - Expected: Retrieves multiple projects using React/NextJS

4. **HR Role - Career Decisions:**
   - Query: "Why did you leave Hexaware/Mobiquity?"
   - Expected: Retrieves career transition reasons

5. **Friend Role - Personal Interests:**
   - Query: "What do you like to do in your free time?"
   - Expected: Retrieves hiking/Alps/outdoor activities

## Success Criteria

The test script is successful if it:

1. ✅ Loads all three role-specific embedding files correctly
2. ✅ Generates query embeddings with correct dimensions (384)
3. ✅ Finds relevant chunks with similarity scores
4. ✅ Builds proper RAG context from retrieved chunks
5. ✅ Generates responses using the fine-tuned model
6. ✅ Shows clear comparison between RAG and baseline responses
7. ✅ Demonstrates improved factual accuracy with RAG
8. ✅ Runs all test cases without errors
9. ✅ Provides clear, formatted output

## Deliverables

1. **Main script:** `test_rag.py`
   - Complete implementation
   - Command-line interface for interactive testing
   - Supports all three roles

2. **Automated test suite:** `test_rag_automated.py`
   - Runs all 5 test cases
   - Compares RAG vs baseline
   - Generates summary report

3. **README:** `RAG_TEST_README.md`
   - Installation instructions
   - Usage examples
   - Configuration options
   - Troubleshooting

## Configuration Options

Allow users to configure:
- `role`: hr, developer, friend
- `top_k`: Number of chunks to retrieve (default: 5)
- `similarity_threshold`: Minimum similarity (default: 0.7)
- `max_tokens`: Max response length (default: 200)
- `temperature`: Sampling temperature (default: 0.7)
- `verbose`: Show detailed debug output (default: False)

## Error Handling

The script should handle:
- Missing embedding files
- Invalid role names
- Empty query strings
- Model loading failures
- Out of memory errors
- No chunks found above threshold

## Performance Considerations

- Load embedding model once (not per query)
- Load fine-tuned model once (not per query)
- Use numpy for efficient similarity calculations
- Cache embeddings if running multiple tests
- Display progress for long operations

## Dependencies

Required packages (add to requirements.txt):
```
sentence-transformers>=2.2.0
transformers>=4.36.0
torch>=2.0.0
numpy>=1.24.0
```

## Notes for Agent

- Use the EXACT model name: `sentence-transformers/all-MiniLM-L6-v2`
- Embeddings are already L2-normalized, no need to normalize again
- Fine-tuned model is in LoRA format, loads with standard transformers
- Chat template is built into the tokenizer
- MPS (Apple Silicon) is available via `device_map="auto"`
- All paths are absolute to avoid confusion
- Output should be visually clear with separators and formatting
