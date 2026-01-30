# Tab-Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone Chrome extension that exposes browser control via WebSocket, enabling Claude Code / Codex to fully control activated browser tabs.

**Architecture:** Chrome extension with Manifest V3. Service worker runs WebSocket server on `ws://localhost:9876`. Content scripts inject into activated tabs to build accessibility snapshots and execute DOM actions. CLI skills connect to WebSocket to send commands and receive results.

**Tech Stack:** Chrome Extension (Manifest V3), JavaScript (no build step initially), WebSocket API, Chrome APIs (tabs, scripting, storage)

---

## Project Structure

```
tab-agent/
├── extension/
│   ├── manifest.json
│   ├── service-worker.js
│   ├── content-script.js
│   ├── snapshot.js
│   ├── actions.js
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── skills/
│   ├── claude-code/
│   │   └── tab-agent.md
│   └── codex/
│       └── tab-agent.md
├── docs/
│   ├── plans/
│   └── reference/
└── README.md
```

---

## Task 1: Project Setup & Manifest

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/icons/` (placeholder icons)
- Create: `README.md`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Tab Agent",
  "version": "0.1.0",
  "description": "Browser control for Claude Code and Codex via WebSocket",

  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },

  "content_scripts": [],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Step 2: Create placeholder icons**

Create simple colored squares as placeholder icons (16x16, 48x48, 128x128 PNG files). Can use any image editor or generate programmatically.

**Step 3: Create README.md**

```markdown
# Tab Agent

Browser control for Claude Code and Codex via WebSocket.

## Installation

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `extension/` folder

## Usage

1. Click the Tab Agent icon on any tab you want to control
2. Click "Activate" to enable control on that tab
3. Use the Claude Code or Codex skill to send commands

## Skill Installation

### Claude Code
```bash
cp skills/claude-code/tab-agent.md ~/.claude/skills/
```

### Codex
```bash
cp skills/codex/tab-agent.md ~/.codex/skills/
```
```

**Step 4: Commit**

```bash
git add extension/manifest.json extension/icons/ README.md
git commit -m "feat: initial project setup with manifest"
```

---

## Task 2: Service Worker - WebSocket Server Foundation

**Files:**
- Create: `extension/service-worker.js`

**Step 1: Create basic service worker with WebSocket server**

Note: Chrome extensions cannot run a true WebSocket server. We need to use a different approach - the extension will act as a WebSocket CLIENT that connects to a tiny local relay server, OR we use Chrome's native messaging.

**Revised approach:** Use a simple HTTP polling mechanism OR bundle a tiny native messaging host.

**Simpler approach for MVP:** The extension listens for messages via `chrome.runtime.onMessageExternal` and we create a tiny Node.js bridge that the skill talks to.

Let's go with a **hybrid approach**:
1. Extension exposes commands via `chrome.runtime.onMessageExternal`
2. A tiny Node.js relay server bridges WebSocket ↔ Chrome extension messaging

**Step 1: Create service-worker.js with state management**

```javascript
// service-worker.js
// Tab Agent - Service Worker
// Manages activated tabs and routes commands to content scripts

const state = {
  activatedTabs: new Map(), // tabId -> { url, title, activatedAt }
  auditLog: [],
};

// Log all actions for audit trail
function audit(action, data, result) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    data,
    result,
  };
  state.auditLog.push(entry);
  // Keep last 1000 entries
  if (state.auditLog.length > 1000) {
    state.auditLog.shift();
  }
  // Persist to storage
  chrome.storage.local.set({ auditLog: state.auditLog });
}

// Check if tab is activated
function isTabActivated(tabId) {
  return state.activatedTabs.has(tabId);
}

// Activate a tab for control
async function activateTab(tabId) {
  const tab = await chrome.tabs.get(tabId);

  // Inject content script
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-script.js']
  });

  state.activatedTabs.set(tabId, {
    url: tab.url,
    title: tab.title,
    activatedAt: new Date().toISOString(),
  });

  audit('activate', { tabId, url: tab.url }, { ok: true });
  return { ok: true, tabId, url: tab.url, title: tab.title };
}

// Deactivate a tab
function deactivateTab(tabId) {
  state.activatedTabs.delete(tabId);
  audit('deactivate', { tabId }, { ok: true });
  return { ok: true };
}

// List all activated tabs
function listActivatedTabs() {
  const tabs = [];
  for (const [tabId, info] of state.activatedTabs) {
    tabs.push({ tabId, ...info });
  }
  return { ok: true, tabs };
}

// Route command to content script
async function routeCommand(tabId, command) {
  if (!isTabActivated(tabId)) {
    return { ok: false, error: 'Tab not activated' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, command);
    audit(command.action, { tabId, ...command }, response);
    return response;
  } catch (error) {
    const result = { ok: false, error: error.message };
    audit(command.action, { tabId, ...command }, result);
    return result;
  }
}

// Handle commands from external sources (relay server)
chrome.runtime.onMessageExternal.addListener(
  async (message, sender, sendResponse) => {
    const { action, tabId, ...params } = message;

    let result;

    switch (action) {
      case 'ping':
        result = { ok: true, message: 'pong', version: '0.1.0' };
        break;

      case 'activate':
        result = await activateTab(tabId);
        break;

      case 'deactivate':
        result = deactivateTab(tabId);
        break;

      case 'tabs':
        result = listActivatedTabs();
        break;

      case 'audit':
        result = { ok: true, log: state.auditLog.slice(-100) };
        break;

      // Commands routed to content script
      case 'snapshot':
      case 'screenshot':
      case 'click':
      case 'type':
      case 'fill':
      case 'press':
      case 'select':
      case 'hover':
      case 'scroll':
      case 'navigate':
        result = await routeCommand(tabId, { action, ...params });
        break;

      default:
        result = { ok: false, error: `Unknown action: ${action}` };
    }

    sendResponse(result);
    return true; // Keep channel open for async response
  }
);

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (state.activatedTabs.has(tabId)) {
    state.activatedTabs.delete(tabId);
    audit('tab_closed', { tabId }, { ok: true });
  }
});

