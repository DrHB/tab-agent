// test/relay.test.js
// Handshake tests for the relay. The relay grants full control of the user's
// browser, so anything able to complete a handshake owns the session: these
// cover who is allowed to.
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const WebSocket = require('ws');

const PORT = 19876;
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;
const SERVER_PATH = path.join(__dirname, '..', 'relay', 'server.js');

let configPath;
let server;
let token;

/**
 * Resolve once the relay answers on its health endpoint.
 *
 * @param {number} attempts - Remaining polls, 50ms apart.
 * @returns {Promise<void>}
 */
function waitForServer(attempts = 100) {
  return new Promise((resolve, reject) => {
    const poll = (left) => {
      const req = http.get(HEALTH_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (left <= 0) {
          reject(new Error('Relay did not start'));
          return;
        }
        setTimeout(() => poll(left - 1), 50);
      });
    };
    poll(attempts);
  });
}

/**
 * Attempt a handshake and report how the relay answered.
 *
 * @param {Object<string, string>} headers - Headers to send with the upgrade.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
function handshake(headers) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`, { headers });
    ws.on('open', () => {
      ws.close();
      resolve({ ok: true });
    });
    ws.on('error', (error) => resolve({ ok: false, error: error.message }));
  });
}

before(async () => {
  configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tab-agent-test-')), 'config.json');

  server = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, PORT: String(PORT), TAB_AGENT_CONFIG: configPath },
    stdio: 'ignore'
  });

  await waitForServer();
  token = JSON.parse(fs.readFileSync(configPath, 'utf8')).token;
});

after(() => {
  if (server) server.kill();
});

test('generates a token readable by its owner only', () => {
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.strictEqual(fs.statSync(configPath).mode & 0o777, 0o600);
});

test('accepts a client presenting the token', async () => {
  const result = await handshake({ 'x-tab-agent-token': token });
  assert.strictEqual(result.ok, true);
});

test('rejects a client with no token', async () => {
  const result = await handshake({});
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /401/);
});

test('rejects a token of the right shape but the wrong value', async () => {
  const result = await handshake({ 'x-tab-agent-token': 'f'.repeat(token.length) });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /401/);
});

test('rejects a token of the wrong length without throwing', async () => {
  const result = await handshake({ 'x-tab-agent-token': 'short' });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /401/);
});

test('rejects a handshake coming from a web page', async () => {
  // A page cannot set headers on a WebSocket, but it always sends an Origin.
  const result = await handshake({
    'x-tab-agent-token': token,
    origin: 'https://evil.example'
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /403/);
});

test('is not reachable from outside loopback', async (t) => {
  const external = Object.values(os.networkInterfaces())
    .flat()
    .find((iface) => iface && iface.family === 'IPv4' && !iface.internal);

  if (!external) {
    t.skip('no non-loopback IPv4 address on this host');
    return;
  }

  // A refused connection and a silently dropped one are both fine; what must
  // not happen is a completed TCP handshake.
  const connected = await new Promise((resolve) => {
    const socket = net.connect({ host: external.address, port: PORT });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1000, () => finish(false));
    socket.on('connect', () => finish(true));
    socket.on('error', () => finish(false));
  });

  assert.strictEqual(connected, false);
});
