import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Middleware para manejar errores de validación
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      message: 'Errores de validación',
      path: req.path,
      errors: errors.array().map((e: any) => ({
        field: e.param || e.path,
        message: e.msg
      })),
      ip: req.ip
    });
    return res.status(400).json({
      error: 'Validación fallida',
      details: errors.array()
    });
  }
  next();
};

// =====================================================
// VALIDACIONES PARA HOJAS DE RUTA
// =====================================================

export const validateCreateHojaRuta = [
  body('numero_hr')
    .trim()
    .notEmpty().withMessage('Número de hoja de ruta requerido')
    .isLength({ max: 50 }).withMessage('Número HR muy largo'),
  
  body('referencia')
    .trim()
    .notEmpty().withMessage('Referencia requerida')
    .isLength({ max: 255 }).withMessage('Referencia muy larga'),
  
  body('procedencia')
    .trim()
    .notEmpty().withMessage('Procedencia requerida')
    .isLength({ max: 255 }).withMessage('Procedencia muy larga'),
  
  body('fecha_limite')
    .notEmpty().withMessage('Fecha límite requerida')
    .isISO8601().withMessage('Fecha límite inválida'),
  
  body('numero_fojas')
    .optional({ values: 'falsy' })
    .customSanitizer(value => {
      // Si es string vacía o no es número válido, retornar undefined
      if (value === '' || value === null || value === undefined) return undefined;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? undefined : parsed;
    })
    .custom(value => {
      if (value === undefined) return true;
      return Number.isInteger(value) && value >= 1;
    }).withMessage('Número de fojas debe ser entero positivo'),
  
  body('prioridad')
    .optional()
    .isIn(['rutinario', 'prioritario', 'urgente', 'otros']).withMessage('Prioridad inválida'),
  
  body('estado')
    .optional()
    .isIn(['pendiente', 'enviada', 'en_proceso', 'finalizada', 'archivada']).withMessage('Estado inválido'),
  
  body('nombre_solicitante')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Nombre de solicitante muy largo'),
  
  body('telefono_celular')
    .optional()
    .trim()
    .matches(/^[0-9\+\-\s\(\)]{0,20}$/).withMessage('Teléfono inválido'),
  
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Observaciones muy largas'),
  
  handleValidationErrors
];

export const validateUpdateHojaRuta = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de hoja de ruta inválido'),
  
  body('numero_hr')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Número HR muy largo'),
  
  body('referencia')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Referencia muy larga'),
  
  body('prioridad')
    .optional()
    .isIn(['rutinario', 'prioritario', 'urgente', 'otros']).withMessage('Prioridad inválida'),
  
  body('estado')
    .optional()
    .isIn(['pendiente', 'enviada', 'en_proceso', 'finalizada', 'archivada']).withMessage('Estado inválido'),
  
  handleValidationErrors
];

export const validateGetHojaRuta = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de hoja de ruta inválido'),
  
  handleValidationErrors
];

// =====================================================
// VALIDACIONES PARA ENVÍOS
// =====================================================

export const validateCreateEnvio = [
  body('destinatario_nombre')
    .trim()
    .notEmpty().withMessage('Nombre del destinatario requerido')
    .isLength({ min: 2, max: 255 }).withMessage('Nombre del destinatario inválido'),
  
  body('destinatario_correo')
    .optional()
    .trim()
    .isEmail().withMessage('Email del destinatario inválido'),
  
  body('destinatario_numero')
    .optional()
    .trim()
    .matches(/^[0-9\+\-\s\(\)]{0,20}$/).withMessage('Número del destinatario inválido'),
  
  body('destino_id')
    .optional()
    .isInt({ min: 1 }).withMessage('ID de destino inválido'),
  
  body('hoja_id')
    .optional()
    .isInt({ min: 1 }).withMessage('ID de hoja de ruta inválido'),
  
  body('comentarios')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Comentarios muy largos'),
  
  body('archivos')
    .optional()
    .isArray().withMessage('Archivos debe ser un array'),
  
  handleValidationErrors
];

// =====================================================
// VALIDACIONES PARA BÚSQUEDAS Y FILTROS
// =====================================================

export const validateListQuery = [
  query('query')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Query muy largo'),
  
  query('estado_cumplimiento')
    .optional()
    .isIn(['pendiente', 'en_proceso', 'completado', 'vencido']).withMessage('Estado inválido'),
  
  query('incluir_completadas')
    .optional()
    .isIn(['true', 'false']).withMessage('incluir_completadas debe ser true o false'),
  
  handleValidationErrors
];

// =====================================================
// VALIDACIONES PARA CAMBIOS DE ESTADO
// =====================================================

export const validateChangeEstado = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de hoja de ruta inválido'),
  
  body('estado')
    .trim()
    .notEmpty().withMessage('Estado requerido')
    .isIn(['pendiente', 'en_proceso', 'completado', 'vencido']).withMessage('Estado inválido'),
  
  handleValidationErrors
];

export const validateChangeUbicacion = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de hoja de ruta inválido'),
  
  body('ubicacion_actual')
    .trim()
    .notEmpty().withMessage('Ubicación requerida')
    .isLength({ max: 255 }).withMessage('Ubicación muy larga'),
  
  body('responsable_actual')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Responsable muy largo'),
  
  handleValidationErrors
];

// =====================================================
// VALIDADORES DE SEGURIDAD ADICIONALES
// =====================================================

// Validar que el input no contiene SQL injection patterns
export const sqlInjectionGuard = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(-{2}|\/\*|\*\/|xp_|sp_)/gi,
    /(;|\||&&)/g
  ];

  const checkSuspicious = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkSuspicious(v));
    }
    return false;
  };

  if (checkSuspicious(req.body) || checkSuspicious(req.query) || checkSuspicious(req.params)) {
    logger.warn({
      message: 'Posible intento de SQL injection detectado',
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(400).json({
      error: 'Datos de entrada sospechosos',
      code: 'SUSPICIOUS_INPUT'
    });
  }

  next();
};
