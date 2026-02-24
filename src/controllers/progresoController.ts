import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

// Agregar progreso a una sola hoja de ruta
export const agregarProgreso = async (req: AuthRequest, res: Response) => {
  try {
    const { hoja_ruta_id, ubicacion_anterior, ubicacion_actual, notas } = req.body;
    const responsable_id = req.userId;

    if (!hoja_ruta_id || !ubicacion_actual) {
      return res.status(400).json({ 
        success: false, 
        message: 'hoja_ruta_id y ubicacion_actual son requeridos' 
      });
    }

    // Verificar que la hoja de ruta existe
    const hojaExiste = await pool.query(
      'SELECT id FROM hojas_ruta WHERE id = $1 AND eliminado_en IS NULL',
      [hoja_ruta_id]
    );

    if (hojaExiste.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Hoja de ruta no encontrada' 
      });
    }

    // Insertar el progreso
    const resultado = await pool.query(
      `INSERT INTO progreso_hojas_ruta 
       (hoja_ruta_id, ubicacion_anterior, ubicacion_actual, responsable_id, notas)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, hoja_ruta_id, ubicacion_anterior, ubicacion_actual, responsable_id, notas, fecha_registro`,
      [hoja_ruta_id, ubicacion_anterior, ubicacion_actual, responsable_id, notas]
    );

    // Actualizar ubicacion_actual en hojas_ruta
    await pool.query(
      'UPDATE hojas_ruta SET ubicacion_actual = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2',
      [ubicacion_actual, hoja_ruta_id]
    );

    console.log(`✅ Progreso agregado a hoja ${hoja_ruta_id}`);

    res.status(201).json({
      success: true,
      message: 'Progreso registrado exitosamente',
      progreso: resultado.rows[0]
    });
  } catch (error) {
    console.error('❌ Error al agregar progreso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al registrar progreso',
      error: (error as Error).message 
    });
  }
};

// Agregar progreso a múltiples hojas de ruta (RÁPIDO - sin recargar)
export const agregarProgresoMultiple = async (req: AuthRequest, res: Response) => {
  try {
    const { hojas } = req.body; // Array de { hoja_ruta_id, ubicacion_anterior, ubicacion_actual, notas }
    const responsable_id = req.userId;

    if (!Array.isArray(hojas) || hojas.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un array de hojas con al menos un elemento' 
      });
    }

    const resultados = [];
    const errores = [];

    for (const hoja of hojas) {
      try {
        const { hoja_ruta_id, ubicacion_anterior, ubicacion_actual, notas } = hoja;

        if (!hoja_ruta_id || !ubicacion_actual) {
          errores.push({ 
            hoja_ruta_id, 
            error: 'hoja_ruta_id y ubicacion_actual son requeridos' 
          });
          continue;
        }

        // Verificar que existe
        const hojaExiste = await pool.query(
          'SELECT id FROM hojas_ruta WHERE id = $1 AND eliminado_en IS NULL',
          [hoja_ruta_id]
        );

        if (hojaExiste.rows.length === 0) {
          errores.push({ 
            hoja_ruta_id, 
            error: 'Hoja de ruta no encontrada' 
          });
          continue;
        }

        // Insertar progreso
        const resultado = await pool.query(
          `INSERT INTO progreso_hojas_ruta 
           (hoja_ruta_id, ubicacion_anterior, ubicacion_actual, responsable_id, notas)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, hoja_ruta_id, ubicacion_anterior, ubicacion_actual, fecha_registro`,
          [hoja_ruta_id, ubicacion_anterior, ubicacion_actual, responsable_id, notas]
        );

        // Actualizar ubicacion_actual
        await pool.query(
          'UPDATE hojas_ruta SET ubicacion_actual = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2',
          [ubicacion_actual, hoja_ruta_id]
        );

        resultados.push(resultado.rows[0]);
      } catch (error) {
        errores.push({ 
          error: (error as Error).message 
        });
      }
    }

    console.log(`✅ Múltiple progreso: ${resultados.length} registrados, ${errores.length} errores`);

    res.status(201).json({
      success: errores.length === 0,
      message: `${resultados.length} progreso(s) registrado(s)${errores.length > 0 ? `, ${errores.length} error(es)` : ''}`,
      registrados: resultados,
      errores: errores.length > 0 ? errores : undefined
    });
  } catch (error) {
    console.error('❌ Error al agregar progreso múltiple:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al registrar progreso múltiple',
      error: (error as Error).message 
    });
  }
};

