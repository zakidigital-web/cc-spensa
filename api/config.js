import { sql } from '../db/client.js';
import { sendResponse, parseBody } from './_utils.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';

  try {
    if (method === 'POST') {
      const body = await parseBody(req);

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

      return sendResponse(res, 200, { success: true, message: 'Config saved to PostgreSQL' });
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

    return sendResponse(res, 200, { success: true, config });
  } catch (err) {
    console.error("API Config Error:", err);
    return sendResponse(res, 200, { success: false, error: err.message });
  }
}
