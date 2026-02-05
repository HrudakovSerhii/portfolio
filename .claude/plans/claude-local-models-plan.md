# Claude Local Models Integration Plan

## Goal
Create two Python scripts (`claude-ollama`, `claude-lm-studio`) that configure and launch Claude Code with local or remote model backends.

## Technical Context

### Claude Code + Ollama Integration
Based on [Ollama Anthropic Compatibility](https://docs.ollama.com/api/anthropic-compatibility) and [Ollama Blog](https://ollama.com/blog/claude):

```bash
# Required environment variables
ANTHROPIC_AUTH_TOKEN=ollama    # required but ignored
ANTHROPIC_API_KEY=""           # required but ignored
ANTHROPIC_BASE_URL=http://localhost:11434  # or remote server

# Launch command
claude --model <model-name>
```

### Ollama API Endpoints
- List local models: `GET http://<host>:11434/api/tags`
- Check server: `GET http://<host>:11434/api/version`
- Pull model: `POST http://<host>:11434/api/pull`

### LM Studio API (reference: litellm/README.md)
- Default port: 1234
- Models endpoint: `GET http://localhost:1234/v1/models`
- Uses LiteLLM proxy on port 4000

---

## Script 1: `claude-ollama`

### Location
`/Users/serhiihrudakov/Documents/Code/FE/portfolio/scripts/claude-ollama`

### Flow
```
1. Parse args: --local | --remote <host:port> | --model <name>
2. Detect/connect to Ollama server
3. Fetch available models from API
4. Prompt user to select model (if not specified)
5. Set environment variables
6. Execute: claude --model <selected-model>
```

### Arguments
| Arg | Description | Default |
|-----|-------------|---------|
| `--local` | Use localhost:11434 | default |
| `--remote <url>` | Use remote Ollama server | - |
| `--model <name>` | Skip selection, use this model | - |
| `--list` | List models and exit | - |

### Implementation Details

```python
#!/usr/bin/env python3
"""
claude-ollama - Run Claude Code with Ollama backend
"""
import argparse
import subprocess
import sys
import requests

OLLAMA_LOCAL = "http://localhost:11434"

def get_models(base_url):
    """Fetch available models from Ollama API"""
    resp = requests.get(f"{base_url}/api/tags", timeout=5)
    resp.raise_for_status()
    return [m["name"] for m in resp.json().get("models", [])]

def select_model(models):
    """Interactive model selection"""
    # numbered list, user picks number
    pass

def run_claude(base_url, model):
    """Launch claude with Ollama config"""
    env = {
        "ANTHROPIC_AUTH_TOKEN": "ollama",
        "ANTHROPIC_API_KEY": "",
        "ANTHROPIC_BASE_URL": base_url,
    }
    subprocess.run(["claude", "--model", model], env={**os.environ, **env})

def main():
    # 1. Parse args
    # 2. Determine base_url (local or remote)
    # 3. Fetch models, handle connection errors
    # 4. Select model (interactive or from args)
    # 5. Run claude
    pass
```

### Logging
- `[ollama] Connecting to {url}...`
- `[ollama] Found {n} models`
- `[ollama] Using model: {name}`
- `[ollama] ERROR: {message}` (on failure, exit 1)

---

## Script 2: `claude-lm-studio`

### Location
`/Users/serhiihrudakov/Documents/Code/FE/portfolio/scripts/claude-lm-studio`

### Flow
```
1. Check LM Studio server (localhost:1234)
2. Fetch loaded models from /v1/models
3. Prompt user to select model
4. Configure LiteLLM proxy (reuse existing docker-compose)
5. Execute: claude --model <mapped-model>
```

### Key Difference from Ollama
LM Studio uses OpenAI-compatible API, needs LiteLLM proxy to translate to Anthropic format:
```
Claude Code → LiteLLM (4000) → LM Studio (1234)
```

### Arguments
| Arg | Description | Default |
|-----|-------------|---------|
| `--model <name>` | Skip selection | - |
| `--list` | List models and exit | - |
| `--no-proxy` | Direct connection (if LM Studio adds Anthropic support) | - |

### Implementation
Reuse logic from existing `litellm/claude-local` but convert to Python.

---

## File Structure

```
scripts/
├── claude-ollama           # Python executable
├── claude-lm-studio        # Python executable
└── lib/
    └── claude_local.py     # Shared utilities (model selection, logging)
```

## Dependencies
- Python 3.8+
- `requests` library (standard in most systems, fallback to urllib)
- Docker (for LM Studio proxy only)

## Exit Codes
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Server connection failed |
| 2 | No models available |
| 3 | Model not found |

---

## Tasks

### Phase 1: claude-ollama
- [ ] Create `scripts/` directory
- [ ] Implement `scripts/lib/claude_local.py` (shared utils)
- [ ] Implement `scripts/claude-ollama`
- [ ] Test with local Ollama
- [ ] Test with remote Ollama server

### Phase 2: claude-lm-studio
- [ ] Port existing bash logic to Python
- [ ] Implement `scripts/claude-lm-studio`
- [ ] Integrate with existing docker-compose setup
- [ ] Test with LM Studio

### Phase 3: Polish
- [ ] Add `--help` with examples
- [ ] Handle edge cases (no models, server down)
- [ ] Add to PATH or create symlinks

---

## Sources
- [Ollama Blog - Claude Code](https://ollama.com/blog/claude)
- [Ollama Anthropic Compatibility Docs](https://docs.ollama.com/api/anthropic-compatibility)
- [claude-code-router](https://github.com/musistudio/claude-code-router)
- [Claude Code Environment Variables](https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467)
- Existing reference: `litellm/README.md`
