// relay/server.js
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 9876;

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server: httpServer });

// Store extension connection
let extensionConnection = null;
const pendingRequests = new Map();

function safeParse(data, label) {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Invalid JSON from ${label}:`, error);
    return null;
  }
}

function failPendingRequests(reason) {
  for (const [id, pending] of pendingRequests.entries()) {
    try {
      pending.ws.send(JSON.stringify({ id: pending.clientId, ok: false, error: reason }));
    } catch (error) {
      console.warn('Failed to notify pending request:', error);
    }
    pendingRequests.delete(id);
  }
}

wss.on('connection', (ws, req) => {
  const isExtension = req.headers['x-client-type'] === 'extension';

  if (isExtension) {
    console.log('Extension connected');
    extensionConnection = ws;

    ws.on('message', (data) => {
      const message = safeParse(data, 'extension');
      if (!message || typeof message.id === 'undefined') {
        return;
      }
      const { id, ...response } = message;

      const pending = pendingRequests.get(id);
      if (pending) {
        pending.ws.send(JSON.stringify({ id: pending.clientId, ...response }));
        pendingRequests.delete(id);
      }
    });

    ws.on('close', () => {
      console.log('Extension disconnected');
      extensionConnection = null;
      failPendingRequests('Extension disconnected');
    });

  } else {
    console.log('Skill client connected');

    ws.on('message', async (data) => {
      const message = safeParse(data, 'client');
      if (!message || typeof message.id === 'undefined') {
        return;
      }
      const { id, ...command } = message;

      console.log(`Command: ${command.action}`, command);

      if (!extensionConnection) {
        ws.send(JSON.stringify({ id, ok: false, error: 'Extension not connected' }));
        return;
      }

      const internalId = Date.now() + Math.random();
      pendingRequests.set(internalId, { ws, clientId: id });

      extensionConnection.send(JSON.stringify({ id: internalId, ...command }));
    });

    ws.on('close', () => {
      console.log('Skill client disconnected');
      for (const [id, pending] of pendingRequests.entries()) {
        if (pending.ws === ws) {
          pendingRequests.delete(id);
        }
      }
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`BrowserAgent Relay running on ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close();
  httpServer.close();
  process.exit(0);
});
