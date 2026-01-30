---
name: tab-agent
description: Browser control via WebSocket - snapshot, click, type, fill, evaluate, screenshot
---

# Tab Agent

WebSocket `ws://localhost:9876`. User activates tabs via extension icon (green = active).

## Before First Command

```bash
curl -s http://localhost:9876/health || (cd ~/tab-agent && node bin/tab-agent.js start &)
sleep 2
```

## Commands

```json
{"id": 1, "action": "tabs"}                                    // list active tabs
{"id": 2, "action": "snapshot", "tabId": ID}                   // get page with refs [e1], [e2]...
{"id": 3, "action": "screenshot", "tabId": ID}                 // viewport screenshot
{"id": 4, "action": "screenshot", "tabId": ID, "fullPage": true}  // full page screenshot
{"id": 5, "action": "click", "tabId": ID, "ref": "e1"}         // click element
{"id": 6, "action": "fill", "tabId": ID, "ref": "e1", "value": "text"}  // fill input
{"id": 7, "action": "type", "tabId": ID, "ref": "e1", "text": "hello"}  // type text
{"id": 8, "action": "type", "tabId": ID, "ref": "e1", "text": "query", "submit": true}  // type and Enter
{"id": 9, "action": "press", "tabId": ID, "key": "Enter"}      // press key
{"id": 10, "action": "scroll", "tabId": ID, "direction": "down", "amount": 500}
{"id": 11, "action": "scrollintoview", "tabId": ID, "ref": "e1"}  // scroll element visible
{"id": 12, "action": "navigate", "tabId": ID, "url": "https://..."}
{"id": 13, "action": "wait", "tabId": ID, "text": "Loading complete"}  // wait for text
{"id": 14, "action": "wait", "tabId": ID, "selector": ".results", "timeout": 5000}  // wait for element
{"id": 15, "action": "evaluate", "tabId": ID, "script": "document.title"}  // run JavaScript
{"id": 16, "action": "batchfill", "tabId": ID, "fields": [{"ref": "e1", "value": "a"}, {"ref": "e2", "value": "b"}]}
{"id": 17, "action": "dialog", "tabId": ID, "accept": true}    // handle alert/confirm
```

## Usage

1. `tabs` -> get tabId of active tab
2. `snapshot` -> read page, get element refs [e1], [e2]...
3. `click`/`fill`/`type` using refs
4. If snapshot incomplete (complex page) -> `screenshot` and analyze visually

## Notes

- Screenshot returns `{"screenshot": "data:image/png;base64,..."}` - analyze directly
- Snapshot refs reset on each call - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
- `type` with `submit: true` presses Enter after typing (for search boxes)
- `evaluate` runs in page context - can access page variables/functions
- `dialog` handles alert/confirm/prompt - debugger bar appears when attached
