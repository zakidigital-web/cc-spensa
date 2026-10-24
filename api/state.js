import { sql } from '../db/client.js';
import { sendResponse, parseBody } from './_utils.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';
  const url = req.url ? new URL(req.url, 'http://localhost') : { searchParams: new URLSearchParams() };
  const stage = url.searchParams.get('stage') || 'all';

  try {
    if (method === 'POST') {
      const body = await parseBody(req);
      const targetStage = body.stage;
      const config = body.config || {};
      const stateData = body.state_data || {};

      if (!targetStage) {
        return sendResponse(res, 400, { success: false, error: "Stage is required" });
      }

      await sql`
        INSERT INTO stage_states (stage, config, state_data, updated_at)
        VALUES (${targetStage}, ${sql.json(config)}, ${sql.json(stateData)}, NOW())
        ON CONFLICT (stage) DO UPDATE SET
          config = EXCLUDED.config,
          state_data = EXCLUDED.state_data,
          updated_at = NOW()
      `;

      return sendResponse(res, 200, { success: true, message: `State for ${targetStage} saved` });
    }

    // Default GET:
    if (stage !== 'all') {
      const rows = await sql`SELECT stage, config, state_data, updated_at FROM stage_states WHERE stage = ${stage} LIMIT 1`;
      const data = rows.length > 0 ? rows[0] : null;
      return sendResponse(res, 200, { success: true, state: data });
    }

    const rows = await sql`SELECT stage, config, state_data, updated_at FROM stage_states`;
    const statesMap = {};
    rows.forEach(r => { statesMap[r.stage] = r; });

    return sendResponse(res, 200, { success: true, states: statesMap });
  } catch (err) {
    console.error("API State Error:", err);
    return sendResponse(res, 200, { success: false, error: err.message, state: null });
  }
}
