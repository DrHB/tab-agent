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
├── relay/
│   ├── package.json
│   ├── server.js
│   ├── native-host.js
│   └── install-native-host.sh
├── skills/
│   ├── claude-code/
│   │   └── tab-agent.md
│   └── codex/
│       └── tab-agent.md
├── test/
│   └── manual-test.md
├── docs/
│   ├── plans/
│   └── reference/
├── README.md
└── CHANGELOG.md
```

---

## Task 1: Project Setup & Manifest

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/icons/` (placeholder icons)

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
    "tabs",
    "nativeMessaging"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },

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
  },

  "web_accessible_resources": [
    {
      "resources": ["snapshot.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

**Step 2: Create placeholder icons**

Create simple 16x16, 48x48, 128x128 PNG files (can be solid color squares for now).

**Step 3: Commit**

```bash
git add extension/manifest.json extension/icons/
git commit -m "feat: initial project setup with manifest"
```

---

## Task 2: Service Worker - State Management & Command Routing

**Files:**
- Create: `extension/service-worker.js`

**Step 1: Create service-worker.js**

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
    const info = state.activatedTabs.get(tabId);
    info.url = changeInfo.url;
    info.title = tab.title;
  }
});

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
      setTimeout(connectNativeHost, 5000);
    });

    console.log('Connected to native host');

  } catch (error) {
    console.error('Failed to connect to native host:', error);
    setTimeout(connectNativeHost, 5000);
  }
}

// Start native messaging connection
connectNativeHost();

console.log('Tab Agent service worker started');
```

**Step 2: Commit**

```bash
git add extension/service-worker.js
git commit -m "feat: service worker with state management and native messaging"
```

---

## Task 3: Snapshot Builder - AI-Readable Page Representation

**Files:**
- Create: `extension/snapshot.js`

**Step 1: Create snapshot.js**

```javascript
// snapshot.js
// Builds AI-readable snapshots from the DOM accessibility tree

(function() {
  let refCounter = 0;
  const refMap = new Map();

  function resetRefs() {
    refCounter = 0;
    refMap.clear();
  }

  function nextRef() {
    return `e${++refCounter}`;
  }

  function storeRef(ref, element) {
    refMap.set(ref, element);
  }

  window.__tabAgent_getElementByRef = function(ref) {
    return refMap.get(ref);
  };

  function getRole(element) {
    if (element.getAttribute('role')) {
      return element.getAttribute('role');
    }

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

  function getName(element) {
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    if (element.getAttribute('aria-labelledby')) {
      const labelId = element.getAttribute('aria-labelledby');
      const labelEl = document.getElementById(labelId);
      if (labelEl) return labelEl.textContent.trim();
    }

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent.trim();
      }
      if (element.placeholder) return element.placeholder;
    }

    if (element.tagName === 'IMG') {
      return element.alt || '';
    }

    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      return element.textContent.trim().substring(0, 100);
    }

    if (/^H[1-6]$/.test(element.tagName)) {
      return element.textContent.trim().substring(0, 100);
    }

    if (element.title) {
      return element.title;
    }

    return '';
  }

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

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    return true;
  }

  function buildSnapshot(element, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return [];
    if (!isVisible(element)) return [];

    const lines = [];
    const role = getRole(element);
    const name = getName(element);
    const interactive = isInteractive(element);

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

    for (const child of element.children) {
      lines.push(...buildSnapshot(child, depth + 1, maxDepth));
    }

    return lines;
  }

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

**Step 2: Commit**

```bash
git add extension/snapshot.js
git commit -m "feat: snapshot builder for AI-readable page representation"
```

---

## Task 4: Content Script - DOM Actions

**Files:**
- Create: `extension/content-script.js`

**Step 1: Create content-script.js**

