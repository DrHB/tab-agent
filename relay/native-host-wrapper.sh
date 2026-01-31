#!/bin/bash
# Wrapper script to ensure correct working directory for native-host.js

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/wrapper.log"
echo "$(date): Starting native host from $SCRIPT_DIR" >> "$LOG_FILE"
export TAB_AGENT_LOG="/tmp/tabpilot-native-host.log"

NODE_BIN="/opt/homebrew/bin/node"
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="/usr/local/bin/node"
fi
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="/usr/bin/node"
fi
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node 2>/dev/null)"
fi
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "$(date): Node.js not found" >> "$LOG_FILE"
  exit 1
fi

export NODE_PATH="$SCRIPT_DIR/node_modules"
echo "$(date): Using node at $NODE_BIN" >> "$LOG_FILE"
echo "$(date): TAB_AGENT_LOG=$TAB_AGENT_LOG" >> "$LOG_FILE"
exec "$NODE_BIN" "$SCRIPT_DIR/native-host.js" 2>> "$LOG_FILE"
