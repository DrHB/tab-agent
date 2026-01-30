# Simplified Installation - Implementation Plan

> **For Claude:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One-command setup after loading extension, with auto-starting relay via skill instructions.

**Architecture:** npm package `tab-agent` with CLI for setup/start, auto-detection of extension ID, skill auto-starts relay.

**Tech Stack:** Node.js CLI, Chrome Native Messaging, WebSocket

---

## Summary of Changes

### Before (painful):
```
1. Clone repo
2. chrome://extensions → Load unpacked
3. Copy extension ID
4. cd relay && npm install
5. ./install-native-host.sh <paste-id>
6. npm start
7. Copy skill files manually
```

### After (simple):
```
1. chrome://extensions → Load unpacked → extension/
2. npx tab-agent setup
3. Done! Just click icon on tabs and ask Claude/Codex
```

---

## Task 1: Restructure for npm Package

**Files:**
- Create: `package.json` (root)
- Create: `bin/tab-agent.js`
- Modify: `relay/package.json` (merge into root)

**Step 1: Create root package.json**

```json
{
  "name": "tab-agent",
  "version": "0.2.0",
  "description": "Browser control for Claude Code and Codex via WebSocket",
  "bin": {
    "tab-agent": "./bin/tab-agent.js"
  },
  "main": "relay/server.js",
  "scripts": {
    "start": "node relay/server.js"
  },
  "files": [
    "bin/",
    "cli/",
    "relay/",
    "skills/",
    "extension/"
  ],
  "dependencies": {
    "ws": "^8.16.0"
  },
  "keywords": ["chrome", "extension", "browser", "automation", "claude", "codex"],
  "repository": "https://github.com/DrHB/tab-agent",
  "license": "MIT"
}
```

**Step 2: Create CLI entry point**

```javascript
// bin/tab-agent.js
#!/usr/bin/env node
const command = process.argv[2];

switch (command) {
  case 'setup':
    require('../cli/setup.js');
    break;
  case 'start':
    require('../cli/start.js');
    break;
  case 'status':
    require('../cli/status.js');
    break;
  default:
    console.log(`
tab-agent - Browser control for Claude/Codex

Commands:
  setup   Auto-detect extension, register native host, install skills
  start   Start the relay server
  status  Check configuration status

Usage:
  npx tab-agent setup
  npx tab-agent start
`);
}
```

**Step 3: Commit**
```bash
git add package.json bin/
git commit -m "feat: restructure for npm package"
```

---

## Task 2: Implement Extension Auto-Detection

**Files:**
- Create: `cli/detect-extension.js`

**Step 1: Create detection logic**

```javascript
// cli/detect-extension.js
const fs = require('fs');
const path = require('path');
const os = require('os');

function getChromeExtensionsPath() {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'darwin') {
    return path.join(home, 'Library/Application Support/Google/Chrome/Default/Extensions');
  } else if (platform === 'linux') {
    return path.join(home, '.config/google-chrome/Default/Extensions');
  } else if (platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Default/Extensions');
  }
  return null;
}

function findTabAgentExtension() {
  const extPath = getChromeExtensionsPath();
  if (!extPath || !fs.existsSync(extPath)) return null;

  const extIds = fs.readdirSync(extPath);

  for (const extId of extIds) {
    const extDir = path.join(extPath, extId);
    const versions = fs.readdirSync(extDir).filter(v => !v.startsWith('.'));

    for (const version of versions) {
      const manifestPath = path.join(extDir, version, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          if (manifest.name === 'Tab Agent') {
            return extId;
          }
        } catch (e) {}
      }
    }
  }
  return null;
}

function checkExistingManifest() {
  const platform = os.platform();
  const home = os.homedir();
  let manifestPath;

  if (platform === 'darwin') {
    manifestPath = path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'linux') {
    manifestPath = path.join(home, '.config/google-chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'win32') {
    manifestPath = path.join(home, '.config/chrome-native-messaging-hosts/com.tabagent.relay.json');
  }

  if (manifestPath && fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const origin = manifest.allowed_origins?.[0];
      if (origin) {
        const match = origin.match(/chrome-extension:\/\/([^/]+)/);
        if (match) return match[1];
      }
    } catch (e) {}
  }
  return null;
}

async function promptForExtensionId() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter extension ID from chrome://extensions: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

module.exports = {
  findTabAgentExtension,
  checkExistingManifest,
  promptForExtensionId,
  getChromeExtensionsPath
};
```

