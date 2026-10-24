import { sql } from '../db/client.js';
import { sendResponse, parseBody } from './_utils.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';

  try {
    if (method === 'POST') {
      const body = await parseBody(req);
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

      return sendResponse(res, 200, { success: true, message: 'Report saved to PostgreSQL' });
    }

    // Default GET:
    const rows = await sql`SELECT * FROM reports ORDER BY id DESC LIMIT 1`;
    const report = rows.length > 0 ? rows[0] : null;

    return sendResponse(res, 200, { success: true, report });
  } catch (err) {
    console.error("API Reports Error:", err);
    return sendResponse(res, 200, { success: false, error: err.message, report: null });
  }
}
