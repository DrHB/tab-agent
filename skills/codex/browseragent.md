---
name: browseragent
description: Browser control via CLI
---

# BrowserAgent

CLI browser control. User activates tabs via extension (green = active).

## Start Relay

```bash
curl -s http://localhost:9876/health || (npx browseragent start &)
```

## Commands

```bash
npx browseragent snapshot          # Page with refs [e1], [e2]...
npx browseragent click <ref>       # Click element
npx browseragent type <ref> <text> # Type text
npx browseragent fill <ref> <val>  # Fill form field
npx browseragent press <key>       # Enter/Escape/Tab/Arrow*
npx browseragent scroll <dir> [n]  # Scroll up/down
npx browseragent navigate <url>    # Go to URL
npx browseragent tabs              # List active tabs
npx browseragent wait <text|sel>   # Wait for condition
npx browseragent screenshot        # Fallback only - if snapshot incomplete
```

## Workflow

1. Always `snapshot` first - get refs [e1], [e2]...
2. `click`/`type`/`fill` using refs
3. `snapshot` again to see results
4. **Only screenshot if snapshot missing content** (charts, canvas, debugging)

Prefer snapshot over screenshot - faster and text-based.
