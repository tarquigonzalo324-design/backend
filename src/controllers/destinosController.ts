import { Request, Response } from 'express';
import pool from '../config/database';

export const listarDestinos = async (req: Request, res: Response) => {
  try {
    console.log('Intentando obtener destinos...');
    
    const query = `
      SELECT id, nombre, descripcion, COALESCE(NULLIF(tipo, ''), 'centro_acogida') AS tipo
      FROM locaciones 
      WHERE activo = true
      ORDER BY tipo, nombre
    `;
    
    console.log('Ejecutando query:', query);
    const result = await pool.query(query);
    console.log('Resultado de la query:', result.rows);
    
    const destinosOrganizados: Record<string, Array<{ id: number; nombre: string; descripcion: string; tipo: string }>> = {
      centro_acogida: [],
      direccion: [],
      departamento: [],
      administrativo: [],
      externo: [],
      otros: []
    };
    
    result.rows.forEach((row: any) => {
      const destino = {
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion,
        tipo: row.tipo
      };
      
      const tipoNormalizado = (row.tipo || '').toLowerCase();

      if (destinosOrganizados[tipoNormalizado]) {
        destinosOrganizados[tipoNormalizado].push(destino);
        return;
      }

      // Fallback por heurística si llega un tipo desconocido
      const nombre = row.nombre?.toLowerCase() || '';
      if (nombre.includes('centro') || nombre.includes('instituto')) {
        destinosOrganizados.centro_acogida.push(destino);
      } else if (nombre.includes('dirección') || nombre.includes('departamento') || 
                 nombre.includes('secretaría') || nombre.includes('unidad') || 
                 nombre.includes('jefatura') || nombre.includes('subdirección')) {
        destinosOrganizados.direccion.push(destino);
      } else {
        destinosOrganizados.otros.push(destino);
      }
    });
    
    console.log('Destinos organizados:', destinosOrganizados);
    
    res.json({
      success: true,
      destinos: destinosOrganizados,
      total: result.rows.length,
      flat: result.rows
    });
  } catch (error) {
    console.error('Error detallado al obtener destinos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener la lista de destinos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const crearDestino = async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion, responsable, tipo = 'centro_acogida', activo = true } = req.body || {};

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    const nombreLimpio = nombre.trim();
    const tipoLimpio = (tipo || 'centro_acogida').trim();

    // Evitar duplicados case-insensitive
    const dup = await pool.query('SELECT id FROM destinos WHERE LOWER(nombre) = LOWER($1)', [nombreLimpio]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'El destino ya existe' });
    }

    const insert = `
      INSERT INTO destinos (nombre, descripcion, responsable, tipo, activo, created_at)
      VALUES ($1, $2, $3, $4, $5, now())
      RETURNING id, nombre, descripcion, responsable, tipo, activo;
    `;

    const result = await pool.query(insert, [
      nombreLimpio,
      descripcion?.trim() || null,
      responsable?.trim() || null,
      tipoLimpio,
      !!activo
    ]);

    return res.status(201).json({ success: true, destino: result.rows[0] });
  } catch (error) {
    console.error('Error al crear destino:', error);
    return res.status(500).json({ success: false, error: 'Error interno al crear destino' });
  }
};