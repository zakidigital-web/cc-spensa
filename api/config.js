import { sql } from '../db/client.js';

export default async function handler(req, res) {
  const method = req.method || (req.headers ? 'GET' : 'GET');

  try {
    if (method === 'POST') {
      let body = {};
      if (typeof req.json === 'function') {
        body = await req.json();
      } else if (req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }

      await sql`
        INSERT INTO events (
          id, title, school_name, event_date, sub_title,
          chairman_name, jury_chief_name, principal_name, theme, sound, updated_at
        ) VALUES (
          'default', ${body.title || ''}, ${body.schoolName || ''}, ${body.eventDate || new Date().toISOString().split('T')[0]},
          ${body.subTitle || ''}, ${body.chairmanName || ''}, ${body.juryChiefName || ''},
          ${body.principalName || ''}, ${body.theme || 'dark'}, ${body.sound ?? true}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          school_name = EXCLUDED.school_name,
          event_date = EXCLUDED.event_date,
          sub_title = EXCLUDED.sub_title,
          chairman_name = EXCLUDED.chairman_name,
          jury_chief_name = EXCLUDED.jury_chief_name,
          principal_name = EXCLUDED.principal_name,
          theme = EXCLUDED.theme,
          sound = EXCLUDED.sound,
          updated_at = NOW()
      `;

      const responseData = { success: true, message: 'Config saved to PostgreSQL' };
      if (res) return res.status(200).json(responseData);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Default GET:
    const rows = await sql`SELECT * FROM events WHERE id = 'default' LIMIT 1`;
    let config = null;
    if (rows.length > 0) {
      const r = rows[0];
      config = {
        title: r.title,
        schoolName: r.school_name,
        eventDate: r.event_date ? new Date(r.event_date).toISOString().split('T')[0] : '',
        subTitle: r.sub_title,
        chairmanName: r.chairman_name,
        juryChiefName: r.jury_chief_name,
        principalName: r.principal_name,
        theme: r.theme,
        sound: r.sound
      };
    }

    if (res) return res.status(200).json({ success: true, config });
    return new Response(JSON.stringify({ success: true, config }), {
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
