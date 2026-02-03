import { Router } from 'express';
import { 
  crearHojaRuta, 
  listarHojasRuta, 
  obtenerHojaRuta,
  actualizarHojaRuta,
  marcarCompletada,
  cambiarEstadoCumplimiento,
  obtenerEstadisticas,
  obtenerHojasPorVencer,
  cambiarUbicacion,
  cambiarEstadoCompleto,
  obtenerDashboardTiempoReal,
  actualizarEstadoHojaRuta,
  obtenerDestinos
} from '../controllers/hojasRutaController';
import { authenticateToken } from '../middleware/auth';
import { requireWriteAccess, requireReadAccess, requireAdminAccess } from '../middleware/authorization';
import {
  validateCreateHojaRuta,
  validateUpdateHojaRuta,
  validateGetHojaRuta,
  validateChangeEstado,
  validateChangeUbicacion,
  validateListQuery,
  sqlInjectionGuard
} from '../utils/validators';

const router = Router();

// Aplicar guardias de seguridad a todas las rutas
router.use(sqlInjectionGuard);

// ============================================
// RUTAS DE LECTURA (Todos los usuarios autenticados)
// ============================================

// Listar/buscar hojas de ruta - LECTURA
router.get(
  '/',
  authenticateToken,
  requireReadAccess,
  validateListQuery,
  listarHojasRuta
);

// Obtener estadísticas para dashboard - LECTURA
router.get(
  '/estadisticas/dashboard',
  authenticateToken,
  requireReadAccess,
  obtenerEstadisticas
);

// Obtener dashboard completo en tiempo real - LECTURA
router.get(
  '/dashboard/tiempo-real',
  authenticateToken,
  requireReadAccess,
  obtenerDashboardTiempoReal
);

// Obtener hojas por vencer - LECTURA
router.get(
  '/por-vencer/lista',
  authenticateToken,
  requireReadAccess,
  obtenerHojasPorVencer
);

// Obtener detalle de hoja de ruta - LECTURA
router.get(
  '/:id',
  authenticateToken,
  requireReadAccess,
  validateGetHojaRuta,
  obtenerHojaRuta
);

// ============================================
// RUTAS DE ESCRITURA (Solo desarrollador/admin)
// ============================================

// Crear hoja de ruta
router.post(
  '/',
  authenticateToken,
  validateCreateHojaRuta,
  crearHojaRuta
);

// Actualizar hoja de ruta completa - SOLO desarrollador/admin
router.put(
  '/:id',
  authenticateToken,
  requireWriteAccess,
  validateUpdateHojaRuta,
  actualizarHojaRuta
);

// Marcar hoja como completada - SOLO desarrollador/admin
router.patch(
  '/:id/completar',
  authenticateToken,
  requireWriteAccess,
  validateGetHojaRuta,
  marcarCompletada
);

// Cambiar estado de cumplimiento - SOLO desarrollador/admin
router.patch(
  '/:id/estado',
  authenticateToken,
  requireWriteAccess,
  validateChangeEstado,
  cambiarEstadoCumplimiento
);

// Cambiar estado completo - SOLO desarrollador/admin
router.patch(
  '/:id/estado-completo',
  authenticateToken,
  requireWriteAccess,
  validateChangeEstado,
  cambiarEstadoCompleto
);

// Cambiar ubicación de hoja de ruta - SOLO desarrollador/admin
router.patch(
  '/:id/ubicacion',
  authenticateToken,
  requireWriteAccess,
  validateChangeUbicacion,
  cambiarUbicacion
);

export default router;
