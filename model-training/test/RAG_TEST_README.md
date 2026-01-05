# RAG Test Suite - README

## Overview

This test suite demonstrates **Retrieval-Augmented Generation (RAG)** by combining:
1. **Sentence embeddings** for semantic search
2. **Role-specific knowledge chunks** with pre-computed embeddings
3. **Fine-tuned Qwen model** for personalized responses

The system retrieves relevant context from your CV/portfolio data and uses it to generate more accurate, factual responses.

## Architecture

```
┌─────────────────┐
│  User Query     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Sentence Transformer       │
│  (all-MiniLM-L6-v2)        │
│  Generate Query Embedding   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Cosine Similarity Search   │
│  Find Top-K Chunks          │
│  (embeddings-{role}.json)   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Build RAG Context          │
│  Combine Retrieved Chunks   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Fine-tuned Qwen Model      │
│  Generate Response with     │
│  Context + Query            │
└─────────────────────────────┘
```

## Installation

### Prerequisites

- Python 3.8 or higher
- At least 4GB RAM (8GB recommended for larger models)
- macOS, Linux, or Windows

### Step 1: Install Dependencies

```bash
cd /Users/serhiihrudakov/Documents/Code/FE/portfolio/model-training/test

pip install -r requirements.txt
```

**requirements.txt:**
```
sentence-transformers>=2.2.0
transformers>=4.36.0
torch>=2.0.0
numpy>=1.24.0
```

### Step 2: Verify File Structure

Ensure the following files exist:

```
portfolio/
├── public/data/
│   ├── embeddings-hr.json          (1.9 MB, 174 chunks)
│   ├── embeddings-developer.json   (2.4 MB, 226 chunks)
│   └── embeddings-friend.json      (1.8 MB, 169 chunks)
│
└── model-training/
    ├── serhii-qwen-lora-v2/        (Fine-tuned model)
    │   ├── config.json
    │   ├── model.safetensors
    │   └── tokenizer files...
    │
    └── test/
        ├── test_rag.py                (Main test script)
        ├── test_rag_automated.py      (Automated test suite)
        └── RAG_TEST_README.md         (This file)
```

## Usage

### Interactive Testing (Single Query)

Run a single test query with custom parameters:

```bash
python test_rag.py "What was your impact at A-Dam?" --role hr
```

**Basic Examples:**

```bash
# HR role - business impact
python test_rag.py "What was your impact at A-Dam?" --role hr

# Developer role - technical details
python test_rag.py "How did you migrate EriksDigital to micro-frontend?" --role developer

# Friend role - personal interests
python test_rag.py "What do you do for fun?" --role friend
```

### Advanced Options

```bash
# Retrieve more chunks (default: 5)
python test_rag.py "What's your React experience?" --role developer --top-k 10

# Lower similarity threshold to get more results (default: 0.7)
python test_rag.py "Tell me about yourself" --role hr --threshold 0.5

# Longer responses (default: 200 tokens)
python test_rag.py "Describe your career journey" --role hr --max-tokens 400

# Higher temperature for more creative responses (default: 0.7)
python test_rag.py "What motivates you?" --role friend --temperature 0.9

# Verbose mode for debugging
python test_rag.py "What projects have you worked on?" --role developer --verbose
```

### Automated Test Suite

Run all 5 predefined test cases and generate a summary report:

```bash
python test_rag_automated.py
```

**With custom parameters:**

```bash
# Run with different settings
python test_rag_automated.py --top-k 10 --threshold 0.6 --max-tokens 300

# Enable verbose output
python test_rag_automated.py --verbose
```

## Configuration Options

### Command-Line Arguments

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | str | required | Test query string (e.g., "What was your impact at A-Dam?") |
| `--role` | str | `hr` | Role perspective: `hr`, `developer`, or `friend` |
| `--top-k` | int | `5` | Number of chunks to retrieve |
| `--threshold` | float | `0.7` | Minimum similarity score (0-1) |
| `--max-tokens` | int | `200` | Maximum response length in tokens |
| `--temperature` | float | `0.7` | Sampling temperature (0=deterministic, 1=creative) |
| `--verbose` | flag | `False` | Show detailed debug output |

### Role Descriptions

Each role has a specific system prompt that influences response style:

- **hr**: Professional, business-focused, highlights impact and leadership
- **developer**: Technical, detailed, emphasizes architecture and problem-solving
- **friend**: Casual, personal, conversational tone

## Output Format

The test script displays:

1. **Query Information**: Query text, role, embedding dimensions
2. **Retrieved Chunks**: Top-K chunks with similarity scores, IDs, categories
3. **RAG Context**: Combined context passed to the model
4. **Model Response (With RAG)**: Response using retrieved context
5. **Baseline Response (Without RAG)**: Response without context for comparison
6. **Comparison**: Side-by-side metrics and quality assessment

## Example Output

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
    Text: "Q: What was your impact at A-Dam?
A: I helped them increase revenue by 100%..."

[2] Similarity: 0.843
    ID: professional_impact_adam_chunk_1
    Category: professional_impact
    Company: A-Dam
    Text: "Q: How did you improve the platform?
A: We migrated to NextJS 14..."

RAG CONTEXT
--------------------------------------------------------------------------------
Total chunks: 5
Total context length: 1,234 characters

MODEL RESPONSE (WITH RAG)
--------------------------------------------------------------------------------
Response time: 2.34s

At A-Dam, I had significant business impact. I helped them increase revenue by
100% and improve customer retention to 75%. We achieved this by migrating to
NextJS 14 with React Server Components, implementing GraphQL for better data
management, and optimizing the platform architecture.

BASELINE RESPONSE (WITHOUT RAG)
--------------------------------------------------------------------------------
Response time: 1.87s

