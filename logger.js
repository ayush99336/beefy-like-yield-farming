import fs from 'fs';
import path from 'path';

const LOG_FILE = 'bot_activity.log';

const writeToFile = (level, message) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
};

export default {
  info: (...args) => {
    const message = args.join(' ');
    console.log(message);
    writeToFile('info', message);
  },
  error: (...args) => {
    const message = args.join(' ');
    console.error(message);
    writeToFile('error', message);
  },
  warn: (...args) => {
    const message = args.join(' ');
    console.warn(message);
    writeToFile('warn', message);
  }
};