// Obtener historial completo de una hoja de ruta
export const obtenerHistorialProgreso = async (req: Request, res: Response) => {
  try {
    const { hoja_ruta_id } = req.params;

    if (!hoja_ruta_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hoja_ruta_id es requerido' 
      });
    }

    const resultado = await pool.query(
      `SELECT 
        phr.id,
        phr.hoja_ruta_id,
        phr.ubicacion_anterior AS "desde",
        phr.ubicacion_actual AS "hacia",
        u.nombre_completo AS "registrado_por",
        u.username,
        phr.notas AS "observaciones",
        phr.fecha_registro AS "fecha",
        hr.numero_hr,
        hr.nombre_solicitante,
        hr.estado_cumplimiento
      FROM progreso_hojas_ruta phr
      LEFT JOIN usuarios u ON phr.responsable_id = u.id
      LEFT JOIN hojas_ruta hr ON phr.hoja_ruta_id = hr.id
      WHERE phr.hoja_ruta_id = $1 AND hr.eliminado_en IS NULL
      ORDER BY phr.fecha_registro DESC`,
      [hoja_ruta_id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No hay progreso registrado para esta hoja de ruta' 
      });
    }

    console.log(`✅ Historial obtenido para hoja ${hoja_ruta_id}: ${resultado.rows.length} registros`);

    res.json({
      success: true,
      total: resultado.rows.length,
      historial: resultado.rows
    });
  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener historial',
      error: (error as Error).message 
    });
  }
};

// Obtener el último progreso de una hoja (vista rápida)
export const obtenerUltimoProgreso = async (req: Request, res: Response) => {
  try {
    const { hoja_ruta_id } = req.params;

    if (!hoja_ruta_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hoja_ruta_id es requerido' 
      });
    }

    const resultado = await pool.query(
      `SELECT * FROM vw_ultimo_progreso_hojas_ruta WHERE hoja_ruta_id = $1`,
      [hoja_ruta_id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No hay progreso registrado para esta hoja de ruta' 
      });
    }

    console.log(`✅ Último progreso obtenido para hoja ${hoja_ruta_id}`);

    res.json({
      success: true,
      progreso: resultado.rows[0]
    });
  } catch (error) {
    console.error('❌ Error al obtener último progreso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener progreso',
      error: (error as Error).message 
    });
  }
};

// Obtener progreso de todas las hojas de ruta (dashboard)
export const obtenerTodoProgreso = async (req: Request, res: Response) => {
  try {
    const { limite = 50, offset = 0 } = req.query;

    const resultado = await pool.query(
      `SELECT * FROM vw_ultimo_progreso_hojas_ruta 
       ORDER BY fecha_registro DESC 
       LIMIT $1 OFFSET $2`,
      [limite, offset]
    );

    const total = await pool.query('SELECT COUNT(DISTINCT hoja_ruta_id) as total FROM progreso_hojas_ruta');

    console.log(`✅ Progreso obtenido: ${resultado.rows.length} hojas`);

    res.json({
      success: true,
      total: total.rows[0].total,
      progreso: resultado.rows
    });
  } catch (error) {
    console.error('❌ Error al obtener progreso general:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener progreso',
      error: (error as Error).message 
    });
  }
};

