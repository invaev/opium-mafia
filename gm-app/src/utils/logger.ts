type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  category: string;
  message: string;
  gameId?: number;
  meta?: Record<string, unknown>;
  timestamp: string;
}

const logBuffer: LogEntry[] = [];
const MAX_BUFFER = 500;

function log(level: LogLevel, category: string, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    category,
    message,
    timestamp: new Date().toISOString(),
    meta,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

  const prefix = `[${category}]`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';

  switch (level) {
    case 'debug':
      console.debug(`${prefix} ${message}${metaStr}`);
      break;
    case 'info':
      console.log(`${prefix} ${message}${metaStr}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}${metaStr}`);
      break;
    case 'error':
      console.error(`${prefix} ${message}${metaStr}`);
      break;
  }
}

export const logger = {
  debug: (category: string, message: string, meta?: Record<string, unknown>) => log('debug', category, message, meta),
  info: (category: string, message: string, meta?: Record<string, unknown>) => log('info', category, message, meta),
  warn: (category: string, message: string, meta?: Record<string, unknown>) => log('warn', category, message, meta),
  error: (category: string, message: string, meta?: Record<string, unknown>) => log('error', category, message, meta),

  getBuffer: (): LogEntry[] => [...logBuffer],

  clear: (): void => { logBuffer.length = 0; },
};

(window as any).__gmLogs = () => logger.getBuffer();
