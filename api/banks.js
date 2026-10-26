import { sql } from '../db/client.js';
import { sendResponse, parseBody } from './_utils.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';
  const url = req.url ? new URL(req.url, 'http://localhost') : { searchParams: new URLSearchParams() };
  let stage = url.searchParams.get('stage') || 'all';
  const jenjang = url.searchParams.get('jenjang');

  try {
    if (method === 'POST') {
      const body = await parseBody(req);
      let targetStage = body.stage;
      const questions = body.questions || [];

      if (!targetStage || !Array.isArray(questions)) {
        return sendResponse(res, 400, { success: false, error: "Invalid payload: stage and questions required" });
      }

      // If stage is penyisihan and jenjang is specified in payload, refine targetStage
      if (targetStage === 'penyisihan' && body.jenjang) {
        targetStage = `penyisihan_${body.jenjang}`;
      }

      if (targetStage === 'all' || targetStage === 'clear_all') {
        await sql`DELETE FROM question_banks`;
        return sendResponse(res, 200, { success: true, count: 0, message: "All question banks cleared" });
      }

      if (targetStage === 'penyisihan_all') {
        await sql`DELETE FROM question_banks WHERE stage LIKE 'penyisihan%'`;
        return sendResponse(res, 200, { success: true, count: 0, message: "All penyisihan questions cleared" });
      }

      // Delete existing questions for this targetStage
      await sql`DELETE FROM question_banks WHERE stage = ${targetStage}`;

      if (questions.length > 0) {
        const rows = questions.map((q, i) => {
          let qId = q.id;
          if (!qId) {
            qId = `${targetStage}_${i + 1}`;
          }
          const finalId = String(qId);
          let opts = null;
          if (Array.isArray(q.o)) {
            opts = JSON.stringify(q.o);
          } else if (typeof q.o === 'string' && q.o) {
            opts = q.o;
          }
          const keyIdx = q.k != null ? Number(q.k) : null;
          const ansKey = q.ans ? String(q.ans) : '';
          const pts = Number(q.val != null ? q.val : 0);
          const pen = Number(q.pen != null ? q.pen : 0);
          const img = q.img ? String(q.img) : null;
          const cat = q.mapel || q.tipe || q.tier || 'Umum';

          return {
            id: finalId,
            stage: targetStage,
            category: cat,
            question: String(q.q || ''),
            options: opts,
            key_index: keyIdx,
            answer_key: ansKey,
            points: pts,
            penalty: pen,
            image_url: img,
            sort_order: i
          };
        });

        // High-performance batch insert in single SQL statement
        await sql`
          INSERT INTO question_banks ${sql(rows, 'id', 'stage', 'category', 'question', 'options', 'key_index', 'answer_key', 'points', 'penalty', 'image_url', 'sort_order')}
          ON CONFLICT (id) DO UPDATE SET
            stage = EXCLUDED.stage,
            category = EXCLUDED.category,
            question = EXCLUDED.question,
            options = EXCLUDED.options,
            key_index = EXCLUDED.key_index,
            answer_key = EXCLUDED.answer_key,
            points = EXCLUDED.points,
            penalty = EXCLUDED.penalty,
            image_url = EXCLUDED.image_url,
            sort_order = EXCLUDED.sort_order,
            updated_at = NOW()
        `;
      }

      return sendResponse(res, 200, { 
        success: true, 
        count: questions.length, 
        stage: targetStage, 
        message: `Questions for ${targetStage} successfully saved to database` 
      });
    }

    // Default GET:
    let rows;
    if (stage === 'penyisihan' && jenjang) {
      stage = `penyisihan_${jenjang}`;
    }

    if (stage === 'penyisihan') {
      rows = await sql`
        SELECT id, stage, category as mapel, category as tipe, category as tier, question as q, options as o, key_index as k, answer_key as ans, points as val, penalty as pen, image_url as img, sort_order
        FROM question_banks
        WHERE stage LIKE 'penyisihan%'
        ORDER BY stage, sort_order ASC
      `;
    } else if (stage !== 'all') {
      rows = await sql`
        SELECT id, stage, category as mapel, category as tipe, category as tier, question as q, options as o, key_index as k, answer_key as ans, points as val, penalty as pen, image_url as img, sort_order
        FROM question_banks
        WHERE stage = ${stage}
        ORDER BY sort_order ASC
      `;
    } else {
      rows = await sql`
        SELECT id, stage, category as mapel, category as tipe, category as tier, question as q, options as o, key_index as k, answer_key as ans, points as val, penalty as pen, image_url as img, sort_order
        FROM question_banks
        ORDER BY stage, sort_order ASC
      `;
    }

    // Process rows to parse JSON options and assign jenjang
    const questions = rows.map(r => {
      let opts = r.o;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch(e) {}
      }
      let j = null;
      if (r.stage.startsWith('penyisihan_')) {
        j = parseInt(r.stage.split('_')[1], 10) || null;
      }
      return {
        id: r.id,
        stage: r.stage,
        jenjang: j,
        mapel: r.mapel,
        tipe: r.tipe,
        tier: r.tier,
        q: r.q,
        o: opts,
        k: r.k != null ? Number(r.k) : null,
        ans: r.ans || '',
        val: Number(r.val || 0),
        pen: Number(r.pen || 0),
        img: r.img || null
      };
    });

    return sendResponse(res, 200, { success: true, count: questions.length, questions: questions });
  } catch (err) {
    console.error("API Banks Error:", err);
    return sendResponse(res, 500, { success: false, error: err.message, questions: [] });
  }
}
