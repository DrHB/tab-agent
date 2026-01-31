#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.browseragent.relay"
HOST_DIR="$HOME/Library/Application Support/TabAgent"
WRAPPER_PATH="$HOST_DIR/native-host-wrapper.sh"

if [[ "$OSTYPE" == "darwin"* ]]; then
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

mkdir -p "$MANIFEST_DIR"

if [ -z "$1" ]; then
  echo "Usage: ./install-native-host.sh <extension-id>"
  echo ""
  echo "Find your extension ID at chrome://extensions (enable Developer mode)"
  exit 1
fi

EXTENSION_ID="$1"

if [ ! -d "$SCRIPT_DIR/node_modules/ws" ]; then
  echo "Dependencies missing: run 'npm install' in $SCRIPT_DIR first."
  exit 1
fi

mkdir -p "$HOST_DIR"
rm -rf "$HOST_DIR/node_modules"
cp "$SCRIPT_DIR/native-host.js" "$HOST_DIR/native-host.js"
cp "$SCRIPT_DIR/native-host-wrapper.sh" "$HOST_DIR/native-host-wrapper.sh"
cp -R "$SCRIPT_DIR/node_modules" "$HOST_DIR/node_modules"

cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "BrowserAgent Native Messaging Host",
  "path": "$WRAPPER_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

chmod +x "$WRAPPER_PATH"
chmod +x "$HOST_DIR/native-host.js"

echo "Native messaging host installed!"
echo "Manifest: $MANIFEST_DIR/$HOST_NAME.json"
echo "Extension ID: $EXTENSION_ID"
