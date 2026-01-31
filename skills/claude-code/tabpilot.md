---
name: tabpilot
description: Browser control via CLI - snapshot, click, type, navigate
---

# TabPilot

Control browser tabs via CLI. User activates tabs via extension icon (green = active).

## Before First Command

```bash
curl -s http://localhost:9876/health || (npx tabpilot start &)
sleep 2
```

## Commands

```bash
npx tabpilot snapshot                # Get page with refs [e1], [e2]...
npx tabpilot click <ref>             # Click element
npx tabpilot type <ref> <text>       # Type text
npx tabpilot fill <ref> <value>      # Fill form field
npx tabpilot press <key>             # Press key (Enter, Escape, Tab)
npx tabpilot scroll <dir> [amount]   # Scroll up/down
npx tabpilot navigate <url>          # Go to URL
npx tabpilot tabs                    # List active tabs
npx tabpilot wait <text|selector>    # Wait for condition
npx tabpilot screenshot              # Capture page (fallback only)
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
npx tabpilot navigate "https://google.com"
npx tabpilot snapshot
npx tabpilot type e1 "hello world"
npx tabpilot press Enter
npx tabpilot snapshot  # See results
```

## Notes

- Refs reset on each snapshot - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
- Prefer snapshot over screenshot - faster and text-based