```javascript
// content-script.js
// Handles commands from service worker and executes DOM actions

// Inject snapshot builder into page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('snapshot.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

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

function getElementByRef(ref) {
  return window.__tabAgent_getElementByRef(ref);
}

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

async function executeType(params) {
  const { ref, text } = params;
  const element = getElementByRef(ref);

  if (!element) {
    return { ok: false, error: `Element ${ref} not found` };
  }

  element.focus();

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

async function executeScroll(params) {
  const { direction = 'down', amount = 300 } = params;

  const scrollAmount = direction === 'up' ? -amount : amount;
  window.scrollBy({ top: scrollAmount, behavior: 'smooth' });

  await new Promise(r => setTimeout(r, 300));

  return { ok: true, direction, scrollY: window.scrollY };
}

async function executeNavigate(params) {
  const { url } = params;
  window.location.href = url;
  return { ok: true, url };
}

async function getSnapshot() {
  await waitForSnapshotReady();
  return { ok: true, ...window.__tabAgent_snapshot() };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, ...params } = message;

  (async () => {
    let result;

    switch (action) {
      case 'snapshot':
        result = await getSnapshot();
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

  return true;
});

console.log('Tab Agent content script loaded');
```

**Step 2: Commit**

```bash
git add extension/content-script.js
git commit -m "feat: content script with DOM actions"
```

---

