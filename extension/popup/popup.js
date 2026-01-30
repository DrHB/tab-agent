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
      if (response.nativeConnected) {
        statusEl.className = 'status connected';
        statusEl.textContent = 'Connected - Ready for commands';
      } else {
        statusEl.className = 'status disconnected';
        const errorMsg = response.lastNativeError || 'Native host not connected';
        statusEl.textContent = errorMsg;
        statusEl.title = errorMsg;
      }
    } else {
      throw new Error('No response');
    }
  } catch (error) {
    statusEl.className = 'status disconnected';
    statusEl.textContent = 'Extension error';
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
