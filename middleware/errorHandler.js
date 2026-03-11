/**
 * middleware/errorHandler.js
 * Centralised error handling middleware.
 */

const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message    = err.message    || 'Internal server error';

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    err.message    = `Duplicate value for field: ${field}`;
    err.statusCode = 409;
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    err.message    = Object.values(err.errors).map(e => e.message).join(', ');
    err.statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    err.message    = 'Invalid token';
    err.statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    err.message    = 'Token expired';
    err.statusCode = 401;
  }

  logger.error(`[${req.method}] ${req.originalUrl} — ${err.statusCode}: ${err.message}`);

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { AppError, globalErrorHandler };
