import { sql } from '../db/client.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';
  const url = req.url ? new URL(req.url, 'http://localhost') : { searchParams: new URLSearchParams() };
  const stage = url.searchParams.get('stage') || 'all';

  try {
    if (method === 'POST') {
      let body = {};
      if (typeof req.json === 'function') body = await req.json();
      else if (req.body) body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const targetStage = body.stage;
      const config = body.config || {};
      const stateData = body.state_data || {};

      if (!targetStage) throw new Error("Stage is required");

      await sql`
        INSERT INTO stage_states (stage, config, state_data, updated_at)
        VALUES (${targetStage}, ${sql.json(config)}, ${sql.json(stateData)}, NOW())
        ON CONFLICT (stage) DO UPDATE SET
          config = EXCLUDED.config,
          state_data = EXCLUDED.state_data,
          updated_at = NOW()
      `;

      const responseData = { success: true, message: `State for ${targetStage} saved` };
      if (res) return res.status(200).json(responseData);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Default GET:
    if (stage !== 'all') {
      const rows = await sql`SELECT stage, config, state_data, updated_at FROM stage_states WHERE stage = ${stage} LIMIT 1`;
      const data = rows.length > 0 ? rows[0] : null;
      if (res) return res.status(200).json({ success: true, state: data });
      return new Response(JSON.stringify({ success: true, state: data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const rows = await sql`SELECT stage, config, state_data, updated_at FROM stage_states`;
    const statesMap = {};
    rows.forEach(r => { statesMap[r.stage] = r; });

    if (res) return res.status(200).json({ success: true, states: statesMap });
    return new Response(JSON.stringify({ success: true, states: statesMap }), {
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
