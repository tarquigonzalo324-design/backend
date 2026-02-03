import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import crypto from 'crypto';

/**
 * CONFIGURACIÓN DE SEGURIDAD COMPLETA DEL BACKEND
 * 
 * Este módulo centraliza todas las configuraciones y mejores prácticas de seguridad
 */

// =====================================================
// VALIDACIÓN DE VARIABLES DE ENTORNO CRÍTICAS
// =====================================================

// Generar secretos seguros si no existen (solo para producción en Railway)
const generateSecureSecret = (length: number = 64): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Configurar JWT_SECRET automáticamente si no existe
if (!process.env.JWT_SECRET) {
  const generatedSecret = generateSecureSecret(64);
  process.env.JWT_SECRET = generatedSecret;
  console.log('⚠️ JWT_SECRET generado automáticamente (considere configurarlo manualmente en producción)');
}

if (!process.env.REFRESH_TOKEN_SECRET) {
  const generatedSecret = generateSecureSecret(64);
  process.env.REFRESH_TOKEN_SECRET = generatedSecret;
  console.log('⚠️ REFRESH_TOKEN_SECRET generado automáticamente');
}

export const validateCriticalEnvVars = (): void => {
  // Verificar conexión a base de datos (compatible con Railway)
  const dbHost = process.env.DB_HOST || process.env.PGHOST;
  const dbUser = process.env.DB_USER || process.env.PGUSER || process.env.POSTGRES_USER;
  const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  const dbName = process.env.DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB;
  const jwtSecret = process.env.JWT_SECRET;

  const missing: string[] = [];
  
  if (!jwtSecret) missing.push('JWT_SECRET');
  if (!dbHost) missing.push('DB_HOST o PGHOST');
  if (!dbUser) missing.push('DB_USER o PGUSER');
  if (!dbPassword) missing.push('DB_PASSWORD o PGPASSWORD');
  if (!dbName) missing.push('DB_NAME o PGDATABASE');

  if (missing.length > 0) {
    logger.error({
      message: 'Variables de entorno críticas faltantes',
      missing,
      severity: 'CRITICAL'
    });
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }

  // Validar que JWT_SECRET sea suficientemente fuerte
  if (jwtSecret && jwtSecret.length < 32) {
    logger.warn({
      message: 'JWT_SECRET muy corto (mínimo 32 caracteres recomendado)',
      length: jwtSecret.length,
      severity: 'HIGH'
    });
  }

  if (jwtSecret === 'default-secret') {
    logger.error({
      message: 'JWT_SECRET está usando valor por defecto inseguro',
      severity: 'CRITICAL'
    });
    throw new Error('JWT_SECRET debe ser cambiado a un valor seguro');
  }

  logger.info('✅ Todas las variables de entorno críticas están configuradas correctamente');
};

// =====================================================
// MIDDLEWARE DE SEGURIDAD ADICIONAL
// =====================================================

/**
 * Prevenir CORS Preflight Requests innecesarios
 */
export const corsPreflightCache = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    res.header('Cache-Control', 'public, max-age=86400');
    return res.status(200).end();
  }
  next();
};

/**
 * Remover headers de servidor
 */
export const removeServerHeader = (req: Request, res: Response, next: NextFunction) => {
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Agregar headers de seguridad personalizados
 */
export const addSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS (solo HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

/**
 * Protección contra DoS - Limitar tamaño de payload
 */
export const payloadSizeLimit = (maxSize = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const maxBytes = parseFloat(maxSize) * 1024 * 1024;
      if (parseInt(contentLength) > maxBytes) {
        logger.warn({
          message: 'Payload excede tamaño máximo permitido',
          contentLength: parseInt(contentLength),
          maxSize,
          ip: req.ip
        });
        return res.status(413).json({
          error: 'Payload demasiado grande',
          code: 'PAYLOAD_TOO_LARGE'
        });
      }
    }
    next();
  };
};

/**
 * Sanitizar datos de salida - Remover información sensible
 */
export const sanitizeResponse = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'jwt'
  ];

  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  return sanitized;
};

