#!/bin/zsh

# LiteLLM proxy management functions

# Source common utilities if not already loaded
[[ -z "$LITELLM_PORT" ]] && source "$(dirname "$0")/common.sh"

# ============================================================================
# LiteLLM Functions
# ============================================================================

# Check if LiteLLM proxy is healthy
# Returns: 0 if healthy, 1 otherwise
litellm_check_health() {
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${LITELLM_API_KEY}" \
        "${LITELLM_URL}/health" \
        --connect-timeout 2 --max-time 3)
    [[ "$http_code" == "200" ]]
}

# Generate config.yaml for LiteLLM with given models
# Usage: litellm_generate_config model1 model2 ...
litellm_generate_config() {
    local models=("$@")
    local config_file="${SCRIPT_DIR}/config.yaml"

    # Start with settings header
    cat > "$config_file" << 'EOF'
litellm_settings:
  drop_params: true  # Drop unsupported parameters like reasoning_effort

model_list:
EOF

    # Add each model
    for model in "${models[@]}"; do
        cat >> "$config_file" << EOF
  - model_name: "$model"
    litellm_params:
      model: "openai/$model"
      api_base: "http://host.docker.internal:${LMSTUDIO_PORT}/v1"
      api_key: "lm-studio"

EOF
    done

    # Add wildcard for Anthropic model requests (maps to first model)
    local first_model="${models[1]}"
    cat >> "$config_file" << EOF
  # Wildcard for any Anthropic model requests
  - model_name: "anthropic/*"
    litellm_params:
      model: "openai/$first_model"
      api_base: "http://host.docker.internal:${LMSTUDIO_PORT}/v1"
      api_key: "lm-studio"
EOF
}

# Ensure LiteLLM container is running
# Starts or restarts as needed
# Returns: 0 on success, 1 on failure
litellm_ensure_running() {
    local max_attempts=${1:-15}

    # Check if container exists
    if docker ps -a --format '{{.Names}}' | grep -q '^litellm$'; then
        ui_info "Restarting LiteLLM proxy..."
        docker restart litellm > /dev/null 2>&1
    else
        ui_info "Starting LiteLLM proxy..."
        (cd "$SCRIPT_DIR" && docker compose up -d > /dev/null 2>&1)
    fi

    # Wait for health check
    ui_info "Waiting for LiteLLM to be ready..."
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if litellm_check_health; then
            return 0
        fi
        sleep 1
        ((attempt++))
    done

    return 1
}
