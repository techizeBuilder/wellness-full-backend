const ENV = require('../config/environment');

// Simple logger utility that can be easily replaced with Winston/Pino later
class Logger {
  constructor() {
    this.isDevelopment = ENV.NODE_ENV === 'development';
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  info(message, data = null) {
    console.log(this.formatMessage('info', message, data));
  }

  error(message, error = null) {
    const errorData = error ? {
      message: error.message,
      stack: this.isDevelopment ? error.stack : undefined
    } : null;
    console.error(this.formatMessage('error', message, errorData));
  }

  warn(message, data = null) {
    console.warn(this.formatMessage('warn', message, data));
  }

  debug(message, data = null) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  // HTTP request logging
  http(req, res, responseTime) {
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    const ip = req.ip || req.connection.remoteAddress;
    
    this.info(`${method} ${url} ${status} - ${responseTime}ms - ${ip}`);
  }
}

// Export singleton instance
module.exports = new Logger();