## Task 5: Popup UI

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
    * { box-sizing: border-box; margin: 0; padding: 0; }

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

    .status.connected { background: #1a3a1a; color: #4ade80; }
    .status.disconnected { background: #3a1a1a; color: #f87171; }

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

    .btn-primary { background: #4a9eff; color: white; }
    .btn-primary:hover { background: #3a8eef; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .activated-tabs { margin-top: 16px; }
    .activated-tabs h2 {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .tab-list { max-height: 150px; overflow-y: auto; }

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

    .tab-item .deactivate:hover { color: #ef4444; }

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
  <h1>Tab Agent</h1>

  <div id="status" class="status disconnected">Checking connection...</div>

  <div class="current-tab">
    <div class="label">Current Tab</div>
    <div id="currentUrl" class="url">Loading...</div>
    <button id="activateBtn" class="btn btn-primary" disabled>Activate Control</button>
  </div>

  <div class="activated-tabs">
    <h2>Activated Tabs</h2>
    <div id="tabList" class="tab-list">
      <div style="color: #666; font-size: 12px;">No tabs activated</div>
    </div>
  </div>

  <div class="footer">ws://localhost:9876 | v0.1.0</div>

  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Create popup.js**

```javascript
// popup.js

let currentTabId = null;
let activatedTabs = [];

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  document.getElementById('currentUrl').textContent = tab.url;

  await refreshActivatedTabs();
  updateActivateButton();
  checkConnection();
}

async function refreshActivatedTabs() {
  const response = await chrome.runtime.sendMessage({ action: 'getTabs' });
  if (response && response.ok) {
    activatedTabs = response.tabs;
    renderTabList();
  }
}

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

  container.querySelectorAll('.deactivate').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tabId = parseInt(e.target.closest('.tab-item').dataset.tabId);
      await chrome.runtime.sendMessage({ action: 'deactivate', tabId });
      await refreshActivatedTabs();
      updateActivateButton();
    });
  });
}

async function checkConnection() {
  const statusEl = document.getElementById('status');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'ping' });
    if (response && response.ok) {
      statusEl.className = 'status connected';
      statusEl.textContent = 'Connected - Ready for commands';
    } else {
      throw new Error('No response');
    }
  } catch (error) {
    statusEl.className = 'status disconnected';
    statusEl.textContent = 'Extension ready - Start relay server';
  }
}

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

init();
```

**Step 3: Commit**

```bash
git add extension/popup/
git commit -m "feat: popup UI for tab activation"
```

---

## Task 6: Relay Server

**Files:**
- Create: `relay/package.json`
- Create: `relay/server.js`

**Step 1: Create package.json**

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

**Step 2: Create server.js**

```javascript
// relay/server.js
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 9876;

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server: httpServer });

// Store extension connection
let extensionConnection = null;
const pendingRequests = new Map();

wss.on('connection', (ws, req) => {
  const isExtension = req.headers['x-client-type'] === 'extension';

  if (isExtension) {
    console.log('Extension connected');
    extensionConnection = ws;

    ws.on('message', (data) => {
      const message = JSON.parse(data);
      const { id, ...response } = message;

      const pending = pendingRequests.get(id);
      if (pending) {
        pending.ws.send(JSON.stringify({ id: pending.clientId, ...response }));
        pendingRequests.delete(id);
      }
    });

    ws.on('close', () => {
      console.log('Extension disconnected');
      extensionConnection = null;
    });

  } else {
    console.log('Skill client connected');

    ws.on('message', async (data) => {
      const message = JSON.parse(data);
      const { id, ...command } = message;

      console.log(`Command: ${command.action}`, command);

      if (!extensionConnection) {
        ws.send(JSON.stringify({ id, ok: false, error: 'Extension not connected' }));
        return;
      }

      const internalId = Date.now() + Math.random();
      pendingRequests.set(internalId, { ws, clientId: id });

      extensionConnection.send(JSON.stringify({ id: internalId, ...command }));
    });

    ws.on('close', () => {
      console.log('Skill client disconnected');
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Tab Agent Relay running on ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

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
git commit -m "feat: WebSocket relay server"
```

---

## Task 7: Native Messaging Host

**Files:**
- Create: `relay/native-host.js`
- Create: `relay/install-native-host.sh`

**Step 1: Create native-host.js**

```javascript
#!/usr/bin/env node
// native-host.js
const WebSocket = require('ws');

function sendMessage(message) {
  const json = JSON.stringify(message);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length, 0);
  process.stdout.write(length);
  process.stdout.write(json);
}

let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  while (inputBuffer.length >= 4) {
    const length = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + length) break;

    const message = JSON.parse(inputBuffer.slice(4, 4 + length).toString());
    inputBuffer = inputBuffer.slice(4 + length);

    handleMessage(message);
  }
});

const ws = new WebSocket('ws://localhost:9876', {
  headers: { 'x-client-type': 'extension' }
});

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
  process.exit(0);
});

function handleMessage(message) {
  if (message.type === 'response') {
    ws.send(JSON.stringify(message));
  }
}
```

**Step 2: Create install-native-host.sh**

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.tabagent.relay"

if [[ "$OSTYPE" == "darwin"* ]]; then
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

mkdir -p "$MANIFEST_DIR"

if [ -z "$1" ]; then
  echo "Usage: ./install-native-host.sh <extension-id>"
  echo ""
  echo "Find your extension ID at chrome://extensions (enable Developer mode)"
  exit 1
fi

EXTENSION_ID="$1"

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

chmod +x "$SCRIPT_DIR/native-host.js"

echo "Native messaging host installed!"
echo "Manifest: $MANIFEST_DIR/$HOST_NAME.json"
echo "Extension ID: $EXTENSION_ID"
```

**Step 3: Commit**

```bash
git add relay/native-host.js relay/install-native-host.sh
git commit -m "feat: native messaging host"
```

---

## Task 8: Claude Code Skill

**Files:**
- Create: `skills/claude-code/tab-agent.md`

**Step 1: Create skill file**

```markdown
---
name: tab-agent
description: Control browser tabs - navigate, click, type, extract data from web pages
---

# Tab Agent - Browser Control

Control Chrome tabs via WebSocket at `ws://localhost:9876`.

## Setup

1. Extension installed and relay server running (`cd relay && npm start`)
2. Tab activated (click extension icon → Activate)

## Commands

All commands are JSON with an `id` field for request/response matching.

### Get page snapshot
```json
{"id": 1, "action": "snapshot", "tabId": <id>}
```
Returns AI-readable page with refs: `[e1] link "Home"`, `[e2] button "Submit"`

### Click element
```json
{"id": 2, "action": "click", "tabId": <id>, "ref": "e1"}
```

### Type text
```json
{"id": 3, "action": "type", "tabId": <id>, "ref": "e2", "text": "hello"}
```

### Fill form field (clears first)
```json
{"id": 4, "action": "fill", "tabId": <id>, "ref": "e2", "value": "hello"}
```

### Press key
```json
{"id": 5, "action": "press", "tabId": <id>, "key": "Enter"}
```
Keys: Enter, Escape, Tab, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight

### Select dropdown
```json
{"id": 6, "action": "select", "tabId": <id>, "ref": "e3", "value": "option1"}
```

### Hover
```json
{"id": 7, "action": "hover", "tabId": <id>, "ref": "e4"}
```

### Scroll
```json
{"id": 8, "action": "scroll", "tabId": <id>, "direction": "down", "amount": 300}
```

### Navigate
```json
{"id": 9, "action": "navigate", "tabId": <id>, "url": "https://example.com"}
```

### Screenshot
```json
{"id": 10, "action": "screenshot", "tabId": <id>}
```

### List tabs
```json
{"id": 11, "action": "tabs"}
```

### Activate tab
```json
{"id": 12, "action": "activate", "tabId": <id>}
```

## Workflow

1. `tabs` → get activated tab IDs
2. `snapshot` → see page with element refs
3. Interact using refs: `click`, `type`, `fill`
4. `snapshot` → verify result
5. Repeat

## Example: Google Search

```
snapshot → [e1] textbox "Search"
fill e1 "claude ai"
press Enter
snapshot → [e2] link "Claude | Anthropic"
click e2
```
```

**Step 2: Commit**

```bash
git add skills/claude-code/
git commit -m "feat: Claude Code skill"
```

---

## Task 9: Codex Skill

**Files:**
- Create: `skills/codex/tab-agent.md`

**Step 1: Create skill file**

```markdown
---
name: tab-agent
description: Control browser tabs via WebSocket
---

# Tab Agent

WebSocket: `ws://localhost:9876`

## Commands

| Action | Params | Description |
|--------|--------|-------------|
| snapshot | tabId | Get page with refs [e1], [e2]... |
| click | tabId, ref | Click element |
| type | tabId, ref, text | Type into element |
| fill | tabId, ref, value | Clear and fill field |
| press | tabId, key | Press key (Enter, Escape, Tab...) |
| select | tabId, ref, value | Select dropdown option |
| hover | tabId, ref | Hover element |
| scroll | tabId, direction, amount | Scroll page |
| navigate | tabId, url | Go to URL |
| screenshot | tabId | Capture image |
| tabs | - | List activated tabs |
| activate | tabId | Enable control |

## Workflow

1. `tabs` → get tab IDs
2. `snapshot` → see page
3. `click`/`type`/`fill` using refs
4. `snapshot` → verify
5. Repeat
```

**Step 2: Commit**

```bash
git add skills/codex/
git commit -m "feat: Codex skill"
```

---

## Task 10: Manual Test Checklist

**Files:**
- Create: `test/manual-test.md`

**Step 1: Create test checklist**

```markdown
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
```

**Step 2: Commit**

```bash
git add test/
git commit -m "docs: manual test checklist"
```

---

## Task 11: README

**Files:**
- Create: `README.md`

**Step 1: Create README**

```markdown
# Tab Agent

Browser control for Claude Code and Codex via WebSocket.

## Quick Start

### 1. Install Extension

```bash
git clone https://github.com/yourname/tab-agent
cd tab-agent
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/`
4. Copy your **Extension ID**

### 2. Setup Relay

```bash
cd relay
npm install
./install-native-host.sh <extension-id>
npm start
```

### 3. Install Skill

```bash
# Claude Code
cp skills/claude-code/tab-agent.md ~/.claude/skills/

# Codex
cp skills/codex/tab-agent.md ~/.codex/skills/
```

### 4. Use

1. Click Tab Agent icon → **Activate** on target tab
2. Ask your AI: "Use tab-agent to search Google for 'hello world'"

## Commands

| Command | Description |
|---------|-------------|
| snapshot | Get AI-readable page |
| click | Click by ref |
| type | Type text |
| fill | Fill form field |
| press | Press key |
| navigate | Go to URL |
| screenshot | Capture image |

## Architecture

```
Claude/Codex → WebSocket → Relay Server → Native Messaging → Extension → Content Script → DOM
```

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README"
```

---

## Task 12: Changelog

**Files:**
- Create: `CHANGELOG.md`

**Step 1: Create changelog**

```markdown
# Changelog

## [0.1.0] - 2026-01-30

### Added
- Chrome extension (Manifest V3)
- WebSocket relay server
- Native messaging host
- AI-readable page snapshots
- DOM actions: click, type, fill, press, select, hover, scroll
- Screenshot capture
- Multi-tab support
- Audit logging
- Claude Code skill
- Codex skill
```

**Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | manifest.json, icons/ | Project setup |
| 2 | service-worker.js | State & routing |
| 3 | snapshot.js | AI-readable snapshots |
| 4 | content-script.js | DOM actions |
| 5 | popup/ | Activation UI |
| 6 | relay/server.js | WebSocket server |
| 7 | relay/native-host.js | Extension bridge |
| 8 | skills/claude-code/ | Claude skill |
| 9 | skills/codex/ | Codex skill |
| 10 | test/ | Test checklist |
| 11 | README.md | Documentation |
| 12 | CHANGELOG.md | Version history |

**Total: 12 tasks, ~15 files**
