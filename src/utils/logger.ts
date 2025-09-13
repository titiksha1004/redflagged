type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogData = Record<string, unknown> | unknown[] | null;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: LogData;
  error?: Error;
  userId?: string;
  requestId?: string;
}

class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setEnvironment(env: string) {
    this.isDevelopment = env === 'development';
  }

  private formatLog(level: LogLevel, message: string, data?: LogData, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      userId: 'TODO: Get from auth context',
      requestId: 'TODO: Get from request context',
    };
  }

  private log(entry: LogEntry) {
    if (this.isDevelopment) {
      console.log(JSON.stringify(entry, null, 2));
    } else {
      // In production, send to logging service
      // Hook up production logging service
      console.log(JSON.stringify(entry));
    }
  }

  info(message: string, data?: LogData) {
    this.log(this.formatLog('info', message, data));
  }

  warn(message: string, data?: LogData) {
    this.log(this.formatLog('warn', message, data));
  }

  error(message: string, error?: Error, data?: LogData) {
    this.log(this.formatLog('error', message, data, error));
  }

  debug(message: string, data?: LogData) {
    if (this.isDevelopment) {
      this.log(this.formatLog('debug', message, data));
    }
  }
}

export const logger = Logger.getInstance(); 