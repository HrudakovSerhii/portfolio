# Chat-Bot Module Revision Plan

## Context

The chat-bot system has 24 files across `modules/chat-bot/` and `modules/semantic-qa/`, loads 3 ML models (embedding 384-dim, SmolLM2 135M, EQA 65MB), and maintains triple-redundant CV data. The target LLM is **Qwen2.5-0.5B-Instruct + LoRA v3** (~250MB ONNX), replacing SmolLM2-135M (abandoned in v1 - hallucinations, poor retention). Every query goes through the LLM to demonstrate generated content. CV embeddings pre-computed at build time.

---

## Current Problems

| Problem | Impact |
|---------|--------|
| `optimized-ml-worker.js` loads SmolLM2-135M (abandoned v1) instead of Qwen2.5-0.5B | Wrong model, 4x smaller than target |
| Each worker defines its own message protocol, init, error handling | Duplicated boilerplate, inconsistent patterns |
| `chat-bot.js` + `chat-integration.js` dead code (superseded by controller+orchestrator) | 22KB dead weight |
| `style-manager.js` identical duplicate of `conversation-style-manager.js` | 12KB duplicate |
| `ChatBotQARouter` and `DualWorkerCoordinator` do the same orchestration | Two parallel pipelines |
| EQA worker loads 65MB distilbert-squad for extractive QA | Unnecessary; Qwen handles this |
| Schema says 768-dim (distilbert-base-uncased) but worker uses 384-dim (all-MiniLM-L6-v2) | Mismatch; embeddings always null at runtime |
| cv-data.v2.json deeply nested structure requires flattening logic everywhere | Complexity for no benefit |
| cv-data.v2.json `responses` thin (1-2 sentences), en.json has richer role-specific text | Best content not used for LLM context |

---

## Embedding Model: Why 384-dim (all-MiniLM-L6-v2)

The cv-data.v2.json schema specified `distilbert-base-uncased` (768-dim). This is wrong for similarity search. `distilbert-base-uncased` is a **masked language model** - its hidden states aren't trained for cosine similarity. You'd need to pool raw hidden states, producing poor similarity scores.

`all-MiniLM-L6-v2` (384-dim) is trained with **contrastive learning** (Sentence-BERT framework) specifically for semantic similarity. Lower dimension does not mean lower quality here:

| Model | Dim | STS Benchmark | Download | Trained for |
|-------|-----|---------------|----------|-------------|
| distilbert-base-uncased | 768 | ~75% (pooled) | ~250MB | Masked LM (not similarity) |
| all-MiniLM-L6-v2 | 384 | 82.6% | 23MB | Sentence similarity |
| bge-small-en-v1.5 | 384 | 85.2% | 33MB | Sentence similarity |
| bge-base-en-v1.5 | 768 | 86.9% | 110MB | Sentence similarity |

For 32 sections where "React experience" vs "hiking hobby" is already a large semantic gap, 384-dim SBERT models are the right tool. If quality needs improvement later, `bge-small-en-v1.5` is a drop-in upgrade (+3% accuracy, +10MB) at the same 384 dimensions.

---

## Target Architecture

```
BUILD TIME:
  cv-data.v2.json + en.json + content-structure.json
    -> build script enriches sections with en.json content
    -> runs all-MiniLM-L6-v2 on embeddingSourceText
    -> outputs cv-data.v3.json with 384-dim embeddings + enriched context
    -> copy to public/data/cv-data.json

RUNTIME (every query goes through LLM):
  1. User types question
  2. embedding-worker -> 384-dim query vector
  3. cosine similarity vs 32 pre-computed section embeddings (pure JS, <1ms)
  4. Top 2-3 sections -> extract context (enriched responses + details)
  5. Build Qwen chat-template prompt:
     <|im_start|>system
     You are Serhii Hrudakov. Speaking to {persona}. Focus on {focus}.
     <|im_end|>
     <|im_start|>user
     Context: {matched section content}
     Question: {user question}
     <|im_end|>
     <|im_start|>assistant
  6. Qwen ONNX generates response via text-gen worker
  7. Validate response -> return to user
  8. If generation fails -> fallback handler
```

---

## Worker Base Interface: `workers/worker-base.js`

Workers are pure data processors: input -> process -> output. The communication protocol (message routing, request IDs, lifecycle, errors) should be standardized.

### Current problem

Each worker implements its own:
- `self.onmessage` with switch/case (different patterns in each)
- Error handling (`self.onerror`, `self.onunhandledrejection`)
- Init lifecycle (workerReady signal, auto-init)
- Response formatting (`{ type, requestId, success, ... }`)

### Solution: WorkerBase module

```javascript
// workers/worker-base.js
export class WorkerBase {
  constructor(workerName) {
    this.name = workerName;
    this.handlers = new Map();
    this.isInitialized = false;

    self.onmessage = (event) => this._route(event);
    self.onerror = (error) => this._onError(error);
    self.onunhandledrejection = (event) => this._onUnhandledRejection(event);

    // Signal script loaded
    self.postMessage({ type: 'workerReady', success: true, worker: this.name });
  }

  // Workers register pure processing functions
  on(type, handler) {
    this.handlers.set(type, handler);
    return this; // chainable
  }

  // Standard response
  _send(requestId, type, data) {
    self.postMessage({ type, requestId, success: true, ...data });
  }

  _sendError(requestId, type, error) {
    self.postMessage({ type, requestId, success: false, error: error.message || error });
  }

  async _route(event) {
    const { type, requestId, data } = event.data;
    const handler = this.handlers.get(type);

    if (!handler) {
      this._sendError(requestId, 'error', `Unknown message type: ${type}`);
      return;
    }

    try {
      const result = await handler(data, requestId);
      if (result !== undefined) {
        this._send(requestId, type, result);
      }
      // If handler returns undefined, it sent its own response (e.g., progress)
    } catch (error) {
      this._sendError(requestId, type, error);
    }
  }

  _onError(error) {
    self.postMessage({ type: 'workerError', success: false, error: error.message });
  }

  _onUnhandledRejection(event) {
    self.postMessage({ type: 'workerError', success: false, error: String(event.reason) });
  }
}
```

### Workers become pure handlers

**embedding-worker.js** (after refactor):
```javascript
import { WorkerBase } from './worker-base.js';

let model = null;
const worker = new WorkerBase('embedding');

worker
  .on('initialize', async () => {
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
    return { message: 'Embedding model loaded' };
  })
  .on('generateEmbedding', async ({ text }) => {
    const output = await model(text, { pooling: 'mean', normalize: true });
    return { embedding: Array.from(output.data) };
  })
  .on('generateBatchEmbeddings', async ({ texts }) => {
    const embeddings = [];
    for (const text of texts) {
      const output = await model(text, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(output.data));
    }
    return { embeddings };
  });
```

