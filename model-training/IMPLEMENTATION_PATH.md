# Portfolio Chat Implementation Path

## Phase 1: Fine-tuned Model Training ✅ COMPLETED

### What We Built
- **Model**: Qwen2.5-0.5B-Instruct with LoRA fine-tuning
- **Training Data**: 500+ Q&A pairs covering CV, projects, experience
- **Configuration**:
  - LoRA rank: 64
  - LoRA alpha: 128
  - Dropout: 0.05
  - Epochs: 10 (stopped at 6.25)
  - Learning rate: 5e-4 with linear decay

### Results & Analysis
**Metrics:**
- ✅ Zero hallucinations (model doesn't fabricate facts)
- ❌ 24.9% factual recall accuracy
- 📊 Best checkpoint: step 50 (epoch 1.6, eval_loss: 1.314)
- 📈 Severe overfitting: train_loss 0.094 → eval_loss 1.761

**Key Findings:**
1. Model learned conversational style well
2. Struggles with precise factual recall (company names, metrics, technologies)
3. Early stopping would help (checkpoint-50 or checkpoint-100)
4. 0.5B parameters insufficient for memorizing complex facts + maintaining conversation quality

### Artifacts
```
model-training/
├── data/cv-training-data.jsonl     # 569 Q&A training pairs
├── serhii-qwen-lora-v2/            # Trained model (v2) with tokenizer files
├── run-scripts/train_hf_jobs.py    # HF Jobs cloud training script
├── test/test_qwen_model.py         # Automated testing script
└── test/test_rag.py                # RAG testing script
```

---

## Phase 2: RAG + Fine-tuned Model Hybrid 🚧 IN PROGRESS

### Progress Summary
| Step | Status | Description |
|------|--------|-------------|
| Step 1: Knowledge Base | ✅ Complete | 569 chunks, embeddings ready |
| Step 2: RAG Pipeline | ❌ Pending | Need `retriever.py` |
| Step 3: Integration | ❌ Pending | Need `hybrid_chat.py` |
| Step 4: Testing | ⏳ Waiting | Test files ready, need RAG |
| Step 5: Frontend | ❌ Pending | Need API server |

### Architecture Overview
Combine the strengths of both approaches:
- **RAG (Retrieval)**: Provides accurate, factual information
- **Fine-tuned Qwen**: Generates natural, conversational responses

```
User Question
     ↓
┌────────────────────┐
│ 1. Embed Question  │  sentence-transformers/all-MiniLM-L6-v2
└────────┬───────────┘
         ↓
┌────────────────────┐
│ 2. Retrieve Facts  │  Vector search in CV knowledge base
└────────┬───────────┘
         ↓
┌────────────────────────────────────────┐
│ 3. Generate Response                   │
│    Input: Question + Retrieved Facts   │
│    Model: Qwen2.5-0.5B LoRA (ckpt-50) │
│    Style: Conversational, personalized │
└────────┬───────────────────────────────┘
         ↓
    Natural Answer with Accurate Facts
```

### Implementation Steps

#### Step 1: Create Knowledge Base ✅ COMPLETED
**Goal**: Convert CV data into semantic chunks for retrieval

**Tasks:**
- [x] Extract facts from `cv-training-data.jsonl`
- [x] Create structured knowledge chunks with id, category, role, question, content, company, keywords
- [x] Generate embeddings using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- [x] Export role-specific JSON files for browser deployment

**Results:**
- 569 semantic chunks created
- 3 role-specific embedding files: hr (174), developer (226), friend (169)
- Browser-compatible JSON format for client-side vector search

**Files created:**
```
model-training/rag/
├── create_knowledge_base.py        # Convert JSONL → knowledge chunks
├── generate_embeddings.py          # Create vector embeddings
├── export_browser_embeddings.py    # Export for browser deployment
├── RAG_README.md                   # Implementation specification
├── knowledge_base/
│   ├── chunks.json                 # 569 structured fact chunks
│   ├── chunks_stats.json           # Category/role distribution stats
│   └── embedding_metadata.json     # Model config (384 dims, L2 normalized)
└── embedding-data/
    ├── embeddings-hr.json          # Professional/leadership chunks (1.9MB)
    ├── embeddings-developer.json   # Technical chunks (2.4MB)
    └── embeddings-friend.json      # Personal/hobbies chunks (1.8MB)
```

#### Step 2: Build RAG Pipeline ❌ PENDING
**Goal**: Retrieve relevant facts for any question

**Tasks:**
- [ ] Implement semantic search
- [ ] Create retrieval function:
  ```python
  def retrieve_facts(question: str, top_k: int = 5):
      # 1. Embed question
      # 2. Find top-k similar chunks
      # 3. Return relevant context
  ```
- [ ] Add re-ranking for better relevance (optional)
- [ ] Test retrieval accuracy on sample questions

**Files to create:**
```
model-training/rag/
└── retriever.py                    # Semantic search implementation
```

#### Step 3: Integrate with Fine-tuned Model ❌ PENDING
**Goal**: Use Qwen to generate responses from retrieved facts

**Tasks:**
- [ ] Load checkpoint-50 (best performing model)
- [ ] Create prompt template:
  ```python
  prompt = f"""You are Serhii. Answer based on these facts:

  FACTS:
  {retrieved_facts}

  QUESTION: {user_question}

  Answer naturally and conversationally as Serhii would."""
  ```
- [ ] Generate response with retrieved context
- [ ] Add citation/source attribution (optional)

**Files to create:**
```
model-training/rag/
└── hybrid_chat.py                  # RAG + Qwen integration
```

#### Step 4: Test & Optimize ⏳ WAITING
**Goal**: Validate accuracy and quality

**Tasks:**
- [ ] Run test suite with RAG (test files exist, waiting for retriever)
- [ ] Target: >90% factual accuracy
- [ ] Tune retrieval parameters (top_k, similarity threshold)
- [ ] Optimize response generation (temperature, max_tokens)
- [ ] Compare with Phase 1 results

**Files (created, awaiting integration):**
```
model-training/test/
├── test_rag.py                     # RAG system testing (manual)
└── test_rag_automated.py           # Automated RAG testing
```

#### Step 5: Frontend Integration ❌ PENDING
**Goal**: Connect to portfolio chat interface

**Tasks:**
- [ ] Create REST API or websocket endpoint
- [ ] Handle streaming responses (optional)
- [ ] Add caching for common questions
- [ ] Deploy model (local or cloud)
- [ ] Update chat UI to use new backend

**Files to create:**
```
model-training/api/
├── server.py                       # FastAPI or Express endpoint
└── chat_handler.js                 # Frontend integration
```

---

## Expected Outcomes

### Phase 1 Results (Current)
| Metric | Score |
|--------|-------|
| Factual Accuracy | 24.9% |
| Hallucinations | 0% ✅ |
| Conversation Quality | Good |

### Phase 2 Target (RAG Hybrid)
| Metric | Target |
|--------|--------|
| Factual Accuracy | >90% 🎯 |
| Hallucinations | <1% |
| Conversation Quality | Excellent |
| Response Time | <2s |

---

## Technology Stack

### Current
- **Model**: Qwen2.5-0.5B-Instruct + LoRA (v2)
- **Framework**: Hugging Face Transformers, PEFT
- **Training**: HF Jobs (cloud) or local (Mac mini)

### Phase 2 Progress
- **Embeddings**: sentence-transformers/all-MiniLM-L6-v2 ✅ Implemented
- **Vector Storage**: JSON files for browser-side search ✅ Implemented
- **Retriever**: Pending implementation
- **API**: FastAPI (Python) - pending
- **Deployment**: Browser-side inference planned (ONNX)

---

## Decision Points

### Should we retrain the model?
**No, reuse checkpoint-50** - it showed best generalization

### Should we use a larger base model?
**Not yet** - test RAG hybrid first. If accuracy is still <80%, consider:
- Qwen2.5-1.5B (3x larger)
- Qwen2.5-3B (6x larger)
- API call to Claude/GPT for complex questions

### Should we train embeddings model?
**No** - pretrained sentence-transformers work excellently for semantic search

---

## Timeline Estimate

**Phase 2 Total: ~2-3 days of work**

- Step 1 (Knowledge Base): 4-6 hours
- Step 2 (RAG Pipeline): 4-6 hours
- Step 3 (Integration): 2-4 hours
- Step 4 (Testing): 2-3 hours
- Step 5 (Frontend): 3-5 hours

---

## Success Criteria

Phase 2 is successful if:
1. ✅ Factual accuracy >90% on test suite
2. ✅ Zero critical hallucinations (company names, dates, metrics)
3. ✅ Responses feel natural and conversational
4. ✅ Can handle follow-up questions and context
5. ✅ Response time <2 seconds on local hardware

---

## Notes & Learnings

### From Phase 1:
- Small models (0.5B) can learn style but struggle with facts
- Early stopping is critical (step 50 vs 200)
- Test-driven development caught hallucinations early
- Overfitting happened quickly (~3 epochs)

### For Phase 2:
- RAG is industry standard for factual QA
- Hybrid approach gets best of both worlds
- Keep retrieved context focused (3-5 chunks max)
- Consider caching for common portfolio questions

---

## References

- Training data: `data/cv-training-data.jsonl` (569 Q&A pairs)
- Knowledge base: `rag/knowledge_base/chunks.json` (569 semantic chunks)
- Embeddings: `rag/embedding-data/` (role-specific JSON files)
- Test scripts: `test/test_qwen_model.py`, `test/test_rag.py`
- DPO Guide: `DPO_TRAINING_GUIDE.md` (alternative training approach)