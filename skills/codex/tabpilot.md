---
name: tabpilot
description: Browser control via CLI
---

# TabPilot

CLI browser control. User activates tabs via extension (green = active).

## Start Relay

```bash
curl -s http://localhost:9876/health || (npx tabpilot start &)
```

## Commands

```bash
npx tabpilot snapshot          # Page with refs [e1], [e2]...
npx tabpilot click <ref>       # Click element
npx tabpilot type <ref> <text> # Type text
npx tabpilot fill <ref> <val>  # Fill form field
npx tabpilot press <key>       # Enter/Escape/Tab/Arrow*
npx tabpilot scroll <dir> [n]  # Scroll up/down
npx tabpilot navigate <url>    # Go to URL
npx tabpilot tabs              # List active tabs
npx tabpilot wait <text|sel>   # Wait for condition
npx tabpilot screenshot        # Fallback only - if snapshot incomplete
```

## Workflow

1. Always `snapshot` first - get refs [e1], [e2]...
2. `click`/`type`/`fill` using refs
3. `snapshot` again to see results
4. **Only screenshot if snapshot missing content** (charts, canvas, debugging)

Prefer snapshot over screenshot - faster and text-based.
