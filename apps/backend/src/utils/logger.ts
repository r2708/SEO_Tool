/**
 * Structured logging utility for the SEO SaaS Platform
 * Uses Winston for production-grade logging with JSON format, timestamps, and file transports
 * 
 * Requirements: 14.7
 */

import winston from 'winston';
import path from 'path';

// Create logs directory path
const logsDir = path.join(process.cwd(), 'logs');

// Configure Winston logger
const winstonLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Include error stack traces
    winston.format.json() // JSON format for structured logging
  ),
  transports: [
    // Error log file - errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    // Combined log file - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    })
  );
}

// Export logger with interface matching existing usage
export const logger = {
  error(message: string, meta?: Record<string, any>): void {
    winstonLogger.error(message, meta);
  },

  warn(message: string, meta?: Record<string, any>): void {
    winstonLogger.warn(message, meta);
  },

  info(message: string, meta?: Record<string, any>): void {
    winstonLogger.info(message, meta);
  },

  debug(message: string, meta?: Record<string, any>): void {
    winstonLogger.debug(message, meta);
  },
};
