import { sql } from '../db/client.js';

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

    if (res) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(data);
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    const errData = { status: 'error', message: err.message };
    if (res) return res.status(500).json(errData);
    return new Response(JSON.stringify(errData), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
