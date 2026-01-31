# AI Web Agent

[![npm version](https://img.shields.io/npm/v/ai-web-agent.svg)](https://www.npmjs.com/package/ai-web-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Give LLMs full control of your browser** — securely, with click-to-activate permission.

Works with Claude Code, Codex, ChatGPT, and any AI that can run shell commands.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│  Relay Server   │────▶│    Extension    │
│  Codex / GPT    │◀────│   (background)  │◀────│    (Chrome)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                       │
                                                       ▼
                                             ┌───────────────────┐
                                             │  Your Active Tab  │
                                             │   🟢 Click to ON  │
                                             └───────────────────┘
```

## Why Web Agent?

- **Full browser control** — navigate, click, type, scroll, screenshot, run JavaScript
- **Uses your login sessions** — access GitHub, Gmail, X, Amazon without sharing credentials
- **Runs in background** — relay starts automatically, works while you do other things
- **Click-to-activate security** — only tabs you explicitly enable, others stay private
- **AI-optimized snapshots** — pages converted to text with refs `[e1]`, `[e2]` for easy targeting
- **Works with any LLM** — Claude, GPT, Codex, or custom agents

## Quick Start

```bash
# 1. Install extension
git clone https://github.com/AiGithubWebAgent/web-agent
# Chrome: chrome://extensions → Developer mode → Load unpacked → select extension/

# 2. Setup
npx ai-web-agent setup

# 3. Activate & go
# Click the extension icon on any tab (turns green)
# Ask your AI: "Search Amazon for mechanical keyboards and find the best rated"
```

## Example Tasks

```bash
# Research
"Go to Hacker News and summarize the top 5 stories"

# Shopping (uses your login!)
"Search Amazon for protein powder, filter by 4+ stars, find the best value"

# Social Media
"Check my GitHub notifications and list unread ones"

# Data Extraction
"Get the titles and prices of the first 10 products on this page"

# Automation
"Fill out this form with my details and submit"
```

## Commands

```bash
# Core workflow
npx ai-web-agent snapshot                # Get page content with refs [e1], [e2]...
npx ai-web-agent click <ref>             # Click element (e.g., click e5)
npx ai-web-agent type <ref> <text>       # Type into element
npx ai-web-agent fill <ref> <value>      # Fill form field

# Navigation
npx ai-web-agent navigate <url>          # Go to URL
npx ai-web-agent scroll <dir> [amount]   # Scroll up/down
npx ai-web-agent press <key>             # Press key (Enter, Escape, Tab)

# Utilities
npx ai-web-agent tabs                    # List active tabs
npx ai-web-agent wait <text>             # Wait for text to appear
npx ai-web-agent screenshot              # Capture page (fallback for complex UIs)
```

**Workflow:** `snapshot` → use refs → `click`/`type` → `snapshot` again → repeat

## Installation

### 1. Load Extension

```bash
git clone https://github.com/AiGithubWebAgent/web-agent
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### 2. Run Setup

```bash
npx ai-web-agent setup
```

This auto-detects your extension and configures everything.

### 3. Activate Tabs

Click the Web Agent icon on any tab you want to control. Green = active.

## Security Model

| Feature | Web Agent | Traditional Automation |
|---------|-----------|----------------------|
| **Access** | Only tabs you click to activate | Entire browser |
| **Sessions** | Uses your cookies | Requires credentials |
| **Visibility** | Green badge shows active tabs | Hidden/background |
| **Control** | You choose what AI can access | Full access by default |

Your banking, email, and sensitive tabs stay completely isolated unless you explicitly activate them.

## Supported Browsers

- Google Chrome
- Brave
- Microsoft Edge
- Chromium

## Troubleshooting

**Extension not detected?**
- Make sure Developer mode is enabled in chrome://extensions
- Reload the extension

**Commands not working?**
- Click the extension icon — must show green "ON"
- Run `npx ai-web-agent status` to check configuration

**No active tabs?**
- Activate at least one tab by clicking the extension icon

## How It Works

1. **Chrome Extension** — Injects into activated tabs, captures DOM snapshots
2. **Relay Server** — Bridges AI ↔ Extension via Chrome Native Messaging (runs in background)
3. **CLI** — Simple commands that any LLM can execute

```
You: "Find cheap flights to Tokyo"
 ↓
LLM → npx ai-web-agent navigate "google.com/flights"
    → npx ai-web-agent snapshot
    → npx ai-web-agent type e5 "Tokyo"
    → npx ai-web-agent click e12
    → ...
```

## License

MIT

---

**Keywords:** web agent, browser automation, AI browser control, Claude browser, Codex browser, LLM web automation, browser agent, ChatGPT browser
