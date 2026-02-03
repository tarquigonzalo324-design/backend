import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Middleware para verificar permisos de escritura (crear/editar/eliminar)
export const requireWriteAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  const userRole = req.userRole?.toLowerCase();
  
  console.log('🔐 Verificando permisos de escritura:', {
    userId: req.userId,
    userRole: req.userRole,
    method: req.method,
    path: req.path
  });
  
  // Roles permitidos para escritura (en minúsculas para comparación)
  const rolesPermitidos = ['desarrollador', 'admin', 'administrador', 'secretaria'];
  
  if (!userRole || !rolesPermitidos.includes(userRole)) {
    console.log('❌ Acceso denegado: Usuario sin permisos de escritura');
    return res.status(403).json({ 
      error: 'No tienes permisos para realizar esta acción',
      requiredRole: rolesPermitidos,
      yourRole: req.userRole
    });
  }
  
  console.log('✅ Permisos de escritura verificados correctamente');
  next();
};

// Middleware para verificar permisos de lectura (todos los usuarios autenticados)
export const requireReadAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  const userRole = req.userRole;
  
  console.log('📖 Verificando permisos de lectura:', {
    userId: req.userId,
    userRole: userRole
  });
  
  // Todos los usuarios autenticados pueden leer
  if (!userRole) {
    console.log('❌ Acceso denegado: Usuario no autenticado');
    return res.status(401).json({ 
      error: 'Usuario no autenticado' 
    });
  }
  
  console.log('✅ Permisos de lectura verificados correctamente');
  next();
};

// Middleware para verificar permisos de administrador
export const requireAdminAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  const userRole = req.userRole;
  
  console.log('👑 Verificando permisos de administrador:', {
    userId: req.userId,
    userRole: userRole
  });
  
  // Solo desarrolladores y admin pueden acceder a funciones administrativas
  if (userRole !== 'desarrollador' && userRole !== 'admin') {
    console.log('❌ Acceso denegado: Se requieren permisos de administrador');
    return res.status(403).json({ 
      error: 'Se requieren permisos de administrador para esta acción',
      requiredRole: ['desarrollador', 'admin'],
      yourRole: userRole
    });
  }
  
  console.log('✅ Permisos de administrador verificados correctamente');
  next();
};

// Función auxiliar para verificar roles
export const hasRole = (userRole: string, allowedRoles: string[]): boolean => {
  return allowedRoles.includes(userRole);
};

// Función auxiliar para verificar si puede editar
export const canEdit = (userRole: string): boolean => {
  return hasRole(userRole, ['desarrollador', 'admin']);
};

// Función auxiliar para verificar si puede crear
export const canCreate = (userRole: string): boolean => {
  return hasRole(userRole, ['desarrollador', 'admin', 'usuario']);
};

// Función auxiliar para verificar si puede leer
export const canRead = (userRole: string): boolean => {
  return hasRole(userRole, ['desarrollador', 'admin', 'usuario']);
};

export default {
  requireWriteAccess,
  requireReadAccess,
  requireAdminAccess,
  hasRole,
  canEdit,
  canCreate,
  canRead
};