**optimized-ml-worker.js** (after refactor):
```javascript
import { WorkerBase } from './worker-base.js';

let generator = null;
const worker = new WorkerBase('textgen');

worker
  .on('initialize', async () => {
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers');
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    // Configurable model - Qwen ONNX when available, SmolLM2 as fallback
    generator = await pipeline('text-generation', MODEL_NAME, { dtype: 'q4', device: 'webgpu' });
    return { message: `${MODEL_NAME} loaded` };
  })
  .on('generate', async ({ prompt, maxTokens, temperature }) => {
    const output = await generator(prompt, {
      max_new_tokens: Math.min(maxTokens || 200, 200),
      temperature: Math.min(temperature || 0.4, 0.5),
      do_sample: true, top_p: 0.85, repetition_penalty: 1.15,
      return_full_text: false
    });
    const text = cleanAndValidate(output[0]?.generated_text);
    if (!text) throw new Error('Generation failed validation');
    return { answer: text };
  });
```

Workers go from ~600 lines each to ~40 lines of pure processing logic. All boilerplate lives in `worker-base.js`.

### Main-thread side: `WorkerCommunicator` stays

The existing `WorkerCommunicator` class (`utils/worker-communicator.js`) handles the main-thread side (request/response promises, timeouts). It already works with the standardized `{ type, requestId, success }` message format that `WorkerBase` produces.

---

## Data Structure: cv-data.v3.json (new format)

The v2 format (deeply nested `sections.core.main_profile`, `sections.experience.hexaware_bonfire`, etc.) was LLM-generated and forces flattening logic everywhere. Replace with a flat array.

### New format

```json
{
  "metadata": {
    "version": "3.0",
    "embeddingModel": "Xenova/all-MiniLM-L6-v2",
    "embeddingDimensions": 384,
    "totalSections": 32,
    "lastUpdated": "2026-02-09"
  },
  "sections": [
    {
      "id": "main_profile",
      "category": "core",
      "embedding": [0.023, -0.041, ...],
      "embeddingText": "Serhii Hrudakov Lead Frontend Developer result-driven...",
      "context": {
        "hr": "Serhii is a Lead Frontend Developer with 10+ years of experience...",
        "developer": "I'm Serhii, a Lead Frontend Developer with 10+ years...",
        "friend": "Hey! I'm Serhii, been coding for over 10 years now..."
      },
      "keywords": ["Serhii Hrudakov", "Lead Frontend Developer", "10+ years"],
      "details": {
        "name": "Serhii Hrudakov",
        "title": "Lead Frontend Developer",
        "experience_years": "10+"
      },
      "relatedSections": ["frontend_stack", "leadership_style"]
    },
    {
      "id": "hexaware_bonfire",
      "category": "experience",
      "embedding": [0.012, 0.078, ...],
      "embeddingText": "Bonfire dating app Frontend Team Lead NX monorepo...",
      "context": {
        "hr": "Led the Bonfire dating app project as Frontend Team Lead...",
        "developer": "Built a configurable dating app platform using NX monorepo...",
        "friend": "Led this really interesting dating app project!..."
      },
      "keywords": ["Bonfire", "Hexaware", "Frontend Team Lead", "NX monorepo"],
      "details": {
        "company": "Hexaware",
        "position": "Frontend Team Lead",
        "period": "Aug 2024 - May 2025",
        "technologies": ["TypeScript", "React", "NX Monorepo", "Playwright", "Zod"]
      },
      "relatedSections": ["frontend_stack", "testing_tools", "leadership_style"]
    }
  ]
}
```

### What changed from v2