// Clean up when tabs navigate away
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && state.activatedTabs.has(tabId)) {
    // Update stored URL
    const info = state.activatedTabs.get(tabId);
    info.url = changeInfo.url;
    info.title = tab.title;
  }
});

console.log('Tab Agent service worker started');
```

**Step 2: Commit**

```bash
git add extension/service-worker.js
git commit -m "feat: service worker with state management and command routing"
```

---

## Task 3: Content Script - Snapshot Builder

**Files:**
- Create: `extension/snapshot.js`
- Create: `extension/content-script.js`

**Step 1: Create snapshot.js - Accessibility tree to AI-readable format**

```javascript
// snapshot.js
// Builds AI-readable snapshots from the DOM accessibility tree

(function() {
  // Element reference counter
  let refCounter = 0;
  const refMap = new Map(); // ref -> element

  // Reset refs for new snapshot
  function resetRefs() {
    refCounter = 0;
    refMap.clear();
  }

  // Get next ref
  function nextRef() {
    return `e${++refCounter}`;
  }

  // Store element with ref
  function storeRef(ref, element) {
    refMap.set(ref, element);
  }

  // Get element by ref
  window.__tabAgent_getElementByRef = function(ref) {
    return refMap.get(ref);
  };

  // Determine element role
  function getRole(element) {
    // Explicit ARIA role
    if (element.getAttribute('role')) {
      return element.getAttribute('role');
    }

    // Implicit roles based on tag
    const tag = element.tagName.toLowerCase();
    const type = element.getAttribute('type');

    const roleMap = {
      'a': 'link',
      'button': 'button',
      'input': type === 'submit' ? 'button' :
               type === 'checkbox' ? 'checkbox' :
               type === 'radio' ? 'radio' :
               type === 'text' || type === 'email' || type === 'password' || type === 'search' ? 'textbox' :
               'input',
      'textarea': 'textbox',
      'select': 'combobox',
      'img': 'img',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'nav': 'navigation',
      'main': 'main',
      'footer': 'contentinfo',
      'header': 'banner',
      'form': 'form',
      'table': 'table',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem',
    };

    return roleMap[tag] || 'generic';
  }

  // Get accessible name
  function getName(element) {
    // aria-label
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    // aria-labelledby
    if (element.getAttribute('aria-labelledby')) {
      const labelId = element.getAttribute('aria-labelledby');
      const labelEl = document.getElementById(labelId);
      if (labelEl) return labelEl.textContent.trim();
    }

    // Input labels
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent.trim();
      }
      // Placeholder
      if (element.placeholder) return element.placeholder;
    }

    // Image alt
    if (element.tagName === 'IMG') {
      return element.alt || '';
    }

    // Button/link text content
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      return element.textContent.trim().substring(0, 100);
    }

    // Headings
    if (/^H[1-6]$/.test(element.tagName)) {
      return element.textContent.trim().substring(0, 100);
    }

    // Title attribute
    if (element.title) {
      return element.title;
    }

    return '';
  }

  // Check if element is interactive
  function isInteractive(element) {
    const tag = element.tagName.toLowerCase();
    const interactiveTags = ['a', 'button', 'input', 'textarea', 'select', 'details', 'summary'];

    if (interactiveTags.includes(tag)) return true;
    if (element.getAttribute('onclick')) return true;
    if (element.getAttribute('role') === 'button') return true;
    if (element.getAttribute('tabindex') !== null) return true;
    if (element.contentEditable === 'true') return true;

    return false;
  }

  // Check if element is visible
  function isVisible(element) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    return true;
  }

  // Build snapshot recursively
  function buildSnapshot(element, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return [];
    if (!isVisible(element)) return [];

    const lines = [];
    const role = getRole(element);
    const name = getName(element);
    const interactive = isInteractive(element);

    // Only include meaningful elements
    const includedRoles = [
      'link', 'button', 'textbox', 'checkbox', 'radio', 'combobox',
      'heading', 'img', 'navigation', 'main', 'form', 'listitem',
      'tab', 'tabpanel', 'menu', 'menuitem', 'dialog', 'alert'
    ];

    const shouldInclude = includedRoles.includes(role) || interactive;

    if (shouldInclude && (name || interactive)) {
      const ref = nextRef();
      storeRef(ref, element);

      let line = `[${ref}] ${role}`;
      if (name) {
        line += ` "${name.substring(0, 80)}"`;
      }

      // Add extra info for form elements
      if (element.tagName === 'INPUT') {
        const type = element.type;
        if (type === 'checkbox' || type === 'radio') {
          line += element.checked ? ' (checked)' : ' (unchecked)';
        }
        if (element.value && type !== 'password') {
          line += ` value="${element.value.substring(0, 30)}"`;
        }
      }

      if (element.tagName === 'SELECT') {
        const selected = element.options[element.selectedIndex];
        if (selected) {
          line += ` selected="${selected.text}"`;
        }
      }

      lines.push(line);
    }

    // Recurse into children
    for (const child of element.children) {
      lines.push(...buildSnapshot(child, depth + 1, maxDepth));
    }

    return lines;
  }

  // Main snapshot function
  window.__tabAgent_snapshot = function() {
    resetRefs();

    const lines = ['== Page Snapshot ==', `URL: ${window.location.href}`, `Title: ${document.title}`, ''];
    lines.push(...buildSnapshot(document.body));

    return {
      url: window.location.href,
      title: document.title,
      snapshot: lines.join('\n'),
      refCount: refCounter,
    };
  };
})();
```

**Step 2: Create content-script.js - Command handler**

```javascript
// content-script.js
// Handles commands from service worker and executes DOM actions