**Step 2: Commit**
```bash
git add cli/detect-extension.js
git commit -m "feat: add extension auto-detection"
```

---

## Task 3: Implement Setup Command

**Files:**
- Create: `cli/setup.js`

**Step 1: Create setup logic**

```javascript
// cli/setup.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { findTabAgentExtension, checkExistingManifest, promptForExtensionId } = require('./detect-extension');

async function setup() {
  console.log('Tab Agent Setup\n');

  // 1. Detect extension ID
  console.log('Detecting extension...');
  let extensionId = findTabAgentExtension();

  if (extensionId) {
    console.log(`✓ Found extension: ${extensionId}`);
  } else {
    extensionId = checkExistingManifest();
    if (extensionId) {
      console.log(`✓ Found existing config: ${extensionId}`);
    } else {
      console.log('✗ Could not auto-detect extension');
      console.log('  Make sure Tab Agent is loaded in chrome://extensions\n');
      extensionId = await promptForExtensionId();
    }
  }

  if (!extensionId || extensionId.length !== 32) {
    console.error('Invalid extension ID');
    process.exit(1);
  }

  // 2. Install native messaging host
  console.log('\nInstalling native messaging host...');
  installNativeHost(extensionId);
  console.log('✓ Native messaging host installed');

  // 3. Install skills
  console.log('\nInstalling skills...');
  installSkills();

  console.log('\n✓ Setup complete!\n');
  console.log('Usage:');
  console.log('  1. Click Tab Agent icon on any tab (turns green)');
  console.log('  2. Ask Claude/Codex: "Use tab-agent to search Google"');
  console.log('\nThe relay server starts automatically when needed.');
}

function installNativeHost(extensionId) {
  const platform = os.platform();
  const home = os.homedir();
  const packageDir = path.dirname(__dirname);

  let manifestDir;
  if (platform === 'darwin') {
    manifestDir = path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
  } else if (platform === 'linux') {
    manifestDir = path.join(home, '.config/google-chrome/NativeMessagingHosts');
  } else if (platform === 'win32') {
    manifestDir = path.join(home, '.config/chrome-native-messaging-hosts');
  }

  fs.mkdirSync(manifestDir, { recursive: true });

  const wrapperPath = path.join(packageDir, 'relay', 'native-host-wrapper.sh');
  const manifest = {
    name: 'com.tabagent.relay',
    description: 'Tab Agent Native Messaging Host',
    path: wrapperPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };

  const manifestPath = path.join(manifestDir, 'com.tabagent.relay.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Make wrapper executable
  fs.chmodSync(wrapperPath, '755');

  // Windows: also set registry key
  if (platform === 'win32') {
    const { execSync } = require('child_process');
    execSync(`reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.tabagent.relay" /ve /t REG_SZ /d "${manifestPath}" /f`);
  }
}

function installSkills() {
  const home = os.homedir();
  const packageDir = path.dirname(__dirname);
  const skillSource = path.join(packageDir, 'skills');

  // Claude Code
  const claudeSkillDir = path.join(home, '.claude', 'skills');
  if (fs.existsSync(path.join(home, '.claude')) || true) { // always create
    fs.mkdirSync(claudeSkillDir, { recursive: true });
    fs.copyFileSync(
      path.join(skillSource, 'claude-code', 'tab-agent.md'),
      path.join(claudeSkillDir, 'tab-agent.md')
    );
    console.log(`✓ Installed skill to ${claudeSkillDir}`);
  }

  // Codex
  const codexSkillDir = path.join(home, '.codex', 'skills');
  if (fs.existsSync(path.join(home, '.codex'))) {
    fs.mkdirSync(codexSkillDir, { recursive: true });
    fs.copyFileSync(
      path.join(skillSource, 'codex', 'tab-agent.md'),
      path.join(codexSkillDir, 'tab-agent.md')
    );
    console.log(`✓ Installed skill to ${codexSkillDir}`);
  }
}

