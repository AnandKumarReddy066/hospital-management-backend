/**
 * websocket/wsServer.js
 * WebSocket server built on the 'ws' library.
 * Supports per-user room-style messaging using userId as the room key.
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// userId → Set<WebSocket> mapping
const clients = new Map();

let wss;

/**
 * initWebSocket — Attaches the WebSocket server to the HTTP server.
 */
exports.initWebSocket = (server) => {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    try {
      // Authenticate via ?token= query param
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) { ws.close(4001, 'Unauthorized'); return; }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      // Register client
      if (!clients.has(userId)) clients.set(userId, new Set());
      clients.get(userId).add(ws);
      logger.info(`WebSocket: user ${userId} connected (${clients.get(userId).size} connections)`);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          handleMessage(userId, data, ws);
        } catch {
          ws.send(JSON.stringify({ event: 'ERROR', message: 'Invalid JSON' }));
        }
      });

      ws.on('close', () => {
        clients.get(userId)?.delete(ws);
        if (clients.get(userId)?.size === 0) clients.delete(userId);
        logger.info(`WebSocket: user ${userId} disconnected`);
      });

      ws.send(JSON.stringify({ event: 'CONNECTED', message: 'WebSocket connected' }));
    } catch (err) {
      ws.close(4001, 'Authentication failed');
    }
  });

  logger.info('🔌  WebSocket server initialised');
};

/**
 * broadcast — Sends a message to ALL connections for a given userId.
 */
exports.broadcast = (userId, data) => {
  const userConnections = clients.get(userId);
  if (!userConnections) return;
  const message = JSON.stringify(data);
  userConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
};

/**
 * broadcastAll — Sends a message to every connected client.
 */
exports.broadcastAll = (data) => {
  const message = JSON.stringify(data);
  wss?.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
};

const handleMessage = (userId, data, ws) => {
  switch (data.event) {
    case 'PING':
      ws.send(JSON.stringify({ event: 'PONG' }));
      break;
    default:
      ws.send(JSON.stringify({ event: 'UNKNOWN_EVENT' }));
  }
};
