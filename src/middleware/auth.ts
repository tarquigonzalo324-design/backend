import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  tokenExp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '1h';

// Validar que JWT_SECRET esté configurado
if (!JWT_SECRET || JWT_SECRET === 'default-secret') {
  logger.error({
    message: 'CRÍTICO: JWT_SECRET no está configurado correctamente en variables de entorno',
    severity: 'CRITICAL'
  });
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.warn({
        message: 'Intento sin token de autenticación',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'Token de acceso requerido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar formato Bearer
    if (!authHeader.startsWith('Bearer ')) {
      logger.warn({
        message: 'Formato de Authorization inválido',
        path: req.path,
        ip: req.ip
      });
      return res.status(401).json({
        error: 'Formato de Authorization inválido (use Bearer <token>)',
        code: 'INVALID_FORMAT'
      });
    }

    jwt.verify(token, JWT_SECRET || '', (err: any, decoded: any) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          logger.warn({
            message: 'Token expirado',
            userId: decoded?.userId,
            ip: req.ip
          });
          return res.status(401).json({ 
            error: 'Token expirado',
            code: 'TOKEN_EXPIRED'
          });
        }

        if (err.name === 'JsonWebTokenError') {
          logger.warn({
            message: 'Token inválido',
            path: req.path,
            ip: req.ip
          });
          return res.status(403).json({ 
            error: 'Token inválido',
            code: 'INVALID_TOKEN'
          });
        }

        logger.error({
          message: 'Error verificando token',
          error: err.message,
          ip: req.ip
        });
        return res.status(403).json({ 
          error: 'Error al verificar token',
          code: 'VERIFICATION_ERROR'
        });
      }

      // Validar estructura del token
      if (!decoded || !decoded.userId || !decoded.rol) {
        console.log('❌ Token inválido:', {
          decoded,
          hasuseId: decoded?.userId,
          hasRol: decoded?.rol
        });
        logger.warn({
          message: 'Token con estructura inválida',
          ip: req.ip,
          decoded
        });
        return res.status(403).json({
          error: 'Token con estructura inválida',
          code: 'INVALID_STRUCTURE'
        });
      }

      // Asignar datos del token al request
      req.userId = decoded.userId;
      req.userRole = decoded.rol;
      req.tokenExp = decoded.exp;

      logger.debug({
        message: 'Token verificado correctamente',
        userId: req.userId,
        path: req.path
      });

      next();
    });
  } catch (error: any) {
    logger.error({
      message: 'Error en middleware de autenticación',
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    return res.status(500).json({ 
      error: 'Error en autenticación',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware para refresh tokens (opcional para implementar)
export const refreshToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token requerido',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verificar refresh token con secreto diferente
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!refreshSecret) {
      logger.error({
        message: 'REFRESH_TOKEN_SECRET no configurado'
      });
      return res.status(500).json({
        error: 'Error del servidor',
        code: 'CONFIG_ERROR'
      });
    }

    jwt.verify(refreshToken, refreshSecret, (err: any, decoded: any) => {
      if (err) {
        logger.warn({
          message: 'Refresh token inválido o expirado',
          ip: req.ip
        });
        return res.status(403).json({
          error: 'Refresh token inválido',
          code: 'INVALID_REFRESH'
        });
      }

      // Generar nuevo token de acceso
      const newToken = jwt.sign(
        {
          userId: decoded.userId,
          usuario: decoded.usuario,
          rol: decoded.rol
        },
        JWT_SECRET || '',
        { 
          expiresIn: TOKEN_EXPIRY as any,
          algorithm: 'HS256' as any
        }
      );

      logger.info({
        message: 'Token refrescado',
        userId: decoded.userId
      });

      return res.json({ token: newToken });
    });
  } catch (error: any) {
    logger.error({
      message: 'Error refrescando token',
      error: error.message
    });
    return res.status(500).json({
      error: 'Error refrescando token',
      code: 'REFRESH_ERROR'
    });
  }
};