# Bug 001: Native Host Exits Immediately

**Status:** Resolved
**Severity:** Critical (blocks all functionality)
**Component:** Native Messaging Bridge
**Date:** 2026-01-30

## Summary

The Chrome extension's native messaging host (`native-host.js`) exits immediately after being spawned by Chrome, preventing communication between the relay server and the extension. The popup shows "Native host has exited."

## Symptoms

1. Extension loads successfully and shows in `chrome://extensions`
2. Popup UI works (can activate/deactivate tabs)
3. Service worker runs correctly
4. Relay server starts and accepts WebSocket connections
5. **But:** Native messaging bridge fails - "Native host has exited"

## Architecture

```
Claude Code/Codex
       │
       ▼ WebSocket (ws://localhost:9876)
┌──────────────────┐
│   Relay Server   │  ◄── Running correctly
│   (server.js)    │
└────────┬─────────┘
         │ WebSocket (x-client-type: extension)
         ▼
┌──────────────────┐
│  Native Host     │  ◄── FAILS HERE - exits immediately
│ (native-host.js) │
└────────┬─────────┘
         │ Chrome Native Messaging (stdio)
         ▼
┌──────────────────┐
│ Service Worker   │  ◄── Running correctly
│ (Chrome ext)     │
└──────────────────┘
```

## What Works

1. **Relay server:** Starts correctly, health endpoint responds
   ```bash
   curl http://localhost:9876/health
   # {"ok":true,"clients":0}
   ```

2. **Native host manually:** Works when run directly from terminal
   ```bash
   cd relay && ./native-host.js
   # Connects to WebSocket, logs show success
   ```

3. **Extension:** Service worker loads, popup UI functions, tabs can be activated

4. **Native messaging manifest:** Correctly installed at:
   ```
   ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tabagent.relay.json
   ```

## What Fails

When Chrome spawns the native host via `chrome.runtime.connectNative('com.tabagent.relay')`:

1. Native host starts
2. **Immediately exits** before establishing stable connection
3. Service worker receives `onDisconnect` event
4. `chrome.runtime.lastError` shows "Native host has exited"

## Debugging Performed

### 1. Added logging to native-host.js
```javascript
const logFile = path.join(__dirname, 'native-host.log');
function log(msg) {
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
}
```
**Result:** Log file is never created when Chrome spawns the host, suggesting it crashes before any code runs.

### 2. Created wrapper script
```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
exec node native-host.js
```
**Result:** Still fails with same error.

### 3. Verified native messaging manifest
```json
{
  "name": "com.tabagent.relay",
  "description": "Tab Agent Native Messaging Host",
  "path": "/Users/drhb/Documents/tmp/tab-agent/relay/native-host-wrapper.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://hklhjclpadbfbkiefljbeheeobhoknlg/"
  ]
}
```
**Result:** Correct format, correct extension ID.

### 4. Tested native host standalone
```bash
cd relay && node native-host.js
```
**Result:** Works perfectly - connects to WebSocket, logs success.

## Hypotheses

### H1: Node.js not in PATH when Chrome spawns process
Chrome may spawn the native host with a restricted environment where `node` is not in PATH.

**Test:** Use absolute path to node in wrapper script:
```bash
#!/bin/bash
exec /usr/local/bin/node /path/to/native-host.js
```

### H2: Working directory issue
When Chrome spawns the native host, the working directory may not be the relay folder, causing `require('ws')` to fail finding `node_modules`.

**Test:** Already tried with wrapper script that `cd`s to correct directory - still failed.

### H3: Module resolution failure
The `ws` module may fail to load due to how Chrome spawns the process.

**Test:** Bundle dependencies or use a compiled binary.

### H4: Chrome sandbox restrictions
Chrome's sandbox may prevent the native host from executing properly.

**Test:** Check Chrome's native messaging logs or try on different system.

### H5: Shebang/line ending issues
The native-host.js shebang or wrapper script may have wrong line endings (CRLF vs LF).

**Test:**
```bash
file native-host.js
file native-host-wrapper.sh
```

### H6: Chrome needs full restart
Native messaging host changes may require complete Chrome quit/restart, not just extension reload.

**Test:** Fully quit Chrome (Cmd+Q on macOS), reopen, test again.

## Recommended Next Steps

1. **Check Chrome's native messaging debug output:**
   - Launch Chrome from terminal: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --enable-logging --v=1`
   - Check stderr for native messaging errors

2. **Test with absolute node path:**
   ```bash
   #!/bin/bash
   exec /opt/homebrew/bin/node /Users/drhb/Documents/tmp/tab-agent/relay/native-host.js
   ```
   (Adjust path based on `which node` output)

3. **Test wrapper script standalone:**
   ```bash
   /Users/drhb/Documents/tmp/tab-agent/relay/native-host-wrapper.sh
   ```

4. **Check file permissions:**
   ```bash
   ls -la relay/native-host*.js relay/native-host*.sh
   ```

5. **Try simpler native host first:**
   Create minimal test that just echoes:
   ```javascript
   #!/usr/bin/env node
   const fs = require('fs');
   fs.writeFileSync('/tmp/native-host-test.log', 'started\n');
   // Keep alive
   setInterval(() => {}, 1000);
   ```

6. **Bundle with pkg or esbuild:**
   Compile native-host.js into standalone binary to avoid module resolution issues.

## Environment

- **OS:** macOS Darwin 25.2.0
- **Chrome:** (check chrome://version)
- **Node.js:** v24.3.0 at /opt/homebrew/bin/node
- **Extension ID:** hklhjclpadbfbkiefljbeheeobhoknlg

## Resolution

**Fixed on:** 2026-01-30

**Root Cause:** Multiple issues with the native host setup:
1. Node.js not in PATH when Chrome spawns the native host
2. Working directory not set correctly for module resolution
3. Native host exited on WebSocket disconnect instead of reconnecting

**Solution:** Updated `native-host-wrapper.sh` and `native-host.js`:

1. **Wrapper script improvements:**
   - Searches multiple node paths (`/opt/homebrew/bin/node`, `/usr/local/bin/node`, etc.)
   - Sets `NODE_PATH` environment variable for module resolution
   - Logs startup for debugging

2. **Native host improvements:**
   - Added reconnection logic instead of exiting on WebSocket close
   - Better error handling with rate-limited error messages
   - Configurable logging via `TAB_AGENT_LOG` environment variable

**Verification:**
```bash
# Health check shows 2 clients (extension + test client)
curl http://localhost:9876/health
# {"ok":true,"clients":2}

# Tabs command returns activated tabs
# Snapshot command returns AI-readable page content
```

## Related Files

| File | Purpose |
|------|---------|
| `relay/native-host.js` | Native messaging host script |
| `relay/native-host-wrapper.sh` | Shell wrapper for native host |
| `relay/server.js` | WebSocket relay server |
| `relay/install-native-host.sh` | Manifest installation script |
| `extension/service-worker.js` | Extension background script |
| `extension/popup/popup.js` | Popup UI logic |

## References

- [Chrome Native Messaging Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [mcp-chrome (similar architecture)](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-chrome)
