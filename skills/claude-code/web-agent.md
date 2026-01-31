---
name: web-agent
description: Browser control via CLI - snapshot, click, type, navigate
---

# Web Agent

Control browser tabs via CLI. User activates tabs via extension icon (green = active).

## Before First Command

```bash
curl -s http://localhost:9876/health || (npx ai-web-agent start &)
sleep 2
```

## Commands

```bash
npx ai-web-agent snapshot                # Get page with refs [e1], [e2]...
npx ai-web-agent click <ref>             # Click element
npx ai-web-agent type <ref> <text>       # Type text
npx ai-web-agent fill <ref> <value>      # Fill form field
npx ai-web-agent press <key>             # Press key (Enter, Escape, Tab)
npx ai-web-agent scroll <dir> [amount]   # Scroll up/down
npx ai-web-agent navigate <url>          # Go to URL
npx ai-web-agent tabs                    # List active tabs
npx ai-web-agent wait <text|selector>    # Wait for condition
npx ai-web-agent screenshot              # Capture page (fallback only)
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
npx ai-web-agent navigate "https://google.com"
npx ai-web-agent snapshot
npx ai-web-agent type e1 "hello world"
npx ai-web-agent press Enter
npx ai-web-agent snapshot  # See results
```

## Notes

- Refs reset on each snapshot - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
- Prefer snapshot over screenshot - faster and text-based
