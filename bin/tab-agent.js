#!/usr/bin/env node
const command = process.argv[2];
const hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h');

// Commands that go to the command module
const BROWSER_COMMANDS = ['tabs', 'snapshot', 'screenshot', 'click', 'type', 'fill', 'press', 'scroll', 'navigate', 'wait', 'evaluate', 'hover', 'select', 'drag', 'get', 'find', 'cookies', 'storage', 'pdf'];

if (command === '-v' || command === '--version') {
  console.log(require('../package.json').version);
  process.exit(0);
}

if (BROWSER_COMMANDS.includes(command)) {
  const { runCommand } = require('../cli/command.js');
  runCommand(process.argv.slice(2));
} else {
  if (hasHelpFlag) {
    showHelp(0);
  }
  switch (command) {
    case 'setup':
      require('../cli/setup.js');
      break;
    case 'start':
      require('../cli/start.js');
      break;
    case 'status':
      require('../cli/status.js');
      break;
    default:
      showHelp();
  }
}

function showHelp(exitCode = null) {
  console.log(`
tab-agent - Give LLMs full control of your browser

Setup:
  setup    Auto-detect extension, configure native messaging
  start    Start the relay server
  status   Check configuration

Browser Control:
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
  hover <ref>               Hover over element
  select <ref> <value>      Select dropdown option
  drag <from> <to>          Drag element to another
  get <prop> [ref] [attr]   Get text, value, attr, url, title
  find <by> <query>         Find by text, role, label, placeholder, selector
  cookies <get|clear>       View or clear cookies
  storage <get|set|remove|rm|clear> Manage localStorage/sessionStorage
  pdf [filename.pdf]        Save page as PDF

Workflow: snapshot → click/type → snapshot → repeat

Examples:
  npx tab-agent setup
  npx tab-agent snapshot
  npx tab-agent click e5
  npx tab-agent type e3 "hello world"
  npx tab-agent navigate "https://google.com"

Version: ${require('../package.json').version}
`);
  if (typeof exitCode === 'number') {
    process.exit(exitCode);
  }
  if (command && command !== 'help' && command !== '--help' && command !== '-h') {
    process.exit(1);
  }
}