// Actualizar un progreso existente
export const actualizarProgreso = async (req: Request, res: Response) => {
  try {
    const { progreso_id } = req.params;
    const { ubicacion_anterior, ubicacion_actual, notas } = req.body;

    if (!progreso_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'progreso_id es requerido' 
      });
    }

    if (!ubicacion_anterior && !ubicacion_actual && !notas) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se debe proporcionar al menos un campo para actualizar' 
      });
    }

    // Obtener progreso actual
    const progresoActual = await pool.query(
      'SELECT * FROM progreso_hojas_ruta WHERE id = $1',
      [progreso_id]
    );

    if (progresoActual.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Progreso no encontrado' 
      });
    }

    const nuevaUbicacion = ubicacion_actual || progresoActual.rows[0].ubicacion_actual;

    // Actualizar progreso
    const resultado = await pool.query(
      `UPDATE progreso_hojas_ruta 
       SET ubicacion_anterior = COALESCE($1, ubicacion_anterior),
           ubicacion_actual = COALESCE($2, ubicacion_actual),
           notas = COALESCE($3, notas),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [ubicacion_anterior, ubicacion_actual, notas, progreso_id]
    );

    // Actualizar ubicacion_actual en hojas_ruta si cambió
    if (ubicacion_actual) {
      await pool.query(
        'UPDATE hojas_ruta SET ubicacion_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [nuevaUbicacion, progresoActual.rows[0].hoja_ruta_id]
      );
    }

    console.log(`✅ Progreso ${progreso_id} actualizado`);

    res.json({
      success: true,
      message: 'Progreso actualizado exitosamente',
      progreso: resultado.rows[0]
    });
  } catch (error) {
    console.error('❌ Error al actualizar progreso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar progreso',
      error: (error as Error).message 
    });
  }
};

// Eliminar un progreso
export const eliminarProgreso = async (req: Request, res: Response) => {
  try {
    const { progreso_id } = req.params;

    if (!progreso_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'progreso_id es requerido' 
      });
    }

    const resultado = await pool.query(
      'DELETE FROM progreso_hojas_ruta WHERE id = $1 RETURNING id',
      [progreso_id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Progreso no encontrado' 
      });
    }

    console.log(`✅ Progreso ${progreso_id} eliminado`);

    res.json({
      success: true,
      message: 'Progreso eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar progreso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar progreso',
      error: (error as Error).message 
    });
  }
};

export const obtenerRespuestasUnidades = async (req: Request, res: Response) => {
  try {
    const { hoja_ruta_id } = req.params;

    if (!hoja_ruta_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hoja_ruta_id es requerido' 
      });
    }

    const resultado = await pool.query(
      `SELECT 
        phr.id,
        phr.hoja_ruta_id,
        phr.accion,
        phr.ubicacion_actual AS destino,
        phr.notas AS instrucciones,
        phr.respuesta,
        phr.fecha_registro AS fecha_recepcion,
        u.nombre_completo AS responsable,
        un.nombre AS unidad_nombre
      FROM progreso_hojas_ruta phr
      LEFT JOIN usuarios u ON phr.responsable_id = u.id
      LEFT JOIN unidades un ON phr.unidad_destino_id = un.id
      WHERE phr.hoja_ruta_id = $1 
        AND LOWER(phr.accion) IN ('recibido', 'respondido', 'redirigido', 'enviado_a_unidad', 'enviado')
      ORDER BY phr.fecha_registro ASC`,
      [hoja_ruta_id]
    );

    const respuestas = resultado.rows.map((row, index) => ({
      seccion: index + 1,
      destino: row.unidad_nombre || row.destino || '',
      fecha_recepcion: row.fecha_recepcion,
      instrucciones: row.instrucciones || '',
      respuesta: row.respuesta || '',
      accion: row.accion,
      responsable: row.responsable
    }));

    res.json({
      success: true,
      total: respuestas.length,
      respuestas
    });
  } catch (error) {
    console.error('❌ Error al obtener respuestas de unidades:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener respuestas',
      error: (error as Error).message 
    });
  }
};
