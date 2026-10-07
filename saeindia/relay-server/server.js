import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { validateAuthToken, extractBearerToken } from './src/auth.js';
import {
  enqueueCommand,
  getCommand,
  pollForAgent,
  registerSseClient,
  ackCommand,
  updateAgentTelemetry,
  getCloudState
} from './src/commandStore.js';
import { openApiSpec } from './src/openapi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to compiled frontend dist directory
const distCandidates = [
  path.resolve(__dirname, '../dist'),
  path.resolve(__dirname, './dist'),
  path.resolve(process.cwd(), 'dist')
];
const DIST_PATH = distCandidates.find(p => fs.existsSync(p)) || null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

const PORT = process.env.PORT || 8443;

// Global relay state
let connectorSocket = null;
let esp32Online = false;
let esp32LastError = '';
const browserSockets = new Set();

let rxBytesTotal = 0;
let txBytesTotal = 0;
let packetsForwarded = 0;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 512 * 1024) { // 512KB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Malformed JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(data, null, 2));
}

// Create HTTP server for health checks, static frontend, REST API and WebSocket upgrades
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method;

  // Handle CORS preflight for all routes
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // =========================================================================
  // 1. OpenAPI Specification & Health Endpoints
  // =========================================================================
  if (pathname === '/api/v1/openapi.json') {
    return sendJson(res, 200, openApiSpec);
  }

  if (pathname === '/health') {
    const cloudRc = getCloudState();
    return sendJson(res, 200, {
      service: 'SAE INDIA MAVLink Secure WSS Relay & RC-Bridge API',
      status: 'ok',
      uptime: process.uptime(),
      mavlinkRelay: {
        connectorOnline: connectorSocket !== null && connectorSocket.readyState === WebSocket.OPEN,
        esp32Online,
        esp32LastError,
        browserClientsCount: browserSockets.size,
        rxBytesTotal,
        txBytesTotal,
        packetsForwarded
      },
      rcBridge: {
        agentOnline: cloudRc.agentOnline,
        agentLastSeenAgeMs: cloudRc.agentLastSeenAgeMs,
        activeCommandsCount: cloudRc.activeCommandsCount,
        totalCommandsProcessed: cloudRc.totalCommandsProcessed,
        lastCommand: cloudRc.lastCommand
      }
    });
  }

  // =========================================================================
  // 2. Cloud Command REST API (/api/v1/*)
  // =========================================================================
  if (pathname.startsWith('/api/v1/')) {
    // Authenticate all API requests
    const token = extractBearerToken(req) || reqUrl.searchParams.get('token');
    const authResult = validateAuthToken(token);
    if (!authResult.ok) {
      return sendJson(res, 401, { error: 'UNAUTHORIZED', message: authResult.error });
    }
    const operatorId = authResult.operatorId || 'operator';
    const clientIp = req.socket.remoteAddress || 'unknown';

    // POST /api/v1/command
    if (pathname === '/api/v1/command' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if (!body || !body.id || !body.type || !body.nonce || !body.issuedAt) {
          return sendJson(res, 400, { error: 'INVALID_COMMAND', message: 'Command must include id, type, nonce, issuedAt, and ttlMs' });
        }
        const result = enqueueCommand(body, operatorId, clientIp);
        if (result.error) {
          return sendJson(res, result.status || 400, { error: result.error, message: result.message });
        }
        return sendJson(res, 200, {
          status: result.record.status,
          command: result.record.command,
          createdAt: result.record.createdAt,
          idempotent: result.idempotent
        });
      } catch (err) {
        return sendJson(res, 400, { error: 'BAD_REQUEST', message: err.message });
      }
    }

    // GET /api/v1/command/:id
    if (pathname.startsWith('/api/v1/command/') && method === 'GET') {
      const commandId = pathname.replace('/api/v1/command/', '').trim();
      const record = getCommand(commandId);
      if (!record) {
        return sendJson(res, 404, { error: 'NOT_FOUND', message: `Command ${commandId} not found` });
      }
      return sendJson(res, 200, record);
    }

    // GET /api/v1/agent/poll
    if (pathname === '/api/v1/agent/poll' && method === 'GET') {
      try {
        const timeoutMs = Math.min(parseInt(reqUrl.searchParams.get('timeout') || '25000', 10), 30000);
        const pollResult = await pollForAgent(timeoutMs);
        return sendJson(res, 200, pollResult);
      } catch (err) {
        return sendJson(res, 500, { error: 'POLL_ERROR', message: err.message });
      }
    }

    // GET /api/v1/agent/stream (SSE)
    if (pathname === '/api/v1/agent/stream' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': connected\n\n');
      registerSseClient(res);
      return;
    }

    // POST /api/v1/agent/ack
    if (pathname === '/api/v1/agent/ack' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if (!body || !body.commandId || !body.status) {
          return sendJson(res, 400, { error: 'INVALID_ACK', message: 'Ack payload requires commandId and status' });
        }
        const result = ackCommand(body);
        if (result.error) {
          return sendJson(res, result.status || 400, { error: result.error, message: result.message });
        }
        return sendJson(res, 200, { ok: true, status: result.record.status });
      } catch (err) {
        return sendJson(res, 400, { error: 'BAD_REQUEST', message: err.message });
      }
    }

    // POST /api/v1/agent/telemetry
    if (pathname === '/api/v1/agent/telemetry' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if (!body || !Array.isArray(body.channels) || body.channels.length !== 16) {
          return sendJson(res, 400, { error: 'INVALID_TELEMETRY', message: 'Telemetry requires 16-channel array' });
        }
        updateAgentTelemetry(body);
        return sendJson(res, 200, { ok: true, timestamp: Date.now() });
      } catch (err) {
        return sendJson(res, 400, { error: 'BAD_REQUEST', message: err.message });
      }
    }

    // GET /api/v1/state
    if (pathname === '/api/v1/state' && method === 'GET') {
      return sendJson(res, 200, getCloudState());
    }

    return sendJson(res, 404, { error: 'ENDPOINT_NOT_FOUND', message: `Unknown API endpoint: ${pathname}` });
  }

  // =========================================================================
  // 3. Static Frontend Serving (SPA fallback)
  // =========================================================================
  if (DIST_PATH) {
    let reqPath = pathname || '/';
    let safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(DIST_PATH, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SPA fallback: return index.html for client-side routing
    const indexPath = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  if (pathname === '/') {
    return sendJson(res, 200, {
      service: 'SAE INDIA MAVLink Secure WSS Relay & RC-Bridge API',
      status: 'ok',
      uptime: process.uptime()
    });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ noServer: true });

function broadcastStatusToBrowsers() {
  const statusMsg = JSON.stringify({
    type: 'RELAY_STATUS',
    connectorOnline: connectorSocket !== null && connectorSocket.readyState === WebSocket.OPEN,
    esp32Online: connectorSocket !== null && connectorSocket.readyState === WebSocket.OPEN && esp32Online,
    error: connectorSocket === null 
      ? 'ESP32 connector offline' 
      : (!esp32Online ? (esp32LastError || 'ESP32 unavailable') : null)
  });

  for (const client of browserSockets) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(statusMsg);
      } catch (err) {}
    }
  }
}

