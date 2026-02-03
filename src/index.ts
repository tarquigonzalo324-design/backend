import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import https from 'https';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from './utils/logger';
import {
  validateCriticalEnvVars,
  corsPreflightCache,
  removeServerHeader,
  addSecurityHeaders,
  payloadSizeLimit,
  securityLogger,
  corsConfig,
  helmetConfig,
  rateLimitConfig
} from './utils/securityConfig';
import authRoutes from './routes/auth';
import hojasRutaRoutes from './routes/hojasRuta';
import destinosRoutes from './routes/destinos';
import locacionesRoutes from './routes/locaciones';
import notificacionesRoutes from './routes/notificaciones';
import enviarRoutes from './routes/enviar';
import historialRoutes from './routes/historial';
import progresoRoutes from './routes/progreso';
import unidadesRoutes from './routes/unidades';
import usuariosRoutes from './routes/usuarios';
import pool from './config/database';

dotenv.config();

// Función para crear tabla progreso_hojas_ruta si no existe
const initializeProgresoTable = async () => {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS progreso_hojas_ruta (
        id SERIAL PRIMARY KEY,
        hoja_ruta_id INTEGER NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
        ubicacion_anterior VARCHAR(255),
        ubicacion_actual VARCHAR(255) NOT NULL,
        responsable_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        notas TEXT,
        fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_progreso_hojas_ruta_id ON progreso_hojas_ruta(hoja_ruta_id);
      CREATE INDEX IF NOT EXISTS idx_progreso_fecha_registro ON progreso_hojas_ruta(fecha_registro DESC);
      CREATE INDEX IF NOT EXISTS idx_progreso_responsable_id ON progreso_hojas_ruta(responsable_id);
      CREATE INDEX IF NOT EXISTS idx_progreso_ubicacion_actual ON progreso_hojas_ruta(ubicacion_actual);
    `;
    
    await pool.query(createTableSQL);
    logger.info({ message: '✅ Tabla progreso_hojas_ruta verificada/creada' });
  } catch (error: any) {
    logger.warn({ message: 'Advertencia al crear tabla progreso_hojas_ruta', error: error.message });
  }
};

// Validar variables de entorno críticas
validateCriticalEnvVars();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DEV = NODE_ENV !== 'production';
const MAX_PAYLOAD = process.env.PAYLOAD_MAX_SIZE || '5mb';

// =============================================
// CORS - USAR PAQUETE CORS SIMPLIFICADO
// =============================================
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

console.log('🌐 CORS Origins permitidos:', allowedOrigins);
console.log('🌐 NODE_ENV:', NODE_ENV);

// Usar cors package directamente - MUY SIMPLE
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (Postman, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS bloqueado:', origin, 'no está en', allowedOrigins);
      callback(null, true); // Temporalmente permitir todo para debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// =============================================
// MIDDLEWARE DE SEGURIDAD
// =============================================

// Helmet: Headers de seguridad HTTP (configuración permisiva)
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Remover headers que exponen información
app.use(removeServerHeader);
app.use(addSecurityHeaders);

// Security Logger
app.use(securityLogger);

// Rate Limiting: Protección contra ataques de fuerza bruta
const limiter = IS_DEV
  ? (req: any, _res: any, next: any) => next() // En desarrollo no limitamos para evitar bloqueos
  : rateLimit({
      windowMs: rateLimitConfig.global.windowMs,
      max: rateLimitConfig.global.max,
      message: rateLimitConfig.global.message,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === '/api/health'
    });

// Rate limiting estricto para login
const loginLimiter = IS_DEV
  ? (req: any, _res: any, next: any) => next()
  : rateLimit({
      windowMs: rateLimitConfig.auth.windowMs,
      max: rateLimitConfig.auth.max,
      message: rateLimitConfig.auth.message,
      skipSuccessfulRequests: rateLimitConfig.auth.skipSuccessfulRequests,
      standardHeaders: true,
      legacyHeaders: false
    });

// Body parser con límite
app.use(payloadSizeLimit(MAX_PAYLOAD));
app.use(express.json({ limit: MAX_PAYLOAD }));
app.use(express.urlencoded({ limit: MAX_PAYLOAD, extended: true }));

// Trust proxy
app.set('trust proxy', 1);

// Aplicar rate limiting global
app.use('/api/', limiter);

// =============================================
// RUTAS
// =============================================

// Health check (sin autenticación para monitoreo)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Rutas de autenticación con rate limiting estricto
app.use('/api/auth', loginLimiter, authRoutes);

// Rutas protegidas
app.use('/api/hojas-ruta', hojasRutaRoutes);
app.use('/api/destinos', destinosRoutes);
app.use('/api/locaciones', locacionesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/enviar', enviarRoutes);
app.use('/api/historial', historialRoutes);
app.use('/api/progreso', progresoRoutes);
app.use('/api/unidades', unidadesRoutes);
app.use('/api/usuarios', usuariosRoutes);

// =============================================
// MANEJO DE ERRORES
// =============================================

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  logger.warn({
    message: 'Ruta no encontrada',
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method
  });
});

// Error handler global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // No exponer detalles de errores en producción
  const statusCode = err.statusCode || 500;
  const message = NODE_ENV === 'production' 
    ? 'Error interno del servidor'
    : err.message;
  
  logger.error({
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack,
    ip: req.ip
  });

  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    ...(NODE_ENV === 'development' && { details: err.stack })
  });
});

// =============================================
// INICIAR SERVIDOR
// =============================================

const startServer = () => {
  try {
    // HTTPS en producción
    if (NODE_ENV === 'production' && process.env.SSL_KEY && process.env.SSL_CERT) {
      const keyPath = path.resolve(process.env.SSL_KEY);
      const certPath = path.resolve(process.env.SSL_CERT);
      
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const key = fs.readFileSync(keyPath, 'utf8');
        const cert = fs.readFileSync(certPath, 'utf8');
        
        const httpsServer = https.createServer({ key, cert }, app);
        
        httpsServer.listen(PORT, async () => {
          // Inicializar tablas
          await initializeProgresoTable();
          
          logger.info({
            message: 'Servidor HTTPS iniciado exitosamente',
            port: PORT,
            environment: NODE_ENV,
            database: process.env.DB_NAME,
            timestamp: new Date().toISOString()
          });
        });

        httpsServer.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            logger.error({
              message: `Puerto ${PORT} ya está en uso`,
              port: PORT
            });
          } else {
            logger.error({
              message: 'Error en servidor HTTPS',
              error: err.message
            });
          }
          process.exit(1);
        });
      } else {
        throw new Error('Archivos SSL no encontrados en las rutas especificadas');
      }
    } else {
      // HTTP en desarrollo
      const server = app.listen(PORT, async () => {
        // Inicializar tablas
        await initializeProgresoTable();
        
        logger.info({
          message: 'Servidor HTTP iniciado exitosamente (Desarrollo)',
          port: PORT,
          environment: NODE_ENV,
          database: process.env.DB_NAME,
          timestamp: new Date().toISOString()
        });

        if (NODE_ENV === 'development') {
          logger.warn({
            message: 'HTTPS deshabilitado en modo desarrollo',
            recommendation: 'Habilitar HTTPS en producción'
          });
        }
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          logger.error({
            message: `Puerto ${PORT} ya está en uso`,
            port: PORT
          });
        } else {
          logger.error({
            message: 'Error iniciando servidor',
            error: err.message
          });
        }
        process.exit(1);
      });
    }
  } catch (error: any) {
    logger.error({
      message: 'Error crítico iniciando servidor',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

startServer();

// =============================================
// MANEJO DE SEÑALES DE TERMINACIÓN
// =============================================

const gracefulShutdown = () => {
  logger.info('Señal de terminación recibida, cerrando servidor gracefully...');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Manejo de excepciones no capturadas
process.on('uncaughtException', (err: Error) => {
  logger.error({
    message: 'Excepción no capturada',
    error: err.message,
    stack: err.stack,
    severity: 'CRITICAL'
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error({
    message: 'Promise rechazo no manejado',
    reason: reason instanceof Error ? reason.message : String(reason),
    severity: 'CRITICAL'
  });
});