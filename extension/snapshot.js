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
