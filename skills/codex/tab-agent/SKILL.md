---
name: tab-agent
description: Browser control via CLI - snapshot, click, type, navigate, find, get, drag, pdf
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
npx tab-agent snapshot                # Get page with refs [e1], [e2]...
npx tab-agent click <ref>             # Click element
npx tab-agent type <ref> <text>       # Type text
npx tab-agent fill <ref> <value>      # Fill form field
npx tab-agent press <key>             # Press key (Enter, Escape, Tab)
npx tab-agent scroll <dir> [amount]   # Scroll up/down
npx tab-agent navigate <url>          # Go to URL
npx tab-agent tabs                    # List active tabs
npx tab-agent wait <text|selector>    # Wait for condition
npx tab-agent wait --url <pattern>    # Wait for URL match
npx tab-agent wait --visible <ref>    # Wait for element visible
npx tab-agent screenshot              # Capture page (fallback only)
npx tab-agent evaluate <script>       # Run JavaScript
npx tab-agent hover <ref>             # Hover over element
npx tab-agent select <ref> <value>    # Select dropdown option
npx tab-agent drag <from> <to>        # Drag and drop
npx tab-agent get text <ref>          # Get element text
npx tab-agent get value <ref>         # Get input value
npx tab-agent get attr <ref> <name>   # Get attribute
npx tab-agent get url                 # Get current URL
npx tab-agent get title               # Get page title
npx tab-agent find text "Submit"      # Find by text content
npx tab-agent find role button        # Find by ARIA role
npx tab-agent find label "Email"      # Find by label
npx tab-agent find placeholder "Search" # Find by placeholder
npx tab-agent cookies get             # View cookies
npx tab-agent cookies clear           # Clear cookies
npx tab-agent storage get [key]       # Read localStorage
npx tab-agent storage set <key> <val> # Write localStorage
npx tab-agent pdf [file.pdf]          # Save page as PDF
```

## Workflow

1. `snapshot` first - always start here to get element refs
2. Use refs [e1], [e2]... with `click`/`type`/`fill`
3. `snapshot` again after actions to see results
4. Use `find` to locate elements without a full snapshot
5. Use `get` to extract specific data from elements
6. **Only use `screenshot` if:**
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

# Find and click a button by text
npx tab-agent find text "Sign In"
npx tab-agent click e1

# Extract data
npx tab-agent get text e5
npx tab-agent get attr e3 href

# Save page as PDF
npx tab-agent pdf report.pdf
```

## Notes

- Refs reset on each snapshot - always snapshot before interacting
- `find` assigns new refs without resetting existing ones
- Keys: Enter, Escape, Tab, Backspace, ArrowUp/Down/Left/Right
- Prefer snapshot over screenshot - faster and text-based
- Use `--browser=safari` or `--browser=chrome` to target specific browser
