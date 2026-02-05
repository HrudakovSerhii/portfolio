# Claude Code with Local LLM

Run Claude Code with local models via LM Studio and LiteLLM proxy.

## Architecture

```
Claude Code → LiteLLM Proxy (port 4000) → LM Studio (port 1234) → Local Models
```

## Prerequisites

- LM Studio installed and running
- Docker and Docker Compose
- At least one model loaded in LM Studio

## Quick Start

```bash
# Start LM Studio and load a model, then:
./claude-local
```

That's it. The script will:

1. Detect loaded models from LM Studio
2. Generate LiteLLM proxy configuration
3. Start/restart the LiteLLM container
4. Launch Claude Code with local configuration

If multiple models are loaded, you'll be prompted to select one.

## Usage

```bash
./claude-local              # Auto-detect and launch
./claude-local --status     # Check service status
./claude-local --help       # Show help
./claude-local -- /help     # Pass arguments to Claude
```

## Shell Alias (Optional)

Add to your `~/.zshrc`:

```bash
# Claude with local LLM
alias claude-local='/path/to/litellm/claude-local'
```

## Other Utilities

### llm-manager.sh

Standalone Docker utility for managing the LiteLLM stack:

```bash
./llm-manager.sh start      # Start LiteLLM proxy
./llm-manager.sh stop       # Stop LiteLLM proxy
./llm-manager.sh status     # Check status
./llm-manager.sh restart    # Restart proxy
```

## Configuration Files

| File                  | Purpose                              |
|-----------------------|--------------------------------------|
| `.env`                | LiteLLM master key                   |
| `config.yaml`         | LiteLLM model mappings (auto-generated) |
| `docker-compose.yaml` | Docker services configuration        |
| `lib/`                | Shared library functions             |

## Troubleshooting

### LM Studio not detected

Make sure LM Studio is running with the local server enabled (default port 1234).

### No models loaded

Load a model in LM Studio before running `./claude-local`. You can check loaded models with:

```bash
curl http://localhost:1234/v1/models
```

### LiteLLM won't start

Check Docker is running and view logs:

```bash
docker logs litellm
```

### Claude Code not connecting

Verify LiteLLM health:

```bash
curl -H "Authorization: Bearer sh-1986" http://localhost:4000/health
```

## Fallback

If local setup fails, `./claude-local` will offer to fall back to the Claude API (requires `ANTHROPIC_API_KEY` configured).

## Benefits

- **Privacy** - All processing happens locally
- **Cost** - No API charges
- **Speed** - No network latency (after model loads)
- **Flexibility** - Use any model LM Studio supports
