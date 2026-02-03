import { Router } from 'express';
import { listarLocaciones, crearLocacion } from '../controllers/locacionesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Público
router.get('/', listarLocaciones);

// Crear locación (protegido)
router.post('/', authenticateToken, crearLocacion);

export default router;
