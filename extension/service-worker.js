// service-worker.js
// Tab Agent - Service Worker
// Manages activated tabs and routes commands to content scripts

// Browser detection
const IS_SAFARI = typeof browser !== 'undefined' &&
  navigator.userAgent.includes('Safari') &&
  !navigator.userAgent.includes('Chrome');
const IS_CHROME = typeof chrome !== 'undefined' && !IS_SAFARI;

// Safari uses 'browser' namespace, Chrome uses 'chrome'
const browserAPI = IS_SAFARI ? browser : chrome;

const state = {
  activatedTabs: new Map(), // tabId -> { url, title, activatedAt }
  auditLog: [],
  nativeConnected: false,
  lastNativeError: null,
  autoActivateAll: false,
};

// Load auto-activate setting from storage on startup
chrome.storage.local.get(['autoActivateAll'], (result) => {
  if (result.autoActivateAll) {
    state.autoActivateAll = true;
    autoActivateExistingTabs();
    updateAutoActivateBadge();
  }
});

// Dialog handling with chrome.debugger
const pendingDialogs = new Map();
const attachedDebuggerTabs = new Set();

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === 'Page.javascriptDialogOpening') {
    pendingDialogs.set(source.tabId, {
      type: params.type,
      message: params.message,
      defaultPrompt: params.defaultPrompt
    });
  }
});

async function handleDialog(tabId, accept, promptText = '') {
  if (!attachedDebuggerTabs.has(tabId)) {
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
      attachedDebuggerTabs.add(tabId);
    } catch (e) {
      return { ok: false, error: `Failed to attach debugger: ${e.message}` };
    }
  }

  const pending = pendingDialogs.get(tabId);
  if (!pending) {
    return { ok: false, error: 'No dialog present' };
  }

  try {
    await chrome.debugger.sendCommand({ tabId }, 'Page.handleJavaScriptDialog', {
      accept,
      promptText
    });
    pendingDialogs.delete(tabId);
    return { ok: true, accepted: accept, dialogType: pending.type };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Update badge for a tab
function updateBadge(tabId) {
  const isActive = state.activatedTabs.has(tabId);
  chrome.action.setBadgeText({ tabId, text: isActive ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: isActive ? '#22c55e' : '#666' });
  chrome.action.setTitle({
    tabId,
    title: isActive ? 'Tab Agent - Active (click to deactivate)' : 'Tab Agent - Click to activate'
  });
}

// Update badge to show AUTO mode
function updateAutoActivateBadge() {
  if (state.autoActivateAll) {
    chrome.action.setBadgeText({ text: 'AUTO' });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    chrome.action.setTitle({ title: 'Tab Agent - Auto-activate ON (click to manage)' });
  } else {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Tab Agent - Click to manage' });
    for (const [tabId] of state.activatedTabs) {
      updateBadge(tabId);
    }
  }
}

// Activate all existing tabs
async function autoActivateExistingTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!state.activatedTabs.has(tab.id) && tab.url && !tab.url.startsWith('chrome://')) {
      await activateTab(tab.id);
    }
  }
}

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

// Ensure content script is ready in the tab
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: '__ping' });
    return { ok: true, alreadyLoaded: true };
  } catch (error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js']
      });
      return { ok: true, injected: true };
    } catch (injectError) {
      return { ok: false, error: injectError.message || 'Failed to inject content script' };
    }
  }
}

// Activate a tab for control
async function activateTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const injectResult = await ensureContentScript(tabId);
    if (!injectResult.ok) {
      const result = { ok: false, error: injectResult.error };
      audit('activate', { tabId, url: tab.url }, result);
      return result;
    }

    state.activatedTabs.set(tabId, {
      url: tab.url,
      title: tab.title,
      activatedAt: new Date().toISOString(),
    });

    // Update badge
    updateBadge(tabId);

    audit('activate', { tabId, url: tab.url }, { ok: true });
    return { ok: true, tabId, url: tab.url, title: tab.title };
  } catch (error) {
    const result = { ok: false, error: error.message };
    audit('activate', { tabId }, result);
    return result;
  }
}

