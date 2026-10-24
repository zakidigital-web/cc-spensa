#!/usr/bin/env bun
/**
 * CLI Database Seeder for Cerdas Cermat IFP
 * Usage:
 *   bun seed.js          # Generate & validate seeds/seed-database.json
 *   bun seed.js --apply  # Seed browser IndexedDB & LocalStorage via Playwright
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(import.meta.dir);
const BANKS_FILE = path.join(ROOT_DIR, 'js', 'default-banks.json');
const OUTPUT_SEED_FILE = path.join(ROOT_DIR, 'seeds', 'seed-database.json');

console.log("==================================================");
console.log("🌱 CERDAS CERMAT IFP - DATABASE SEED GENERATOR");
console.log("==================================================");

// 1. Read Question Banks
let defaultBanks = { penyisihan: [], semifinal: [], final: [] };
if (fs.existsSync(BANKS_FILE)) {
  defaultBanks = JSON.parse(fs.readFileSync(BANKS_FILE, 'utf-8'));
  console.log(`✓ Bank Soal terbaca:`);
  console.log(`  - Penyisihan : ${defaultBanks.penyisihan.length} butir`);
  console.log(`  - Semifinal  : ${defaultBanks.semifinal.length} butir`);
  console.log(`  - Grand Final: ${defaultBanks.final.length} butir`);
} else {
  console.error("❌ File js/default-banks.json tidak ditemukan!");
  process.exit(1);
}

// 2. Build Complete Tournament Seed Bundle
const today = new Date().toISOString().split('T')[0];
const seedBundle = {
  version: "1.0.0",
  created_at: new Date().toISOString(),
  description: "Official Database Seed for Cerdas Cermat IFP Suite (Penyisihan, Semifinal, Grand Final)",

  // 1. Event Metadata
  event_config: {
    title: "LOMBA CERDAS CERMAT IFP TINGKAT SMP TAHUN 2026",
    schoolName: "SMP NEGERI 1 KABUPATEN",
    eventDate: today,
    subTitle: "Kompetisi Interaktif Multidisiplin Berbasis Smart Screen IFP",
    chairmanName: "Drs. H. Ahmad Fauzi, M.Pd.",
    juryChiefName: "Dr. Hj. Siti Rahmawati, M.Si.",
    principalName: "H. Bambang Irawan, S.Pd., M.M.",
    theme: "dark",
    sound: true
  },

  // 2. Question Banks
  banks: {
    penyisihan: defaultBanks.penyisihan,
    semifinal: defaultBanks.semifinal,
    final: defaultBanks.final
  },

  // 3. Match Progression & Simulation States
  states: {
    // Babak 1: Kualifikasi Penyisihan (9 Tim, 3 Gelombang, Jenjang 9)
    penyisihan: {
      cfg: {
        jenjang: 9,
        nTim: 9,
        tim: {
          7: ["7A", "7B", "7C", "7D", "7E", "7F", "7G", "7H", "7I"],
          8: ["8A", "8B", "8C", "8D", "8E", "8F", "8G", "8H", "8I"],
          9: [
            "9C - Phoenix", "9A - Garuda", "9D - Rajawali",
            "9B - Elang", "9E - Cendrawasih", "9F - Jalak",
            "9G - Merpati", "9H - Kasuari", "9I - Albatros"
          ]
        },
        gel: 0,
        anak: 10,
        wSoal: 30,
        gMenit: 30,
        poin: 2,
        penalti: 0,
        mode: "batas",
        kunci: true,
        label: true,
        pin: ""
      },
      skor: {
        7: {},
        8: {},
        9: {
          "9C - Phoenix": 92,
          "9A - Garuda": 86,
          "9D - Rajawali": 80,
          "9B - Elang": 76,
          "9E - Cendrawasih": 72,
          "9F - Jalak": 66,
          "9G - Merpati": 62,
          "9H - Kasuari": 56,
          "9I - Albatros": 50
        }
      }
    },

    // Babak 2: Semifinal (45 Kotak Papan Interaktif, 9 Tim)
    semifinal: {
      cfg: {
        nTim: 9,
        tim: [
          "9C - Phoenix", "9A - Garuda", "9D - Rajawali",
          "9B - Elang", "9E - Cendrawasih", "9F - Jalak",
          "9G - Merpati", "9H - Kasuari", "9I - Albatros"
        ],
        lolos: 5,
        awal: "undi",
        ronde: "geser",
        suara: true,
        pin: "",
        jenis: [
          { k: "BS", n: "Benar / Salah", cnt: 18, val: 100, sec: 20 },
          { k: "PG1", n: "Pilihan Ganda I", cnt: 9, val: 150, sec: 30 },
          { k: "PG2", n: "Pilihan Ganda II", cnt: 9, val: 200, sec: 45 },
          { k: "ES", n: "Essay", cnt: 9, val: 300, sec: 90 }
        ]
      },
      game: {
        phase: "end",
        teams: [
          { name: "9C - Phoenix", score: 650 },
          { name: "9A - Garuda", score: 550 },
          { name: "9D - Rajawali", score: 450 },
          { name: "9B - Elang", score: 400 },
          { name: "9E - Cendrawasih", score: 350 },
          { name: "9F - Jalak", score: 250 },
          { name: "9G - Merpati", score: 200 },
          { name: "9H - Kasuari", score: 150 },
          { name: "9I - Albatros", score: 100 }
        ]
      }
    },

    // Babak 3: Grand Final (5 Finalis & Penetapan Juara)
    final: {
      title: "CERDAS CERMAT FINAL",
      n: 5,
      init: 100,
      dur: 90,
      np: 5,
      snd: 1,
      rb: 0,
      names: [
        "9C - Tim Phoenix",
        "9A - Tim Garuda",
        "9D - Tim Rajawali",
        "9B - Tim Elang",
        "9E - Tim Cendrawasih"
      ],
      score: [475, 395, 320, 260, 195],
      done: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
      started: true
    }
  },

  // 4. Juara & Finalis Resmi
  champions: [
    { rank: 1, title: "JUARA 1", badge: "🥇", name: "9C - Tim Phoenix", score: 475, desc: "Pemenang Utama / Medali Emas" },
    { rank: 2, title: "JUARA 2", badge: "🥈", name: "9A - Tim Garuda", score: 395, desc: "Runner Up 1 / Medali Perak" },
    { rank: 3, title: "JUARA 3", badge: "🥉", name: "9D - Tim Rajawali", score: 320, desc: "Runner Up 2 / Medali Perunggu" },
    { rank: 4, title: "JUARA HARAPAN 1", badge: "🎖️", name: "9B - Tim Elang", score: 260, desc: "Peringkat IV Finalis" },
    { rank: 5, title: "JUARA HARAPAN 2", badge: "🎖️", name: "9E - Tim Cendrawasih", score: 195, desc: "Peringkat V Finalis" }
  ]
};

// 3. Write to seeds/seed-database.json
fs.mkdirSync(path.dirname(OUTPUT_SEED_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_SEED_FILE, JSON.stringify(seedBundle, null, 2), 'utf-8');
console.log(`\n✅ Berkas Seed berhasil ditulis ke:`);
console.log(`   ${OUTPUT_SEED_FILE} (${fs.statSync(OUTPUT_SEED_FILE).size} bytes)`);

// 4. Handle --apply argument
const args = process.argv.slice(2);
if (args.includes('--apply')) {
  console.log("\n🚀 Menerapkan seed langsung ke browser IndexedDB...");
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
    });

    const page = await browser.newPage();
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async (data) => {
      if (window.DatabaseSeeder) {
        return await window.DatabaseSeeder.importDatabaseJSON(data);
      }
      return false;
    }, seedBundle);

    console.log("Result seed ke browser:", result ? "BERHASIL ✓" : "GAGAL ✕");
    await browser.close();
  } catch (err) {
    console.error("Gagal apply via Playwright:", err.message);
  }
}

console.log("\n💡 Tips:");
console.log("  - Untuk menjalankan seeder langsung di terminal: bun seed.js --apply");
console.log("  - Untuk menggunakan di web: Klik tombol '🌱 Seed Database' di Modal Pengaturan");
console.log("==================================================");
