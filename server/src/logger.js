import fs from "fs";
import path from "path";

const logDir = path.resolve("./logs");
const errorLogPath = path.join(logDir, "error.log");
const appLogPath = path.join(logDir, "app.log");

function writeLine(filePath, line) {
  fs.appendFile(filePath, line + "\n", (err) => {
    if (err) {
      console.error("failed to write log", err);
    }
  });
}

function formatLine(level, message, meta) {
  const timestamp = new Date().toISOString();
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] ${level} ${message}${payload}`;
}

export function logInfo(message, meta) {
  const line = formatLine("INFO", message, meta);
  writeLine(appLogPath, line);
}

export function logError(message, meta) {
  const line = formatLine("ERROR", message, meta);
  writeLine(errorLogPath, line);
}
