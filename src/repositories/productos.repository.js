import { pool } from '../config/db.js';

export async function listarActivos() {
  const { rows } = await pool.query(
    'SELECT id, nombre, descripcion, precio, imagen_url FROM productos WHERE activo ORDER BY id'
  );
  return rows;
}