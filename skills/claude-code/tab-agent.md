---
name: tab-agent
description: Browser control via WebSocket - snapshot, click, type, screenshot
---

# Tab Agent

WebSocket `ws://localhost:9876`. User activates tabs via extension icon (green = active).

## Commands

```json
{"id": 1, "action": "tabs"}                                    // list active tabs
{"id": 2, "action": "snapshot", "tabId": ID}                   // get page with refs [e1], [e2]...
{"id": 3, "action": "screenshot", "tabId": ID}                 // get base64 PNG (for complex pages)
{"id": 4, "action": "click", "tabId": ID, "ref": "e1"}         // click element
{"id": 5, "action": "fill", "tabId": ID, "ref": "e1", "value": "text"}  // fill input
{"id": 6, "action": "press", "tabId": ID, "key": "Enter"}      // press key
{"id": 7, "action": "scroll", "tabId": ID, "direction": "down", "amount": 500}
{"id": 8, "action": "navigate", "tabId": ID, "url": "https://..."}
```

## Usage

1. `tabs` → get tabId
2. `snapshot` → read page, get element refs
3. `click`/`fill`/`press` using refs
4. If snapshot incomplete → `screenshot` (returns base64 PNG, analyze visually)

## Notes

- Screenshot returns `{"screenshot": "data:image/png;base64,..."}` - analyze directly
- Snapshot refs reset on each call - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
