import winston from 'winston';
import path from 'path';
import fs from 'fs';

const NODE_ENV = process.env.NODE_ENV || 'development';
const logsDir = path.join(process.cwd(), 'logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  NODE_ENV === 'production'
    ? winston.format.json() // JSON en producción
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
);

// Transports
const transports = [
  // Console
  new winston.transports.Console({
    format: NODE_ENV === 'production' ? winston.format.json() : customFormat,
  }),
  
  // Archivo de todos los logs
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    format: winston.format.json(),
    maxsize: 10485760, // 10MB
    maxFiles: 10,
  }),
  
  // Archivo de errores
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: winston.format.json(),
    maxsize: 10485760,
    maxFiles: 10,
  }),
];

// Solo agregar archivo de debug en desarrollo
if (NODE_ENV === 'development') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'debug.log'),
      level: 'debug',
      format: customFormat,
      maxsize: 10485760,
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  defaultMeta: { service: 'hoja-ruta-api' },
  transports,
});

// Log de inicio
logger.info({
  message: 'Logger inicializado',
  environment: NODE_ENV,
  timestamp: new Date().toISOString()
});

export default logger;