// Upgrade handler with token authentication and routing
server.on('upgrade', (request, socket, head) => {
  const reqUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const token = reqUrl.searchParams.get('token') || request.headers['x-relay-token'];

  // Route: /connector (for ESP32 and local connector agent - protected by token)
  if (pathname === '/connector') {
    const auth = validateAuthToken(token);
    if (!auth.ok) {
      console.warn(`[AUTH FAILED] Unauthorized ESP32/connector attempt from ${request.socket.remoteAddress}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      handleConnectorConnection(ws);
    });
    return;
  }

  // Route: /ws or / (for frontend browser client - always allow dashboard viewer)
  if (pathname === '/ws' || pathname === '/') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleBrowserConnection(ws);
    });
    return;
  }

  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// Handle Local Connector Agent connection
function handleConnectorConnection(ws) {
  console.log('[CONNECTOR] Local connector connected successfully.');
  
  if (connectorSocket && connectorSocket !== ws) {
    console.warn('[CONNECTOR] Replacing existing connector instance.');
    try {
      connectorSocket.close(1000, 'Superseded by new connector');
    } catch (e) {}
  }

  connectorSocket = ws;
  esp32Online = true;
  esp32LastError = '';

  broadcastStatusToBrowsers();

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      if (!esp32Online) {
        esp32Online = true;
        broadcastStatusToBrowsers();
      }
      rxBytesTotal += data.length;
      packetsForwarded++;
      for (const browser of browserSockets) {
        if (browser.readyState === WebSocket.OPEN) {
          try {
            browser.send(data, { binary: true });
          } catch (e) {
            console.error('[FORWARD ERROR] Failed to send to browser:', e);
          }
        }
      }
    } else {
      try {
        const text = data.toString();
        const msg = JSON.parse(text);
        if (msg.type === 'ESP32_STATUS') {
          esp32Online = msg.status === 'CONNECTED';
          esp32LastError = msg.error || '';
          console.log(`[CONNECTOR REPORT] ESP32 status changed to: ${msg.status} ${esp32LastError ? `(${esp32LastError})` : ''}`);
          broadcastStatusToBrowsers();
        }
      } catch (err) {
        console.warn('[CONNECTOR] Non-JSON text message received:', data.toString());
      }
    }
  });

  ws.on('close', (code, reason) => {
    console.warn(`[CONNECTOR] Local connector disconnected (${code}: ${reason || 'No reason'}).`);
    if (connectorSocket === ws) {
      connectorSocket = null;
      esp32Online = false;
      esp32LastError = 'ESP32 connector offline';
      broadcastStatusToBrowsers();
    }
  });

  ws.on('error', (err) => {
    console.error('[CONNECTOR ERROR]', err.message);
  });
}

// Handle Browser Frontend connection
function handleBrowserConnection(ws) {
  browserSockets.add(ws);

  const initialStatus = JSON.stringify({
    type: 'RELAY_STATUS',
    connectorOnline: connectorSocket !== null && connectorSocket.readyState === WebSocket.OPEN,
    esp32Online: connectorSocket !== null && connectorSocket.readyState === WebSocket.OPEN && esp32Online,
    error: connectorSocket === null 
      ? 'ESP32 connector offline' 
      : (!esp32Online ? (esp32LastError || 'ESP32 unavailable') : null)
  });
  ws.send(initialStatus);

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      txBytesTotal += data.length;
      if (connectorSocket && connectorSocket.readyState === WebSocket.OPEN) {
        try {
          connectorSocket.send(data, { binary: true });
        } catch (err) {
          console.error('[FORWARD ERROR] Failed to send to connector:', err);
        }
      }
    } else {
      for (const client of browserSockets) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          try {
            client.send(data);
          } catch (e) {}
        }
      }
    }
  });

  ws.on('close', () => {
    browserSockets.delete(ws);
  });

  ws.on('error', (err) => {
    browserSockets.delete(ws);
  });
}

// Keepalive heartbeat
setInterval(() => {
  if (connectorSocket && connectorSocket.readyState === WebSocket.OPEN) {
    try {
      connectorSocket.ping();
    } catch (e) {}
  }
  for (const client of browserSockets) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.ping();
      } catch (e) {}
    }
  }
}, 25000);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SAE INDIA SECURE RELAY & RC-BRIDGE API RUNNING`);
  console.log(`📡 Port:               ${PORT}`);
  console.log(`🌐 Browser Endpoint:   /ws`);
  console.log(`🔌 Connector Endpoint: /connector`);
  console.log(`🎮 RC Command API:     /api/v1/command`);
  console.log(`📖 OpenAPI Spec:       http://localhost:${PORT}/api/v1/openapi.json`);
  console.log(`❤️  Health Check:       http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});
