import { Router } from 'express';
import { 
  obtenerNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
  contarNoLeidas,
  crearNotificacion,
  generarNotificacionesAutomaticas
} from '../controllers/notificacionesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Obtener notificaciones de un usuario
router.get('/usuario/:usuario_id', authenticateToken, obtenerNotificaciones);

// Contar notificaciones no leídas
router.get('/usuario/:usuario_id/count', authenticateToken, contarNoLeidas);

// Marcar notificación como leída
router.patch('/:id/leer', authenticateToken, marcarComoLeida);

// Marcar todas las notificaciones como leídas
router.patch('/usuario/:usuario_id/leer-todas', authenticateToken, marcarTodasComoLeidas);

// Crear notificación manual
router.post('/', authenticateToken, crearNotificacion);

// Generar notificaciones automáticas (para cron job o trigger manual)
router.post('/generar-automaticas', authenticateToken, generarNotificacionesAutomaticas);

export default router;