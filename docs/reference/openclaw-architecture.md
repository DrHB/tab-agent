# OpenClaw Architecture Overview

How a request like **"get me top 10 news on hackernews"** flows through the system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER REQUEST FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐
  │   USER MESSAGE   │  "Get me top 10 news on hackernews"
  │  (WhatsApp/      │
  │   Telegram/CLI)  │
  └────────┬─────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GATEWAY                                         │
│                     ws://127.0.0.1:18789                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  • Receives RPC call to "agent" method                              │    │
│  │  • Resolves/creates session (main or group)                         │    │
│  │  • Validates permissions & channels                                 │    │
│  │  • Routes to Pi Agent                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PI AGENT (LLM)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  • Receives user message + system prompt + tool definitions         │    │
│  │  • Analyzes request: needs to browse a website                      │    │
│  │  • Available tools: browser, exec, canvas, nodes, etc.              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           │          TOOL CALLING LOOP                │
           └─────────────────────┬─────────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
    ▼                            ▼                            ▼
┌────────────┐            ┌────────────┐            ┌────────────┐
│  STEP 1    │            │  STEP 2    │            │  STEP 3    │
│browser.open│───────────▶│ browser.   │───────────▶│ browser.   │
│  (url)     │            │ snapshot   │            │ screenshot │
└─────┬──────┘            └─────┬──────┘            └─────┬──────┘
      │                         │                         │
      └─────────────────────────┴─────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER TOOL                                         │
│                    (browser-tool.ts)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Actions: open, snapshot, screenshot, act, navigate, tabs, etc.     │    │
│  │  Routes request to Browser Control Service                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   ROUTING DECISION      │
                    └────────────┬────────────┘
                                 │
       ┌─────────────────────────┼─────────────────────────┐
       │                         │                         │
       ▼                         ▼                         ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    HOST      │         │    NODE      │         │   SANDBOX    │
│   (Local)    │         │   (Remote)   │         │  (Docker)    │
│127.0.0.1:    │         │  via Node    │         │  Isolated    │
│   18791      │         │  Registry    │         │  Browser     │
└──────┬───────┘         └──────────────┘         └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BROWSER CONTROL SERVICE                                   │
│                    http://127.0.0.1:18791                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Express HTTP Server with routes:                                   │    │
│  │  • POST /tabs/open     → Open new tab with URL                      │    │
│  │  • POST /snapshot      → Generate AI-readable page snapshot         │    │
│  │  • POST /screenshot    → Capture page image                         │    │
│  │  • POST /act           → Click, type, hover, drag, etc.            │    │
│  │  • POST /navigate      → Go to URL                                  │    │
│  │  • GET  /tabs          → List open tabs                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLAYWRIGHT LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  High-level wrappers over CDP:                                      │    │
│  │  • snapshotAiViaPlaywright()  → AI-readable text of page           │    │
│  │  • clickViaPlaywright()       → Click element by ref               │    │
│  │  • typeViaPlaywright()        → Type text into fields              │    │
│  │  • takeScreenshotViaPlaywright()                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CHROME DEVTOOLS PROTOCOL (CDP)                             │
│                       ws://127.0.0.1:18800                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Low-level browser control:                                         │    │
│  │  • Page.navigate           → Navigate to URL                        │    │
│  │  • Page.captureScreenshot  → Get screenshot as base64               │    │
│  │  • Accessibility.getFullAXTree → Get accessibility tree             │    │
│  │  • Runtime.evaluate        → Execute JavaScript                     │    │
│  │  • Input.dispatchMouseEvent → Click/drag                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHROME BROWSER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Managed Chromium instance with:                                    │    │
│  │  • Profile: ~/.openclaw/browser-data/openclaw/                      │    │
│  │  • CDP enabled on port 18800                                        │    │
│  │  • Headless or headed mode                                          │    │
│  │  • Persistent cookies/auth                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐      │
│    │              news.ycombinator.com                               │      │
│    │   ┌─────────────────────────────────────────────────────────┐   │      │
│    │   │  Hacker News                                            │   │      │
│    │   │  ─────────────────────────────────────────────────────  │   │      │
│    │   │  1. [e1] Show HN: Project X...              (points)    │   │      │
│    │   │  2. [e2] Ask HN: Best tools for...          (points)    │   │      │
│    │   │  3. [e3] New programming language...        (points)    │   │      │
│    │   │  ...                                                    │   │      │
│    │   │  10.[e10] Latest in AI research             (points)    │   │      │
│    │   └─────────────────────────────────────────────────────────┘   │      │
│    └─────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SNAPSHOT RETURNED TO AGENT                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  == Page Snapshot ==                                                │    │
│  │  [e1] link "Show HN: Project X - Revolutionary tool" (284 pts)     │    │
│  │  [e2] link "Ask HN: Best tools for remote work?" (156 pts)         │    │
│  │  [e3] link "New programming language breaks records" (342 pts)     │    │
│  │  [e4] link "OpenAI announces new model" (521 pts)                  │    │
│  │  ...                                                                │    │
│  │  [e10] link "Latest AI research compilation" (98 pts)              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PI AGENT PROCESSES RESULT                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  • Parses snapshot, identifies top 10 stories                       │    │
│  │  • Extracts titles, points, authors from refs [e1]-[e10]           │    │
│  │  • Optionally takes screenshot for visual confirmation              │    │
│  │  • Generates human-readable summary                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESPONSE TO USER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  "Here are the top 10 news stories on Hacker News:                 │    │
│  │                                                                     │    │
│  │   1. New programming language breaks records (342 pts)             │    │
│  │   2. OpenAI announces new model (521 pts)                          │    │
│  │   3. Show HN: Project X - Revolutionary tool (284 pts)             │    │
│  │   ... [full list with titles, points, and links]                   │    │
│  │                                                                     │    │
│  │   [Screenshot attached]"                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components Summary

| Layer | Component | Port | Purpose |
|-------|-----------|------|---------|
| **Entry** | Gateway | 18789 | WebSocket control plane, routes messages |
| **AI** | Pi Agent | - | LLM that understands requests, calls tools |
| **Tool** | Browser Tool | - | High-level API for browser actions |
| **Service** | Browser Control | 18791 | HTTP server handling browser commands |
| **Abstraction** | Playwright | - | High-level wrappers over CDP |
| **Protocol** | CDP | 18800 | Chrome DevTools Protocol (low-level) |
| **Browser** | Chrome/Chromium | - | Actual browser rendering pages |

## The "Snapshot" Concept

The key innovation is the **AI-readable snapshot** format:
- Playwright extracts the page's accessibility tree
- Elements get refs like `[e1]`, `[e2]`, etc.
- Agent can reference these to click: `{ action: "act", kind: "click", ref: "e1" }`
- No need for CSS selectors or XPath - the AI "sees" the page as structured text

This allows the LLM to understand and interact with web pages naturally.

## Key Files in the Codebase

| Component | File Location |
|-----------|---------------|
| Browser Tool | `src/agents/tools/browser-tool.ts` |
| Gateway Handlers | `src/gateway/server-methods/browser.ts` |
| Control Service | `src/browser/server.ts` |
| Routes | `src/browser/routes/` |
| Playwright Wrappers | `src/browser/pw-*.ts` |
| CDP Protocol | `src/browser/cdp.ts` |
| Snapshot Generator | `src/browser/pw-role-snapshot.ts` |
| Agent Runner | `src/auto-reply/reply/agent-runner*.ts` |
| Pi Agent Core | `src/agents/pi-embedded-runner/` |
