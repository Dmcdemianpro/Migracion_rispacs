import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getClient, closePool } from '../lib/db/connection';

// Cargar variables de entorno desde .env.local manualmente
function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          const value = trimmed.substring(equalIndex + 1).trim();
          process.env[key] = value;
        }
      }
    }
  }
}

// Cargar variables antes de hacer cualquier cosa
loadEnvFile();

async function initDatabase() {
  console.log('Inicializando base de datos...');

  try {
    const client = await getClient();

    try {
      // Leer el archivo schema.sql
      const schemaPath = join(__dirname, '..', 'lib', 'db', 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf-8');

      // Ejecutar el schema
      await client.query(schemaSql);

      console.log('✓ Esquema de base de datos creado exitosamente');
      console.log('✓ Tabla informes_staging creada');
      console.log('✓ Índices creados');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initDatabase();
}

export default initDatabase;