// Deactivate a tab
function deactivateTab(tabId) {
  state.activatedTabs.delete(tabId);
  updateBadge(tabId);
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
    // Handle evaluate - must use world: MAIN for page context access
    if (command.action === 'evaluate') {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (code) => {
            try {
              const result = eval(code);
              if (typeof result === 'function') return { ok: true, result: '[Function]' };
              if (result instanceof Node) return { ok: true, result: '[DOM Node]' };
              return { ok: true, result };
            } catch (e) {
              return { ok: false, error: e.message };
            }
          },
          args: [command.script]
        });
        const evalResult = results[0]?.result || { ok: false, error: 'No result' };
        audit('evaluate', { tabId, script: command.script }, evalResult);
        return evalResult;
      } catch (error) {
        const result = { ok: false, error: error.message };
        audit('evaluate', { tabId, script: command.script }, result);
        return result;
      }
    }

    // Handle screenshot specially - must be done in service worker
    if (command.action === 'screenshot') {
      const { fullPage = false } = command;
      const tab = await chrome.tabs.get(tabId);

      // Full page screenshot using chrome.debugger
      if (fullPage) {
        try {
          // Try to detach first in case previous attempt left debugger attached
          try { await chrome.debugger.detach({ tabId }); } catch {}

          await chrome.debugger.attach({ tabId }, '1.3');

          const screenshot = await chrome.debugger.sendCommand(
            { tabId },
            'Page.captureScreenshot',
            {
              format: 'png',
              captureBeyondViewport: true
            }
          );

          await chrome.debugger.detach({ tabId });
          audit('screenshot', { tabId, fullPage: true }, { ok: true });
          return { ok: true, screenshot: 'data:image/png;base64,' + screenshot.data, format: 'png' };
        } catch (error) {
          try { await chrome.debugger.detach({ tabId }); } catch {}
          const result = { ok: false, error: error.message };
          audit('screenshot', { tabId, fullPage: true }, result);
          return result;
        }
      }

      // Viewport screenshot (existing behavior)
      let previousActiveTabId = null;
      let dataUrl = null;

      try {
        if (!tab.active) {
          const [activeTab] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
          if (activeTab && activeTab.id !== tabId) {
            previousActiveTabId = activeTab.id;
          }
          await chrome.tabs.update(tabId, { active: true });
          await new Promise(r => setTimeout(r, 150));
        }

        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
          quality: 90
        });
      } finally {
        if (previousActiveTabId && previousActiveTabId !== tabId) {
          try {
            await chrome.tabs.update(previousActiveTabId, { active: true });
          } catch (restoreError) {
            console.warn('Failed to restore active tab after screenshot:', restoreError);
          }
        }
      }

      audit('screenshot', { tabId }, { ok: true });

      return {
        ok: true,
        screenshot: dataUrl,
        format: 'png',
        encoding: 'base64'
      };
    }

    // Handle PDF generation - must be done in service worker via debugger
    if (command.action === 'pdf') {
      try {
        try { await chrome.debugger.detach({ tabId }); } catch {}
        await chrome.debugger.attach({ tabId }, '1.3');
        const pdf = await chrome.debugger.sendCommand({ tabId }, 'Page.printToPDF', {
          printBackground: true,
          preferCSSPageSize: true,
        });
        await chrome.debugger.detach({ tabId });
        audit('pdf', { tabId }, { ok: true });
        return { ok: true, pdf: pdf.data, format: 'pdf', encoding: 'base64' };
      } catch (error) {
        try { await chrome.debugger.detach({ tabId }); } catch {}
        const result = { ok: false, error: error.message };
        audit('pdf', { tabId }, result);
        return result;
      }
    }

    const injectResult = await ensureContentScript(tabId);
    if (!injectResult.ok) {
      const result = { ok: false, error: injectResult.error };
      audit(command.action, { tabId, ...command }, result);
      return result;
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
        result = {
          ok: true,
          message: 'pong',
          version: '0.1.0',
          nativeConnected: state.nativeConnected,
          lastNativeError: state.lastNativeError
        };
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

      case 'getAutoActivate':
        result = { ok: true, autoActivateAll: state.autoActivateAll };
        break;

      case 'setAutoActivate': {
        state.autoActivateAll = params.enabled;
        chrome.storage.local.set({ autoActivateAll: params.enabled });
        updateAutoActivateBadge();
        if (params.enabled) {
          autoActivateExistingTabs();
        }
        audit('setAutoActivate', { enabled: params.enabled }, { ok: true });
        result = { ok: true, autoActivateAll: params.enabled };
        break;
      }

      default:
        result = { ok: false, error: `Unknown action: ${action}` };
    }

    sendResponse(result);
  })();

  return true;
});

