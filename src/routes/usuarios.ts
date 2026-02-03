import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  listarRoles,
  getMiPerfil
} from '../controllers/usuariosController';

const router = Router();

router.get('/me', authenticateToken, getMiPerfil);
router.get('/roles', authenticateToken, listarRoles);
router.get('/', authenticateToken, listarUsuarios);
router.get('/:id', authenticateToken, obtenerUsuario);
router.post('/', authenticateToken, crearUsuario);
router.put('/:id', authenticateToken, actualizarUsuario);
router.delete('/:id', authenticateToken, eliminarUsuario);

export default router;
