import ENV from '../config/environment';
import { Request, Response } from 'express';

// Simple logger utility that can be easily replaced with Winston/Pino later
class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = ENV.NODE_ENV === 'development';
  }

  private formatMessage(level: string, message: string, data: any = null): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  info(message: string, data: any = null): void {
    console.log(this.formatMessage('info', message, data));
  }

  error(message: string, error: Error | any = null): void {
    const errorData = error ? {
      message: error.message,
      stack: this.isDevelopment ? error.stack : undefined
    } : null;
    console.error(this.formatMessage('error', message, errorData));
  }

  warn(message: string, data: any = null): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  debug(message: string, data: any = null): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  // HTTP request logging
  http(req: Request, res: Response, responseTime: number): void {
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    const ip = req.ip || (req.connection as any).remoteAddress;
    
    this.info(`${method} ${url} ${status} - ${responseTime}ms - ${ip}`);
  }
}

// Export singleton instance
export default new Logger();

