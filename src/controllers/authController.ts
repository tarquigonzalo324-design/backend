import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import logger from '../utils/logger';
import { LoginRequest, LoginResponse } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// Validaciones para login
export const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Usuario es requerido')
    .isLength({ min: 2 }).withMessage('Usuario debe tener al menos 2 caracteres'),
  body('password')
    .notEmpty().withMessage('Contraseña es requerida')
    .isLength({ min: 1 }).withMessage('Contraseña es requerida')
];

export const login = async (req: Request, res: Response) => {
  try {
    // Validar entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({
        message: 'Validación fallida en login',
        errors: errors.array(),
        ip: req.ip
      });
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: errors.array()
      });
    }

    const { username, password }: LoginRequest = req.body;

    // Log seguro del intento (sin contraseña)
    logger.info({
      message: 'Intento de login',
      username,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Buscar usuario en la base de datos (case-insensitive)
    const result = await pool.query(
      `SELECT * FROM usuarios WHERE LOWER(username) = LOWER($1) AND activo = true`,
      [username]
    );

    console.log('🔍 Query user result:', result.rows[0]);

    if (result.rows.length === 0) {
      // No revelar si el usuario existe (seguridad)
      logger.warn({
        message: 'Usuario no encontrado o inactivo',
        username,
        ip: req.ip
      });
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = result.rows[0];

    // Obtener nombre del rol
    let rolName = 'usuario';
    if (user.rol_id) {
      const roleResult = await pool.query(
        'SELECT nombre FROM roles WHERE id = $1',
        [user.rol_id]
      );
      if (roleResult.rows.length > 0) {
        rolName = roleResult.rows[0].nombre;
      }
    }

    console.log('🔍 User rol_id:', user.rol_id, '- rolName:', rolName);

    // Verificar contraseña
    try {
      const isValidPassword = await bcryptjs.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        // Log de intento fallido
        logger.warn({
          message: 'Contraseña inválida',
          userId: user.id,
          username: user.username,
          ip: req.ip
        });

        return res.status(401).json({
          error: 'Credenciales inválidas',
          code: 'INVALID_CREDENTIALS'
        });
      }
    } catch (hashError: any) {
      logger.error({
        message: 'Error comparando contraseña',
        error: hashError.message,
        userId: user.id
      });
      return res.status(500).json({
        error: 'Error en autenticación',
        code: 'AUTH_ERROR'
      });
    }

    // Validar secretos JWT
    if (!JWT_SECRET) {
      logger.error({
        message: 'JWT_SECRET no configurado',
        severity: 'CRITICAL'
      });
      return res.status(500).json({
        error: 'Error del servidor',
        code: 'CONFIG_ERROR'
      });
    }

    // Generar tokens
    try {
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          rol: rolName
        },
        JWT_SECRET,
        { 
          expiresIn: TOKEN_EXPIRY as any,
          algorithm: 'HS256' as any
        }
      );

      console.log('✅ Token generado:', {
        userId: user.id,
        username: user.username,
        rol: rolName,
        tokenPrefix: token.substring(0, 20)
      });

      // Generar refresh token si está configurado
      let refreshToken = null;
      if (REFRESH_TOKEN_SECRET) {
        refreshToken = jwt.sign(
          {
            userId: user.id,
            username: user.username,
            type: 'refresh'
          },
          REFRESH_TOKEN_SECRET,
          {
            expiresIn: REFRESH_TOKEN_EXPIRY as any,
            algorithm: 'HS256' as any
          }
        );
      }

      // Actualizar último login
      await pool.query(
        'UPDATE usuarios SET actualizado_en = NOW(), ultimo_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Obtener nombre de unidad si existe
      let unidadNombre = null;
      if (user.unidad_id) {
        const unidadResult = await pool.query('SELECT nombre FROM unidades WHERE id = $1', [user.unidad_id]);
        if (unidadResult.rows.length > 0) {
          unidadNombre = unidadResult.rows[0].nombre;
        }
      }

      const response: LoginResponse = {
        token,
        refreshToken: refreshToken || undefined,
        usuario: {
          id: user.id,
          username: user.username,
          nombre_completo: user.nombre_completo,
          rol: rolName,
          unidad_id: user.unidad_id || null,
          unidad_nombre: unidadNombre
        }
      };

      logger.info({
        message: 'Login exitoso',
        userId: user.id,
        username: user.username,
        ip: req.ip
      });

      // Headers de seguridad adicionales
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      res.json(response);

    } catch (tokenError: any) {
      logger.error({
        message: 'Error generando JWT',
        error: tokenError.message,
        userId: user.id
      });
      return res.status(500).json({
        error: 'Error en autenticación',
        code: 'TOKEN_ERROR'
      });
    }

  } catch (error: any) {
    logger.error({
      message: 'Error en login',
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

export const verificarToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'No hay usuario en el token',
        code: 'NO_USER'
      });
    }
    
    const result = await pool.query(
      'SELECT id, username, nombre_completo, rol_id FROM usuarios WHERE id = $1 AND activo = true',
      [userId]
    );

    if (result.rows.length === 0) {
      logger.warn({
        message: 'Usuario no encontrado en verificación',
        userId,
        ip: req.ip
      });
      return res.status(404).json({
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    logger.debug({
      message: 'Token verificado',
      userId
    });

    res.json({
      usuario: result.rows[0],
      tokenValid: true
    });

  } catch (error: any) {
    logger.error({
      message: 'Error verificando token',
      error: error.message,
      userId: (req as any).userId
    });
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Refresh Token endpoint
export const refreshTokenEndpoint = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token requerido',
        code: 'NO_REFRESH'
      });
    }

    if (!REFRESH_TOKEN_SECRET) {
      logger.error({
        message: 'REFRESH_TOKEN_SECRET no configurado'
      });
      return res.status(500).json({
        error: 'Error del servidor',
        code: 'CONFIG_ERROR'
      });
    }

    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err: any, decoded: any) => {
      if (err) {
        logger.warn({
          message: 'Refresh token inválido',
          error: err.name,
          ip: req.ip
        });
        return res.status(403).json({
          error: 'Refresh token inválido',
          code: 'INVALID_REFRESH'
        });
      }

      if (!JWT_SECRET) {
        logger.error({
          message: 'JWT_SECRET no configurado'
        });
        return res.status(500).json({
          error: 'Error del servidor',
          code: 'CONFIG_ERROR'
        });
      }

      const newToken = jwt.sign(
        {
          userId: decoded.userId,
          username: decoded.username,
          rol: decoded.rol
        },
        JWT_SECRET,
        {
          expiresIn: TOKEN_EXPIRY as any,
          algorithm: 'HS256' as any
        }
      );

      logger.info({
        message: 'Token refrescado',
        userId: decoded.userId
      });

      res.json({ token: newToken });
    });
  } catch (error: any) {
    logger.error({
      message: 'Error en refresh token',
      error: error.message
    });
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Logout (invalidar token - requiere base de datos de tokens bloqueados)
export const logout = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    logger.info({
      message: 'Usuario desconectado',
      userId,
      ip: req.ip
    });

    res.json({
      message: 'Desconexión exitosa',
      code: 'LOGOUT_SUCCESS'
    });
  } catch (error: any) {
    logger.error({
      message: 'Error en logout',
      error: error.message
    });
    res.status(500).json({
      error: 'Error en desconexión',
      code: 'LOGOUT_ERROR'
    });
  }
};