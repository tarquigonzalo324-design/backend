import express from 'express';
import { 
  obtenerHistorial, 
  obtenerHistorialPorCategorias, 
  obtenerEstadisticasHistorial, 
  registrarActividad 
} from '../controllers/historialController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/historial - Obtener historial completo con filtros
router.get('/', obtenerHistorial);

// GET /api/historial/categorias - Obtener historial por categorías (para la página principal)
router.get('/categorias', obtenerHistorialPorCategorias);

// GET /api/historial/estadisticas - Obtener estadísticas del historial
router.get('/estadisticas', obtenerEstadisticasHistorial);

// POST /api/historial - Registrar actividad manual
router.post('/', registrarActividad);

export default router;