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
