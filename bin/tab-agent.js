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
tab-agent - Browser control for Claude/Codex

Setup Commands:
  setup    Auto-detect extension, register native host, install skills
  start    Start the relay server
  status   Check configuration status

Browser Commands:
  tabs                      List active tabs
  snapshot                  Get AI-readable page content
  screenshot [--full]       Capture screenshot
  click <ref>               Click element (e.g., click e5)
  type <ref> <text>         Type text into element
  fill <ref> <value>        Fill form field
  press <key>               Press key (Enter, Escape, etc.)
  scroll <dir> [amount]     Scroll up/down
  navigate <url>            Go to URL
  wait <text|selector>      Wait for text or element
  evaluate <script>         Run JavaScript

Examples:
  npx tab-agent setup
  npx tab-agent snapshot
  npx tab-agent click e5
  npx tab-agent type e3 "hello world"

Version: ${require('../package.json').version}
`);
  if (command && command !== 'help' && command !== '--help' && command !== '-h') {
    process.exit(1);
  }
}
