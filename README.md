# Tab Agent

[![npm version](https://img.shields.io/npm/v/tab-agent.svg)](https://www.npmjs.com/package/tab-agent)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/DrHB/tab-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Let Claude & Codex browse as YOU** — uses your existing logins, click-to-activate security.

> No headless browser. No re-authenticating. Your AI uses your actual Chrome sessions.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│  Relay Server   │────▶│    Extension    │
│    or Codex     │◀────│   (background)  │◀────│    (Chrome)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                       │
                                                       ▼
                                             ┌───────────────────┐
                                             │  Your Active Tab  │
                                             │   🟢 Click to ON  │
                                             └───────────────────┘
```

## Why Tab Agent?

Most browser automation tools (Playwright, Puppeteer, agent-browser) spin up a **fresh headless browser** — you start logged out of everything, and many sites actively block them. They detect headless browsers through missing plugins, `navigator.webdriver` flags, and other fingerprints.

Tab Agent is different — it uses your real Chrome with your real cookies:

```
+---------------+--------------------------------------+----------------------------------+
|               | Tab Agent                            | Headless Browsers                |
+---------------+--------------------------------------+----------------------------------+
| Your logins   | (+) Uses existing sessions           | (-) Must re-authenticate         |
| Security      | (+) Click to activate specific tabs  | (-) Full browser access          |
| Privacy       | (+) Credentials never leave browser  | (-) Agent sees everything        |
| Detection     | (+) Real browser, real cookies       | (-) Often blocked by anti-bot    |
| Setup         | (+) Uses your Chrome                 | (-) Downloads separate browser   |
| Visibility    | (+) Watch in real browser            | (-) Runs hidden/headless         |
+---------------+--------------------------------------+----------------------------------+
```

**Use Tab Agent when:** Claude or Codex needs to browse as "you" — shopping with your Prime account, checking your GitHub notifications, using sites you're already logged into.

**Use headless browsers when:** CI/CD automation, web scraping, or testing with fresh sessions.

## Features

- **Full browser control** — navigate, click, type, scroll, screenshot, run JavaScript
- **Uses your login sessions** — access GitHub, Gmail, Amazon without sharing credentials
- **Runs in background** — relay starts automatically, works while you do other things
- **Click-to-activate security** — only tabs you explicitly enable, others stay private
- **AI-optimized snapshots** — pages converted to text with refs `[e1]`, `[e2]` for easy targeting
- **Works with Claude Code & Codex** — installs skills automatically

## Quick Start

```bash
# 1. Install extension
git clone https://github.com/DrHB/tab-agent
# Chrome: chrome://extensions → Developer mode → Load unpacked → select extension/

# 2. Setup
npx tab-agent setup

# 3. Activate & go
# Click extension icon on any tab (turns green)
# Ask Claude/Codex: "Search Amazon for mechanical keyboards and find the best rated"
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
"Fill out this form with my details"
```

## Commands

```bash
# Core workflow
npx tab-agent snapshot                # Get page content with refs [e1], [e2]...
npx tab-agent click <ref>             # Click element (e.g., click e5)
npx tab-agent type <ref> <text>       # Type into element
npx tab-agent fill <ref> <value>      # Fill form field

# Navigation
npx tab-agent navigate <url>          # Go to URL
npx tab-agent scroll <dir> [amount]   # Scroll up/down
npx tab-agent press <key>             # Press key (Enter, Escape, Tab)

# Utilities
npx tab-agent tabs                    # List active tabs
npx tab-agent wait <text>             # Wait for text to appear
npx tab-agent screenshot              # Capture page (fallback for complex UIs)
```

**Workflow:** `snapshot` → use refs → `click`/`type` → `snapshot` again → repeat

## Installation

### 1. Load Extension

```bash
git clone https://github.com/DrHB/tab-agent
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### 2. Run Setup

```bash
npx tab-agent setup
```

This auto-detects your extension and configures everything.

### 3. Activate Tabs

Click the Tab Agent icon on any tab you want to control. Green = active.

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
- Run `npx tab-agent status` to check configuration

**No active tabs?**
- Activate at least one tab by clicking the extension icon

## How It Works

1. **Chrome Extension** — Injects into activated tabs, captures DOM snapshots
2. **Relay Server** — Bridges AI ↔ Extension via Chrome Native Messaging (runs in background)
3. **CLI** — Simple commands for Claude Code and Codex

```
You: "Find cheap flights to Tokyo"
 ↓
Claude → npx tab-agent navigate "google.com/flights"
    → npx tab-agent snapshot
    → npx tab-agent type e5 "Tokyo"
    → npx tab-agent click e12
    → ...
```

## License

MIT
