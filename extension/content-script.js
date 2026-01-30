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

    return { getElementByRef, snapshot };
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
}