| v2 | v3 | Why |
|----|-----|-----|
| Nested: `sections.experience.hexaware_bonfire` | Flat array with `category` field | Eliminates flattening logic |
| `embeddings: null` | `embedding: [384 floats]` | Pre-computed at build time |
| `embeddingSourceText` | `embeddingText` | Clearer name |
| `responses: {hr, developer, friend}` | `context: {hr, developer, friend}` | Enriched with en.json content, serves as LLM context |
| `priority`, `confidence` fields | Removed | Cosine similarity is sufficient for 32 sections |
| `personality`, `responseTemplates` top-level | Removed from data file | Move to conversation-style-manager (where they're actually used) |

### Enrichment from en.json + content-structure.json

The `context` field per section combines:
1. Existing `responses` text from cv-data.v2 (base)
2. Richer descriptions from `en.json` (e.g., `experience.mobiquity.description` for Hexaware sections)
3. Technology lists from `content-structure.json` (injected into `details.technologies`)

For sections without en.json mapping (personal themes), the existing `responses` become `context` as-is.

---

## File Changes

### DELETE (14 files)

| File | Reason |
|------|--------|
| `modules/chat-bot/chat-bot.js` | Dead code, superseded by chat-orchestrator |
| `modules/chat-bot/chat-integration.js` | Dead code, superseded by chat-controller |
| `modules/chat-bot/style-manager.js` | Exact duplicate of conversation-style-manager |
| `modules/chat-bot/chat-bot-qa-router.js` | Pipeline absorbed into chat-orchestrator |
| `modules/chat-bot/utils/intent-classifier.js` | EQA routing no longer needed |
| `modules/semantic-qa/index.js` | Replaced by refactored orchestrator |
| `modules/semantic-qa/dual-worker-coordinator.js` | Replaced by refactored orchestrator |
| `modules/semantic-qa/utils/text-chunker.js` | No chunking needed (32 atomic sections) |
| `modules/semantic-qa/utils/fact-extractor.js` | Unused |
| `modules/semantic-qa/utils/context-formatter.js` | Inlined into orchestrator |
| `modules/semantic-qa/utils/cache-manager.js` | Worker handles embedding cache internally |
| `modules/semantic-qa/utils/query-processor.js` | Synonym expansion not proven valuable for 32 sections |
| `modules/semantic-qa/utils/cv-context-builder.js` | Context building inlined (few lines) |
| `workers/eqa-worker.js` | EQA model removed, Qwen handles QA |

### CREATE (4 files)

| File | Purpose |
|------|---------|
| `workers/worker-base.js` | Shared worker communication protocol (message routing, errors, lifecycle) |
| `modules/chat-bot/utils/similarity.js` | `cosineSimilarity()` + `findSimilarSections()` (~30 lines) |
| `modules/chat-bot/utils/prompt-builder.js` | Qwen chat-template prompt construction |
| `scripts/build-embeddings.js` | Build script: enrich cv-data + generate embeddings -> `public/data/cv-data.json` |

### REFACTOR (3 files)

**`cv-data-service.js`**
- `loadCVData()` -> fetch `data/cv-data.json` (v3 with embeddings baked in)
- Add `buildSectionIndex()` -> `Map<id, section>` for fast lookup
- Remove: `prepareCVChunks()`, `cacheEmbeddings()`, `findSectionsByKeywords()`

**`chat-orchestrator.js`**
- Absorb QARouter pipeline into single `processMessage()`:
  1. Generate query embedding via embedding worker
  2. Find similar sections via cosine similarity (pure JS)
  3. Build context from top matches' `context[style]` field
  4. Build Qwen chat-template prompt
  5. Send to text-gen worker
  6. Validate response
  7. Fallback if generation fails
- Lazy-init text-gen worker (only on first query, not on role selection)
- Remove: QARouter dependency, EQA worker init, intent classification

**`optimized-ml-worker.js`** -> Rewrite using WorkerBase
- Import `WorkerBase`, register `initialize` and `generate` handlers
- Configurable model name (Qwen ONNX when available, SmolLM2 as fallback)
- `max_new_tokens`: 200 (up from 60), `temperature`: 0.4 (up from 0.3)
- Keep `cleanAndValidateText()` as pure validation function (not method)
- ~40 lines of processing logic, all boilerplate in worker-base.js

**`embedding-worker.js`** -> Rewrite using WorkerBase
- Import `WorkerBase`, register `initialize`, `generateEmbedding`, `generateBatchEmbeddings` handlers
- Remove: `processCVSections`, `filterBySimilarityThreshold`, `clearCache`, `getCacheStats` (unused in new flow)
- Remove: internal cache Map (embedding caching not needed with pre-computed CV embeddings; query embeddings are one-shot)
- ~30 lines of processing logic

### TRIM (1 file)

**`conversation-manager.js`**
- Remove unused: `generateResponse()`, `analyzeConversationFlow()`, `generateFollowUpSuggestions()`, `formatMultipleResponses()`
- Keep: `addMessage()`, `getContext()`, `setStyle()`

### KEEP UNCHANGED (5 files)

| File | Reason |
|------|--------|
| `chat-controller.js` | Entry point, role mapping works |
| `chat-ui.js` | No UI changes in scope |
| `conversation-style-manager.js` | Style data, greetings + absorb personality/responseTemplates from cv-data |
| `fallback-handler.js` | Degradation UX |
| `utils/worker-communicator.js` | Main-thread side Promise wrapper (pairs with WorkerBase) |

### Result: 12 files (from 24), 2 workers (from 3)

```
modules/chat-bot/
  chat-controller.js              (keep)
  chat-orchestrator.js             (refactor - single orchestrator, always-LLM)
  chat-ui.js                       (keep)
  conversation-manager.js          (trim dead methods)
  conversation-style-manager.js    (keep)
  cv-data-service.js               (refactor - load v3 flat format, build index)
  fallback-handler.js              (keep)
  utils/
    worker-communicator.js         (keep - main-thread side)
    similarity.js                  (new)
    prompt-builder.js              (new - Qwen chat template)

workers/
  worker-base.js                   (new - shared worker protocol)
  embedding-worker.js              (rewrite using WorkerBase)
  optimized-ml-worker.js           (rewrite using WorkerBase)
```

---

## Prompt Design for Qwen2.5-0.5B

Matches the training data format from `cv-training-data.jsonl`:

```
<|im_start|>system
You are Serhii Hrudakov. You are speaking to a {persona}. {focus_instruction}
<|im_end|>
<|im_start|>user
Based on this information:
{context from matched sections}

{user question}
<|im_end|>
<|im_start|>assistant
```

**Persona mapping** (from training data):
- hr -> "Recruiter (HR). Focus on leadership, business impact, and professional growth."
- developer -> "Senior Engineer. Focus on technical details, stack decisions, and architecture."
- friend -> "Friend. Tone is casual, enthusiastic about hobbies and life."

**Context budget**: Qwen 0.5B handles ~1024 tokens well. Budget: system prompt (~30 tokens) + context (~400 tokens) + question (~50 tokens) + response (~200 tokens) = ~680 tokens. Safe margin.

**Generation params**:
- `max_new_tokens`: 200
- `temperature`: 0.4
- `top_p`: 0.85
- `repetition_penalty`: 1.15
- `do_sample`: true

---

## Build Script: `scripts/build-embeddings.js`

Node.js script that:

1. Load `model-training/cv-data-parse/cv-data.v2.json`
2. Load `public/translations/en.json`
3. Load `public/data/content-structure.json`
4. For each section in cv-data:
   a. Find matching content in en.json (experience descriptions, skills text, etc.)
   b. Find matching metadata in content-structure.json (technologies, impact scores)
   c. Build enriched `context` field with role-specific text
   d. Run `embeddingSourceText` through all-MiniLM-L6-v2 -> 384-dim vector
   e. Store in `embedding` field
5. Update metadata (version 3.0, correct model/dimensions)
6. Write to `public/data/cv-data.json`

### Section-to-en.json mapping logic

```
cv-data section "hexaware_bonfire"
  -> en.json "experience.mobiquity.description" (Hexaware = Mobiquity)
  -> content-structure "sections.experience.metadata.main_items[0]" (technologies, impactScore)
  -> Build context.hr from en.json "experience.recruiter.content.text" snippet
  -> Build context.developer from en.json "experience.developer.content.text" snippet
  -> Build context.friend from en.json "experience.friend.content.text" snippet
```

For sections without direct en.json mapping (themes, personal), keep existing `responses` as context.

---

## Similarity: `modules/chat-bot/utils/similarity.js`

```javascript
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function findSimilarSections(queryEmbedding, sectionIndex, topK = 3) {
  const results = [];
  for (const [id, section] of sectionIndex.entries()) {
    if (!section.embedding) continue;
    const similarity = cosineSimilarity(queryEmbedding, section.embedding);
    results.push({ id, section, similarity });
  }
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}
```

No priority weighting, no adaptive thresholds. Pure cosine similarity. 32 sections, <1ms.

---

## Orchestrator Flow (`chat-orchestrator.js`)

```javascript
async processMessage(message) {
  // 1. Embed query
  const queryEmbedding = await this.embeddingWorker.generateEmbedding(message);

  // 2. Find similar sections (pure JS, no worker needed)
  const matches = findSimilarSections(queryEmbedding, this.sectionIndex, 3);

  // 3. Check minimum relevance
  if (!matches.length || matches[0].similarity < 0.2) {
    return this.handleFallback(message);
  }

  // 4. Build context from top matches
  const context = matches
    .filter(m => m.similarity >= 0.2)
    .slice(0, 2)
    .map(m => m.section.context?.[this.currentStyle] || m.section.responses[this.currentStyle])
    .join('\n\n');

  // 5. Build Qwen prompt
  const prompt = buildQwenPrompt(message, context, this.currentStyle);

  // 6. Generate via Qwen worker (lazy init)
  if (!this.textGenReady) await this.initTextGenWorker();
  const result = await this.textGenWorker.generate(prompt);

  // 7. Validate
  const validated = validateResponse(result);
  if (!validated) return this.handleFallback(message);

  // 8. Record + return
  this.conversationManager.addMessage(message, validated, matches);
  return { answer: validated, confidence: matches[0].similarity, matches };
}
```

---

## Qwen ONNX Model Status

The Qwen LoRA v3 model is not yet trained/converted to ONNX. The worker refactoring should:
- Make model name configurable (not hardcoded)
- Use Qwen ONNX when available, keep SmolLM2 as temporary fallback
- The `prompt-builder.js` should output Qwen chat-template format regardless (SmolLM2 handles raw text fine)

Once the Qwen ONNX model is published to HF Hub, the worker config change is a single line.

---

## Verification

1. `node scripts/build-embeddings.js` -> generates `public/data/cv-data.json`
2. Open portfolio -> select role -> type question
3. Console should show: query embedding -> similarity scores -> context built -> prompt sent -> LLM response
4. Test: "What is your experience with React?" -> should match frontend_stack + relevant experience sections -> LLM synthesizes answer
5. Test: "What's the weather?" -> low similarity -> fallback handler
6. Test: "Tell me about your leadership and hiking" -> multi-section match -> LLM combines context

---

---

# IMPLEMENTATION SUBTASKS

Split across 3 developers working independently. Each task has: input, end goal, and acceptance test.

## Developer A: Data Pipeline & Similarity

**Scope**: Build script, cv-data v3 generation, similarity utility.
**No dependencies on other developers** -- produces a JSON file that B and C consume.

---

### Task A1: Create `scripts/build-embeddings.js` -- Data Enrichment (no embeddings yet)

**Input files**:
- `model-training/cv-data-parse/cv-data.v2.json` -- source CV data (32 sections, nested under `sections.core.*`, `sections.experience.*`, `sections.skills.*`, `sections.themes.*`)
- `public/translations/en.json` -- richer role-specific text (keys like `hero.recruiter.content.text`, `experience.mobiquity.description`, etc.)
- `public/data/content-structure.json` -- technology lists per section (under `sections.experience.metadata.main_items[]`)

**End goal**: A Node.js script at `scripts/build-embeddings.js` that:
1. Reads all three input files using `fs.readFileSync` + `JSON.parse`
2. Flattens the nested v2 sections into a flat array. For each section in `cv-data.v2.json`:
   - Extract `id`, infer `category` from its parent key (e.g., `sections.experience.hexaware_bonfire` -> `category: "experience"`)
   - Rename `embeddingSourceText` -> `embeddingText`
   - Copy `keywords`, `details`, `relatedSections` as-is
   - Remove `priority`, `confidence`, `embeddings` (will be replaced)
3. Build the `context` field (replaces `responses`):
   - Start with existing `responses.hr`, `responses.developer`, `responses.friend` as base text
   - For experience sections: look up matching entries in `en.json` and `content-structure.json` to extend the base text with richer descriptions. The mapping is approximate -- Hexaware sections map to `experience.mobiquity.*` keys in en.json. Use the section's `details.company` and `details.project_name` to find matches.
   - For sections with no en.json mapping (themes like `hiking`, `cooking`, etc.), copy `responses` directly to `context`
4. Build `metadata` object: `{ version: "3.0", embeddingModel: "Xenova/all-MiniLM-L6-v2", embeddingDimensions: 384, totalSections: <count>, lastUpdated: <today> }`
5. Set `embedding: null` for now (Task A2 adds real embeddings)
6. Remove top-level `personality` and `responseTemplates` from output (they move to conversation-style-manager, Task C5)
7. Write output to `public/data/cv-data.json`

**How to test**:
- Run `node scripts/build-embeddings.js` -- no errors
- `public/data/cv-data.json` exists and is valid JSON
- `jq '.sections | length' public/data/cv-data.json` returns 32
- `jq '.sections[0] | keys' public/data/cv-data.json` includes: `id`, `category`, `embeddingText`, `context`, `keywords`, `details`, `relatedSections`, `embedding`
- `jq '.sections[0].context | keys' public/data/cv-data.json` returns `["developer","friend","hr"]`
- `jq '.metadata.version' public/data/cv-data.json` returns `"3.0"`
- No `personality` or `responseTemplates` keys at top level
- Every section's `context.hr`, `context.developer`, `context.friend` is a non-empty string
- Experience sections (category "experience") have `context` strings longer than original v2 `responses` strings (enriched from en.json)

---

### Task A2: Add Embedding Generation to Build Script

**Input**: The build script from Task A1, plus `@xenova/transformers` npm package.

**End goal**: Extend `scripts/build-embeddings.js` to:
1. Install `@xenova/transformers` as a dev dependency: `npm install -D @xenova/transformers`
2. After building the flat v3 structure (Task A1 output), load the `all-MiniLM-L6-v2` model using the transformers pipeline:
   ```javascript
   const { pipeline } = await import('@xenova/transformers');
   const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
   ```
3. For each section, generate embedding from `embeddingText`:
   ```javascript
   const output = await embedder(section.embeddingText, { pooling: 'mean', normalize: true });
   section.embedding = Array.from(output.data);
   ```
4. Write the final `public/data/cv-data.json` with all embeddings populated

**How to test**:
- Run `node scripts/build-embeddings.js` -- completes (may take 30-60s first time for model download)
- `jq '.sections[0].embedding | length' public/data/cv-data.json` returns `384`
- `jq '.sections[] | select(.embedding == null)' public/data/cv-data.json` returns nothing (all sections have embeddings)
- Every `embedding` array has exactly 384 elements, all numbers
- Each embedding has L2 norm close to 1.0 (normalized): pick any section, compute `sqrt(sum(e^2))`, should be ~1.0

---

### Task A3: Create `modules/chat-bot/utils/similarity.js`

**Input**: The v3 data format spec (flat array with `embedding[384]` per section).

**End goal**: Create file at `src/scripts/modules/chat-bot/utils/similarity.js` with two exported functions:

1. `cosineSimilarity(a, b)` -- takes two arrays of equal length, returns a number between -1 and 1
   - Compute dot product / (norm(a) * norm(b))
   - Handle edge case: if either norm is 0, return 0

2. `findSimilarSections(queryEmbedding, sectionIndex, topK = 3)` -- takes a 384-dim query vector, a `Map<id, section>` where each section has `.embedding`, and optional topK
   - Iterate over all entries in sectionIndex
   - Skip entries where `section.embedding` is null/undefined
   - Compute cosine similarity between queryEmbedding and section.embedding
   - Return array of `{ id, section, similarity }` sorted descending by similarity, sliced to topK

Both functions are pure (no side effects, no imports).

**How to test**:
- Unit test: `cosineSimilarity([1,0,0], [1,0,0])` returns `1.0`
- Unit test: `cosineSimilarity([1,0,0], [0,1,0])` returns `0.0`
- Unit test: `cosineSimilarity([1,0,0], [-1,0,0])` returns `-1.0`
- Unit test: `cosineSimilarity([0,0,0], [1,0,0])` returns `0` (not NaN)
- Unit test: `findSimilarSections(queryVec, mapWith5Entries, 3)` returns exactly 3 results
- Unit test: results are sorted descending by `.similarity`
- Unit test: entries with `embedding: null` are skipped

---

## Developer B: Worker Infrastructure & Prompt Builder

**Scope**: WorkerBase class, rewrite both workers, create prompt-builder.
**No dependencies on A or C** -- workers are standalone files.

---

### Task B1: Create `workers/worker-base.js`

**Input**:
- Current `embedding-worker.js` (728 lines) at `src/scripts/workers/embedding-worker.js` -- study its message protocol
- Current `optimized-ml-worker.js` (603 lines) at `src/scripts/workers/optimized-ml-worker.js` -- study its message protocol
- Current `WorkerCommunicator` at `src/scripts/modules/chat-bot/utils/worker-communicator.js` -- this is the main-thread side; WorkerBase must produce messages in the format WorkerCommunicator expects: `{ type, requestId, success, ...data }`

**End goal**: Create `src/scripts/workers/worker-base.js` exporting a `WorkerBase` class:

Constructor:
- Takes `workerName` (string)
- Sets `self.onmessage`, `self.onerror`, `self.onunhandledrejection`
- Sends `{ type: 'workerReady', success: true, worker: workerName }` immediately

Methods:
- `on(type, handler)` -- registers async handler for message type. Returns `this` for chaining.
- `_route(event)` -- extracts `{ type, requestId, data }` from `event.data`, finds handler, calls it. If handler returns a value, sends `{ type, requestId, success: true, ...result }`. If handler throws, sends `{ type, requestId, success: false, error: message }`. If no handler found, sends error.
- `_send(requestId, type, data)` -- sends success message
- `_sendError(requestId, type, error)` -- sends error message
- `_onError(error)` -- sends `{ type: 'workerError', success: false, error: error.message }`
- `_onUnhandledRejection(event)` -- sends `{ type: 'workerError', success: false, error: String(event.reason) }`

Key behavior:
- If handler returns `undefined`, no auto-response is sent (handler manages its own messages, e.g., for streaming progress)
- The `data` parameter passed to handler is `event.data.data` (the nested data object from WorkerCommunicator's `postMessage({ type, requestId, data })`)
- The `requestId` is passed as second argument to handler for cases where handler needs to send custom messages

**How to test**:
- Create a minimal test worker that imports WorkerBase, registers a handler `worker.on('echo', async (data) => ({ echoed: data.msg }))`, then from main thread send `{ type: 'echo', requestId: '1', data: { msg: 'hello' } }` and verify response is `{ type: 'echo', requestId: '1', success: true, echoed: 'hello' }`
- Test error path: register a handler that throws, verify response has `success: false` and `error` field
- Test unknown type: send `{ type: 'unknown', requestId: '2' }`, verify error response
- Verify `workerReady` message is sent on construction with `success: true`
- Verify WorkerCommunicator can pair with a WorkerBase-based worker (send message, get promise resolved)

---

### Task B2: Rewrite `workers/embedding-worker.js` Using WorkerBase

**Input**:
- `src/scripts/workers/worker-base.js` (from Task B1)
- Current `src/scripts/workers/embedding-worker.js` (728 lines) -- study to preserve required message types

**End goal**: Rewrite `src/scripts/workers/embedding-worker.js` to:

1. Import `WorkerBase` from `./worker-base.js`
2. Create worker: `const worker = new WorkerBase('embedding');`
3. Register three handlers:

   **`initialize`** handler:
   - Dynamic import `@xenova/transformers@2.17.2` from CDN
   - Configure env: `allowRemoteModels = true`, `allowLocalModels = false`
   - Load pipeline: `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })`
   - Store model in module-level variable
   - Return `{ message: 'Embedding model loaded' }`

   **`generateEmbedding`** handler:
   - Receives `{ text }` from data
   - Run model with `{ pooling: 'mean', normalize: true }`
   - Return `{ embedding: Array.from(output.data) }`

   **`generateBatchEmbeddings`** handler:
   - Receives `{ texts }` from data
   - Loop through texts, generate embedding for each
   - Return `{ embeddings: [...] }`

4. Do NOT auto-initialize (remove the `initializeEmbeddingService().catch(...)` call at bottom of current file). The orchestrator sends an explicit `initialize` message.
5. Remove all functions that are no longer needed: `processCVSections`, `filterBySimilarityThreshold`, `clearCache`, `getCacheStats`, `calculateSimilarity`, `hashText`, `sanitizeText`, and the internal cache `Map`.

The file should be ~30-40 lines total.

**How to test**:
- File exists, is valid JS with `import` syntax (ES module)
- No `self.onmessage` assignment in the file (WorkerBase handles it)
- No `self.onerror` or `self.onunhandledrejection` in the file
- No `switch` statement
- File is under 50 lines of code (excluding blank lines and comments)
- From browser: create Worker with `{ type: 'module' }`, send `initialize`, verify `{ type: 'initialize', success: true }` response
- After init: send `{ type: 'generateEmbedding', requestId: 'test', data: { text: 'hello world' } }`, verify response has `embedding` array of length 384
- After init: send `{ type: 'generateBatchEmbeddings', requestId: 'test2', data: { texts: ['a', 'b'] } }`, verify response has `embeddings` array of length 2, each inner array length 384
- WorkerCommunicator can communicate with it (send/receive promise pattern works)

---

### Task B3: Rewrite `workers/optimized-ml-worker.js` Using WorkerBase

**Input**:
- `src/scripts/workers/worker-base.js` (from Task B1)
- Current `src/scripts/workers/optimized-ml-worker.js` (603 lines) -- study to preserve the `cleanAndValidateText` logic

**End goal**: Rewrite `src/scripts/workers/optimized-ml-worker.js` to:

1. Import `WorkerBase` from `./worker-base.js`
2. Define a configurable model name constant at top:
   ```javascript
   const MODEL_NAME = 'HuggingFaceTB/SmolLM2-135M-Instruct';
   // TODO: Switch to Qwen2.5-0.5B-Instruct ONNX when available
   ```
3. Create worker: `const worker = new WorkerBase('textgen');`
4. Register two handlers:

   **`initialize`** handler:
   - Dynamic import `@huggingface/transformers` from CDN
   - Configure env: `allowRemoteModels = true`, `allowLocalModels = false`
   - Check WebGPU availability (reuse the `checkWebGPUAvailability()` logic from current file), fall back to `'wasm'` device
   - Load pipeline: `pipeline('text-generation', MODEL_NAME, { dtype: 'q4', device: deviceToUse })`
   - Store generator in module-level variable
   - Return `{ message: '${MODEL_NAME} loaded', device: deviceToUse }`

   **`generate`** handler:
   - Receives `{ prompt, maxTokens, temperature }` from data
   - Call generator with:
     ```javascript
     { max_new_tokens: Math.min(maxTokens || 200, 200),
       temperature: Math.min(temperature || 0.4, 0.5),
       do_sample: true, top_p: 0.85, repetition_penalty: 1.15,
       return_full_text: false }
     ```
   - Extract `output[0]?.generated_text`
   - Run through `cleanAndValidateText()` (keep this as a standalone function, not a class method)
   - If validation fails (returns null), throw `new Error('Generation failed validation')`
   - Return `{ answer: cleanedText }`

5. Keep `cleanAndValidateText()` as a standalone function below the worker setup. Copy the validation logic from the current file's method (lines 246-307): whitespace cleanup, invalid pattern checks, length check, first-person check.
6. Keep `checkWebGPUAvailability()` as a standalone async function.
7. Do NOT auto-initialize (remove the `worker.initialize().catch(...)` at bottom).

The file should be ~80-100 lines total (mostly the validation function).

**How to test**:
- File exists, is valid JS with `import` syntax (ES module)
- No `class OptimizedMLWorker` -- no class at all
- No `self.addEventListener('message', ...)` -- WorkerBase handles it
- No `switch` statement
- `MODEL_NAME` constant is defined and easy to change
- `cleanAndValidateText` function is present and exported or accessible
- From browser: create Worker, send `initialize`, verify response with `success: true` (may take time to download model)
- After init: send `{ type: 'generate', requestId: 'test', data: { prompt: 'Hello' } }`, verify response has `answer` string or `success: false` with error
- WorkerCommunicator can communicate with it

---

### Task B4: Create `modules/chat-bot/utils/prompt-builder.js`

**Input**: The Qwen chat-template format spec (above), persona mapping, and training data format.

**End goal**: Create `src/scripts/modules/chat-bot/utils/prompt-builder.js` with one exported function:

```javascript
export function buildQwenPrompt(question, context, style)
```

**Parameters**:
- `question` (string): user's question
- `context` (string): concatenated context from matched CV sections
- `style` (string): one of `'hr'`, `'developer'`, `'friend'`

**Returns**: A string in Qwen chat-template format:
```
<|im_start|>system
You are Serhii Hrudakov. You are speaking to a {persona}. {focus_instruction}
<|im_end|>
<|im_start|>user
Based on this information:
{context}

{question}
<|im_end|>
<|im_start|>assistant
```

**Persona mapping** (hardcoded in the file):
- `hr` -> persona: "Recruiter (HR)", focus: "Focus on leadership, business impact, and professional growth."
- `developer` -> persona: "Senior Engineer", focus: "Focus on technical details, stack decisions, and architecture."
- `friend` -> persona: "Friend", focus: "Tone is casual, enthusiastic about hobbies and life."

If `context` is empty or falsy, omit the "Based on this information:" block and just include the question.

If `style` is not recognized, default to `developer`.

**How to test**:
- `buildQwenPrompt('What is React?', 'React is a JS library', 'developer')` returns a string containing `<|im_start|>system`, `Senior Engineer`, `<|im_start|>user`, `Based on this information:`, `React is a JS library`, `What is React?`, `<|im_start|>assistant`
- `buildQwenPrompt('Hi', '', 'hr')` returns a prompt without "Based on this information:" (no context)
- `buildQwenPrompt('Hi', null, 'friend')` returns a prompt with "Friend" persona, no context block
- `buildQwenPrompt('Hi', 'ctx', 'unknown_style')` defaults to developer persona
- Output always ends with `<|im_start|>assistant\n` (trailing newline so model continues)
- No banned words from CLAUDE.md appear in the output

---

## Developer C: Core Refactor & Cleanup

**Scope**: Refactor orchestrator, cv-data-service, conversation-manager; delete dead code; wire up.
**Depends on**: A1-A3 output (cv-data.json format, similarity.js), B1-B4 output (worker-base, prompt-builder). **C can start Tasks C1-C3 immediately** (deletion and trimming). Tasks C4-C6 need A and B outputs.

---

### Task C1: Delete Dead Code -- Chat-Bot Module

**Input**: The file list below, each at `src/scripts/modules/chat-bot/`:

| File | Reason for deletion |
|------|---------------------|
| `chat-bot.js` | Superseded by `chat-orchestrator.js` (refactored in 2025-12-30, per orchestrator's docstring) |
| `chat-integration.js` | Superseded by `chat-controller.js` (refactored in 2025-12-30) |
| `style-manager.js` | Exact duplicate of `conversation-style-manager.js` (renamed copy per docstring line 7-8) |
| `chat-bot-qa-router.js` | Pipeline absorbed into chat-orchestrator (Task C5). Currently imported only by chat-orchestrator.js line 28 |
| `utils/intent-classifier.js` | Only imported by chat-bot-qa-router.js line 11. EQA routing is removed. |

**End goal**: Delete all 5 files. Verify no remaining imports reference them.

**How to test**:
- Files no longer exist on disk
- `grep -r "chat-bot.js\|chat-integration.js\|style-manager.js\|chat-bot-qa-router.js\|intent-classifier.js" src/scripts/` returns NO matches (other than this plan doc or comments). If any import references are found, they need to be removed too (but don't modify files beyond removing dead imports -- other tasks handle the refactoring).
- The project doesn't have broken static imports to these deleted files. Since `chat-orchestrator.js` imports `chat-bot-qa-router.js` on line 28, that import line must be removed. Also the import at line 181 (`dynamic import`). These are part of the refactor in C5, but C1 should note this dependency.

---

### Task C2: Delete Dead Code -- Semantic-QA Module & EQA Worker

**Input**: The file list below:

Files at `src/scripts/modules/semantic-qa/`:
| File | Reason |
|------|--------|
| `index.js` | Module entry point for removed pipeline |
| `dual-worker-coordinator.js` | Parallel pipeline replaced by orchestrator |
| `utils/text-chunker.js` | No chunking needed (32 atomic sections) |
| `utils/fact-extractor.js` | Unused |
| `utils/context-formatter.js` | Context building inlined into orchestrator |
| `utils/cache-manager.js` | Worker handles caching internally |
| `utils/query-processor.js` | Synonym expansion not proven valuable |
| `utils/cv-context-builder.js` | Context building is now few lines in orchestrator |
| `utils/similarity-calculator.js` | Replaced by new `similarity.js` (Task A3) |
| `utils/response-validator.js` | Response validation inlined into orchestrator |
| `utils/prompt-builder.js` | Replaced by new `prompt-builder.js` (Task B4) |

Worker at `src/scripts/workers/`:
| File | Reason |
|------|--------|
| `eqa-worker.js` | EQA model (distilbert-squad, 65MB) removed -- Qwen handles QA |

**End goal**: Delete the entire `src/scripts/modules/semantic-qa/` directory (11 files) and `src/scripts/workers/eqa-worker.js` (1 file). Total: 12 files.

**How to test**:
- `src/scripts/modules/semantic-qa/` directory does not exist
- `src/scripts/workers/eqa-worker.js` does not exist
- `grep -r "semantic-qa\|eqa-worker\|dual-worker-coordinator\|text-chunker\|fact-extractor\|context-formatter\|cache-manager\|query-processor\|cv-context-builder\|similarity-calculator\|response-validator" src/scripts/` returns NO matches from live code (only from docs or comments). Note: `chat-bot-qa-router.js` (already deleted in C1) had imports to several of these. The orchestrator refactor (C5) handles remaining references.

---

### Task C3: Trim `conversation-manager.js`

**Input**: Current file at `src/scripts/modules/chat-bot/conversation-manager.js` (746 lines).

**Methods to KEEP** (used by orchestrator):
- `constructor()` (lines 7-13)
- `generateSessionId()` (lines 20-24)
- `addMessage(userMessage, botResponse, matchedSections, confidence)` (lines 32-44)
- `maintainContextWindow()` (lines 49-53)
- `getContext(currentTopics, limit)` (lines 61-99)
- `isMessageRelatedToTopics(message, topics)` (lines 107-119)
- `areTopicsRelated(topic1, topic2)` (lines 128-154)
- `clearHistory()` (lines 159-162)
- `setStyle(style)` (lines 168-178)
- `getStyle()` (lines 184-186)
- `getConversationStats()` (lines 707-715)
- `calculateAverageConfidence()` (lines 722-729)
- `getUniqueTopics()` (lines 735-743)

**Methods to REMOVE** (dead code, not called anywhere after orchestrator refactor):
- `generateResponse(query, cvMatches, style)` (lines 195-225) -- LLM generates responses now
- `formatSingleResponse(match, style, currentTopics)` (lines 233-244) -- part of dead generateResponse
- `formatMultipleResponses(matches, style, query, currentTopics)` (lines 254-266) -- part of dead generateResponse
- `combineResponses(responses, style, query, currentTopics)` (lines 276-294) -- part of dead generateResponse
- `getStyleConnectors(style)` (lines 300-318) -- used only by combineResponses
- `getMultiTopicIntro(style, query)` (lines 326-334) -- used only by combineResponses
- `addContextualElements(response, style, currentTopics)` (lines 343-358) -- used only by formatSingleResponse
- `isFollowUpQuestion(context, currentTopics)` (lines 366-380) -- unused
- `extractTopicFromHistory(context)` (lines 387-396) -- used only by addContextualElements
- `addContextualReference(response, lastTopic, style, context)` (lines 406-426) -- used only by addContextualElements
- `getSpecificContextualPhrase(context, style)` (lines 434-471) -- used only by addContextualReference
- `isRelatedTopic(lastTopic, response)` (lines 479-505) -- used only by addContextualReference
- `generateFallbackResponse(style)` (lines 512-522) -- fallback-handler handles this
- `generateGenericResponse(match, style)` (lines 530-541) -- part of dead generateResponse
- `generateContextAwareResponse(query, cvMatches, style)` (lines 550-575) -- unused
- `analyzeConversationFlow(context, currentTopics, query)` (lines 584-616) -- unused
- `classifyQuery(query)` (lines 623-647) -- used only by analyzeConversationFlow
- `generateFollowUpSuggestions(currentTopics, style)` (lines 655-672) -- unused
- `getTopicFollowUpSuggestion(topic, style)` (lines 680-701) -- used only by generateFollowUpSuggestions

**End goal**: Remove all listed methods. File goes from ~746 lines to ~180 lines. Keep the class export structure (`export default ConversationManager`).

**How to test**:
- File exists, is valid JS
- `ConversationManager` class is exported as default
- Has methods: `addMessage`, `getContext`, `setStyle`, `getStyle`, `clearHistory`, `getConversationStats`
- Does NOT have: `generateResponse`, `formatSingleResponse`, `formatMultipleResponses`, `combineResponses`, `analyzeConversationFlow`, `generateFollowUpSuggestions`, `generateFallbackResponse`, `generateContextAwareResponse`
- `grep -c "generateResponse\|formatSingleResponse\|formatMultipleResponses\|analyzeConversationFlow\|generateFollowUpSuggestions" src/scripts/modules/chat-bot/conversation-manager.js` returns 0
- No other file in the project calls the removed methods (verify with grep)

---

### Task C4: Refactor `cv-data-service.js`

**Input**:
- Current file at `src/scripts/modules/chat-bot/cv-data-service.js` (457 lines)
- The v3 data format spec (flat array, see plan above)
- `public/data/cv-data.json` generated by Task A2

**End goal**: Rewrite `cv-data-service.js` to work with v3 format:

1. **`loadCVData()`** -- no longer takes a `style` parameter. Fetches `data/cv-data.json` (relative path). Validates: metadata has `version: "3.0"`, sections is an array. Stores data.

2. **`buildSectionIndex()`** -- new method. Creates and returns a `Map<id, section>` from the flat sections array. Store in `this.sectionIndex`.

3. **`getSectionById(id)`** -- look up in `this.sectionIndex`

4. **`getSectionsByCategory(category)`** -- filter `this.cvData.sections` by category field

5. **`getAllSections()`** -- return `this.cvData.sections` directly (already flat)

6. **`getMetadata()`** -- return `this.cvData.metadata`

7. **`isDataLoaded()`** and **`reset()`** -- keep as-is

**Remove**:
- `validateCVData()` -- v2 schema validation, wrong for v3
- `validateSection()` -- v2 section validation
- `prepareCVChunks()` -- no longer needed (sections are already flat with embeddings)
- `findSectionsByKeywords()` -- replaced by embedding similarity
- `cacheEmbeddings()`, `getCachedEmbeddings()` -- embeddings are pre-computed
- `getEmbeddings()` -- direct access via section object
- `getPersonality()`, `getResponseTemplates()`, `getCommunicationStyle()` -- moved to conversation-style-manager

**Fetch path change**: Current file fetches `public/cv/cv-data.v2.json`. New file fetches `data/cv-data.json` (relative to public root, since this runs in browser context).

**How to test**:
- File exists, is valid JS, exports `CVDataService` as default
- `loadCVData()` takes no parameters
- After `loadCVData()`, `buildSectionIndex()` returns a Map
- `getSectionById('main_profile')` returns the main_profile section object with `embedding`, `context`, etc.
- `getAllSections()` returns an array (not a nested object)
- No methods named `prepareCVChunks`, `cacheEmbeddings`, `findSectionsByKeywords`, `getPersonality`, `getResponseTemplates`
- `grep -c "prepareCVChunks\|cacheEmbeddings\|findSectionsByKeywords\|getPersonality\|getResponseTemplates" src/scripts/modules/chat-bot/cv-data-service.js` returns 0

---

### Task C5: Refactor `chat-orchestrator.js`

**Input**:
- Current file at `src/scripts/modules/chat-bot/chat-orchestrator.js` (582 lines)
- `modules/chat-bot/utils/similarity.js` (from Task A3)
- `modules/chat-bot/utils/prompt-builder.js` (from Task B4)
- `modules/chat-bot/utils/worker-communicator.js` (existing, unchanged)
- `workers/worker-base.js` (from Task B1) -- workers use this, but orchestrator doesn't import it directly
- The refactored `cv-data-service.js` (from Task C4)

**End goal**: Rewrite `chat-orchestrator.js` to use the new pipeline:

1. **Remove imports**: Delete `import { ChatBotQARouter }` (line 28). Add imports:
   ```javascript
   import { WorkerCommunicator } from './utils/worker-communicator.js';
   import { findSimilarSections } from './utils/similarity.js';
   import { buildQwenPrompt } from './utils/prompt-builder.js';
   ```

2. **Remove QARouter**: Delete `this.chatbotQARouter`, `initializeChatRouter()`, `waitForWorkerReady()`, and all EQA-related code.

3. **Add embedding worker management**: In `selectConversationStyle()`:
   - After `cvDataService.loadCVData()`, call `cvDataService.buildSectionIndex()`
   - Store the index: `this.sectionIndex = cvDataService.buildSectionIndex()`
   - Initialize embedding worker:
     ```javascript
     this.embeddingWorker = new Worker('./scripts/workers/embedding-worker.js', { type: 'module' });
     this.embeddingCommunicator = new WorkerCommunicator(this.embeddingWorker, 'embedding', 60000);
     ```
   - Wait for initialization: listen for `initialized` or `ready` message, then send `{ type: 'initialize' }` if needed
   - Do NOT initialize text-gen worker here (lazy init on first query)

4. **Rewrite `processMessage(message)`**:
   ```javascript
   async processMessage(message) {
     // 1. Generate query embedding
     const embResponse = await this.embeddingCommunicator.sendMessage('generateEmbedding', { text: message });
     const queryEmbedding = embResponse.embedding;

     // 2. Find similar sections (pure JS)
     const matches = findSimilarSections(queryEmbedding, this.sectionIndex, 3);

     // 3. Check minimum relevance
     if (!matches.length || matches[0].similarity < 0.2) {
       return this._generateFallbackResponse({ shouldFallback: true, reason: 'no_matches' }, message);
     }

     // 4. Build context from top matches
     const context = matches
       .filter(m => m.similarity >= 0.2)
       .slice(0, 2)
       .map(m => m.section.context?.[this.currentStyle] || '')
       .filter(Boolean)
       .join('\n\n');

     // 5. Build Qwen prompt
     const prompt = buildQwenPrompt(message, context, this.currentStyle);

     // 6. Lazy init text-gen worker
     if (!this.textGenCommunicator) {
       await this._initTextGenWorker();
     }

     // 7. Generate
     const genResponse = await this.textGenCommunicator.sendMessage('generate', {
       prompt, maxTokens: 200, temperature: 0.4
     });

     // 8. Validate
     if (!genResponse.answer) {
       return this._generateFallbackResponse({ shouldFallback: true, reason: 'generation_failed' }, message);
     }

     // 9. Record + return
     this.conversationManager.addMessage(message, genResponse.answer, matches.map(m => m.id), matches[0].similarity);
     return {
       success: true, type: 'answer', message, answer: genResponse.answer,
       confidence: matches[0].similarity, style: this.currentStyle
     };
   }
   ```

5. **Add `_initTextGenWorker()`**: Private method that creates the text-gen worker and communicator, sends `initialize`, waits for ready. Similar pattern to embedding worker but with 120000ms timeout (model is large).

6. **Keep unchanged**: `constructor()` callback structure, `_checkBrowserCompatibility()`, `_loadModules()`, `selectConversationStyle()` (with modifications above), `restartConversation()`, `generateFallbackEmail()`, `getState()`, `getPerformanceMetrics()`, `retryInitialization()`, `destroy()`.

7. **Remove unused**: `engineMode`, `getAvailableEngines()`, `getEngineMode()` (single engine now).

8. **Update `destroy()`**: Terminate `embeddingCommunicator` and `textGenCommunicator` instead of `chatbotQARouter.cleanup()`.

**How to test**:
- File exists, is valid JS
- No import of `ChatBotQARouter` or anything from `semantic-qa/`
- Has imports for `WorkerCommunicator`, `findSimilarSections`, `buildQwenPrompt`
- `processMessage()` method exists
- No reference to `chatbotQARouter`, `eqaWorker`, `eqaCommunicator`
- No reference to `engineMode`, `getAvailableEngines`, `getEngineMode`
- `grep -c "chatbotQARouter\|eqaWorker\|semantic-qa\|intent-classifier\|ChatBotQARouter" src/scripts/modules/chat-bot/chat-orchestrator.js` returns 0
- Integration test: initialize orchestrator -> select style -> processMessage("What is your experience with React?") -> returns `{ success: true, answer: <string>, confidence: <number> }`

---

### Task C6: Move Personality Data & Wire Up Imports

**Input**:
- `model-training/cv-data-parse/cv-data.v2.json` -- contains `personality` and `responseTemplates` top-level keys
- `src/scripts/modules/chat-bot/conversation-style-manager.js` -- destination for personality data
- `src/scripts/modules/chat-bot/chat-controller.js` -- verify imports still work

**End goal**:

1. **Move personality/responseTemplates to conversation-style-manager.js**:
   - Open `cv-data.v2.json`, copy the `personality` object (traits, values, workStyle, interests, communication_style) and `responseTemplates` object (noMatch, lowConfidence, fallbackRequest, emailFallback)
   - Add them as static data in `conversation-style-manager.js`. The simplest approach: add a `getPersonality()` method and `getResponseTemplates()` method that return these objects. Add the data as a const at the top of the file or inside `initializeStyleData()`.
   - The `fallback-handler.js` uses `styleManager` -- verify it doesn't need `getPersonality()` or `getResponseTemplates()` calls. If it does, the new methods on ConversationStyleManager provide them.

2. **Verify chat-controller.js imports**: After all refactoring (C1-C5):
   - `chat-controller.js` imports `chat-orchestrator.js` (line 101) -- this file is refactored but still exported as `{ ChatOrchestrator }`
   - `chat-controller.js` imports `chat-ui.js` (line 102) -- unchanged
   - No other imports need updating in chat-controller.js
   - Verify: `grep "import" src/scripts/modules/chat-bot/chat-controller.js` shows only valid imports to files that exist

3. **Verify no broken imports across the module**: Run a grep for all import statements in `src/scripts/modules/chat-bot/` and `src/scripts/workers/` and confirm every imported file exists.

**How to test**:
- `conversation-style-manager.js` has methods `getPersonality()` and `getResponseTemplates()` (or equivalent)
- `getPersonality()` returns object with keys: `traits`, `values`, `workStyle`, `interests`, `communication_style`
- `getResponseTemplates()` returns object with keys: `noMatch`, `lowConfidence`, `fallbackRequest`, `emailFallback`
- Each responseTemplate has sub-keys `hr`, `developer`, `friend`
- `chat-controller.js` has no broken imports (all imported files exist)
- `grep -rn "from.*'" src/scripts/modules/chat-bot/ src/scripts/workers/` -- every referenced file path resolves to an existing file
- No circular dependency issues (orchestrator does not import from conversation-style-manager which imports from orchestrator)

---

## Dependency Graph

```
INDEPENDENT (can start immediately):
  A1 -> A2 -> A3 (sequential within A)
  B1 -> B2, B3, B4 (B1 first, then B2/B3/B4 can parallel)
  C1, C2, C3 (deletions/trimming, no dependencies)

AFTER A + B COMPLETE:
  C4 (needs A2 output: cv-data.json format)
  C5 (needs A3: similarity.js, B4: prompt-builder.js, C4: cv-data-service.js)
  C6 (needs C5 complete, then verify wiring)
```

```
Developer A:  A1 ──> A2 ──> A3
Developer B:  B1 ──> B2 ──┐
                    B3 ──┤ (B2, B3, B4 parallel after B1)
                    B4 ──┘
Developer C:  C1 ──┐
              C2 ──┤ (C1, C2, C3 parallel)
              C3 ──┘──> C4 ──> C5 ──> C6
                        ^       ^
                        |       |
                       A2      A3 + B4
```

**Critical path**: A1 -> A2 -> (wait for B4) -> C5 -> C6

---

## File Reference (Actual Paths)

All source files are under `/Users/serhiihrudakov/Documents/Code/FE/portfolio/`:

| Plan reference | Actual path |
|----------------|-------------|
| `modules/chat-bot/*` | `src/scripts/modules/chat-bot/*` |
| `modules/semantic-qa/*` | `src/scripts/modules/semantic-qa/*` |
| `workers/*` | `src/scripts/workers/*` |
| `scripts/build-embeddings.js` | `scripts/build-embeddings.js` (new, at project root) |
| `public/data/cv-data.json` | `public/data/cv-data.json` (output) |
| `cv-data.v2.json` | `model-training/cv-data-parse/cv-data.v2.json` |
| `en.json` | `public/translations/en.json` |
| `content-structure.json` | `public/data/content-structure.json` |
