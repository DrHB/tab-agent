# Tab Agent

Browser control for Claude Code and Codex via WebSocket.

## Quick Start

### 1. Install Extension

```bash
git clone https://github.com/yourname/tab-agent
cd tab-agent
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/`
4. Copy your **Extension ID**

### 2. Setup Relay

```bash
cd relay
npm install
./install-native-host.sh <extension-id>
npm start
```

### 3. Install Skill

```bash
# Claude Code
cp skills/claude-code/tab-agent.md ~/.claude/skills/

# Codex
cp skills/codex/tab-agent.md ~/.codex/skills/
```

### 4. Use

1. Click Tab Agent icon → **Activate** on target tab
2. Ask your AI: "Use tab-agent to search Google for 'hello world'"

## Commands

| Command | Description |
|---------|-------------|
| snapshot | Get AI-readable page |
| click | Click by ref |
| type | Type text |
| fill | Fill form field |
| press | Press key |
| navigate | Go to URL |
| screenshot | Capture image |

## Architecture

```
Claude/Codex → WebSocket → Relay Server → Native Messaging → Extension → Content Script → DOM
```

## License

MIT
