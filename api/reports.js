import { sql } from '../db/client.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';

  try {
    if (method === 'POST') {
      let body = {};
      if (typeof req.json === 'function') body = await req.json();
      else if (req.body) body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const docNumber = body.doc_number || `421.3/CC-FINAL/${new Date().getFullYear()}`;
      const title = body.title || 'LOMBA CERDAS CERMAT IFP';
      const schoolName = body.school_name || 'SMP NEGERI 1 KABUPATEN';
      const eventDate = body.event_date || new Date().toISOString().split('T')[0];
      const finalists = body.finalists || [];
      const signatories = body.signatories || {};

      await sql`
        INSERT INTO reports (
          doc_number, event_id, title, school_name, event_date, finalists, signatories, created_at
        ) VALUES (
          ${docNumber}, 'default', ${title}, ${schoolName}, ${eventDate},
          ${sql.json(finalists)}, ${sql.json(signatories)}, NOW()
        )
        ON CONFLICT (doc_number) DO UPDATE SET
          title = EXCLUDED.title,
          school_name = EXCLUDED.school_name,
          event_date = EXCLUDED.event_date,
          finalists = EXCLUDED.finalists,
          signatories = EXCLUDED.signatories
      `;

      const responseData = { success: true, message: 'Report saved to PostgreSQL' };
      if (res) return res.status(200).json(responseData);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Default GET:
    const rows = await sql`SELECT * FROM reports ORDER BY id DESC LIMIT 1`;
    const report = rows.length > 0 ? rows[0] : null;

    if (res) return res.status(200).json({ success: true, report });
    return new Response(JSON.stringify({ success: true, report }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    const errData = { success: false, error: err.message };
    if (res) return res.status(500).json(errData);
    return new Response(JSON.stringify(errData), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
