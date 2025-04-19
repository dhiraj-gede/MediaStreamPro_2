import pino from 'pino';

// Configure logger based on environment
const loggerConfig = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        levelFirst: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
      },
    },
    level: 'debug',
  },
  production: {
    level: 'info',
  },
};

// Default to development if NODE_ENV is not set
const env = process.env.NODE_ENV || 'development';
const config = env === 'production' ? loggerConfig.production : loggerConfig.development;

// Create logger instance
export const logger = pino(config);

// Export log levels for convenience
export const logLevels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

/**
 * Helper to log startup messages
 */
export function logStartup(name: string, port: number): void {
  logger.info(`🚀 ${name} service started on port ${port}`);
}

/**
 * Helper to log API requests
 */
export function logApiRequest(method: string, path: string, statusCode: number, duration: number): void {
  logger.debug({
    msg: `${method} ${path} ${statusCode} in ${duration}ms`,
    method,
    path,
    statusCode,
    duration,
  });
}

/**
 * Helper to log errors with context
 */
export function logError(error: Error, context?: Record<string, any>): void {
  logger.error({
    err: error,
    ...context,
  });
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, any>): typeof logger {
  return logger.child(context);
}
