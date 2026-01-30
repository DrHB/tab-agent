#!/usr/bin/env node
const command = process.argv[2];

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
    console.log(`
tab-agent - Browser control for Claude/Codex

Commands:
  setup   Auto-detect extension, register native host, install skills
  start   Start the relay server
  status  Check configuration status

Usage:
  npx tab-agent setup
  npx tab-agent start
`);
}
