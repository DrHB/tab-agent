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
