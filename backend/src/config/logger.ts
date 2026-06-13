import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.isProd ? 'info' : 'debug',
  transport: env.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
    remove: true,
  },
});
