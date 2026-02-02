// relay/server.js
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 9876;

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      clients: wss.clients.size,
      browsers: {
        chrome: connections.chrome !== null,
        safari: connections.safari !== null
      }
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server: httpServer });

// Store extension connections by browser type
const connections = { chrome: null, safari: null };
const pendingRequests = new Map();

function safeParse(data, label) {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Invalid JSON from ${label}:`, error);
    return null;
  }
}

/**
 * Get the appropriate extension connection for routing.
 * @param {string} targetBrowser - Optional: 'chrome' or 'safari'
 * @returns {{ ws: WebSocket, browser: string } | null}
 */
function getExtensionConnection(targetBrowser) {
  // If specific browser requested, return it if connected
  if (targetBrowser) {
    const ws = connections[targetBrowser];
    if (ws) {
      return { ws, browser: targetBrowser };
    }
    return null;
  }

  // Auto-detect: if only one browser connected, use it
  const chromeConnected = connections.chrome !== null;
  const safariConnected = connections.safari !== null;

  if (chromeConnected && !safariConnected) {
    return { ws: connections.chrome, browser: 'chrome' };
  }
  if (safariConnected && !chromeConnected) {
    return { ws: connections.safari, browser: 'safari' };
  }
  if (chromeConnected && safariConnected) {
    // Default to chrome for backwards compatibility
    return { ws: connections.chrome, browser: 'chrome' };
  }

  return null;
}

/**
 * Fail pending requests, optionally filtered by browser.
 * @param {string} reason - Error message
 * @param {string} browser - Optional: only fail requests for this browser
 */
function failPendingRequests(reason, browser) {
  for (const [id, pending] of pendingRequests.entries()) {
    // If browser specified, only fail requests for that browser
    if (browser && pending.browser !== browser) {
      continue;
    }
    try {
      pending.ws.send(JSON.stringify({ id: pending.clientId, ok: false, error: reason }));
    } catch (error) {
      console.warn('Failed to notify pending request:', error);
    }
    pendingRequests.delete(id);
  }
}

wss.on('connection', (ws, req) => {
  const clientType = req.headers['x-client-type'];
  // 'extension' means chrome for backwards compatibility, 'safari' means safari
  const isExtension = clientType === 'extension' || clientType === 'safari';
  const browser = clientType === 'safari' ? 'safari' : 'chrome';

  if (isExtension) {
    console.log(`${browser} extension connected`);
    connections[browser] = ws;

    ws.on('message', (data) => {
      const message = safeParse(data, `${browser} extension`);
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
      console.log(`${browser} extension disconnected`);
      connections[browser] = null;
      failPendingRequests(`${browser} extension disconnected`, browser);
    });

  } else {
    console.log('Skill client connected');

    ws.on('message', async (data) => {
      const message = safeParse(data, 'client');
      if (!message || typeof message.id === 'undefined') {
        return;
      }
      const { id, browser: targetBrowser, ...command } = message;

      console.log(`Command: ${command.action}`, command);

      const connection = getExtensionConnection(targetBrowser);
      if (!connection) {
        const errorMsg = targetBrowser
          ? `${targetBrowser} extension not connected`
          : 'No extension connected';
        ws.send(JSON.stringify({ id, ok: false, error: errorMsg }));
        return;
      }

      const internalId = Date.now() + Math.random();
      pendingRequests.set(internalId, { ws, clientId: id, browser: connection.browser });

      connection.ws.send(JSON.stringify({ id: internalId, ...command }));
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
  console.log(`TabPilot Relay running on ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close();
  httpServer.close();
  process.exit(0);
});
