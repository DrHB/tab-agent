---
name: tab-agent
description: Browser control via CLI
---

# Tab Agent

CLI browser control. User activates tabs via extension (green = active).

## Start Relay

```bash
curl -s http://localhost:9876/health || (npx tab-agent start &)
```

## Commands

```bash
tabs                         # List active tabs
snapshot                     # Page with refs [e1], [e2]...
screenshot [--full]          # Capture viewport/full page
click <ref>                  # Click element
type <ref> <text>            # Type text
fill <ref> <value>           # Fill form field
press <key>                  # Enter/Escape/Tab/Arrow*
scroll <dir> [amount]        # Scroll up/down
navigate <url>               # Go to URL
wait <text|selector>         # Wait for condition
evaluate <script>            # Run JavaScript
```

## Flow

`snapshot` -> `click`/`type` -> repeat. Use `screenshot` if snapshot incomplete.
