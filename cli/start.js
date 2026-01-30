// cli/start.js
const path = require('path');
const { spawn } = require('child_process');

const serverPath = path.join(__dirname, '..', 'relay', 'server.js');
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  detached: false
});

server.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});
