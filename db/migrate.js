#!/usr/bin/env bun
/**
 * Database Migration Runner for Neon PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { sql } from './client.js';

console.log("==================================================");
console.log("🚀 MENJALANKAN MIGRASI DATABASE NEON POSTGRESQL");
console.log("==================================================");

try {
  const schemaPath = path.join(import.meta.dir, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log("Membaca schema.sql...");
  await sql.unsafe(schemaSql);
  console.log("✓ Tabel-tabel berhasil dibuat / divalidasi:");
  console.log("  1. app_settings    (Key-Value Settings Cache)");
  console.log("  2. events          (Identitas & Konfigurasi Acara)");
  console.log("  3. question_banks  (Bank Soal Penyisihan, Semifinal, Final)");
  console.log("  4. stage_states    (Live State & Riwayat Skor 3 Babak)");
  console.log("  5. reports         (Berita Acara & Penetapan Juara)");
  console.log("==================================================");
  console.log("✅ Migrasi PostgreSQL Sukses!");
} catch (err) {
  console.error("❌ Gagal migrasi database:", err);
  process.exit(1);
} finally {
  await sql.end();
}
