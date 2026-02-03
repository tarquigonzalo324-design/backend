import { Request, Response } from 'express';
import pool from '../config/database';

// Obtener notificaciones de un usuario
export const obtenerNotificaciones = async (req: Request, res: Response) => {
  try {
    const { usuario_id } = req.params;
    const { solo_no_leidas } = req.query;
    
    let sqlQuery = `
      SELECT n.*, hr.numero_hr, hr.referencia
      FROM notificaciones n
      LEFT JOIN hojas_ruta hr ON n.hoja_ruta_id = hr.id
      WHERE n.usuario_id = $1
    `;
    
    if (solo_no_leidas === 'true') {
      sqlQuery += ` AND n.leida = false`;
    }
    
    sqlQuery += ` ORDER BY n.created_at DESC`;
    
    const result = await pool.query(sqlQuery, [usuario_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

// Marcar notificación como leída
export const marcarComoLeida = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE notificaciones 
       SET leida = true, leida_en = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    res.status(500).json({ error: 'Error al marcar notificación como leída' });
  }
};

// Marcar todas las notificaciones como leídas
export const marcarTodasComoLeidas = async (req: Request, res: Response) => {
  try {
    const { usuario_id } = req.params;
    
    await pool.query(
      `UPDATE notificaciones 
       SET leida = true, leida_en = CURRENT_TIMESTAMP
       WHERE usuario_id = $1 AND leida = false`,
      [usuario_id]
    );
    
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Error al marcar todas como leídas:', error);
    res.status(500).json({ error: 'Error al marcar todas como leídas' });
  }
};

// Obtener conteo de notificaciones no leídas
export const contarNoLeidas = async (req: Request, res: Response) => {
  try {
    const { usuario_id } = req.params;
    
    const result = await pool.query(
      `SELECT COUNT(*) as no_leidas FROM notificaciones 
       WHERE usuario_id = $1 AND leida = false`,
      [usuario_id]
    );
    
    res.json({ no_leidas: parseInt(result.rows[0].no_leidas) });
  } catch (error) {
    console.error('Error al contar notificaciones no leídas:', error);
    res.status(500).json({ error: 'Error al contar notificaciones no leídas' });
  }
};

// Crear notificación manual (para testing o uso administrativo)
export const crearNotificacion = async (req: Request, res: Response) => {
  try {
    const { hoja_ruta_id, usuario_id, tipo, mensaje } = req.body;
    
    const result = await pool.query(
      `INSERT INTO notificaciones (hoja_ruta_id, usuario_id, tipo, mensaje)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [hoja_ruta_id, usuario_id, tipo, mensaje]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear notificación:', error);
    res.status(500).json({ error: 'Error al crear notificación' });
  }
};

// Función para generar notificaciones automáticas (ejecutar periódicamente)
export const generarNotificacionesAutomaticas = async (req: Request, res: Response) => {
  try {
    // Actualizar todas las hojas para recalcular días de vencimiento
    await pool.query(`
      UPDATE hojas_ruta 
      SET actualizado_en = CURRENT_TIMESTAMP 
      WHERE fecha_limite IS NOT NULL 
        AND estado_cumplimiento != 'completado'
    `);
    
    // Obtener estadísticas de notificaciones generadas
    const stats = await pool.query(`
      SELECT COUNT(*) as nuevas_notificaciones
      FROM notificaciones 
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    `);
    
    res.json({ 
      message: 'Notificaciones automáticas procesadas',
      nuevas_notificaciones: stats.rows[0].nuevas_notificaciones
    });
  } catch (error) {
    console.error('Error al generar notificaciones automáticas:', error);
    res.status(500).json({ error: 'Error al generar notificaciones automáticas' });
  }
};