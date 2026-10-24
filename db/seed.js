#!/usr/bin/env bun
/**
 * PostgreSQL Database Seeder for Neon Cloud Database
 * Seeds events, question_banks, stage_states, and reports tables.
 */

import fs from 'fs';
import path from 'path';
import { sql } from './client.js';

console.log("==================================================");
console.log("🌱 SEEDING NEON POSTGRESQL CLOUD DATABASE");
console.log("==================================================");

try {
  const seedFile = path.join(import.meta.dir, '..', 'seeds', 'seed-database.json');
  if (!fs.existsSync(seedFile)) {
    console.error("❌ File seeds/seed-database.json tidak ditemukan!");
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
  console.log("Memuat berkas seed JSON...");

  // 1. Seed events table
  console.log("1. Seeding table 'events'...");
  const cfg = seed.event_config;
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
  console.log("   ✓ Event metadata tersimpan.");

  // 2. Seed question_banks table
  console.log("2. Seeding table 'question_banks'...");
  await sql`DELETE FROM question_banks`;

  let totalQuestions = 0;
  for (const stage of ['penyisihan', 'semifinal', 'final']) {
    const questions = seed.banks[stage] || [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id || `${stage}_${i+1}`;
      const cat = q.mapel || q.tipe || q.tier || 'Umum';
      const opts = q.o ? JSON.stringify(q.o) : null;
      const keyIdx = q.k != null ? q.k : null;
      const ansKey = q.ans || '';
      const pts = q.val || 0;
      const pen = q.pen || 0;
      const img = q.img || null;

      await sql`
        INSERT INTO question_banks (
          id, stage, category, question, options, key_index, answer_key, points, penalty, image_url, sort_order
        ) VALUES (
          ${qId}, ${stage}, ${cat}, ${q.q}, ${opts ? sql.json(q.o) : null}, ${keyIdx}, ${ansKey}, ${pts}, ${pen}, ${img}, ${i}
        )
      `;
      totalQuestions++;
    }
    console.log(`   ✓ Bank Soal '${stage}': ${questions.length} butir tersimpan.`);
  }

  // 3. Seed stage_states table
  console.log("3. Seeding table 'stage_states'...");
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
      console.log(`   ✓ State babak '${stage}' tersimpan.`);
    }
  }

  // 4. Seed reports table (Berita Acara Resmi)
  console.log("4. Seeding table 'reports'...");
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
  console.log("   ✓ Berita Acara & Penetapan Juara resmi tersimpan.");

  // 5. Seed app_settings table
  console.log("5. Seeding table 'app_settings' (Fast Cache)...");
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES 
      ('event_config', ${sql.json(cfg)}, NOW()),
      ('state_penyisihan', ${sql.json(seed.states.penyisihan)}, NOW()),
      ('state_semifinal', ${sql.json(seed.states.semifinal)}, NOW()),
      ('state_final', ${sql.json(seed.states.final)}, NOW()),
      ('champions', ${sql.json(seed.champions)}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `;
  console.log("   ✓ Fast Cache settings tersimpan.");

  console.log("==================================================");
  console.log(`✅ BERHASIL SEEDING DATABASE POSTGRESQL!`);
  console.log(`   Total Soal      : ${totalQuestions} butir`);
  console.log(`   Babak Tersinkron: Penyisihan, Semifinal, Grand Final`);
  console.log(`   Juara Tersimpan : ${seed.champions.length} Finalis`);
  console.log("==================================================");
} catch (err) {
  console.error("❌ Gagal seeding database:", err);
  process.exit(1);
} finally {
  await sql.end();
}
