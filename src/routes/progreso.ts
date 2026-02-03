import express, { Router } from 'express';
import {
  agregarProgreso,
  agregarProgresoMultiple,
  obtenerHistorialProgreso,
  obtenerUltimoProgreso,
  obtenerTodoProgreso,
  actualizarProgreso,
  eliminarProgreso,
  obtenerRespuestasUnidades
} from '../controllers/progresoController';
import { authenticateToken } from '../middleware/auth';

const router: Router = express.Router();

// Rutas protegidas
router.use(authenticateToken);

// POST - Agregar progreso a una sola hoja
// Body: { hoja_ruta_id, ubicacion_anterior, ubicacion_actual, notas? }
router.post('/agregar', agregarProgreso);

// POST - Agregar progreso a múltiples hojas (RÁPIDO)
// Body: { hojas: [{ hoja_ruta_id, ubicacion_anterior, ubicacion_actual, notas? }, ...] }
router.post('/agregar-multiple', agregarProgresoMultiple);

// GET - Obtener historial completo de una hoja
router.get('/historial/:hoja_ruta_id', obtenerHistorialProgreso);

// GET - Obtener respuestas de unidades para el preview de impresión
router.get('/respuestas/:hoja_ruta_id', obtenerRespuestasUnidades);

// GET - Obtener último progreso de una hoja
router.get('/ultimo/:hoja_ruta_id', obtenerUltimoProgreso);

// GET - Obtener todo el progreso (dashboard)
router.get('/', obtenerTodoProgreso);

// PUT - Actualizar un progreso
router.put('/:progreso_id', actualizarProgreso);

// DELETE - Eliminar un progreso
router.delete('/:progreso_id', eliminarProgreso);

export default router;
