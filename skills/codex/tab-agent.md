---
name: tab-agent
description: Browser control via WebSocket
---

# Tab Agent

`ws://localhost:9876` - User activates tabs via extension (green = active)

## Start Relay

```bash
curl -s http://localhost:9876/health || (npx tab-agent start &)
```

## Commands

```
tabs                                  -> list active tabs
snapshot tabId                        -> page with refs [e1], [e2]...
screenshot tabId                      -> viewport screenshot (base64 PNG)
screenshot tabId fullPage=true        -> full page screenshot
click tabId ref                       -> click element
fill tabId ref value                  -> fill input
type tabId ref text                   -> type text
type tabId ref text submit=true       -> type and press Enter
press tabId key                       -> Enter/Escape/Tab/Arrow*
scroll tabId direction amount         -> scroll page
scrollintoview tabId ref              -> scroll element visible
navigate tabId url                    -> go to URL
wait tabId text="..."                 -> wait for text
wait tabId selector="..." timeout=ms  -> wait for element
evaluate tabId script="..."           -> run JavaScript
batchfill tabId fields=[...]          -> fill multiple fields
dialog tabId accept=true              -> handle alert/confirm
```

## Flow

`tabs` -> `snapshot` -> `click`/`fill` -> repeat. Use `screenshot` if snapshot incomplete.
