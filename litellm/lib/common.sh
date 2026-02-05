#!/bin/zsh

# Common constants and UI helpers for Claude local LLM setup

# ============================================================================
# Constants
# ============================================================================

LITELLM_PORT=4000
LMSTUDIO_PORT=1234
LITELLM_API_KEY="sh-1986"
LITELLM_URL="http://localhost:${LITELLM_PORT}"
LMSTUDIO_URL="http://localhost:${LMSTUDIO_PORT}"

# ============================================================================
# Colors (only if terminal supports them)
# ============================================================================

if [[ -t 1 ]]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    GREEN=''
    RED=''
    YELLOW=''
    BLUE=''
    BOLD=''
    RESET=''
fi

# ============================================================================
# UI Helper Functions
# ============================================================================

ui_info() {
    echo "${BLUE}→${RESET} $1"
}

ui_success() {
    echo "${GREEN}✓${RESET} $1"
}

ui_error() {
    echo "${RED}✗${RESET} $1" >&2
}

ui_warn() {
    echo "${YELLOW}!${RESET} $1"
}

ui_header() {
    echo ""
    echo "${BOLD}$1${RESET}"
    echo ""
}

ui_prompt() {
    echo -n "${BOLD}$1${RESET} "
}
