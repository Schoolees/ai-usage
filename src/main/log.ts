import log from 'electron-log/main';
import { redactValue } from './redact';

export function initLog() {
  log.initialize();
  log.transports.file.level = 'info';
  // Every log line passes through redaction before reaching console or file.
  log.hooks.push((message) => ({ ...message, data: message.data.map(redactValue) }));
  return log;
}
