// cli/command.js
const WebSocket = require('ws');

const COMMANDS = ['tabs', 'snapshot', 'screenshot', 'click', 'type', 'fill', 'press', 'scroll', 'navigate', 'wait', 'evaluate', 'hover', 'select', 'drag', 'get', 'find', 'cookies', 'storage', 'pdf'];

async function runCommand(args) {
  // Extract --browser flag
  let targetBrowser = null;
  const browserFlagIndex = args.findIndex(a => a === '--browser' || a.startsWith('--browser='));
  if (browserFlagIndex !== -1) {
    const flag = args[browserFlagIndex];
    if (flag.includes('=')) {
      targetBrowser = flag.split('=')[1];
    } else if (args[browserFlagIndex + 1]) {
      targetBrowser = args[browserFlagIndex + 1];
      args.splice(browserFlagIndex + 1, 1);
    }
    args.splice(browserFlagIndex, 1);
  }

  const [command, ...params] = args;

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available: ${COMMANDS.join(', ')}`);
    process.exit(1);
  }

  const ws = new WebSocket('ws://localhost:9876');

  const timeout = setTimeout(() => {
    console.error('Connection timeout - is the relay running? Try: npx tab-agent start');
    ws.close();
    process.exit(1);
  }, 5000);

  ws.on('error', (err) => {
    clearTimeout(timeout);
    console.error('Connection failed:', err.message);
    console.error('Make sure relay is running: npx tab-agent start');
    process.exit(1);
  });

  ws.on('open', () => {
    clearTimeout(timeout);

    // First get tabs to find tabId
    if (command === 'tabs') {
      ws.send(JSON.stringify({ id: 1, action: 'tabs', browser: targetBrowser }));
    } else {
      // Get active tab first, then run command
      ws.send(JSON.stringify({ id: 0, action: 'tabs', browser: targetBrowser }));
    }
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    // Handle tabs response
    if (msg.id === 0) {
      if (!msg.tabs || msg.tabs.length === 0) {
        console.error('No active tabs. Click Tab Agent icon on a tab to activate it.');
        ws.close();
        process.exit(1);
      }

      const tabId = msg.tabs[0].tabId;
      const payload = buildPayload(command, params, tabId);
      ws.send(JSON.stringify({ id: 1, ...payload, browser: targetBrowser }));
      return;
    }

    // Handle command response
    if (msg.id === 1) {
      if (command === 'tabs') {
        printTabs(msg);
      } else if (command === 'snapshot') {
        printSnapshot(msg);
      } else if (command === 'screenshot') {
        printScreenshot(msg);
      } else if (command === 'pdf') {
        printPdf(msg);
      } else if (command === 'find') {
        printFind(msg);
      } else {
        printResult(msg);
      }
      ws.close();
      process.exit(msg.ok ? 0 : 1);
    }
  });
}

function buildPayload(command, params, tabId) {
  const payload = { action: command, tabId };

  switch (command) {
    case 'click':
      payload.ref = params[0];
      break;
    case 'type':
      payload.ref = params[0];
      payload.text = params.slice(1).join(' ');
      if (params.includes('--submit')) {
        payload.submit = true;
        payload.text = payload.text.replace('--submit', '').trim();
      }
      break;
    case 'fill':
      payload.ref = params[0];
      payload.value = params.slice(1).join(' ');
      break;
    case 'press':
      payload.key = params[0];
      break;
    case 'scroll':
      payload.direction = params[0] || 'down';
      payload.amount = parseInt(params[1]) || 500;
      break;
    case 'navigate':
      payload.url = params[0];
      break;
    case 'wait':
      if (params[0] === '--url') {
        payload.urlPattern = params[1];
      } else if (params[0] === '--visible') {
        payload.visibleRef = params[1];
      } else if (params[0]?.startsWith('.') || params[0]?.startsWith('#')) {
        payload.selector = params[0];
      } else {
        payload.text = params.filter(p => !/^\d+$/.test(p)).join(' ');
      }
      payload.timeout = parseInt(params.find(p => /^\d+$/.test(p))) || 5000;
      break;
    case 'evaluate':
      payload.script = params.join(' ');
      break;
    case 'screenshot':
      if (params.includes('--full') || params.includes('--fullPage')) {
        payload.fullPage = true;
      }
      break;
    case 'hover':
      payload.ref = params[0];
      break;
    case 'select':
      payload.ref = params[0];
      payload.value = params.slice(1).join(' ');
      break;
    case 'drag':
      payload.fromRef = params[0];
      payload.toRef = params[1];
      break;
    case 'get':
      payload.subcommand = params[0]; // text, html, value, attr, url, title
      payload.ref = params[1];
      payload.attr = params[2]; // for get attr <ref> <name>
      break;
    case 'find':
      payload.by = params[0]; // text, role, label, placeholder, selector
      payload.query = params.slice(1).join(' ');
      break;
    case 'cookies':
      payload.subcommand = params[0]; // get, clear
      break;
    case 'storage':
      payload.subcommand = params[0]; // get, set, remove, clear
      payload.storageType = params.includes('--session') ? 'session' : 'local';
      // Filter out --session flag
      const storageParams = params.filter(p => p !== '--session');
      payload.key = storageParams[1];
      payload.value = storageParams.slice(2).join(' ');
      break;
    case 'pdf':
      break;
  }

  return payload;
}

function printHelp() {
  console.log(`
tab-agent - Give LLMs full control of your browser

Usage: npx tab-agent <command> [options]

Commands:
  snapshot                  Get page content with refs [e1], [e2]...
  click <ref>               Click element (e.g., click e5)
  type <ref> <text>         Type into element
  fill <ref> <value>        Fill form field
  press <key>               Press key (Enter, Escape, Tab)
  scroll <dir> [amount]     Scroll up/down
  navigate <url>            Go to URL
  tabs                      List active tabs
  wait <text|selector>      Wait for text or element
  screenshot [--full]       Capture page (fallback)
  evaluate <script>         Run JavaScript
  hover <ref>               Hover over element
  select <ref> <value>      Select dropdown option
  drag <from> <to>          Drag element to another
  get <prop> [ref] [attr]   Get text, value, attr, url, title
  find <by> <query>         Find by text, role, label, placeholder, selector
  cookies <get|clear>       View or clear cookies
  storage <get|set|rm|clear> Manage localStorage/sessionStorage
  pdf [filename.pdf]        Save page as PDF

Options:
  --browser=<chrome|safari>   Target specific browser

Workflow: snapshot → click/type → snapshot → repeat

Examples:
  npx tab-agent snapshot
  npx tab-agent click e5
  npx tab-agent get text e3
  npx tab-agent find text "Submit"
  npx tab-agent find role button
  npx tab-agent pdf page.pdf
  npx tab-agent drag e1 e5
  npx tab-agent hover e3
  npx tab-agent select e7 "Option 2"
  npx tab-agent cookies get
  npx tab-agent storage get myKey
`);
}

function printTabs(msg) {
  if (!msg.ok) {
    console.error('Error:', msg.error);
    return;
  }
  console.log('Active tabs:\n');
  msg.tabs.forEach((tab, i) => {
    const browserTag = tab.browser ? `[${tab.browser}] ` : '';
    console.log(`  ${i + 1}. ${browserTag}[${tab.tabId}] ${tab.title}`);
    console.log(`     ${tab.url}\n`);
  });
}

function printSnapshot(msg) {
  if (!msg.ok) {
    console.error('Error:', msg.error);
    return;
  }
  console.log(msg.snapshot);
}

function printScreenshot(msg) {
  if (!msg.ok) {
    console.error('Error:', msg.error);
    return;
  }
  // Output base64 directly - no file, no auto-open
  console.log(msg.screenshot);
}

function printPdf(msg) {
  if (!msg.ok) {
    console.error('Error:', msg.error);
    return;
  }
  // Check if a filename was given via params
  const outFile = process.argv.find(a => a.endsWith('.pdf'));
  if (outFile) {
    require('fs').writeFileSync(outFile, Buffer.from(msg.pdf, 'base64'));
    console.log(`PDF saved to ${outFile}`);
  } else {
    console.log(msg.pdf);
  }
}

function printFind(msg) {
  if (!msg.ok) {
    console.error('Error:', msg.error);
    return;
  }
  if (msg.results.length === 0) {
    console.log('No matches found.');
    return;
  }
  console.log(`Found ${msg.count} match${msg.count !== 1 ? 'es' : ''}:\n`);
  msg.results.forEach(r => {
    console.log(`  [${r.ref}] ${r.role} "${r.name}"`);
  });
}

function printResult(msg) {
  if (!msg.ok) {
    console.error('Error:', msg.error);
    return;
  }
  console.log('OK');
  if (msg.result !== undefined) {
    console.log('Result:', msg.result);
  }
}

module.exports = { runCommand };
