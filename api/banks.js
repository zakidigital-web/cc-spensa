import { sql } from '../db/client.js';
import { sendResponse, parseBody } from './_utils.js';

function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/["'“”‘’`]/g, '')
    .replace(/[.,:;?!]+$/g, '')
    .trim();
}

function deduplicateQuestions(items) {
  const map = new Map();
  items.forEach(it => {
    const k = normalizeKey(it.q || it.question);
    if (!k) return;
    if (!map.has(k)) {
      map.set(k, Object.assign({}, it));
    } else {
      const existing = map.get(k);
      if (!existing.img && (it.img || it.image_url)) {
        existing.img = it.img || it.image_url;
        existing.image_url = it.img || it.image_url;
      }
      const exOpts = Array.isArray(existing.o) ? existing.o : [];
      const newOpts = Array.isArray(it.o) ? it.o : [];
      if (exOpts.length === 0 && newOpts.length > 0) {
        existing.o = newOpts;
      }
      const exAns = String(existing.ans || existing.answer_key || '');
      const newAns = String(it.ans || it.answer_key || '');
      if (newAns.length > exAns.length) {
        existing.ans = newAns;
        existing.answer_key = newAns;
      }
    }
  });
  return Array.from(map.values());
}

async function insertQuestionRows(targetStage, questions) {
  if (!questions || questions.length === 0) return 0;
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
    const ansKey = q.ans ? String(q.ans) : (q.answer_key ? String(q.answer_key) : '');
    const pts = Number(q.val != null ? q.val : (q.points != null ? q.points : 0));
    const pen = Number(q.pen != null ? q.pen : (q.penalty != null ? q.penalty : 0));
    const img = q.img ? String(q.img) : (q.image_url ? String(q.image_url) : null);
    const cat = q.mapel || q.tipe || q.tier || q.category || 'Umum';

    return {
      id: finalId,
      stage: targetStage,
      category: cat,
      question: String(q.q || q.question || ''),
      options: opts,
      key_index: keyIdx,
      answer_key: ansKey,
      points: pts,
      penalty: pen,
      image_url: img,
      sort_order: i
    };
  });

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
  return rows.length;
}

export default async function handler(req, res) {
  const method = req.method || 'GET';
  const url = req.url ? new URL(req.url, 'http://localhost') : { searchParams: new URLSearchParams() };
  let stage = url.searchParams.get('stage') || 'all';
  const jenjang = url.searchParams.get('jenjang');
  const actionParam = url.searchParams.get('action');

  try {
    if (method === 'POST') {
      const body = await parseBody(req);
      const action = body.action || actionParam;

      // Special action: Clean all duplicate questions across the cloud database
      if (action === 'clean_duplicates') {
        const allRows = await sql`
          SELECT id, stage, category, question, options, key_index, answer_key, points, penalty, image_url, sort_order
          FROM question_banks
          ORDER BY stage, sort_order ASC
        `;
        const totalBefore = allRows.length;
        const byStage = {};
        allRows.forEach(r => {
          byStage[r.stage] = byStage[r.stage] || [];
          byStage[r.stage].push(r);
        });

        let totalAfter = 0;
        await sql`DELETE FROM question_banks`;

        for (const [stg, list] of Object.entries(byStage)) {
          const deduped = deduplicateQuestions(list);
          totalAfter += deduped.length;
          await insertQuestionRows(stg, deduped);
        }

        return sendResponse(res, 200, {
          success: true,
          purgedCount: totalBefore - totalAfter,
          totalRemaining: totalAfter,
          message: `Berhasil membersihkan ${totalBefore - totalAfter} soal duplikat di Cloud database.`
        });
      }

      let targetStage = body.stage;
      let questions = body.questions || [];

      if (!targetStage || !Array.isArray(questions)) {
        return sendResponse(res, 400, { success: false, error: "Invalid payload: stage and questions required" });
      }

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

      // Smart Merge mode: combine existing cloud questions + incoming questions, then deduplicate
      if (body.mode === 'smart_merge') {
        const existingRows = await sql`
          SELECT id, stage, category as mapel, category as tipe, category as tier, question as q, options as o, key_index as k, answer_key as ans, points as val, penalty as pen, image_url as img, sort_order
          FROM question_banks
          WHERE stage = ${targetStage}
          ORDER BY sort_order ASC
        `;
        const existingClean = existingRows.map(r => {
          let opts = r.o;
          if (typeof opts === 'string') {
            try { opts = JSON.parse(opts); } catch(e) {}
          }
          return { ...r, o: opts };
        });

        const combined = [...existingClean, ...questions];
        const mergedDeduped = deduplicateQuestions(combined);

        await sql`DELETE FROM question_banks WHERE stage = ${targetStage}`;
        await insertQuestionRows(targetStage, mergedDeduped);

        return sendResponse(res, 200, {
          success: true,
          count: mergedDeduped.length,
          purgedDuplicates: combined.length - mergedDeduped.length,
          stage: targetStage,
          message: `Smart merge berhasil: ${mergedDeduped.length} soal tersimpan (${combined.length - mergedDeduped.length} duplikat dibersihkan).`
        });
      }

      // Standard save: Auto-deduplicate incoming questions array to prevent duplicate insertions
      const dedupedQuestions = deduplicateQuestions(questions);

      // Delete existing questions for this targetStage
      await sql`DELETE FROM question_banks WHERE stage = ${targetStage}`;
      await insertQuestionRows(targetStage, dedupedQuestions);

      return sendResponse(res, 200, { 
        success: true, 
        count: dedupedQuestions.length, 
        duplicatesPurged: questions.length - dedupedQuestions.length,
        stage: targetStage, 
        message: `Questions for ${targetStage} successfully saved to database` 
      });
    }

    // Default GET:
    if (stage === 'penyisihan' && jenjang) {
      stage = `penyisihan_${jenjang}`;
    }

    let rows;
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
