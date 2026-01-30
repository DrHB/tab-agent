---
name: tab-agent
description: Control browser tabs via WebSocket
---

# Tab Agent

WebSocket: `ws://localhost:9876`

## Commands

| Action | Params | Description |
|--------|--------|-------------|
| snapshot | tabId | Get page with refs [e1], [e2]... |
| click | tabId, ref | Click element |
| type | tabId, ref, text | Type into element |
| fill | tabId, ref, value | Clear and fill field |
| press | tabId, key | Press key (Enter, Escape, Tab...) |
| select | tabId, ref, value | Select dropdown option |
| hover | tabId, ref | Hover element |
| scroll | tabId, direction, amount | Scroll page |
| navigate | tabId, url | Go to URL |
| screenshot | tabId | Capture image |
| tabs | - | List activated tabs |
| activate | tabId | Enable control |

## Workflow

1. `tabs` → get tab IDs
2. `snapshot` → see page
3. `click`/`type`/`fill` using refs
4. `snapshot` → verify
5. Repeat
