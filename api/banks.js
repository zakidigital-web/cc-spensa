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
      const questions = body.questions || [];

      if (!targetStage || !Array.isArray(questions)) {
        throw new Error("Invalid payload: stage and questions array required");
      }

      await sql`DELETE FROM question_banks WHERE stage = ${targetStage}`;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qId = q.id || `${targetStage}_${i+1}`;
        const cat = q.mapel || q.tipe || q.tier || 'Umum';
        const opts = q.o ? sql.json(q.o) : null;
        const keyIdx = q.k != null ? q.k : null;
        const ansKey = q.ans || '';
        const pts = q.val || 0;
        const pen = q.pen || 0;
        const img = q.img || null;

        await sql`
          INSERT INTO question_banks (
            id, stage, category, question, options, key_index, answer_key, points, penalty, image_url, sort_order
          ) VALUES (
            ${qId}, ${targetStage}, ${cat}, ${q.q}, ${opts}, ${keyIdx}, ${ansKey}, ${pts}, ${pen}, ${img}, ${i}
          )
        `;
      }

      const responseData = { success: true, count: questions.length, message: `Questions for ${targetStage} saved` };
      if (res) return res.status(200).json(responseData);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Default GET:
    let rows;
    if (stage !== 'all') {
      rows = await sql`
        SELECT id, stage, category as mapel, question as q, options as o, key_index as k, answer_key as ans, points as val, penalty as pen, image_url as img
        FROM question_banks
        WHERE stage = ${stage}
        ORDER BY sort_order ASC
      `;
    } else {
      rows = await sql`
        SELECT id, stage, category as mapel, question as q, options as o, key_index as k, answer_key as ans, points as val, penalty as pen, image_url as img
        FROM question_banks
        ORDER BY stage, sort_order ASC
      `;
    }

    const payload = { success: true, count: rows.length, questions: rows };
    if (res) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), {
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