setup().catch(console.error);
```

**Step 2: Commit**
```bash
git add cli/setup.js
git commit -m "feat: add setup command with auto-detection"
```

---

## Task 4: Implement Start and Status Commands

**Files:**
- Create: `cli/start.js`
- Create: `cli/status.js`

**Step 1: Create start command**

```javascript
// cli/start.js
const path = require('path');
const { spawn } = require('child_process');

const serverPath = path.join(__dirname, '..', 'relay', 'server.js');
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  detached: false
});

server.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});
```

**Step 2: Create status command**

```javascript
// cli/status.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function status() {
  console.log('Tab Agent Status\n');

  // Check native host
  const home = os.homedir();
  const platform = os.platform();
  let manifestPath;

  if (platform === 'darwin') {
    manifestPath = path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'linux') {
    manifestPath = path.join(home, '.config/google-chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'win32') {
    manifestPath = path.join(home, '.config/chrome-native-messaging-hosts/com.tabagent.relay.json');
  }

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('Native Host: ✓ Installed');
    console.log(`  Extension: ${manifest.allowed_origins[0]}`);
  } else {
    console.log('Native Host: ✗ Not installed (run: npx tab-agent setup)');
  }

  // Check skills
  const claudeSkill = path.join(home, '.claude', 'skills', 'tab-agent.md');
  const codexSkill = path.join(home, '.codex', 'skills', 'tab-agent.md');

  console.log(`Claude Skill: ${fs.existsSync(claudeSkill) ? '✓' : '✗'} ${claudeSkill}`);
  console.log(`Codex Skill:  ${fs.existsSync(codexSkill) ? '✓' : '✗'} ${codexSkill}`);

  // Check relay server
  console.log('\nRelay Server:');
  try {
    const response = await fetch('http://localhost:9876/health');
    const data = await response.json();
    console.log(`  Status: ✓ Running (${data.clients} clients)`);
  } catch (e) {
    console.log('  Status: ✗ Not running');
  }
}

status().catch(console.error);
```

**Step 3: Commit**
```bash
git add cli/start.js cli/status.js
git commit -m "feat: add start and status commands"
```

---

## Task 5: Implement New Browser Commands

**Files:**
- Modify: `extension/content-script.js`
- Modify: `extension/service-worker.js`

### New commands to add:

| Command | Parameters | Description |
|---------|------------|-------------|
| `evaluate` | `script` | Run JavaScript, return result |
| `wait` | `text`, `selector`, `timeout` | Wait for condition |
| `dialog` | `accept` | Handle alert/confirm/prompt |
| `scrollintoview` | `ref` | Scroll element into view |
| `screenshot` | `fullPage` | Full page screenshot |
| `fill` | `fields[]` | Batch fill multiple fields |
| `type` | `submit` | Type and press Enter |

**Step 1: Add to content-script.js**

```javascript
// Add these functions to content-script.js

async function executeEvaluate(params) {
  const { script } = params;
  try {
    const fn = new Function(script);
    const result = fn();
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function executeWait(params) {
  const { text, selector, timeout = 30000 } = params;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (text && document.body.innerText.includes(text)) {
      return { ok: true, found: 'text' };
    }
    if (selector && document.querySelector(selector)) {
      return { ok: true, found: 'selector' };
    }
    await new Promise(r => setTimeout(r, 100));
  }

  return { ok: false, error: 'Timeout waiting for condition' };
}

async function executeScrollIntoView(params) {
  const { ref } = params;
  const element = getElementByRef(ref);

  if (!element) {
    return { ok: false, error: `Element ${ref} not found` };
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 300));

  return { ok: true, ref };
}

async function executeBatchFill(params) {
  const { fields } = params;
  const results = [];

  for (const field of fields) {
    const result = await executeFill({ ref: field.ref, value: field.value });
    results.push({ ref: field.ref, ...result });
  }

  return { ok: results.every(r => r.ok), results };
}

// Update executeType to support submit
async function executeType(params) {
  const { ref, text, submit = false } = params;
  // ... existing type code ...

  if (submit) {
    const element = getElementByRef(ref);
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

    // Also try form submit
    const form = element.closest('form');
    if (form) form.submit();
  }

  return { ok: true, ref, typed: text, submitted: submit };
}
```

**Step 2: Add dialog handling to service-worker.js**

```javascript
// Dialog handling in service-worker.js
const pendingDialogs = new Map();

