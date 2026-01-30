# Tab Agent Manual Test

## Setup

- [ ] Load extension at chrome://extensions
- [ ] Note extension ID: _____________
- [ ] Run: `cd relay && npm install`
- [ ] Run: `./install-native-host.sh <extension-id>`
- [ ] Run: `npm start`

## Extension Tests

- [ ] Click extension icon → popup appears
- [ ] Click "Activate" on test page
- [ ] Tab appears in activated list
- [ ] Click deactivate → tab removed

## WebSocket Tests

```bash
npm install -g wscat
wscat -c ws://localhost:9876
```

- [ ] `{"id":1,"action":"tabs"}` → lists tabs
- [ ] `{"id":2,"action":"snapshot","tabId":<id>}` → returns snapshot with refs
- [ ] `{"id":3,"action":"click","tabId":<id>,"ref":"e1"}` → clicks element
- [ ] `{"id":4,"action":"screenshot","tabId":<id>}` → returns base64 image

## End-to-End

- [ ] Copy skill to ~/.claude/skills/
- [ ] Ask Claude: "Use tab-agent to get Hacker News top stories"
- [ ] Verify Claude connects and extracts data
