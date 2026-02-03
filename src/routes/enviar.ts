import { Router } from 'express';
import { 
  crearEnvio, 
  listarEnvios, 
  actualizarEstadoEnvio, 
  obtenerDestinos,
  obtenerEnviosMiUnidad,
  marcarRecibido,
  enviarRespuesta,
  redirigirEnvio,
  enviarAUnidad
} from '../controllers/enviarController';
import { authenticateToken } from '../middleware/auth';
import {
  validateCreateEnvio,
  validateListQuery,
  sqlInjectionGuard
} from '../utils/validators';

const router = Router();

router.use(sqlInjectionGuard);

router.get('/mi-unidad', authenticateToken, obtenerEnviosMiUnidad);

router.get('/destinos', authenticateToken, obtenerDestinos);

router.post('/', authenticateToken, validateCreateEnvio, crearEnvio);

router.post('/a-unidad', authenticateToken, enviarAUnidad);

router.get('/', authenticateToken, validateListQuery, listarEnvios);

router.put('/:id/estado', authenticateToken, actualizarEstadoEnvio);

router.put('/:id/recibir', authenticateToken, marcarRecibido);

router.put('/:id/responder', authenticateToken, enviarRespuesta);

router.put('/:id/redirigir', authenticateToken, redirigirEnvio);

export default router;
