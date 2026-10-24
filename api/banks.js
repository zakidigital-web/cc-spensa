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
      const questions = body.questions || [];

      if (!targetStage || !Array.isArray(questions)) {
        return sendResponse(res, 400, { success: false, error: "Invalid payload: stage and questions required" });
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

      return sendResponse(res, 200, { success: true, count: questions.length, message: `Questions for ${targetStage} saved` });
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

    return sendResponse(res, 200, { success: true, count: rows.length, questions: rows });
  } catch (err) {
    console.error("API Banks Error:", err);
    return sendResponse(res, 200, { success: false, error: err.message, questions: [] });
  }
}
