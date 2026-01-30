# Tab Agent

Secure tab-level browser control for Claude Code and Codex — only the tabs you explicitly activate, not your entire browser.

## Install

### 1. Load Extension
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/` folder

### 2. Setup
```bash
npx tab-agent setup
```

That's it! The setup auto-detects your extension and configures everything.

## Use

1. Click Tab Agent icon on any tab (turns green = active)
2. Ask Claude/Codex: "Use tab-agent to search Google for 'hello world'"

## Commands

| Command | Description |
|---------|-------------|
| `tabs` | List activated tabs |
| `snapshot` | Get AI-readable page with refs [e1], [e2]... |
| `screenshot` | Capture viewport (or `fullPage: true` for full page) |
| `click` | Click element by ref |
| `fill` | Fill form field |
| `type` | Type text (with optional `submit: true`) |
| `press` | Press key (Enter, Escape, Tab, Arrow*) |
| `scroll` | Scroll page |
| `scrollintoview` | Scroll element into view |
| `navigate` | Go to URL |
| `wait` | Wait for text or selector |
| `evaluate` | Run JavaScript in page context |
| `batchfill` | Fill multiple fields at once |
| `dialog` | Handle alert/confirm/prompt |

## Manual Commands

```bash
npx tab-agent status  # Check configuration
npx tab-agent start   # Start relay manually
```

## Architecture

```
Claude/Codex → WebSocket:9876 → Relay → Native Messaging → Extension → DOM
```

## License

MIT
