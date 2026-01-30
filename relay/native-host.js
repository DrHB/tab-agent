#!/usr/bin/env node
// native-host.js
const WebSocket = require('ws');

function sendMessage(message) {
  const json = JSON.stringify(message);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length, 0);
  process.stdout.write(length);
  process.stdout.write(json);
}

let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  while (inputBuffer.length >= 4) {
    const length = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + length) break;

    const message = JSON.parse(inputBuffer.slice(4, 4 + length).toString());
    inputBuffer = inputBuffer.slice(4 + length);

    handleMessage(message);
  }
});

const ws = new WebSocket('ws://localhost:9876', {
  headers: { 'x-client-type': 'extension' }
});

ws.on('open', () => {
  sendMessage({ type: 'connected' });
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  sendMessage({ type: 'command', ...message });
});

ws.on('error', (error) => {
  sendMessage({ type: 'error', error: error.message });
});

ws.on('close', () => {
  process.exit(0);
});

function handleMessage(message) {
  if (message.type === 'response') {
    ws.send(JSON.stringify(message));
  }
}
