import pool from './src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'database/migrations/004_add_rol_field_to_usuarios.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Ejecutando migración...');
    await pool.query(sql);
    
    console.log('✅ Migración ejecutada exitosamente');
    
    // Verificar que se agregó el campo
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='usuarios' AND column_name='rol'"
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Campo "rol" verificado en tabla usuarios');
    }
    
    // Ver los usuarios actuales y sus roles
    const users = await pool.query('SELECT id, username, nombre_completo, rol FROM usuarios');
    console.log('\n📋 Usuarios en la base de datos:');
    console.table(users.rows);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  }
}

runMigration();
