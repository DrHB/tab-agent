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
npx tab-agent screenshot              # Capture viewport
npx tab-agent screenshot --full       # Capture full page
npx tab-agent click <ref>             # Click element
npx tab-agent type <ref> <text>       # Type text
npx tab-agent fill <ref> <value>      # Fill form field
npx tab-agent press <key>             # Press key (Enter, Escape, Tab)
npx tab-agent scroll <dir> [amount]   # Scroll up/down
npx tab-agent navigate <url>          # Go to URL
npx tab-agent wait <text|selector>    # Wait for condition
npx tab-agent evaluate <script>       # Run JavaScript
```

## Usage

1. `tabs` -> find active tab
2. `snapshot` -> read page, get element refs [e1], [e2]...
3. `click`/`type`/`fill` using refs
4. If snapshot incomplete -> `screenshot` and analyze visually

## Examples

```bash
# Search Google
npx tab-agent navigate "https://google.com"
npx tab-agent snapshot
npx tab-agent type e1 "hello world"
npx tab-agent press Enter

# Read page content
npx tab-agent snapshot
npx tab-agent screenshot --full
```

## Notes

- Screenshot saves to /tmp/ and opens automatically
- Refs reset on each snapshot - always snapshot before interacting
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
