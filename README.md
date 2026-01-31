# Tab Agent

[![npm version](https://img.shields.io/npm/v/tab-agent.svg)](https://www.npmjs.com/package/tab-agent)

**Give Claude, Codex, or any LLM full control of your browser tabs** — securely, with click-to-activate permission.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│  Relay Server   │────▶│    Extension    │
│   Codex / LLM   │◀────│   (background)  │◀────│    (Chrome)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                       │
                                                       ▼
                                             ┌───────────────────┐
                                             │  Your Active Tab  │
                                             │   🟢 Click to ON  │
                                             └───────────────────┘
```

## Features

- **Full browser control** — navigate, click, type, scroll, screenshot, run JavaScript
- **Uses your login sessions** — access authenticated sites (GitHub, Gmail, X) without sharing credentials
- **Runs in background** — relay server starts automatically, works while you do other things
- **Click-to-activate security** — only tabs you explicitly enable, your other tabs stay private
- **AI-optimized snapshots** — pages converted to readable text with element refs `[e1]`, `[e2]`
- **Works with any LLM** — Claude Code, Codex, or any tool that can run shell commands

---

## Quick Start

```bash
# 1. Clone and load extension
git clone https://github.com/DrHB/tab-agent
# → Chrome: chrome://extensions → Developer mode → Load unpacked → select extension/

# 2. Setup (auto-detects everything)
npx tab-agent setup

# 3. Activate a tab & go!
# → Click Tab Agent icon on any tab (turns green = active)
# → Ask Claude: "Use tab-agent to search Google for 'hello world'"
```

---

## Why Tab Agent?

### 🔒 Security First

| | Tab Agent | Traditional Automation |
|--|-----------|----------------------|
| **Access** | Only tabs you activate | Entire browser |
| **Visibility** | Green badge = active | Hidden/background |
| **Sessions** | Uses your cookies | Requires re-login |
| **Credentials** | Never shared | Often required |

**Click-to-activate model:** Your banking, email, and sensitive tabs stay completely isolated. You always see exactly which tabs the LLM can control.

### 🍪 Works With Your Login Sessions

Because Tab Agent runs as a Chrome extension:

- **Uses your existing cookies** — no re-authentication needed
- **Access any site you're logged into** — GitHub, X, Gmail, internal tools
- **Works with SSO and 2FA** — enterprise apps, protected accounts
- **No credential sharing** — your passwords stay in your browser

### 🤖 LLM-Optimized

- **Semantic snapshots** — pages converted to readable text with refs `[e1]`, `[e2]`
- **Screenshot fallback** — for complex dynamic pages
- **Simple targeting** — click/type using refs instead of fragile CSS selectors

---

## Example Use Cases

**Web Research**
> "Go to Hacker News and summarize the top 5 articles"

**Authenticated Actions** (uses your session!)
> "Check my GitHub notifications and list the unread ones"

**Form Automation**
> "Fill out this contact form with my details"

**Data Extraction**
> "Get the last 20 posts from my X timeline with author names"

**Multi-step Workflows**
> "Search Amazon for 'mechanical keyboard', filter by 4+ stars, and list the top 3"

---

## Installation

### Step 1: Load Extension

```bash
git clone https://github.com/DrHB/tab-agent
```

1. Open `chrome://extensions` in your browser
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. You'll see the Tab Agent icon in your toolbar

### Step 2: Run Setup

```bash
npx tab-agent setup
```

This automatically:
- Detects your extension ID
- Configures native messaging
- Installs the Claude/Codex skill

### Step 3: Activate & Use

1. Navigate to any webpage
2. **Click the Tab Agent icon** — it turns green (🟢 ON)
3. Ask your LLM to interact with the page

---

## Commands Reference

### Navigation & Viewing
| Command | Description |
|---------|-------------|
| `tabs` | List all activated tabs |
| `navigate` | Go to a URL |
| `snapshot` | Get page with element refs |
| `screenshot` | Capture viewport image |
| `screenshot --full` | Capture entire page |

### Interaction
| Command | Description |
|---------|-------------|
| `click` | Click element by ref |
| `type` | Type text into element |
| `fill` | Fill a form field |
| `press` | Press a key (Enter, Escape, Tab, Arrows) |

### Page Control
| Command | Description |
|---------|-------------|
| `scroll` | Scroll up/down by amount |
| `wait` | Wait for text or element to appear |
| `evaluate` | Run JavaScript in page context |

---

## CLI Usage

```bash
# Setup & Status
npx tab-agent setup                   # Initial configuration
npx tab-agent status                  # Check if everything works
npx tab-agent start                   # Start relay server manually

# Browser Commands
npx tab-agent tabs                    # List active tabs
npx tab-agent snapshot                # Get page content with refs
npx tab-agent screenshot              # Capture viewport
npx tab-agent screenshot --full       # Capture full page
npx tab-agent click e5                # Click element
npx tab-agent type e3 "hello"         # Type text
npx tab-agent navigate "https://..."  # Go to URL
```

---

## Supported Browsers

- Google Chrome
- Brave
- Microsoft Edge
- Chromium

Setup automatically detects your browser.

---

## Troubleshooting

**Extension not detected?**
- Ensure `extension/` folder is loaded in chrome://extensions
- Developer mode must be enabled
- Try refreshing the extensions page

**Tab not responding?**
- Click the Tab Agent icon — must show green "ON" badge
- Refresh the page after activating

**Relay connection issues?**
- Run `npx tab-agent status` to check config
- Run `npx tab-agent start` to see error details

---

## How It Works

1. **Chrome Extension** — Runs in your browser with access to activated tabs and your session cookies

2. **Relay Server** — Local WebSocket server that bridges LLM ↔ Extension via Chrome's Native Messaging API (runs in background)

3. **Skill File** — Tells Claude/Codex how to send commands

**Data flow:**
```
You: "Search Google for cats"
 ↓
LLM → CLI command → Relay Server → Native Messaging → Extension → Browser action
 ↑
Results ← Response ← Relay Server ← Native Messaging ← Page snapshot
```

---

## License

MIT

---

**Works with [Claude Code](https://claude.ai/code), [Codex](https://openai.com/codex), and any LLM that can run shell commands.**
