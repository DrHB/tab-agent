// content-script.js
// Handles commands from service worker and executes DOM actions

if (window.__tabAgent_contentScriptLoaded) {
  console.log('Tab Agent content script already loaded');
} else {
  window.__tabAgent_contentScriptLoaded = true;

  const snapshotState = (() => {
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

    function getElementByRef(ref) {
      return refMap.get(ref);
    }

    function getRole(element) {
      const explicitRole = element.getAttribute('role');
      if (explicitRole) return explicitRole;

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
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;

      const ariaLabelledBy = element.getAttribute('aria-labelledby');
      if (ariaLabelledBy) {
        const labelEl = document.getElementById(ariaLabelledBy);
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

    function getDirectText(element) {
      let text = '';
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      }
      return text.trim();
    }

    function buildSnapshot(element, depth = 0, maxDepth = 15) {
      if (depth > maxDepth) return [];
      if (!isVisible(element)) return [];

      const lines = [];
      const role = getRole(element);
      const name = getName(element);
      const interactive = isInteractive(element);

      const includedRoles = [
        'link', 'button', 'textbox', 'checkbox', 'radio', 'combobox',
        'heading', 'img', 'navigation', 'main', 'form', 'listitem',
        'tab', 'tabpanel', 'menu', 'menuitem', 'dialog', 'alert',
        'article', 'paragraph'
      ];

      // Check for data-testid (useful for Twitter/X)
      const testId = element.getAttribute('data-testid');
      const isTweet = testId && (testId.includes('tweet') || testId.includes('tweetText'));

      // Get direct text content for text-heavy elements
      const directText = getDirectText(element);
      const hasSignificantText = directText.length > 20;

      const shouldInclude = includedRoles.includes(role) || interactive || isTweet || hasSignificantText;

      if (shouldInclude && (name || interactive || directText || isTweet)) {
        const ref = nextRef();
        storeRef(ref, element);

        let line = `[${ref}] ${role}`;
        if (isTweet) {
          line = `[${ref}] tweet`;
        }

        const displayText = name || directText;
        if (displayText) {
          line += ` "${displayText.substring(0, 200).replace(/\n/g, ' ')}"`;
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

    function snapshot() {
      resetRefs();

      const lines = ['== Page Snapshot ==', `URL: ${window.location.href}`, `Title: ${document.title}`, ''];
      const root = document.body || document.documentElement;
      if (root) {
        lines.push(...buildSnapshot(root));
      }

      // Special handling for Twitter/X - find tweets by data-testid
      const tweetElements = document.querySelectorAll('[data-testid="tweet"], [data-testid="tweetText"], article[role="article"]');
      if (tweetElements.length > 0) {
        lines.push('');
        lines.push('== Tweets ==');
        tweetElements.forEach((el, i) => {
          const ref = nextRef();
          storeRef(ref, el);

          // Get tweet text content
          const tweetText = el.querySelector('[data-testid="tweetText"]');
          const text = tweetText ? tweetText.textContent.trim() : el.textContent.trim();

          // Get author if available
          const authorLink = el.querySelector('a[href^="/"][role="link"]');
          const author = authorLink ? authorLink.textContent : '';

          if (text && text.length > 10) {
            const cleanText = text.substring(0, 300).replace(/\n+/g, ' ').replace(/\s+/g, ' ');
            lines.push(`[${ref}] tweet ${author ? 'by ' + author + ': ' : ''}"${cleanText}"`);
          }
        });
      }

      return {
        url: window.location.href,
        title: document.title,
        snapshot: lines.join('\n'),
        refCount: refCounter,
      };
    }

    return { getElementByRef, snapshot, isVisible, getRole, getName, nextRef, storeRef };
  })();

  function getElementByRef(ref) {
    return snapshotState.getElementByRef(ref);
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
    const { ref, text, submit = false } = params;
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

    // Handle submit if requested
    if (submit) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

      // Also try form submit
      const form = element.closest('form');
      if (form) form.requestSubmit();
    }

    return { ok: true, ref, typed: text, submitted: submit };
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
    const target = document.activeElement || document.body;

    if (!target) {
      return { ok: false, error: 'No active element to receive keypress' };
    }

    target.dispatchEvent(new KeyboardEvent('keydown', { ...keyInfo, bubbles: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { ...keyInfo, bubbles: true }));

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

  // Wait for condition (text, selector, url pattern, or visible ref)
  async function executeWait(params) {
    const { text, selector, urlPattern, visibleRef, timeout = 30000 } = params;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (text && document.body.innerText.includes(text)) {
        return { ok: true, found: 'text' };
      }
      if (selector && document.querySelector(selector)) {
        return { ok: true, found: 'selector' };
      }
      if (urlPattern && window.location.href.includes(urlPattern)) {
        return { ok: true, found: 'url', url: window.location.href };
      }
      if (visibleRef) {
        const el = getElementByRef(visibleRef);
        if (el && snapshotState.isVisible(el)) {
          return { ok: true, found: 'visible', ref: visibleRef };
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return { ok: false, error: 'Timeout waiting for condition' };
  }

  // Scroll element into view
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

  // Batch fill multiple fields
  async function executeBatchFill(params) {
    const { fields } = params;
    const results = [];

    for (const field of fields) {
      const result = await executeFill({ ref: field.ref, value: field.value });
      results.push({ ref: field.ref, ...result });
    }

    return { ok: results.every(r => r.ok), results };
  }

  async function executeDrag(params) {
    const { fromRef, toRef } = params;
    const fromEl = getElementByRef(fromRef);
    const toEl = getElementByRef(toRef);

    if (!fromEl) return { ok: false, error: `Element ${fromRef} not found` };
    if (!toEl) return { ok: false, error: `Element ${toRef} not found` };

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const fromX = fromRect.left + fromRect.width / 2;
    const fromY = fromRect.top + fromRect.height / 2;
    const toX = toRect.left + toRect.width / 2;
    const toY = toRect.top + toRect.height / 2;

    fromEl.dispatchEvent(new MouseEvent('mousedown', { clientX: fromX, clientY: fromY, bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    fromEl.dispatchEvent(new MouseEvent('mousemove', { clientX: fromX + 5, clientY: fromY + 5, bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    toEl.dispatchEvent(new MouseEvent('mousemove', { clientX: toX, clientY: toY, bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    toEl.dispatchEvent(new MouseEvent('mouseup', { clientX: toX, clientY: toY, bubbles: true }));

    // Also fire dragstart/drop for HTML5 drag-and-drop
    fromEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
    toEl.dispatchEvent(new DragEvent('drop', { bubbles: true }));
    fromEl.dispatchEvent(new DragEvent('dragend', { bubbles: true }));

    return { ok: true, from: fromRef, to: toRef };
  }

  async function executeGet(params) {
    const { subcommand, ref, attr } = params;

    if (subcommand === 'url') return { ok: true, result: window.location.href };
    if (subcommand === 'title') return { ok: true, result: document.title };

    if (!ref) return { ok: false, error: 'No ref provided' };
    const element = getElementByRef(ref);
    if (!element) return { ok: false, error: `Element ${ref} not found` };

    switch (subcommand) {
      case 'text':
        return { ok: true, result: element.textContent.trim() };
      case 'html':
        return { ok: true, result: element.innerHTML };
      case 'value':
        return { ok: true, result: element.value || '' };
      case 'attr':
        return { ok: true, result: element.getAttribute(attr) };
      default:
        return { ok: false, error: `Unknown get subcommand: ${subcommand}` };
    }
  }

  async function executeFind(params) {
    const { by, query } = params;
    const results = [];

    const matches = [];
    if (by === 'text') {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode()) {
        const el = walker.currentNode;
        if (el.textContent.trim().toLowerCase().includes(query.toLowerCase()) && snapshotState.isVisible(el)) {
          matches.push(el);
          if (matches.length >= 20) break;
        }
      }
    } else if (by === 'role') {
      const els = document.querySelectorAll(`[role="${query}"]`);
      const tagRoles = { button: 'button', a: 'link', input: 'textbox', textarea: 'textbox', select: 'combobox', img: 'img' };
      const tagMatch = Object.entries(tagRoles).find(([, r]) => r === query);
      if (tagMatch) {
        document.querySelectorAll(tagMatch[0]).forEach(el => { if (snapshotState.isVisible(el)) matches.push(el); });
      }
      els.forEach(el => { if (snapshotState.isVisible(el) && !matches.includes(el)) matches.push(el); });
    } else if (by === 'label') {
      const labels = document.querySelectorAll('label');
      labels.forEach(label => {
        if (label.textContent.trim().toLowerCase().includes(query.toLowerCase())) {
          const input = label.control || (label.htmlFor && document.getElementById(label.htmlFor));
          if (input) matches.push(input);
        }
      });
      // Also search aria-label
      document.querySelectorAll(`[aria-label*="${query}" i]`).forEach(el => {
        if (!matches.includes(el)) matches.push(el);
      });
    } else if (by === 'placeholder') {
      document.querySelectorAll(`[placeholder*="${query}" i]`).forEach(el => matches.push(el));
    } else if (by === 'selector') {
      document.querySelectorAll(query).forEach(el => { if (snapshotState.isVisible(el)) matches.push(el); });
    } else {
      return { ok: false, error: `Unknown find method: ${by}` };
    }

    // Assign refs to found elements
    for (const el of matches.slice(0, 20)) {
      const ref = snapshotState.nextRef();
      snapshotState.storeRef(ref, el);
      const role = snapshotState.getRole(el);
      const name = snapshotState.getName(el);
      results.push({ ref, role, name: name.substring(0, 100) });
    }

    return { ok: true, results, count: results.length };
  }

  async function executeCookies(params) {
    const { subcommand } = params;

    if (subcommand === 'get') {
      return { ok: true, result: document.cookie };
    } else if (subcommand === 'clear') {
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      return { ok: true, cleared: true };
    } else {
      return { ok: false, error: `Unknown cookies subcommand: ${subcommand}` };
    }
  }

  async function executeStorage(params) {
    const { subcommand, storageType = 'local', key, value } = params;
    const store = storageType === 'session' ? sessionStorage : localStorage;

    switch (subcommand) {
      case 'get':
        if (key) return { ok: true, result: store.getItem(key) };
        const all = {};
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          all[k] = store.getItem(k);
        }
        return { ok: true, result: all };
      case 'set':
        store.setItem(key, value);
        return { ok: true, key, value };
      case 'remove':
        store.removeItem(key);
        return { ok: true, removed: key };
      case 'clear':
        store.clear();
        return { ok: true, cleared: true };
      default:
        return { ok: false, error: `Unknown storage subcommand: ${subcommand}` };
    }
  }

  async function executeNavigate(params) {
    const { url } = params;
    window.location.href = url;
    return { ok: true, url };
  }

  async function getSnapshot() {
    return { ok: true, ...snapshotState.snapshot() };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, ...params } = message;

    (async () => {
      let result;

      switch (action) {
        case '__ping':
          result = { ok: true };
          break;
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
        case 'wait':
          result = await executeWait(params);
          break;
        case 'scrollintoview':
          result = await executeScrollIntoView(params);
          break;
        case 'batchfill':
          result = await executeBatchFill(params);
          break;
        case 'navigate':
          result = await executeNavigate(params);
          break;
        case 'drag':
          result = await executeDrag(params);
          break;
        case 'get':
          result = await executeGet(params);
          break;
        case 'find':
          result = await executeFind(params);
          break;
        case 'cookies':
          result = await executeCookies(params);
          break;
        case 'storage':
          result = await executeStorage(params);
          break;
        default:
          result = { ok: false, error: `Unknown action: ${action}` };
      }

      sendResponse(result);
    })();

    return true;
  });

  console.log('Tab Agent content script loaded');
}
