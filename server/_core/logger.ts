/**
 * Simple structured logger for the server
 */

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: any;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const structuredLog = {
    timestamp,
    level,
    message,
    ...context,
  };

  // In production, we would use a more sophisticated logger like pino or winston
  // For now, we use console to output structured JSON
  const output = JSON.stringify(structuredLog);
  
  switch (level) {
    case "info":
      console.log(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "error":
      console.error(output);
      break;
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};
