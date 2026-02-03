import { Router } from 'express';
import { 
  login, 
  verificarToken,
  validateLogin,
  refreshTokenEndpoint,
  logout
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/login - Login con validación
router.post('/login', validateLogin, login);

// POST /api/auth/refresh - Refrescar token
router.post('/refresh', refreshTokenEndpoint);

// GET /api/auth/verify - Verificar token válido
router.get('/verify', authenticateToken, verificarToken);

// POST /api/auth/logout - Logout del usuario
router.post('/logout', authenticateToken, logout);

export default router;