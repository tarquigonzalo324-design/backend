import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const listarUnidades = async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT id, nombre, descripcion, direccion, telefono, activo, created_at
      FROM unidades
      WHERE activo = true
      ORDER BY nombre
    `;
    const result = await pool.query(query);
    res.json({ success: true, unidades: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    res.status(500).json({ success: false, error: 'Error al obtener unidades' });
  }
};

export const obtenerUnidad = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM unidades WHERE id = $1 AND activo = true',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Unidad no encontrada' });
    }
    res.json({ success: true, unidad: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener unidad:', error);
    res.status(500).json({ success: false, error: 'Error al obtener unidad' });
  }
};

export const crearUnidad = async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, descripcion, direccion, telefono } = req.body || {};
    const creado_por = req.userId;
    
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    const nombreLimpio = nombre.trim();
    const dup = await pool.query('SELECT id FROM unidades WHERE LOWER(nombre) = LOWER($1)', [nombreLimpio]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'La unidad ya existe' });
    }

    const insert = `
      INSERT INTO unidades (nombre, descripcion, direccion, telefono, creado_por, activo, created_at)
      VALUES ($1, $2, $3, $4, $5, true, now())
      RETURNING id, nombre, descripcion, direccion, telefono, activo, created_at;
    `;
    const result = await pool.query(insert, [
      nombreLimpio,
      descripcion?.trim() || null,
      direccion?.trim() || null,
      telefono?.trim() || null,
      creado_por
    ]);

    console.log('Unidad creada:', result.rows[0]);
    res.status(201).json({ success: true, unidad: result.rows[0] });
  } catch (error) {
    console.error('Error al crear unidad:', error);
    res.status(500).json({ success: false, error: 'Error al crear unidad' });
  }
};

export const actualizarUnidad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, direccion, telefono, activo } = req.body || {};

    const exists = await pool.query('SELECT id FROM unidades WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Unidad no encontrada' });
    }

    const update = `
      UPDATE unidades 
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          direccion = COALESCE($3, direccion),
          telefono = COALESCE($4, telefono),
          activo = COALESCE($5, activo),
          updated_at = now()
      WHERE id = $6
      RETURNING *;
    `;
    const result = await pool.query(update, [
      nombre?.trim(),
      descripcion?.trim(),
      direccion?.trim(),
      telefono?.trim(),
      activo,
      id
    ]);

    res.json({ success: true, unidad: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar unidad:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar unidad' });
  }
};

export const eliminarUnidad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE unidades SET activo = false, updated_at = now() WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Unidad no encontrada' });
    }

    res.json({ success: true, message: 'Unidad eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar unidad:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar unidad' });
  }
};

export const obtenerUsuariosUnidad = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.username, u.nombre_completo, r.nombre as rol
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.unidad_id = $1 AND u.activo = true AND u.eliminado_en IS NULL`,
      [id]
    );
    res.json({ success: true, usuarios: result.rows });
  } catch (error) {
    console.error('Error al obtener usuarios de unidad:', error);
    res.status(500).json({ success: false, error: 'Error al obtener usuarios' });
  }
};

export default { 
  listarUnidades, 
  obtenerUnidad, 
  crearUnidad, 
  actualizarUnidad, 
  eliminarUnidad,
  obtenerUsuariosUnidad 
};
