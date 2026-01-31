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
npx tab-agent tabs              # List active tabs
npx tab-agent snapshot          # Page with refs [e1], [e2]...
npx tab-agent click <ref>       # Click element
npx tab-agent type <ref> <text> # Type text
npx tab-agent fill <ref> <val>  # Fill form field
npx tab-agent press <key>       # Enter/Escape/Tab/Arrow*
npx tab-agent scroll <dir> [n]  # Scroll up/down
npx tab-agent navigate <url>    # Go to URL
npx tab-agent wait <text|sel>   # Wait for condition
npx tab-agent screenshot        # Fallback only - if snapshot incomplete
```

## Workflow

1. Always `snapshot` first - get refs [e1], [e2]...
2. `click`/`type`/`fill` using refs
3. `snapshot` again to see results
4. **Only screenshot if snapshot missing content** (charts, canvas, debugging)

Prefer snapshot over screenshot - faster and text-based.
