---
name: web-agent
description: Browser control via CLI - snapshot, click, type, navigate
---

# Web Agent

Control browser tabs via CLI. User activates tabs via extension icon (green = active).

## Before First Command

```bash
curl -s http://localhost:9876/health || (npx web-agent start &)
sleep 2
```

## Commands

```bash
npx web-agent snapshot                # Get page with refs [e1], [e2]...
npx web-agent click <ref>             # Click element
npx web-agent type <ref> <text>       # Type text
npx web-agent fill <ref> <value>      # Fill form field
npx web-agent press <key>             # Press key (Enter, Escape, Tab)
npx web-agent scroll <dir> [amount]   # Scroll up/down
npx web-agent navigate <url>          # Go to URL
npx web-agent tabs                    # List active tabs
npx web-agent wait <text|selector>    # Wait for condition
npx web-agent screenshot              # Capture page (fallback only)
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
npx web-agent navigate "https://google.com"
npx web-agent snapshot
npx web-agent type e1 "hello world"
npx web-agent press Enter
npx web-agent snapshot  # See results
```

## Notes

- Refs reset on each snapshot - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
- Prefer snapshot over screenshot - faster and text-based
