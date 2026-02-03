import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const listarUsuarios = async (req: AuthRequest, res: Response) => {
  try {
    const query = `
      SELECT u.id, u.username, u.nombre_completo, u.activo, u.unidad_id,
             u.creado_en, u.ultimo_login, u.bloqueado,
             r.nombre as rol, r.id as rol_id,
             un.nombre as unidad_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN unidades un ON u.unidad_id = un.id
      WHERE u.eliminado_en IS NULL
      ORDER BY u.creado_en DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, usuarios: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ success: false, error: 'Error al listar usuarios' });
  }
};

export const obtenerUsuario = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.*, r.nombre as rol, un.nombre as unidad_nombre
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       LEFT JOIN unidades un ON u.unidad_id = un.id
       WHERE u.id = $1 AND u.eliminado_en IS NULL`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    const usuario = result.rows[0];
    delete usuario.password_hash;
    res.json({ success: true, usuario });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ success: false, error: 'Error al obtener usuario' });
  }
};

export const crearUsuario = async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, nombre_completo, unidad_id } = req.body || {};
    const creado_por = req.userId;

    if (!username || !password || !nombre_completo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, password y nombre_completo son requeridos' 
      });
    }

    const usernameLimpio = username.trim().toLowerCase();
    const dup = await pool.query('SELECT id FROM usuarios WHERE LOWER(username) = $1', [usernameLimpio]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'El usuario ya existe' });
    }

    const rolResult = await pool.query("SELECT id FROM roles WHERE nombre = 'Operador Unidad'");
    if (rolResult.rows.length === 0) {
      return res.status(500).json({ success: false, error: 'Rol Operador Unidad no encontrado' });
    }
    const rolId = rolResult.rows[0].id;

    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    const insert = `
      INSERT INTO usuarios (username, password_hash, nombre_completo, rol_id, unidad_id, creado_por, activo, creado_en)
      VALUES ($1, $2, $3, $4, $5, $6, true, now())
      RETURNING id, username, nombre_completo, rol_id, unidad_id, activo, creado_en;
    `;
    const result = await pool.query(insert, [
      usernameLimpio,
      passwordHash,
      nombre_completo.trim(),
      rolId,
      unidad_id || null,
      creado_por
    ]);

    console.log('Usuario creado:', result.rows[0]);
    res.status(201).json({ success: true, usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ success: false, error: 'Error al crear usuario' });
  }
};

export const actualizarUsuario = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre_completo, unidad_id, activo, password } = req.body || {};

    const exists = await pool.query('SELECT id FROM usuarios WHERE id = $1 AND eliminado_en IS NULL', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    let passwordHash = null;
    if (password) {
      const salt = await bcryptjs.genSalt(10);
      passwordHash = await bcryptjs.hash(password, salt);
    }

    const update = `
      UPDATE usuarios 
      SET nombre_completo = COALESCE($1, nombre_completo),
          unidad_id = COALESCE($2, unidad_id),
          activo = COALESCE($3, activo),
          password_hash = COALESCE($4, password_hash),
          actualizado_en = now()
      WHERE id = $5
      RETURNING id, username, nombre_completo, unidad_id, activo;
    `;
    const result = await pool.query(update, [
      nombre_completo?.trim(),
      unidad_id,
      activo,
      passwordHash,
      id
    ]);

    res.json({ success: true, usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
  }
};

export const eliminarUsuario = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const eliminado_por = req.userId;

    const protegidos = await pool.query(
      "SELECT id FROM usuarios WHERE id = $1 AND username IN ('admin', 'jose')",
      [id]
    );
    if (protegidos.rows.length > 0) {
      return res.status(403).json({ success: false, error: 'No se puede eliminar usuarios del sistema' });
    }

    const result = await pool.query(
      'UPDATE usuarios SET eliminado_en = now(), eliminado_por = $1, activo = false WHERE id = $2 RETURNING id',
      [eliminado_por, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
};

export const listarRoles = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, nombre, descripcion FROM roles WHERE activo = true ORDER BY nivel_jerarquia');
    res.json({ success: true, roles: result.rows });
  } catch (error) {
    console.error('Error al listar roles:', error);
    res.status(500).json({ success: false, error: 'Error al listar roles' });
  }
};

export const getMiPerfil = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const result = await pool.query(
      `SELECT u.id, u.username, u.nombre_completo, u.unidad_id, u.activo,
              r.nombre as rol, un.nombre as unidad_nombre
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       LEFT JOIN unidades un ON u.unidad_id = un.id
       WHERE u.id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ success: false, error: 'Error al obtener perfil' });
  }
};

export default {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  listarRoles,
  getMiPerfil
};
