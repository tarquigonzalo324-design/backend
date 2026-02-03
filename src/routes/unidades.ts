import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listarUnidades,
  obtenerUnidad,
  crearUnidad,
  actualizarUnidad,
  eliminarUnidad,
  obtenerUsuariosUnidad
} from '../controllers/unidadesController';

const router = Router();

router.get('/', authenticateToken, listarUnidades);
router.get('/:id', authenticateToken, obtenerUnidad);
router.get('/:id/usuarios', authenticateToken, obtenerUsuariosUnidad);
router.post('/', authenticateToken, crearUnidad);
router.put('/:id', authenticateToken, actualizarUnidad);
router.delete('/:id', authenticateToken, eliminarUnidad);

export default router;
