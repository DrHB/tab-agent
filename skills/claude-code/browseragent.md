---
name: browseragent
description: Browser control via CLI - snapshot, click, type, navigate
---

# BrowserAgent

Control browser tabs via CLI. User activates tabs via extension icon (green = active).

## Before First Command

```bash
curl -s http://localhost:9876/health || (npx browseragent start &)
sleep 2
```

## Commands

```bash
npx browseragent snapshot                # Get page with refs [e1], [e2]...
npx browseragent click <ref>             # Click element
npx browseragent type <ref> <text>       # Type text
npx browseragent fill <ref> <value>      # Fill form field
npx browseragent press <key>             # Press key (Enter, Escape, Tab)
npx browseragent scroll <dir> [amount]   # Scroll up/down
npx browseragent navigate <url>          # Go to URL
npx browseragent tabs                    # List active tabs
npx browseragent wait <text|selector>    # Wait for condition
npx browseragent screenshot              # Capture page (fallback only)
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
npx browseragent navigate "https://google.com"
npx browseragent snapshot
npx browseragent type e1 "hello world"
npx browseragent press Enter
npx browseragent snapshot  # See results
```

## Notes

- Refs reset on each snapshot - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
- Prefer snapshot over screenshot - faster and text-based
