---
name: tab-agent
description: Browser control via CLI - snapshot, click, type, fill, screenshot
---

# Tab Agent

Control browser tabs via CLI. User activates tabs via extension icon (green = active).

## Before First Command

```bash
curl -s http://localhost:9876/health || (npx tab-agent start &)
sleep 2
```

## Commands

```bash
npx tab-agent tabs                    # List active tabs
npx tab-agent snapshot                # Get page with refs [e1], [e2]...
npx tab-agent click <ref>             # Click element
npx tab-agent type <ref> <text>       # Type text
npx tab-agent fill <ref> <value>      # Fill form field
npx tab-agent press <key>             # Press key (Enter, Escape, Tab)
npx tab-agent scroll <dir> [amount]   # Scroll up/down
npx tab-agent navigate <url>          # Go to URL
npx tab-agent wait <text|selector>    # Wait for condition
npx tab-agent screenshot              # Capture viewport (fallback only)
npx tab-agent screenshot --full       # Capture full page (fallback only)
```

## Workflow

1. `snapshot` first - always start here to get element refs
2. Use refs [e1], [e2]... with `click`/`type`/`fill`
3. `snapshot` again after actions to see results
4. **Only use `screenshot` if:**
   - Snapshot is missing expected content
   - Page has complex visuals (charts, images, canvas)
   - Debugging why an action didn't work

## Examples

```bash
# Search Google
npx tab-agent navigate "https://google.com"
npx tab-agent snapshot
npx tab-agent type e1 "hello world"
npx tab-agent press Enter
npx tab-agent snapshot  # See results

# Only screenshot if snapshot doesn't show what you need
npx tab-agent screenshot --full
```

## Notes

- Refs reset on each snapshot - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
- Screenshot outputs base64 to stdout (no file saved)
- Prefer snapshot over screenshot - it's faster and text-based