chrome.scripting.onDialogOpened?.addListener((dialog) => {
  pendingDialogs.set(dialog.tabId, dialog);
});

async function handleDialog(tabId, accept) {
  const dialog = pendingDialogs.get(tabId);
  if (!dialog) {
    return { ok: false, error: 'No dialog present' };
  }

  if (accept) {
    await chrome.scripting.acceptDialog(tabId);
  } else {
    await chrome.scripting.dismissDialog(tabId);
  }

  pendingDialogs.delete(tabId);
  return { ok: true, accepted: accept };
}
```

**Step 3: Add fullPage screenshot**

```javascript
// In service-worker.js screenshot handler
if (command.action === 'screenshot') {
  const { fullPage = false } = command;

  if (fullPage) {
    // Use chrome.debugger for full page
    await chrome.debugger.attach({ tabId }, '1.3');
    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Page.captureScreenshot',
      { captureBeyondViewport: true, fromSurface: true }
    );
    await chrome.debugger.detach({ tabId });
    return { ok: true, screenshot: 'data:image/png;base64,' + result.data };
  } else {
    // existing viewport screenshot
  }
}
```

**Step 4: Commit**
```bash
git add extension/content-script.js extension/service-worker.js
git commit -m "feat: add evaluate, wait, dialog, scrollintoview, fullPage screenshot"
```

---

## Task 6: Update Skill Files

**Files:**
- Modify: `skills/claude-code/tab-agent.md`
- Modify: `skills/codex/tab-agent.md`

**Step 1: Update Claude Code skill**

See Design Section 3 (Updated) for full content.

**Step 2: Update Codex skill**

Compact version of same commands.

**Step 3: Commit**
```bash
git add skills/
git commit -m "feat: update skills with new commands and auto-start"
```

---

## Task 7: Update README

**Files:**
- Modify: `README.md`

**Step 1: Simplify README**

```markdown
# Tab Agent

Secure tab-level browser control for Claude Code and Codex.

## Install

### 1. Load Extension
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/` folder

### 2. Setup
```bash
npx tab-agent setup
```

That's it! The setup auto-detects your extension and configures everything.

## Use

1. Click Tab Agent icon on any tab (turns green = active)
2. Ask Claude/Codex: "Use tab-agent to search Google for 'hello world'"

## Commands

| Command | Description |
|---------|-------------|
| snapshot | Get AI-readable page with refs |
| screenshot | Capture viewport (or fullPage) |
| click | Click element by ref |
| fill | Fill form field(s) |
| type | Type text (with optional submit) |
| press | Press key |
| scroll | Scroll page |
| scrollintoview | Scroll element into view |
| navigate | Go to URL |
| evaluate | Run JavaScript |
| wait | Wait for text/element |
| dialog | Handle alert/confirm |

## Manual Commands

```bash
npx tab-agent status  # Check configuration
npx tab-agent start   # Start relay manually
```

## Architecture

```
Claude/Codex → WebSocket:9876 → Relay → Native Messaging → Extension → DOM
```

## License

MIT
```

**Step 2: Commit**
```bash
git add README.md
git commit -m "docs: simplify README with new installation"
```

---

## Task 8: Test and Publish

**Step 1: Test locally**
```bash
npm link
tab-agent setup
tab-agent status
tab-agent start
```

**Step 2: Publish to npm**
```bash
npm login
npm publish
```

**Step 3: Test npx**
```bash
npm unlink tab-agent
npx tab-agent setup
```

---

## Summary

| Before | After |
|--------|-------|
| 7 manual steps | 2 steps |
| Copy extension ID | Auto-detected |
| Run install script | `npx tab-agent setup` |
| Manual relay start | Auto-starts via skill |
| Copy skill files | Auto-installed |

**New commands added:**
- `evaluate` - run JavaScript
- `wait` - wait for conditions
- `dialog` - handle alerts
- `scrollintoview` - scroll element visible
- `screenshot --fullPage` - full page capture
- `fill --fields` - batch fill
- `type --submit` - type and submit
