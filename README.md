# Tab Agent

Secure tab-level browser control for Claude Code and Codex — only the tabs you explicitly activate, not your entire browser.

## Why Tab Agent?

### Security First
Unlike browser automation tools that control your entire browser, Tab Agent uses a **click-to-activate** model:
- Only tabs you explicitly activate (green badge) can be controlled
- Your banking, email, and other sensitive tabs remain completely isolated
- No background access — you see exactly which tabs AI can interact with
- Full audit logging of every action taken

### Works With Your Session
Tab Agent operates through a Chrome extension, which means:
- **Uses your existing cookies and login sessions** — no need to re-authenticate
- Access sites that require login (GitHub, Twitter, internal tools, etc.)
- Works with SSO, 2FA-protected accounts, and enterprise apps
- No credential sharing or token management needed

### AI-Optimized
- **Semantic snapshots** — pages converted to AI-readable text with element refs `[e1]`, `[e2]`
- **Screenshot fallback** — for complex/dynamic pages, get visual screenshots
- **Smart element targeting** — click, type, fill using simple refs instead of fragile selectors

## Install

### 1. Load Extension

```bash
git clone https://github.com/DrHB/tab-agent
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. You'll see the Tab Agent icon in your toolbar

### 2. Run Setup

```bash
npx tab-agent setup
```

This auto-detects your extension and configures everything (native messaging + skills).

### 3. Use It

1. **Click the Tab Agent icon** on any tab you want to control (turns green = active)
2. **Ask Claude/Codex:**
   - "Use tab-agent to search Google for 'best restaurants nearby'"
   - "Go to my GitHub notifications and summarize them"
   - "Fill out this form with my details"

## Example Use Cases

### Web Research
```
"Go to Hacker News and get me the top 5 articles with summaries"
```

### Authenticated Actions
```
"Check my GitHub notifications and mark the resolved ones as read"
```
Works because Tab Agent uses your existing GitHub session!

### Form Automation
```
"Fill out this job application with my resume details"
```

### Data Extraction
```
"Go to my Twitter timeline and get the last 20 tweets"
```

## Commands

| Command | Description |
|---------|-------------|
| `tabs` | List activated tabs |
| `snapshot` | Get AI-readable page with refs [e1], [e2]... |
| `screenshot` | Capture viewport (add `fullPage: true` for full page) |
| `click` | Click element by ref |
| `fill` | Fill form field |
| `type` | Type text (add `submit: true` to press Enter) |
| `press` | Press key (Enter, Escape, Tab, Arrow keys) |
| `scroll` | Scroll page up/down |
| `scrollintoview` | Scroll element into view |
| `navigate` | Go to URL |
| `wait` | Wait for text or selector to appear |
| `evaluate` | Run JavaScript in page context |
| `batchfill` | Fill multiple fields at once |
| `dialog` | Handle alert/confirm/prompt dialogs |

## CLI Commands

```bash
npx tab-agent setup   # Configure everything (run once)
npx tab-agent status  # Check if everything is working
npx tab-agent start   # Manually start the relay server
```

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude/Codex   │────▶│  Relay Server   │────▶│    Extension    │
│   (Your AI)     │◀────│  (WebSocket)    │◀────│  (Chrome)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              :9876                     │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Activated Tab  │
                                               │   (Green = ON)  │
                                               └─────────────────┘
```

1. **Extension** runs in Chrome with access to your tabs and sessions
2. **Relay Server** bridges WebSocket (AI) ↔ Native Messaging (Extension)
3. **AI** sends commands, receives snapshots/screenshots, takes actions

## Security Model

| Feature | Tab Agent | Traditional Automation |
|---------|-----------|----------------------|
| Tab Access | Only activated tabs | All tabs or new browser |
| Sessions | Uses existing cookies | Requires re-login |
| Visibility | Green badge shows active | Hidden/background |
| Audit | Full action logging | Varies |
| Credentials | Never shared | Often required |

## Supported Browsers

- Google Chrome
- Brave
- Microsoft Edge
- Chromium

The setup automatically detects which browser you're using.

## Troubleshooting

**Extension not detected?**
- Make sure you loaded the `extension/` folder in chrome://extensions
- Check that Developer mode is enabled

**Commands not working?**
- Click the Tab Agent icon to activate the tab (must show green "ON")
- Run `npx tab-agent status` to check configuration

**Relay not connecting?**
- Run `npx tab-agent start` manually to see any errors

## License

MIT