// Handle extension icon click - toggle activation
chrome.action.onClicked.addListener(async (tab) => {
  if (state.activatedTabs.has(tab.id)) {
    deactivateTab(tab.id);
  } else {
    await activateTab(tab.id);
  }
});

// Update badge when switching tabs
chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateBadge(tabId);
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up debugger state
  if (attachedDebuggerTabs.has(tabId)) {
    chrome.debugger.detach({ tabId }).catch(() => {});
    attachedDebuggerTabs.delete(tabId);
  }
  pendingDialogs.delete(tabId);

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
  if (changeInfo.status === 'complete') {
    if (state.autoActivateAll && !state.activatedTabs.has(tabId) && tab.url && !tab.url.startsWith('chrome://')) {
      activateTab(tabId);
    } else if (state.activatedTabs.has(tabId)) {
      ensureContentScript(tabId);
      updateBadge(tabId);
    }
  }
});

// Native messaging connection
let nativePort = null;

function connectNativeHost() {
  console.log('Attempting to connect to native host...');

  try {
    if (IS_SAFARI) {
      // Safari: native messaging is handled by the containing app
      // The app will inject messages via browser.runtime messaging
      console.log('Safari detected - native messaging handled by container app');
      state.nativeConnected = true;
      state.lastNativeError = null;
      // Safari extension will receive commands via runtime.onMessage from the app
      return;
    }

    // Chrome: use connectNative
    nativePort = chrome.runtime.connectNative('com.tabagent.relay');
    console.log('connectNative called, port created');

    nativePort.onMessage.addListener(async (message) => {
      console.log('Received from native host:', message);

      if (message.type === 'connected') {
        console.log('Native host connected to relay server');
        state.nativeConnected = true;
        state.lastNativeError = null;
        return;
      }

      if (message.type === 'error') {
        console.error('Native host error:', message.error);
        return;
      }

      if (message.type === 'command') {
        const { id, action, tabId, ...params } = message;
        console.log(`Processing command: ${action}`, { tabId, params });

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

          case 'dialog':
            result = await handleDialog(tabId, params.accept, params.promptText);
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
          case 'evaluate':
          case 'wait':
          case 'scrollintoview':
          case 'batchfill':
          case 'drag':
          case 'get':
          case 'find':
          case 'cookies':
          case 'storage':
          case 'pdf':
            result = await routeCommand(tabId, { action, ...params });
            break;

          default:
            result = { ok: false, error: `Unknown action: ${action}` };
        }

        console.log(`Command ${action} result:`, result);
        nativePort.postMessage({ type: 'response', id, ...result });
      }
    });

    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      const errorMsg = error ? error.message : null;
      console.log('Native host disconnected', errorMsg ? `Error: ${errorMsg}` : '');
      state.nativeConnected = false;
      state.lastNativeError = errorMsg;
      nativePort = null;
      console.log('Will retry connection in 5 seconds...');
      setTimeout(connectNativeHost, 5000);
    });

    console.log('Native messaging listeners registered');

  } catch (error) {
    console.error('Failed to connect to native host:', error);
    setTimeout(connectNativeHost, 5000);
  }
}

// Start native messaging connection
console.log('Starting native messaging connection...');
connectNativeHost();

console.log('Tab Agent service worker started');
