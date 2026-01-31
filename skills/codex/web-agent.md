---
name: web-agent
description: Browser control via CLI
---

# Web Agent

CLI browser control. User activates tabs via extension (green = active).

## Start Relay

```bash
curl -s http://localhost:9876/health || (npx ai-web-agent start &)
```

## Commands

```bash
npx ai-web-agent snapshot          # Page with refs [e1], [e2]...
npx ai-web-agent click <ref>       # Click element
npx ai-web-agent type <ref> <text> # Type text
npx ai-web-agent fill <ref> <val>  # Fill form field
npx ai-web-agent press <key>       # Enter/Escape/Tab/Arrow*
npx ai-web-agent scroll <dir> [n]  # Scroll up/down
npx ai-web-agent navigate <url>    # Go to URL
npx ai-web-agent tabs              # List active tabs
npx ai-web-agent wait <text|sel>   # Wait for condition
npx ai-web-agent screenshot        # Fallback only - if snapshot incomplete
```

## Workflow

1. Always `snapshot` first - get refs [e1], [e2]...
2. `click`/`type`/`fill` using refs
3. `snapshot` again to see results
4. **Only screenshot if snapshot missing content** (charts, canvas, debugging)

Prefer snapshot over screenshot - faster and text-based.