I worked at A-Dam on improving their platform using NextJS and React. We focused
on technical improvements and business growth.

COMPARISON
--------------------------------------------------------------------------------
RAG response length: 245 characters
Baseline response length: 98 characters
Context provided: 5 chunks
================================================================================
```

## Test Cases

The automated suite includes 5 test cases:

| # | Test Name | Query | Role | Expected Elements |
|---|-----------|-------|------|-------------------|
| 1 | HR Role - Business Impact | "What was your impact at A-Dam?" | hr | 100%, revenue, 75%, retention |
| 2 | Developer Role - Technical Architecture | "How did you migrate EriksDigital from monolith to micro-frontend?" | developer | micro-frontend, migration, architecture |
| 3 | Developer Role - Technology Stack | "What's your experience with React and NextJS?" | developer | React, NextJS, Next.js |
| 4 | HR Role - Career Decisions | "Why did you leave Hexaware/Mobiquity?" | hr | career, growth, opportunity |
| 5 | Friend Role - Personal Interests | "What do you like to do in your free time?" | friend | hiking, Alps, outdoor, travel |

## Troubleshooting

### Issue: "Embeddings file not found"

**Error:**
```
FileNotFoundError: Embeddings file not found: /Users/.../embeddings-hr.json
```

**Solution:**
- Verify the embedding files exist in `public/data/`
- Check file names: `embeddings-hr.json`, `embeddings-developer.json`, `embeddings-friend.json`
- Ensure you're running the script from the correct directory

### Issue: "Model not found"

**Error:**
```
FileNotFoundError: Model not found at /Users/.../serhii-qwen-lora-v2
```

**Solution:**
- Verify the fine-tuned model exists in `model-training/serhii-qwen-lora-v2/`
- Check that model files are present: `config.json`, `model.safetensors`, tokenizer files
- Re-run the training script if needed

### Issue: "Out of memory"

**Error:**
```
RuntimeError: CUDA out of memory
```

**Solution:**
- Reduce `--max-tokens` to generate shorter responses
- Close other applications to free up RAM
- Use `torch_dtype=torch.float16` instead of `float32` in code (edit test_rag.py:176)

### Issue: "No chunks found above threshold"

**Output:**
```
RETRIEVED CHUNKS (Top 0)
--------------------------------------------------------------------------------
No chunks found above similarity threshold
```

**Solution:**
- Lower the `--threshold` parameter (e.g., `--threshold 0.5`)
- Check if the query is relevant to the role (e.g., don't ask technical questions with `--role friend`)
- Verify embeddings are properly formatted

### Issue: "Poor quality responses"

**Symptoms:**
- RAG response is similar to baseline
- Missing expected facts
- Generic or vague answers

**Solution:**
- Increase `--top-k` to retrieve more context (e.g., `--top-k 10`)
- Lower `--threshold` to include more chunks (e.g., `--threshold 0.6`)
- Check if relevant information exists in the embeddings files
- Adjust `--temperature` for more/less creative responses

### Issue: "Slow response times"

**Symptoms:**
- Response takes >10 seconds
- Script hangs during generation

**Solution:**
- Model is loading for the first time (normal, happens once)
- Reduce `--max-tokens` for faster generation
- Ensure you're not running other heavy processes
- Consider using GPU acceleration if available

## Performance Tips

1. **Reuse loaded models**: The script loads models once and reuses them for multiple queries
2. **Adjust top_k**: Start with 5 chunks, increase if responses lack detail
3. **Tune threshold**: 0.7 is a good starting point, lower to 0.5-0.6 for broader matches
4. **Cache embeddings**: Models are cached by sentence-transformers automatically
5. **Parallel processing**: Run automated tests once instead of individual queries

## Advanced Usage

### Custom Test Cases

Modify `TEST_CASES` in `test_rag_automated.py`:

```python
TEST_CASES.append({
    "name": "Custom Test - My Query",
    "query": "Your custom question here",
    "role": "developer",
    "expected_elements": ["keyword1", "keyword2"],
    "description": "What this test should verify"
})
```

### Programmatic Usage

Use RAGTester in your own scripts:

```python
from test_rag import RAGTester

# Initialize
tester = RAGTester(verbose=True)

# Run test
tester.run_test(
    query="What's your experience with Python?",
    role="developer",
    top_k=5,
    threshold=0.7
)
```

### Batch Processing

Process multiple queries:

```bash
# Create queries.txt with one query per line
cat queries.txt | while read query; do
    python test_rag.py "$query" --role developer >> results.txt
done
```

## Technical Details

### Embedding Model

- **Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions**: 384
- **Normalization**: L2 normalized (optimized for cosine similarity)
- **License**: Apache 2.0

### Similarity Calculation

Since embeddings are L2-normalized, cosine similarity simplifies to:

```python
similarity = np.dot(query_embedding, chunk_embedding)
```

Range: 0.0 (orthogonal) to 1.0 (identical)

### Fine-tuned Model

- **Base**: Qwen2.5-0.5B-Instruct
- **Method**: LoRA (Low-Rank Adaptation)
- **Training Data**: 568 CV Q&A pairs
- **Format**: Hugging Face Transformers

## License

This test suite is part of the portfolio project and uses:
- Sentence Transformers (Apache 2.0)
- Transformers (Apache 2.0)
- PyTorch (BSD)

## Support

For issues or questions:
1. Check this README's troubleshooting section
2. Verify all dependencies are installed
3. Run with `--verbose` for detailed debugging
4. Check that all required files exist

## Next Steps

After successful testing:
1. Integrate RAG into production application
2. Add caching layer for frequently asked questions
3. Implement confidence scoring for responses
4. Create web API endpoint for RAG queries
5. Add monitoring and analytics
