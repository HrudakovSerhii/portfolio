#!/bin/zsh

# LLM Manager - Start/Stop/Status for local LLM setup

case "$1" in
    start)
        echo "Starting local LLM stack..."
        # Start LiteLLM proxy
        cd "$(dirname "$0")" && docker compose up -d
        echo "Waiting for services to be ready..."
        sleep 5
        
        # Verify health
        if curl -s -H "Authorization: Bearer sh-1986" \
                http://localhost:4000/health > /dev/null 2>&1; then
            echo "✓ Local LLM is ready on port 4000"
        else
            echo "✗ Failed to start local LLM"
            exit 1
        fi
        ;;
    
    stop)
        echo "Stopping local LLM stack..."
        cd "$(dirname "$0")" && docker compose down
        ;;
    
    status)
        if curl -s -H "Authorization: Bearer sh-1986" \
                http://localhost:4000/health \
                --connect-timeout 2 --max-time 3 > /dev/null 2>&1; then
            echo "✓ Local LLM is running on port 4000"
            exit 0
        else
            echo "✗ Local LLM is not running"
            exit 1
        fi
        ;;
    
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 1
        ;;
esac
