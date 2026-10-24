import { sql } from '../db/client.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const seedFile = path.join(process.cwd(), 'seeds', 'seed-database.json');
    if (!fs.existsSync(seedFile)) {
      throw new Error("seeds/seed-database.json not found");
    }

    const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
    const cfg = seed.event_config;

    // 1. Events
    await sql`
      INSERT INTO events (
        id, title, school_name, event_date, sub_title,
        chairman_name, jury_chief_name, principal_name, theme, sound, updated_at
      ) VALUES (
        'default', ${cfg.title}, ${cfg.schoolName}, ${cfg.eventDate}, ${cfg.subTitle},
        ${cfg.chairmanName}, ${cfg.juryChiefName}, ${cfg.principalName}, ${cfg.theme}, ${cfg.sound}, NOW()
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

    // 2. Question Banks
    await sql`DELETE FROM question_banks`;
    let count = 0;
    for (const stage of ['penyisihan', 'semifinal', 'final']) {
      const questions = seed.banks[stage] || [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qId = q.id || `${stage}_${i+1}`;
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
            ${qId}, ${stage}, ${cat}, ${q.q}, ${opts}, ${keyIdx}, ${ansKey}, ${pts}, ${pen}, ${img}, ${i}
          )
        `;
        count++;
      }
    }

    // 3. Stage States
    for (const stage of ['penyisihan', 'semifinal', 'final']) {
      const stageState = seed.states[stage];
      if (stageState) {
        const config = stageState.cfg || { title: stageState.title, n: stageState.n, init: stageState.init, dur: stageState.dur };
        const stateData = stage === 'final'
          ? { names: stageState.names, score: stageState.score, done: stageState.done, started: stageState.started }
          : (stage === 'semifinal' ? { game: stageState.game } : { skor: stageState.skor });

        await sql`
          INSERT INTO stage_states (stage, config, state_data, updated_at)
          VALUES (${stage}, ${sql.json(config)}, ${sql.json(stateData)}, NOW())
          ON CONFLICT (stage) DO UPDATE SET
            config = EXCLUDED.config,
            state_data = EXCLUDED.state_data,
            updated_at = NOW()
        `;
      }
    }

    // 4. Reports
    const reportDocNum = `421.3/CC-FINAL/${new Date().getFullYear()}`;
    const signatories = {
      juryChief: cfg.juryChiefName,
      chairman: cfg.chairmanName,
      principal: cfg.principalName
    };

    await sql`
      INSERT INTO reports (
        doc_number, event_id, title, school_name, event_date, finalists, signatories, created_at
      ) VALUES (
        ${reportDocNum}, 'default', ${cfg.title}, ${cfg.schoolName}, ${cfg.eventDate},
        ${sql.json(seed.champions)}, ${sql.json(signatories)}, NOW()
      )
      ON CONFLICT (doc_number) DO UPDATE SET
        title = EXCLUDED.title,
        school_name = EXCLUDED.school_name,
        event_date = EXCLUDED.event_date,
        finalists = EXCLUDED.finalists,
        signatories = EXCLUDED.signatories
    `;

    const data = {
      success: true,
      message: 'PostgreSQL database successfully seeded!',
      total_questions: count,
      finalists: seed.champions.length
    };

    if (res) return res.status(200).json(data);
    return new Response(JSON.stringify(data), {
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