// Inject snapshot builder
const script = document.createElement('script');
script.src = chrome.runtime.getURL('snapshot.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Wait for snapshot.js to load
function waitForSnapshotReady() {
  return new Promise((resolve) => {
    const check = () => {
      if (typeof window.__tabAgent_snapshot === 'function') {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

// Get element by ref
function getElementByRef(ref) {
  return window.__tabAgent_getElementByRef(ref);
}

// Execute click action
async function executeClick(params) {
  const { ref, doubleClick = false } = params;
  const element = getElementByRef(ref);

  if (!element) {
    return { ok: false, error: `Element ${ref} not found` };
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 100));

  if (doubleClick) {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  } else {
    element.click();
  }

  return { ok: true, ref };
}

// Execute type action
async function executeType(params) {
  const { ref, text } = params;
  const element = getElementByRef(ref);

  if (!element) {
    return { ok: false, error: `Element ${ref} not found` };
  }

  element.focus();

  // Type character by character for realistic input
  for (const char of text) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
  }

  return { ok: true, ref, typed: text };
}

// Execute fill action (clear + type)
async function executeFill(params) {
  const { ref, value } = params;
  const element = getElementByRef(ref);

  if (!element) {
    return { ok: false, error: `Element ${ref} not found` };
  }

  element.focus();
  element.value = '';
  element.dispatchEvent(new Event('input', { bubbles: true }));

  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return { ok: true, ref, filled: value };
}

// Execute press action (keyboard key)
async function executePress(params) {
  const { key } = params;

  const keyMap = {
    'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
    'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
    'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
    'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  };

  const keyInfo = keyMap[key] || { key, code: key, keyCode: 0 };

  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { ...keyInfo, bubbles: true }));
  document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { ...keyInfo, bubbles: true }));

  return { ok: true, key };
}

// Execute select action (dropdown)
async function executeSelect(params) {
  const { ref, value } = params;
  const element = getElementByRef(ref);

  if (!element || element.tagName !== 'SELECT') {
    return { ok: false, error: `Select element ${ref} not found` };
  }

  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return { ok: true, ref, selected: value };
}

// Execute hover action
async function executeHover(params) {
  const { ref } = params;
  const element = getElementByRef(ref);

  if (!element) {
    return { ok: false, error: `Element ${ref} not found` };
  }

  element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

  return { ok: true, ref };
}

// Execute scroll action
async function executeScroll(params) {
  const { direction = 'down', amount = 300 } = params;

  const scrollAmount = direction === 'up' ? -amount : amount;
  window.scrollBy({ top: scrollAmount, behavior: 'smooth' });

  await new Promise(r => setTimeout(r, 300));

  return { ok: true, direction, scrollY: window.scrollY };
}

// Execute navigate action
async function executeNavigate(params) {
  const { url } = params;
  window.location.href = url;
  return { ok: true, url };
}

// Capture screenshot
async function captureScreenshot(params) {
  // Screenshots must be captured by service worker using chrome.tabs.captureVisibleTab
  // Return a signal that service worker should capture
  return { ok: true, captureRequired: true };
}

// Get snapshot
async function getSnapshot() {
  await waitForSnapshotReady();
  return { ok: true, ...window.__tabAgent_snapshot() };
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, ...params } = message;

  (async () => {
    let result;

    switch (action) {
      case 'snapshot':
        result = await getSnapshot();
        break;
      case 'screenshot':
        result = await captureScreenshot(params);
        break;
      case 'click':
        result = await executeClick(params);
        break;
      case 'type':
        result = await executeType(params);
        break;
      case 'fill':
        result = await executeFill(params);
        break;
      case 'press':
        result = await executePress(params);
        break;
      case 'select':
        result = await executeSelect(params);
        break;
      case 'hover':
        result = await executeHover(params);
        break;
      case 'scroll':
        result = await executeScroll(params);
        break;
      case 'navigate':
        result = await executeNavigate(params);
        break;
      default:
        result = { ok: false, error: `Unknown action: ${action}` };
    }

    sendResponse(result);
  })();

  return true; // Keep channel open for async
});

