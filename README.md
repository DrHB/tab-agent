# Tab Agent

**Secure browser control for Claude Code and Codex** — only the tabs you explicitly activate, not your entire browser.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude/Codex   │────▶│  Relay Server   │────▶│    Extension    │
│                 │◀────│   :9876         │◀────│    (Chrome)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌───────────────────┐
                                              │  Your Active Tab  │
                                              │    🟢 ON          │
                                              └───────────────────┘
```

## Quick Start

```bash
# 1. Clone and load extension
git clone https://github.com/DrHB/tab-agent
# → Open chrome://extensions → Enable Developer mode → Load unpacked → select extension/

# 2. Setup (auto-detects everything)
npx tab-agent setup

# 3. Use it
# → Click Tab Agent icon on a tab (turns green)
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
| **Audit** | Full action logging | Varies |

**Click-to-activate model:** Your banking, email, and sensitive tabs stay completely isolated. You always see exactly which tabs AI can control.

### 🍪 Works With Your Login Sessions

Because Tab Agent runs as a Chrome extension:

- **Uses your existing cookies** — no re-authentication needed
- **Access any site you're logged into** — GitHub, X, Gmail, internal tools
- **Works with SSO and 2FA** — enterprise apps, protected accounts
- **No credential sharing** — your passwords stay in your browser

### 🤖 AI-Optimized

- **Semantic snapshots** — pages converted to AI-readable text with refs `[e1]`, `[e2]`
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
3. Ask your AI to interact with the page

---

## Commands Reference

### Navigation & Viewing
| Command | Description |
|---------|-------------|
| `tabs` | List all activated tabs |
| `navigate` | Go to a URL |
| `snapshot` | Get AI-readable page with element refs |
| `screenshot` | Capture viewport image |
| `screenshot fullPage` | Capture entire page |

### Interaction
| Command | Description |
|---------|-------------|
| `click` | Click element by ref |
| `type` | Type text into element |
| `type ... submit` | Type and press Enter |
| `fill` | Fill a form field |
| `batchfill` | Fill multiple fields at once |
| `press` | Press a key (Enter, Escape, Tab, Arrows) |

### Page Control
| Command | Description |
|---------|-------------|
| `scroll` | Scroll up/down by amount |
| `scrollintoview` | Scroll element into view |
| `wait` | Wait for text or element to appear |
| `evaluate` | Run JavaScript in page context |
| `dialog` | Handle alert/confirm/prompt |

---

## CLI Reference

```bash
npx tab-agent setup   # Initial configuration
npx tab-agent status  # Check if everything works
npx tab-agent start   # Start relay server manually
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

2. **Relay Server** — Local WebSocket server (port 9876) that bridges AI ↔ Extension via Chrome's Native Messaging API

3. **Skill File** — Tells Claude/Codex how to send commands to the relay

**Data flow:**
```
You: "Search Google for cats"
 ↓
Claude/Codex → WebSocket command → Relay Server → Native Messaging → Extension → DOM action
 ↑
Results ← WebSocket response ← Relay Server ← Native Messaging ← Page snapshot
```

---

## License

MIT

---

**Made for [Claude Code](https://claude.ai/code) and [Codex](https://openai.com/codex)**