/**
 * Middleware para logging de seguridad
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'debug';

    logger[level as 'warn' | 'debug']({
      message: 'Petición HTTP completada',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: (req as any).userId || 'anonymous'
    });
  });

  next();
};

// =====================================================
// CONFIGURACIÓN DE CREDENCIALES
// =====================================================

/**
 * Hash de contraseña mejorada
 */
export const passwordHashConfig = {
  saltRounds: 12, // Aumentado de 10 para mejor seguridad
  algorithm: 'bcrypt'
};

/**
 * Configuración de expiración de tokens
 */
export const tokenConfig = {
  access: {
    expiresIn: process.env.TOKEN_EXPIRY || '1h',
    algorithm: 'HS256'
  },
  refresh: {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    algorithm: 'HS256'
  }
};

// =====================================================
// CONFIGURACIÓN DE RATE LIMITING AVANZADA
// =====================================================

export const rateLimitConfig = {
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: 'Demasiadas solicitudes, intente más tarde'
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Demasiados intentos de login'
  },
  api: {
    windowMs: 60 * 1000, // 1 minuto
    max: 30,
    message: 'Límite de API excedido'
  }
};

// =====================================================
// VALIDACIÓN DE INPUTS AVANZADA
// =====================================================

/**
 * Patrones de regex para detectar código malicioso
 */
export const maliciousPatterns = {
  sqlInjection: /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)|(-{2}|\/\*|\*\/|xp_|sp_)/gi,
  scriptInjection: /<script[^>]*>.*?<\/script>/gi,
  htmlInjection: /<[a-z][^>]*>/gi,
  commandInjection: /[;&|`$(){}[\]]/g,
};

/**
 * Detectar ataques comunes en inputs
 */
export const detectMaliciousInput = (input: string): boolean => {
  if (typeof input !== 'string') return false;

  for (const [key, pattern] of Object.entries(maliciousPatterns)) {
    if (pattern.test(input)) {
      logger.warn({
        message: 'Posible ataque detectado',
        type: key,
        input: input.substring(0, 100)
      });
      return true;
    }
  }

  return false;
};

// =====================================================
// CONFIGURACIÓN DE CORS AVANZADA
// =====================================================

const corsAllowlist = (() => {
  const raw = process.env.CORS_ORIGINS || process.env.RAILWAY_STATIC_URL || 'http://localhost:5173';
  const origins = raw
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  
  console.log('🔧 CORS Origins configurados:', origins);
  return origins;
})();

export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Permitir requests sin origin (como Postman, curl, o server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // Verificar si el origin está en la lista permitida
    if (corsAllowlist.includes(origin)) {
      return callback(null, true);
    }
    
    // En desarrollo, permitir localhost
    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    console.log('⚠️ CORS bloqueado para origin:', origin);
    console.log('📋 Origins permitidos:', corsAllowlist);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 horas
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// =====================================================
// HELMET CONFIGURACIÓN DETALLADA
// =====================================================

export const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' as const },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"]
    }
  }
} as any;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Generar JWT Secret fuerte
 */
export const generateStrongSecret = (length = 32): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Validar fortaleza de contraseña
 */
export const validatePasswordStrength = (password: string): {
  isStrong: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Mínimo 8 caracteres');

  if (password.length >= 12) score++;
  else if (password.length >= 8) feedback.push('Considera 12+ caracteres');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Agregar letras minúsculas');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Agregar letras mayúsculas');

  if (/\d/.test(password)) score++;
  else feedback.push('Agregar números');

  if (/[!@#$%^&*]/.test(password)) score++;
  else feedback.push('Agregar caracteres especiales');

  return {
    isStrong: score >= 4,
    score,
    feedback
  };
};

export default {
  validateCriticalEnvVars,
  corsPreflightCache,
  removeServerHeader,
  addSecurityHeaders,
  payloadSizeLimit,
  sanitizeResponse,
  securityLogger,
  passwordHashConfig,
  tokenConfig,
  rateLimitConfig,
  maliciousPatterns,
  detectMaliciousInput,
  corsConfig,
  helmetConfig,
  generateStrongSecret,
  validatePasswordStrength
};
