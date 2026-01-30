---
name: tab-agent
description: Browser control via WebSocket
---

# Tab Agent

`ws://localhost:9876` - User activates tabs via extension (green = active)

## Commands

```
tabs                              → list active tabs
snapshot tabId                    → page with refs [e1], [e2]...
screenshot tabId                  → base64 PNG (analyze visually)
click tabId ref                   → click element
fill tabId ref value              → fill input
press tabId key                   → Enter/Escape/Tab/Arrow*
scroll tabId direction amount     → scroll page
navigate tabId url                → go to URL
```

## Flow

`tabs` → `snapshot` → `click`/`fill` → repeat. Use `screenshot` if snapshot incomplete.
