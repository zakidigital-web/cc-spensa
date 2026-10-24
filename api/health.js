import { sql } from '../db/client.js';
import { sendResponse } from './_utils.js';

export default async function handler(req, res) {
  try {
    const result = await sql`SELECT NOW() as current_time, current_database() as db, current_user as user`;
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*)::int FROM events) as events_count,
        (SELECT COUNT(*)::int FROM question_banks) as questions_count,
        (SELECT COUNT(*)::int FROM stage_states) as stages_count,
        (SELECT COUNT(*)::int FROM reports) as reports_count
    `;

    const data = {
      status: 'online',
      provider: 'Neon PostgreSQL',
      server_time: result[0].current_time,
      database: result[0].db,
      user: result[0].user,
      stats: counts[0]
    };

    return sendResponse(res, 200, data);
  } catch (err) {
    console.error("API Health Error:", err);
    return sendResponse(res, 200, {
      status: 'offline_or_error',
      provider: 'Neon PostgreSQL',
      error: err.message,
      hint: 'Periksa koneksi DATABASE_URL di Environment Variables Vercel.'
    });
  }
}
