import { Router } from 'express';
import { listarDestinos, crearDestino } from '../controllers/destinosController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Obtener todos los destinos (sin autenticación para dropdowns)
router.get('/', listarDestinos);

// Crear un nuevo destino (requiere autenticación)
router.post('/', authenticateToken, crearDestino);

export default router;