import { Request, Response } from 'express';
import pool from '../config/database';

// GET /api/locaciones - público
export const listarLocaciones = async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT id, nombre, descripcion, COALESCE(NULLIF(tipo, ''), 'centro_acogida') AS tipo
      FROM locaciones
      WHERE activo = true
      ORDER BY tipo, nombre
    `;
    const result = await pool.query(query);

    // Organizado por tipo
    const organizadas: Record<string, any[]> = {};
    result.rows.forEach((row) => {
      const tipo = (row.tipo || 'otros').toLowerCase();
      if (!organizadas[tipo]) organizadas[tipo] = [];
      organizadas[tipo].push(row);
    });

    res.json({ success: true, locaciones: organizadas, flat: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error al obtener locaciones:', error);
    res.status(500).json({ success: false, error: 'Error al obtener locaciones' });
  }
};

// POST /api/locaciones - protegido
export const crearLocacion = async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion, tipo = 'centro_acogida', activo = true } = req.body || {};
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    const nombreLimpio = nombre.trim();
    const tipoLimpio = (tipo || 'centro_acogida').trim();

    const dup = await pool.query('SELECT id FROM locaciones WHERE LOWER(nombre) = LOWER($1)', [nombreLimpio]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'La locación ya existe' });
    }

    const insert = `
      INSERT INTO locaciones (nombre, descripcion, tipo, activo, created_at)
      VALUES ($1, $2, $3, $4, now())
      RETURNING id, nombre, descripcion, tipo, activo;
    `;
    const result = await pool.query(insert, [
      nombreLimpio,
      descripcion?.trim() || null,
      tipoLimpio,
      !!activo,
    ]);

    res.status(201).json({ success: true, locacion: result.rows[0] });
  } catch (error) {
    console.error('Error al crear locación:', error);
    res.status(500).json({ success: false, error: 'Error al crear locación' });
  }
};

export default { listarLocaciones, crearLocacion };
