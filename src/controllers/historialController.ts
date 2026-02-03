import { Request, Response } from 'express';
import { Pool } from 'pg';
import pool from '../config/database';

interface HistorialItem {
  id: number;
  tipo: 'añadido' | 'editado' | 'enviado';
  hoja_id?: number;
  numero_hr?: string;
  referencia?: string;
  procedencia?: string;
  destinatario?: string;
  descripcion: string;
  usuario_nombre?: string;
  fecha_actividad: string;
  datos_anteriores?: any;
  datos_nuevos?: any;
}

// Obtener historial completo con filtros
export const obtenerHistorial = async (req: Request, res: Response) => {
  try {
    const { tipo, limite = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        id,
        tipo,
        hoja_id,
        numero_hr,
        referencia,
        procedencia,
        destinatario,
        descripcion,
        usuario_nombre,
        fecha_actividad,
        datos_anteriores,
        datos_nuevos
      FROM historial_actividades
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Filtro por tipo si se especifica
    if (tipo && typeof tipo === 'string') {
      conditions.push(`tipo = $${params.length + 1}`);
      params.push(tipo);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY fecha_actividad DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limite as string));
    params.push(parseInt(offset as string));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener historial por categorías (para la página de historial)
export const obtenerHistorialPorCategorias = async (req: Request, res: Response) => {
  try {
    const limite = 10; // Límite por categoría
    
    // Consultas paralelas para cada tipo
    const [añadidosResult, editadosResult, enviadosResult] = await Promise.all([
      // Últimos añadidos
      pool.query(`
        SELECT 
          id, tipo, hoja_id, numero_hr, referencia, procedencia, 
          descripcion, usuario_nombre, fecha_actividad
        FROM historial_actividades 
        WHERE tipo = 'añadido' 
        ORDER BY fecha_actividad DESC 
        LIMIT $1
      `, [limite]),
      
      // Últimos editados
      pool.query(`
        SELECT 
          id, tipo, hoja_id, numero_hr, referencia, procedencia, 
          descripcion, usuario_nombre, fecha_actividad
        FROM historial_actividades 
        WHERE tipo = 'editado' 
        ORDER BY fecha_actividad DESC 
        LIMIT $1
      `, [limite]),
      
      // Últimos enviados
      pool.query(`
        SELECT 
          id, tipo, hoja_id, numero_hr, destinatario, 
          descripcion, usuario_nombre, fecha_actividad
        FROM historial_actividades 
        WHERE tipo = 'enviado' 
        ORDER BY fecha_actividad DESC 
        LIMIT $1
      `, [limite])
    ]);
    
    res.json({
      success: true,
      data: {
        añadidos: añadidosResult.rows,
        editados: editadosResult.rows,
        enviados: enviadosResult.rows
      }
    });
  } catch (error) {
    console.error('Error obteniendo historial por categorías:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas del historial
export const obtenerEstadisticasHistorial = async (req: Request, res: Response) => {
  try {
    const { periodo = '7' } = req.query; // días
    
    const result = await pool.query(`
      SELECT 
        tipo,
        COUNT(*) as cantidad
      FROM historial_actividades 
      WHERE fecha_actividad >= NOW() - INTERVAL '${periodo} days'
      GROUP BY tipo
      ORDER BY tipo
    `);
    
    // Formatear resultado
    const estadisticas = {
      añadidos: 0,
      editados: 0,
      enviados: 0,
      total: 0
    };
    
    result.rows.forEach(row => {
      estadisticas[row.tipo as keyof typeof estadisticas] = parseInt(row.cantidad);
      estadisticas.total += parseInt(row.cantidad);
    });
    
    res.json({
      success: true,
      data: estadisticas,
      periodo: `${periodo} días`
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Registrar actividad manualmente (para casos especiales)
export const registrarActividad = async (req: Request, res: Response) => {
  try {
    const {
      tipo,
      hoja_id,
      numero_hr,
      referencia,
      procedencia,
      destinatario,
      descripcion,
      usuario_nombre
    } = req.body;
    
    // Validaciones
    if (!tipo || !['añadido', 'editado', 'enviado'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de actividad inválido'
      });
    }
    
    if (!descripcion) {
      return res.status(400).json({
        success: false,
        error: 'Descripción es obligatoria'
      });
    }
    
    const result = await pool.query(`
      INSERT INTO historial_actividades (
        tipo, hoja_id, numero_hr, referencia, procedencia, 
        destinatario, descripcion, usuario_nombre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, fecha_actividad
    `, [tipo, hoja_id, numero_hr, referencia, procedencia, destinatario, descripcion, usuario_nombre]);
    
    res.status(201).json({
      success: true,
      message: 'Actividad registrada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error registrando actividad:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export default {
  obtenerHistorial,
  obtenerHistorialPorCategorias,
  obtenerEstadisticasHistorial,
  registrarActividad
};