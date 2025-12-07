#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
    
    # Check if GEMINI_API_KEY is set
    if [ -n "$GEMINI_API_KEY" ]; then
        echo "✓ GEMINI_API_KEY found and loaded"
    else
        echo "⚠️  Warning: GEMINI_API_KEY not found in .env file"
        echo "   Please add GEMINI_API_KEY=your_api_key to your .env file"
    fi
else
    echo "⚠️  Warning: .env file not found"
    echo "   Create a .env file with GEMINI_API_KEY=your_api_key"
fi

# Set up environment
export PATH="$HOME/bin:$PATH"
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"

# Start Colima if not running
if ! colima status >/dev/null 2>&1; then
    echo "Starting Colima..."
    colima start --runtime docker --cpu 2 --memory 4
fi

# Build the Docker image if it doesn't exist
# if ! docker image inspect claude-code-sandbox >/dev/null 2>&1; then
#     echo "Building Claude Code Sandbox Docker image..."
#     docker build -t claude-code-sandbox .devcontainer/
# fi

# Build the Docker image (rebuild to ensure latest changes)
echo "Building/rebuilding Claude Code Sandbox Docker image..."
docker build -t claude-code-sandbox claude_containerized/.devcontainer/

# Run the Dev Container
echo "Starting Claude Code Dev Container..."
docker run -it --rm \
  --cap-add=NET_ADMIN \
  --cap-add=NET_RAW \
  -v "$(pwd):/workspace" \
  -v claude-code-bashhistory:/commandhistory \
  -v claude-code-config:/home/node/.claude \
  -e NODE_OPTIONS="--max-old-space-size=4096" \
  -e CLAUDE_CONFIG_DIR="/home/node/.claude" \
  -e POWERLEVEL9K_DISABLE_GITSTATUS="true" \
  -e GEMINI_API_KEY="$GEMINI_API_KEY" \
  -w /workspace \
  --user node \
  claude-code-sandbox /bin/zsh 