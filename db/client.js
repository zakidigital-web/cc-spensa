import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

// Default Neon DB URL provided by user (used if Vercel env variable is not yet populated)
const FALLBACK_URL = 'postgresql://neondb_owner:npg_sc7MxLXdAbJ2@ep-snowy-waterfall-b8kvsjuh-pooler.c-14.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

export const connectionString = 
  process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  process.env.DATABASE_URL_UNPOOLED ||
  FALLBACK_URL;

let _sql = null;

export function getSql() {
  if (!_sql) {
    _sql = postgres(connectionString, {
      ssl: 'require',
      max: 5,
      idle_timeout: 15,
      connect_timeout: 10
    });
  }
  return _sql;
}

export const sql = getSql();
export default sql;
