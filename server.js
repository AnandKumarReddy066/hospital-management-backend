/**
 * server.js
 * Entry point — boots HTTP server + WebSocket server.
 */

const http = require('http');
const app = require('./app');
const { initWebSocket } = require('./websocket/wsServer');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// ── Connect to MongoDB ──────────────────────────────────────────────────────
connectDB();

// ── Create underlying HTTP server ───────────────────────────────────────────
const server = http.createServer(app);

// ── Attach WebSocket server ─────────────────────────────────────────────────
initWebSocket(server);

// ── Start listening ──────────────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`🏥  Hospital Management API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});
