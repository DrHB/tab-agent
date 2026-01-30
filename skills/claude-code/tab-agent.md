---
name: tab-agent
description: Control browser tabs - navigate, click, type, extract data from web pages
---

# Tab Agent - Browser Control

Control Chrome tabs via WebSocket at `ws://localhost:9876`.

## Setup

1. Extension installed and relay server running (`cd relay && npm start`)
2. Tab activated (click extension icon → Activate)

## Commands

All commands are JSON with an `id` field for request/response matching.

### Get page snapshot
```json
{"id": 1, "action": "snapshot", "tabId": <id>}
```
Returns AI-readable page with refs: `[e1] link "Home"`, `[e2] button "Submit"`

### Click element
```json
{"id": 2, "action": "click", "tabId": <id>, "ref": "e1"}
```

### Type text
```json
{"id": 3, "action": "type", "tabId": <id>, "ref": "e2", "text": "hello"}
```

### Fill form field (clears first)
```json
{"id": 4, "action": "fill", "tabId": <id>, "ref": "e2", "value": "hello"}
```

### Press key
```json
{"id": 5, "action": "press", "tabId": <id>, "key": "Enter"}
```
Keys: Enter, Escape, Tab, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight

### Select dropdown
```json
{"id": 6, "action": "select", "tabId": <id>, "ref": "e3", "value": "option1"}
```

### Hover
```json
{"id": 7, "action": "hover", "tabId": <id>, "ref": "e4"}
```

### Scroll
```json
{"id": 8, "action": "scroll", "tabId": <id>, "direction": "down", "amount": 300}
```

### Navigate
```json
{"id": 9, "action": "navigate", "tabId": <id>, "url": "https://example.com"}
```

### Screenshot
```json
{"id": 10, "action": "screenshot", "tabId": <id>}
```

### List tabs
```json
{"id": 11, "action": "tabs"}
```

### Activate tab
```json
{"id": 12, "action": "activate", "tabId": <id>}
```

## Workflow

1. `tabs` → get activated tab IDs
2. `snapshot` → see page with element refs
3. Interact using refs: `click`, `type`, `fill`
4. `snapshot` → verify result
5. Repeat

## Example: Google Search

```
snapshot → [e1] textbox "Search"
fill e1 "claude ai"
press Enter
snapshot → [e2] link "Claude | Anthropic"
click e2
```
