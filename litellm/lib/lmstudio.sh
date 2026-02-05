#!/bin/zsh

# LM Studio integration functions

# Source common utilities if not already loaded
[[ -z "$LITELLM_PORT" ]] && source "$(dirname "$0")/common.sh"

# ============================================================================
# LM Studio Functions
# ============================================================================

# Check if LM Studio API is accessible
lms_check_running() {
    curl -s "${LMSTUDIO_URL}/v1/models" \
        --connect-timeout 2 --max-time 3 > /dev/null 2>&1
}

# Get list of currently loaded models from LM Studio
# Returns: newline-separated list of model IDs
lms_get_loaded_models() {
    curl -s "${LMSTUDIO_URL}/v1/models" \
        --connect-timeout 2 --max-time 3 2>/dev/null | \
        python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    models = [m['id'] for m in data.get('data', [])]
    print('\n'.join(models))
except:
    pass
"
}

# Filter out embedding models from a list of models
# Usage: lms_filter_chat_models model1 model2 ...
# Returns: space-separated list of chat-capable models
lms_filter_chat_models() {
    local models=("$@")
    local chat_models=()

    for model in "${models[@]}"; do
        if [[ ! "$model" =~ "embedding" ]] && [[ ! "$model" =~ "embed" ]]; then
            chat_models+=("$model")
        fi
    done

    echo "${chat_models[@]}"
}
