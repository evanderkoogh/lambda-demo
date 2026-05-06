import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: process.env.SERVICE_NAME ?? 'unknown',
    env: process.env.NODE_ENV ?? 'development',
  },
});

export type Logger = typeof logger;
