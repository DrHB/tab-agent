#!/usr/bin/env node
// native-host.js
const WebSocket = require('ws');
const fs = require('fs');

const LOG_PATH = process.env.TAB_AGENT_LOG || '';

function log(msg) {
  if (!LOG_PATH) return;
  try {
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
  } catch (error) {
    // Logging must never crash the host.
  }
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length, 0);
  process.stdout.write(length);
  process.stdout.write(json);
}

let inputBuffer = Buffer.alloc(0);
let ws = null;
let reconnectTimer = null;
let lastErrorAt = 0;

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  while (inputBuffer.length >= 4) {
    const length = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + length) break;

    let message = null;
    try {
      message = JSON.parse(inputBuffer.slice(4, 4 + length).toString());
    } catch (error) {
      sendMessage({ type: 'error', error: `Invalid message: ${error.message}` });
    }
    inputBuffer = inputBuffer.slice(4 + length);

    if (message) {
      handleMessage(message);
    }
  }
});

process.stdin.on('end', () => {
  log('stdin ended - extension disconnected');
  if (ws) {
    try {
      ws.close();
    } catch (error) {
      // Ignore shutdown errors.
    }
  }
  process.exit(0);
});

process.stdin.on('error', (err) => {
  log(`stdin error: ${err.message}`);
});

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, 1000);
}

function connectWebSocket() {
  try {
    ws = new WebSocket('ws://localhost:9876', {
      headers: {
        'x-client-type': 'chrome'
      }
    });
  } catch (error) {
    const now = Date.now();
    if (now - lastErrorAt > 2000) {
      lastErrorAt = now;
      sendMessage({ type: 'error', error: error.message });
    }
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    sendMessage({ type: 'connected' });
  });

  ws.on('message', (data) => {
    let message = null;
    try {
      message = JSON.parse(data);
    } catch (error) {
      sendMessage({ type: 'error', error: `Invalid relay message: ${error.message}` });
      return;
    }
    sendMessage({ type: 'command', ...message });
  });

  ws.on('error', (error) => {
    const now = Date.now();
    if (now - lastErrorAt > 2000) {
      lastErrorAt = now;
      sendMessage({ type: 'error', error: error.message });
    }
  });

  ws.on('close', () => {
    scheduleReconnect();
  });
}

function handleMessage(message) {
  if (message.type === 'response') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      sendMessage({ type: 'error', error: 'Relay not connected' });
    }
  }
}

connectWebSocket();
