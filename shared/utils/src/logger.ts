export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export class Logger {
  private serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...(meta && { meta }),
    }
    console.log(JSON.stringify(logEntry))
  }

  debug(message: string, meta?: any) {
    this.log(LogLevel.DEBUG, message, meta)
  }

  info(message: string, meta?: any) {
    this.log(LogLevel.INFO, message, meta)
  }

  warn(message: string, meta?: any) {
    this.log(LogLevel.WARN, message, meta)
  }

  error(message: string, meta?: any) {
    this.log(LogLevel.ERROR, message, meta)
  }
}