console.log('Tab Agent content script loaded');
```

**Step 3: Update manifest to allow snapshot.js as web accessible**

Add to `manifest.json`:

```json
{
  "web_accessible_resources": [
    {
      "resources": ["snapshot.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

**Step 4: Commit**

```bash
git add extension/snapshot.js extension/content-script.js extension/manifest.json
git commit -m "feat: content script with snapshot builder and DOM actions"
```

---

## Task 4: Popup UI - Activation Control

**Files:**
- Create: `extension/popup/popup.html`
- Create: `extension/popup/popup.js`

**Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      width: 300px;
      padding: 16px;
      background: #1a1a2e;
      color: #e0e0e0;
    }

    h1 {
      font-size: 16px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status {
      font-size: 12px;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .status.connected {
      background: #1a3a1a;
      color: #4ade80;
    }

    .status.disconnected {
      background: #3a1a1a;
      color: #f87171;
    }

    .current-tab {
      background: #2a2a3e;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .current-tab .label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .current-tab .url {
      font-size: 12px;
      color: #aaa;
      word-break: break-all;
      margin-bottom: 8px;
    }

    .btn {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-primary {
      background: #4a9eff;
      color: white;
    }

    .btn-primary:hover {
      background: #3a8eef;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .activated-tabs {
      margin-top: 16px;
    }

    .activated-tabs h2 {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .tab-list {
      max-height: 150px;
      overflow-y: auto;
    }

    .tab-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: #2a2a3e;
      border-radius: 4px;
      margin-bottom: 4px;
      font-size: 12px;
    }

    .tab-item .title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 8px;
    }

    .tab-item .deactivate {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px;
    }

    .tab-item .deactivate:hover {
      color: #ef4444;
    }

    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #2a2a3e;
      font-size: 11px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>🎯 Tab Agent</h1>

  <div id="status" class="status disconnected">
    Checking connection...
  </div>

  <div class="current-tab">
    <div class="label">Current Tab</div>
    <div id="currentUrl" class="url">Loading...</div>
    <button id="activateBtn" class="btn btn-primary" disabled>
      Activate Control
    </button>
  </div>

  <div class="activated-tabs">
    <h2>Activated Tabs</h2>
    <div id="tabList" class="tab-list">
      <div style="color: #666; font-size: 12px;">No tabs activated</div>
    </div>
  </div>

  <div class="footer">
    ws://localhost:9876 • v0.1.0
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Create popup.js**

```javascript
// popup.js
// Tab Agent popup UI logic

let currentTabId = null;
let currentTabUrl = null;
let activatedTabs = [];

// Initialize popup
async function init() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;
  currentTabUrl = tab.url;

  document.getElementById('currentUrl').textContent = tab.url;

  // Load activated tabs
  await refreshActivatedTabs();

  // Update button state
  updateActivateButton();

  // Check relay connection
  checkRelayConnection();
}

// Refresh list of activated tabs
async function refreshActivatedTabs() {
  const response = await chrome.runtime.sendMessage({ action: 'getTabs' });
  if (response && response.ok) {
    activatedTabs = response.tabs;
    renderTabList();
  }
}

// Update activate button state
function updateActivateButton() {
  const btn = document.getElementById('activateBtn');
  const isActivated = activatedTabs.some(t => t.tabId === currentTabId);

  if (isActivated) {
    btn.textContent = 'Deactivate Control';
    btn.className = 'btn btn-danger';
  } else {
    btn.textContent = 'Activate Control';
    btn.className = 'btn btn-primary';
  }

  btn.disabled = false;
}

// Render activated tabs list
function renderTabList() {
  const container = document.getElementById('tabList');

  if (activatedTabs.length === 0) {
    container.innerHTML = '<div style="color: #666; font-size: 12px;">No tabs activated</div>';
    return;
  }

  container.innerHTML = activatedTabs.map(tab => `
    <div class="tab-item" data-tab-id="${tab.tabId}">
      <span class="title" title="${tab.url}">${tab.title || tab.url}</span>
      <button class="deactivate" title="Deactivate">✕</button>
    </div>
  `).join('');

  // Add click handlers for deactivate buttons
  container.querySelectorAll('.deactivate').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tabId = parseInt(e.target.closest('.tab-item').dataset.tabId);
      await chrome.runtime.sendMessage({ action: 'deactivate', tabId });
      await refreshActivatedTabs();
      updateActivateButton();
    });
  });
}

// Check if relay server is connected
async function checkRelayConnection() {
  const statusEl = document.getElementById('status');

  try {
    // Try to ping the service worker
    const response = await chrome.runtime.sendMessage({ action: 'ping' });
    if (response && response.ok) {
      statusEl.className = 'status connected';
      statusEl.textContent = '● Connected - Ready for commands';
    } else {
      throw new Error('No response');
    }
  } catch (error) {
    statusEl.className = 'status disconnected';
    statusEl.textContent = '○ Extension ready - Start relay server';
  }
}

// Handle activate/deactivate button click
document.getElementById('activateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('activateBtn');
  btn.disabled = true;

  const isActivated = activatedTabs.some(t => t.tabId === currentTabId);

  if (isActivated) {
    await chrome.runtime.sendMessage({ action: 'deactivate', tabId: currentTabId });
  } else {
    await chrome.runtime.sendMessage({ action: 'activate', tabId: currentTabId });
  }

  await refreshActivatedTabs();
  updateActivateButton();
});

// Initialize on load
init();
```

**Step 3: Update service-worker.js to handle internal messages**

Add to service-worker.js (before the `onMessageExternal` listener):

```javascript
// Handle internal messages (from popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, tabId, ...params } = message;

  (async () => {
    let result;

    switch (action) {
      case 'ping':
        result = { ok: true, message: 'pong', version: '0.1.0' };
        break;

      case 'activate':
        result = await activateTab(tabId);
        break;

      case 'deactivate':
        result = deactivateTab(tabId);
        break;

      case 'getTabs':
        result = listActivatedTabs();
        break;

      default:
        result = { ok: false, error: `Unknown action: ${action}` };
    }

    sendResponse(result);
  })();

  return true;
});
```

**Step 4: Commit**

```bash
git add extension/popup/
git commit -m "feat: popup UI for tab activation control"
```

---

## Task 5: Relay Server - WebSocket to Chrome Bridge

**Files:**
- Create: `relay/package.json`
- Create: `relay/server.js`

**Step 1: Create relay/package.json**

```json
{
  "name": "tab-agent-relay",
  "version": "0.1.0",
  "description": "WebSocket relay for Tab Agent Chrome extension",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "ws": "^8.16.0"
  }
}
```

**Step 2: Create relay/server.js**

```javascript
// relay/server.js
// WebSocket server that bridges CLI skills to Chrome extension

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 9876;
const EXTENSION_ID = process.env.EXTENSION_ID || null;

// Store for pending requests
const pendingRequests = new Map();
let requestCounter = 0;

// Create HTTP server for health checks
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server: httpServer });

console.log(`Tab Agent Relay starting on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      const { id, ...command } = message;

      console.log(`Received command: ${command.action}`, command);

      // Forward to Chrome extension via native messaging or HTTP
      // For now, we'll use a simple approach:
      // The extension needs to connect to us as well

      // Since Chrome extensions can't run WebSocket servers,
      // we need the extension to poll us or use native messaging

      // For MVP: respond with instructions to set up native messaging
      // OR: use chrome.debugger API approach

      // Simplified approach: store command and let extension poll
      const requestId = ++requestCounter;

      pendingRequests.set(requestId, {
        ws,
        command,
        clientId: id,
        timestamp: Date.now(),
      });

      // For now, simulate direct response
      // In production, extension would fetch and respond
      const response = await forwardToExtension(command);

      ws.send(JSON.stringify({
        id,
        ...response
      }));

    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        ok: false,
        error: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Forward command to Chrome extension
// This uses Chrome DevTools Protocol via chrome.debugger
// Or native messaging - for MVP we'll use a polling approach
async function forwardToExtension(command) {
  // MVP: Return mock response explaining setup needed
  // Production: Use native messaging or CDP

  return {
    ok: false,
    error: 'Extension bridge not yet implemented. Please see README for setup.',
    hint: 'Run: npm run setup-native-messaging'
  };
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`Tab Agent Relay running on ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close();
  httpServer.close();
  process.exit(0);
});
```

**Step 3: Commit**

```bash
git add relay/
git commit -m "feat: WebSocket relay server foundation"
```

---

## Task 6: Native Messaging Host - Extension Bridge

**Files:**
- Create: `relay/native-host.js`
- Create: `relay/install-native-host.sh`
- Create: `extension/native-messaging.json`

**Step 1: Create native-host.js**

```javascript
#!/usr/bin/env node
// native-host.js
// Native messaging host for Chrome extension communication

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Native messaging uses stdin/stdout with length-prefixed JSON
function sendMessage(message) {
  const json = JSON.stringify(message);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length, 0);
  process.stdout.write(length);
  process.stdout.write(json);
}

function readMessage() {
  return new Promise((resolve) => {
    let length = null;
    let buffer = Buffer.alloc(0);

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        buffer = Buffer.concat([buffer, chunk]);

        if (length === null && buffer.length >= 4) {
          length = buffer.readUInt32LE(0);
          buffer = buffer.slice(4);
        }

        if (length !== null && buffer.length >= length) {
          const message = JSON.parse(buffer.slice(0, length).toString());
          buffer = buffer.slice(length);
          length = null;
          resolve(message);
        }
      }
    });
  });
}

// Connect to relay server
const ws = new WebSocket('ws://localhost:9876');

ws.on('open', () => {
  sendMessage({ type: 'connected' });
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  sendMessage({ type: 'command', ...message });
});

ws.on('error', (error) => {
  sendMessage({ type: 'error', error: error.message });
});

ws.on('close', () => {
  sendMessage({ type: 'disconnected' });
  process.exit(0);
});

// Handle messages from extension
async function main() {
  while (true) {
    const message = await readMessage();

    if (message.type === 'response') {
      ws.send(JSON.stringify(message));
    }
  }
}

main().catch(console.error);
```

**Step 2: Create install-native-host.sh**

```bash
#!/bin/bash
# install-native-host.sh
# Installs the native messaging host for Tab Agent

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.tabagent.relay"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

# Create directory if needed
mkdir -p "$MANIFEST_DIR"

# Get extension ID (user must provide)
if [ -z "$1" ]; then
  echo "Usage: ./install-native-host.sh <extension-id>"
  echo ""
  echo "Find your extension ID at chrome://extensions (enable Developer mode)"
  exit 1
fi

EXTENSION_ID="$1"

# Create manifest
cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Tab Agent Native Messaging Host",
  "path": "$SCRIPT_DIR/native-host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

# Make native host executable
chmod +x "$SCRIPT_DIR/native-host.js"

echo "Native messaging host installed!"
echo "Manifest: $MANIFEST_DIR/$HOST_NAME.json"
echo "Extension ID: $EXTENSION_ID"
```

**Step 3: Update manifest.json for native messaging**

Add to `extension/manifest.json`:

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "nativeMessaging"
  ]
}
```

**Step 4: Commit**

```bash
git add relay/native-host.js relay/install-native-host.sh extension/manifest.json
git commit -m "feat: native messaging host for extension-relay bridge"
```

---

## Task 7: Update Service Worker for Native Messaging

**Files:**
- Modify: `extension/service-worker.js`

**Step 1: Add native messaging connection to service-worker.js**

Add at the top of service-worker.js:

```javascript
// Native messaging connection
let nativePort = null;

function connectNativeHost() {
  try {
    nativePort = chrome.runtime.connectNative('com.tabagent.relay');

    nativePort.onMessage.addListener(async (message) => {
      if (message.type === 'command') {
        const { id, action, tabId, ...params } = message;

        let result;

        switch (action) {
          case 'ping':
            result = { ok: true, message: 'pong', version: '0.1.0' };
            break;

          case 'activate':
            result = await activateTab(tabId);
            break;

          case 'deactivate':
            result = deactivateTab(tabId);
            break;

          case 'tabs':
            result = listActivatedTabs();
            break;

          case 'audit':
            result = { ok: true, log: state.auditLog.slice(-100) };
            break;

          case 'snapshot':
          case 'screenshot':
          case 'click':
          case 'type':
          case 'fill':
          case 'press':
          case 'select':
          case 'hover':
          case 'scroll':
          case 'navigate':
            result = await routeCommand(tabId, { action, ...params });
            break;

          default:
            result = { ok: false, error: `Unknown action: ${action}` };
        }

        nativePort.postMessage({ type: 'response', id, ...result });
      }
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('Native host disconnected');
      nativePort = null;
      // Retry connection after delay
      setTimeout(connectNativeHost, 5000);
    });

    console.log('Connected to native host');

  } catch (error) {
    console.error('Failed to connect to native host:', error);
    // Retry after delay
    setTimeout(connectNativeHost, 5000);
  }
}

// Start native messaging connection
connectNativeHost();
```

**Step 2: Commit**

```bash
git add extension/service-worker.js
git commit -m "feat: native messaging integration in service worker"
```

---

## Task 8: Screenshot Capture

**Files:**
- Modify: `extension/service-worker.js`

**Step 1: Add screenshot capture to service-worker.js**

Update the `routeCommand` function:

```javascript
// Route command to content script
async function routeCommand(tabId, command) {
  if (!isTabActivated(tabId)) {
    return { ok: false, error: 'Tab not activated' };
  }

  try {
    // Handle screenshot specially - must be done in service worker
    if (command.action === 'screenshot') {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 90
      });

      audit('screenshot', { tabId }, { ok: true });

      return {
        ok: true,
        screenshot: dataUrl,
        format: 'png',
        encoding: 'base64'
      };
    }

    const response = await chrome.tabs.sendMessage(tabId, command);
    audit(command.action, { tabId, ...command }, response);
    return response;

  } catch (error) {
    const result = { ok: false, error: error.message };
    audit(command.action, { tabId, ...command }, result);
    return result;
  }
}
```

**Step 2: Commit**

```bash
git add extension/service-worker.js
git commit -m "feat: screenshot capture via service worker"
```

---

## Task 9: Claude Code Skill

**Files:**
- Create: `skills/claude-code/tab-agent.md`

**Step 1: Create the skill file**

```markdown
---
name: tab-agent
description: Control browser tabs - navigate, click, type, extract data from web pages
---

# Tab Agent - Browser Control Skill

Connect to the Tab Agent Chrome extension to control browser tabs.

## Setup

1. Extension must be installed and running
2. Relay server must be running: `cd relay && npm start`
3. Tab must be activated (click extension icon → Activate)

## Connection

Connect via WebSocket to `ws://localhost:9876`

## Protocol

Send JSON commands, receive JSON responses.

### Commands

**Get page snapshot (AI-readable view):**
```json
{"id": 1, "action": "snapshot", "tabId": <tab_id>}
```
Response:
```json
{"id": 1, "ok": true, "url": "...", "title": "...", "snapshot": "== Page Snapshot ==\n[e1] link \"...\"..."}
```

**Click element:**
```json
{"id": 2, "action": "click", "tabId": <tab_id>, "ref": "e1"}
```

**Type text:**
```json
{"id": 3, "action": "type", "tabId": <tab_id>, "ref": "e2", "text": "hello"}
```

**Fill form field (clears first):**
```json
{"id": 4, "action": "fill", "tabId": <tab_id>, "ref": "e2", "value": "hello"}
```

**Press key:**
```json
{"id": 5, "action": "press", "tabId": <tab_id>, "key": "Enter"}
```
Keys: Enter, Escape, Tab, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight

**Select dropdown option:**
```json
{"id": 6, "action": "select", "tabId": <tab_id>, "ref": "e3", "value": "option1"}
```

**Hover over element:**
```json
{"id": 7, "action": "hover", "tabId": <tab_id>, "ref": "e4"}
```

**Scroll page:**
```json
{"id": 8, "action": "scroll", "tabId": <tab_id>, "direction": "down", "amount": 300}
```

**Navigate to URL:**
```json
{"id": 9, "action": "navigate", "tabId": <tab_id>, "url": "https://example.com"}
```

**Take screenshot:**
```json
{"id": 10, "action": "screenshot", "tabId": <tab_id>}
```
Response includes base64 PNG.

**List activated tabs:**
```json
{"id": 11, "action": "tabs"}
```

**Activate a tab:**
```json
{"id": 12, "action": "activate", "tabId": <tab_id>}
```

**Get audit log:**
```json
{"id": 13, "action": "audit"}
```

## Workflow

1. First, call `tabs` to see which tabs are activated
2. Call `snapshot` to see the current page state
3. Analyze the snapshot - elements have refs like `[e1]`, `[e2]`
4. Use refs to interact: `click`, `type`, `fill`, `select`
5. After actions, call `snapshot` again to see results
6. Repeat until task is complete

## Example: Search on Google

```
1. snapshot → see [e1] input "Search"
2. fill e1 "claude ai"
3. press Enter
4. snapshot → see search results [e2] link "Claude | Anthropic"
5. click e2
6. snapshot → verify on Anthropic page
```

## Tips

- Always snapshot after actions to verify results
- Use `fill` for form fields (clears existing text)
- Use `type` to append text
- If element not found, snapshot again (page may have changed)
- Check `tabs` if commands fail (tab may not be activated)
```

**Step 2: Commit**

```bash
git add skills/claude-code/tab-agent.md
git commit -m "feat: Claude Code skill file"
```

---

## Task 10: Codex Skill

**Files:**
- Create: `skills/codex/tab-agent.md`

**Step 1: Create the Codex skill file**

```markdown
---
name: tab-agent
description: Control browser tabs - navigate, click, type, extract data from web pages
---

# Tab Agent - Browser Control

Control Chrome browser tabs via WebSocket connection to Tab Agent extension.

## Connection

WebSocket: `ws://localhost:9876`

## Commands (JSON)

| Action | Params | Description |
|--------|--------|-------------|
| `snapshot` | `tabId` | Get AI-readable page view with element refs |
| `click` | `tabId`, `ref` | Click element by ref (e.g., "e1") |
| `type` | `tabId`, `ref`, `text` | Type text into element |
| `fill` | `tabId`, `ref`, `value` | Clear and fill form field |
| `press` | `tabId`, `key` | Press keyboard key |
| `select` | `tabId`, `ref`, `value` | Select dropdown option |
| `hover` | `tabId`, `ref` | Hover over element |
| `scroll` | `tabId`, `direction`, `amount` | Scroll page |
| `navigate` | `tabId`, `url` | Go to URL |
| `screenshot` | `tabId` | Capture page image (base64) |
| `tabs` | - | List activated tabs |
| `activate` | `tabId` | Enable control on tab |
| `audit` | - | Get action log |

## Snapshot Format

```
== Page Snapshot ==
URL: https://example.com
Title: Example Page

[e1] link "Home"
[e2] button "Login"
[e3] textbox "Email" value=""
[e4] textbox "Password" value=""
[e5] button "Submit"
```

## Workflow

1. `tabs` → get activated tab IDs
2. `snapshot` → see page with refs
3. `click`/`type`/`fill` → interact using refs
4. `snapshot` → verify result
5. Repeat

## Example

```json
{"action": "snapshot", "tabId": 123}
{"action": "fill", "tabId": 123, "ref": "e3", "value": "user@example.com"}
{"action": "fill", "tabId": 123, "ref": "e4", "value": "password123"}
{"action": "click", "tabId": 123, "ref": "e5"}
{"action": "snapshot", "tabId": 123}
```
```

**Step 2: Commit**

```bash
git add skills/codex/tab-agent.md
git commit -m "feat: Codex skill file"
```

---

## Task 11: Integration Test - Manual Verification

**Files:**
- Create: `test/manual-test.md`

**Step 1: Create manual test checklist**

```markdown
# Tab Agent Manual Test Checklist

## Prerequisites

- [ ] Chrome browser installed
- [ ] Node.js >= 18 installed
- [ ] Extension loaded in Chrome (chrome://extensions → Load unpacked)
- [ ] Note extension ID: ________________________________

## Setup Tests

### Install Native Messaging Host
```bash
cd relay
npm install
./install-native-host.sh <extension-id>
```
- [ ] Script completes without error
- [ ] Manifest file created in NativeMessagingHosts folder

### Start Relay Server
```bash
cd relay
npm start
```
- [ ] Server starts on port 9876
- [ ] No errors in console

## Extension Tests

### Popup UI
- [ ] Click extension icon → popup appears
- [ ] Shows "Extension ready" status
- [ ] Current tab URL displayed
- [ ] Activate button enabled

### Tab Activation
- [ ] Click "Activate Control" on a test page (e.g., https://example.com)
- [ ] Button changes to "Deactivate Control"
- [ ] Tab appears in "Activated Tabs" list
- [ ] Click "Deactivate" → tab removed from list

## Command Tests

Use a WebSocket client (e.g., `wscat`) to test:

```bash
npm install -g wscat
wscat -c ws://localhost:9876
```

### Ping
```json
{"id": 1, "action": "ping"}
```
- [ ] Response: `{"id": 1, "ok": true, "message": "pong"}`

### List Tabs
```json
{"id": 2, "action": "tabs"}
```
- [ ] Response shows activated tabs

### Snapshot
```json
{"id": 3, "action": "snapshot", "tabId": <id>}
```
- [ ] Response contains snapshot with refs [e1], [e2], etc.
- [ ] URL and title correct

### Click
```json
{"id": 4, "action": "click", "tabId": <id>, "ref": "e1"}
```
- [ ] Element clicked (verify in browser)
- [ ] Response: `{"ok": true, "ref": "e1"}`

### Type
```json
{"id": 5, "action": "type", "tabId": <id>, "ref": "e2", "text": "test"}
```
- [ ] Text appears in input field
- [ ] Response confirms typed text

### Screenshot
```json
{"id": 6, "action": "screenshot", "tabId": <id>}
```
- [ ] Response contains base64 PNG
- [ ] Can decode and view image

## End-to-End Test

Test with actual Claude Code:

1. [ ] Install skill: `cp skills/claude-code/tab-agent.md ~/.claude/skills/`
2. [ ] Start relay server
3. [ ] Activate a tab on https://news.ycombinator.com
4. [ ] Ask Claude: "Use tab-agent to get the top 5 stories from Hacker News"
5. [ ] Verify Claude connects, snapshots, and extracts stories

## Cleanup

- [ ] Stop relay server (Ctrl+C)
- [ ] Deactivate test tabs
- [ ] Optionally remove extension
```

**Step 2: Commit**

```bash
git add test/manual-test.md
git commit -m "docs: manual test checklist"
```

---

## Task 12: Final Polish & Documentation

**Files:**
- Update: `README.md`
- Create: `CHANGELOG.md`

**Step 1: Update README.md with complete documentation**

```markdown
# Tab Agent

🎯 Browser control for Claude Code and Codex via WebSocket.

Tab Agent is a Chrome extension that lets AI assistants control your browser tabs. Activate a tab, and your AI can see the page, click buttons, fill forms, and extract data.

## Features

- **AI-Readable Snapshots** - Pages rendered as structured text with element refs
- **Full Interaction** - Click, type, fill, select, hover, scroll
- **Screenshot Capture** - Get visual confirmation of page state
- **Multi-Tab Support** - Control multiple tabs simultaneously
- **Audit Logging** - Track all actions for debugging
- **Secure by Design** - Explicit tab activation required

## Quick Start

### 1. Install Extension

```bash
git clone https://github.com/yourname/tab-agent
cd tab-agent
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Note your **Extension ID** (shown under the extension name)

### 2. Install Native Messaging Host

```bash
cd relay
npm install
./install-native-host.sh <your-extension-id>
```

### 3. Start Relay Server

```bash
npm start
```

Keep this running while using Tab Agent.

### 4. Install Skill

**For Claude Code:**
```bash
cp skills/claude-code/tab-agent.md ~/.claude/skills/
```

**For Codex:**
```bash
cp skills/codex/tab-agent.md ~/.codex/skills/
```

### 5. Activate a Tab

1. Navigate to any webpage
2. Click the Tab Agent extension icon
3. Click **Activate Control**

### 6. Use with AI

Ask your AI assistant:
> "Use tab-agent to go to Hacker News and get the top 5 stories"

## Architecture

```
┌─────────────────────┐
│  Claude Code/Codex  │
│  (sends commands)   │
└──────────┬──────────┘
           │ WebSocket
           ▼
┌─────────────────────┐
│   Relay Server      │
│  ws://localhost:9876│
└──────────┬──────────┘
           │ Native Messaging
           ▼
┌─────────────────────┐
│  Chrome Extension   │
│  (service worker)   │
└──────────┬──────────┘
           │ chrome.tabs API
           ▼
┌─────────────────────┐
│  Content Script     │
│  (DOM interaction)  │
└─────────────────────┘
```

## Commands

| Command | Description |
|---------|-------------|
| `snapshot` | Get AI-readable page state |
| `click` | Click element by ref |
| `type` | Type text into element |
| `fill` | Clear and fill form field |
| `press` | Press keyboard key |
| `select` | Select dropdown option |
| `hover` | Hover over element |
| `scroll` | Scroll page |
| `navigate` | Go to URL |
| `screenshot` | Capture page image |
| `tabs` | List activated tabs |
| `activate` | Enable control on tab |
| `audit` | Get action log |

## Security

- **Explicit Activation** - Each tab must be manually activated
- **Local Only** - All communication stays on localhost
- **Audit Trail** - All actions logged for review
- **No Cloud** - Your data never leaves your machine

## Troubleshooting

**Extension not connecting:**
- Ensure relay server is running (`npm start` in relay/)
- Check native messaging host is installed
- Restart Chrome after installing native host

**Commands failing:**
- Verify tab is activated (check popup)
- Try `tabs` command to confirm connection
- Check relay server console for errors

**Element not found:**
- Take a fresh `snapshot` - page may have changed
- Element might be in an iframe (not yet supported)
- Element might be hidden or off-screen

## License

MIT
```

**Step 2: Create CHANGELOG.md**

```markdown
# Changelog

## [0.1.0] - 2026-01-30

### Added
- Chrome extension with Manifest V3
- WebSocket relay server
- Native messaging host for extension-relay bridge
- AI-readable page snapshots with element refs
- DOM actions: click, type, fill, press, select, hover, scroll
- Screenshot capture
- Multi-tab support with explicit activation
- Audit logging
- Claude Code skill
- Codex skill
- Manual test checklist
```

**Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: complete README and changelog"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project setup & manifest | `manifest.json`, `README.md`, icons |
| 2 | Service worker foundation | `service-worker.js` |
| 3 | Content script & snapshots | `snapshot.js`, `content-script.js` |
| 4 | Popup UI | `popup/popup.html`, `popup/popup.js` |
| 5 | Relay server | `relay/server.js`, `relay/package.json` |
| 6 | Native messaging host | `native-host.js`, `install-native-host.sh` |
| 7 | Service worker native messaging | `service-worker.js` (update) |
| 8 | Screenshot capture | `service-worker.js` (update) |
| 9 | Claude Code skill | `skills/claude-code/tab-agent.md` |
| 10 | Codex skill | `skills/codex/tab-agent.md` |
| 11 | Manual test checklist | `test/manual-test.md` |
| 12 | Documentation | `README.md`, `CHANGELOG.md` |

**Total: 12 tasks, ~15 files**
