import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

// Load .env if present
dotenv.config();

const connectionString = 
  process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  process.env.DATABASE_URL_UNPOOLED ||
  '';

if (!connectionString) {
  console.warn("⚠️ Warning: DATABASE_URL tidak ditemukan di environment variables.");
}

export const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15
});

export default sql;
