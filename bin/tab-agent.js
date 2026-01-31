#!/usr/bin/env node
const command = process.argv[2];

// Commands that go to the command module
const BROWSER_COMMANDS = ['tabs', 'snapshot', 'screenshot', 'click', 'type', 'fill', 'press', 'scroll', 'navigate', 'wait', 'evaluate'];

if (command === '-v' || command === '--version') {
  console.log(require('../package.json').version);
  process.exit(0);
}

if (BROWSER_COMMANDS.includes(command)) {
  const { runCommand } = require('../cli/command.js');
  runCommand(process.argv.slice(2));
} else {
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

function showHelp() {
  console.log(`
web-agent - Give LLMs full control of your browser

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

Workflow: snapshot → click/type → snapshot → repeat

Examples:
  npx web-agent setup
  npx web-agent snapshot
  npx web-agent click e5
  npx web-agent type e3 "hello world"
  npx web-agent navigate "https://google.com"

Version: ${require('../package.json').version}
`);
  if (command && command !== 'help' && command !== '--help' && command !== '-h') {
    process.exit(1);
  }
}
