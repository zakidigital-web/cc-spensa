import { chromium } from 'playwright';

async function runTests() {
  console.log("=== STARTING COMPREHENSIVE KUADRAT / FORMULA VERIFICATION ===");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // 1. Test penyisihan-cerdas-cermat.html window.fmt
  console.log("\n1. Navigating to penyisihan-cerdas-cermat.html...");
  await page.goto("http://localhost:3000/penyisihan-cerdas-cermat.html");

  const fmtResults = await page.evaluate(() => {
    const cases = [
      // Area & unit squares
      { id: "cm_dollar_sup", input: "Luas persegi dengan sisi 7 cm adalah ... cm$^2$", expectKatex: true },
      { id: "cm_raw_caret", input: "Luas persegi dengan sisi 7 cm adalah ... cm^2", expectKatex: true },
      { id: "cm_unicode", input: "Luas persegi dengan sisi 7 cm adalah ... cm²", expectKatex: true },
      { id: "opt_num_cm_raw", input: "49 cm^2", expectKatex: true },
      { id: "opt_num_cm_unicode", input: "28 cm²", expectKatex: true },
      { id: "opt_num_cm_dollar", input: "56 cm$^2$", expectKatex: true },
      { id: "opt_num_cm_proper", input: "$14\\text{ cm}^2$", expectKatex: true },
      { id: "unit_accel", input: "Percepatan 9.8 m/s^2", expectKatex: true },
      { id: "unit_m_sq", input: "Tanah seluas 100 m^2", expectKatex: true },

      // Quadratic equations & expressions
      { id: "quad_eq_raw", input: "Akar-akar dari persamaan kuadrat x^2 + 5x - 14 = 0 adalah ...", expectKatex: true },
      { id: "quad_eq_dollar", input: "Akar-akar dari persamaan kuadrat $x^2 + 5x - 14 = 0$ adalah ...", expectKatex: true },
      { id: "quad_unicode", input: "Persamaan kuadrat x² - 9 = 0", expectKatex: true },
      { id: "pythagoras", input: "Rumus segitiga siku-siku: a^2 + b^2 = c^2", expectKatex: true },
      { id: "func_quad", input: "Fungsi kuadrat f(x) = ax^2 + bx + c", expectKatex: true },
      { id: "quad_rhs", input: "Nilai x^2 = 14", expectKatex: true },
      { id: "parenthesized_pow", input: "Hasil dari (x + 2)^2 adalah x^2 + 4x + 4", expectKatex: true },
      { id: "roots_choices", input: "x = 2 atau x = -7", expectKatex: true },
      { id: "circle_area_latex", input: "Luas lingkaran L = \\pi r^2", expectKatex: true },
      { id: "circle_area_unicode", input: "Luas lingkaran L = πr²", expectKatex: true },
      { id: "pow_10", input: "Nilai 10^2 adalah 100", expectKatex: true },

      // Non-math preservation
      { id: "plain_non_math_1", input: "Hari raya Idulfitri dirayakan setelah bulan ...", expectKatex: false },
      { id: "plain_non_math_2", input: "Sila ke-3 Pancasila berbunyi ...", expectKatex: false },
      { id: "plain_non_math_3", input: "UUD 1945 disahkan pada tanggal ...", expectKatex: false }
    ];

    return cases.map(c => {
      const rendered = window.fmt(c.input);
      const hasKatex = rendered.includes('class="katex"');
      const hasError = rendered.includes('katex-error');
      const pass = c.expectKatex ? (hasKatex && !hasError) : (!hasError && !hasKatex);
      return {
        id: c.id,
        input: c.input,
        rendered,
        hasKatex,
        hasError,
        pass
      };
    });
  });

  const failedFmt = fmtResults.filter(r => !r.pass);
  console.log(`window.fmt test: ${fmtResults.length - failedFmt.length}/${fmtResults.length} passed.`);
  if (failedFmt.length > 0) {
    console.error("FAILURES in window.fmt:", JSON.stringify(failedFmt, null, 2));
    throw new Error("window.fmt verification failed");
  }

  // 2. Test live IFP 3-column screen rendering with quadratic formulas
  console.log("\n2. Testing live IFP 3-column screen rendering...");
  await page.evaluate(() => {
    const q1 = {
      id: "live-q1",
      jenjang: 9,
      mapel: "Matematika",
      q: "Akar-akar dari persamaan kuadrat x^2 + 5x - 14 = 0 adalah ...",
      o: ["x = 2 atau x = -7", "x = -2 atau x = 7", "x = 1 atau x = -14", "x = -1 atau x = 14"],
      k: 0
    };
    const q2 = {
      id: "live-q2",
      jenjang: 9,
      mapel: "Matematika",
      q: "Luas persegi dengan sisi 7 cm adalah ... cm$^2$",
      o: ["49 cm^2", "28 cm²", "14 cm$^2$", "$56\\text{ cm}^2$"],
      k: 0
    };
    const q3 = {
      id: "live-q3",
      jenjang: 9,
      mapel: "Matematika",
      q: "Rumus luas lingkaran adalah L = \\pi r^2. Jika r = 7 cm, berapa luasnya?",
      o: ["154 cm^2", "44 cm^2", "88 cm^2", "196 cm^2"],
      k: 0
    };

    bank.soal[9].unshift(q1, q2, q3);

    S = {
      phase: "play",
      cfg: { jenjang: 9, gel: 0, mode: "seq", wSoal: 0, wTot: 600, showKey: true, anak: 3, label: true, kunci: true },
      groups: [
        { nama: "9A", qs: [mkQ(q1, 1)], cyc: 1, i: 0, ans: [], turn: 0, tLeft: 0, done: false, sel: null, lock: false },
        { nama: "9B", qs: [mkQ(q2, 1)], cyc: 1, i: 0, ans: [], turn: 0, tLeft: 0, done: false, sel: null, lock: false },
        { nama: "9C", qs: [mkQ(q3, 1)], cyc: 1, i: 0, ans: [], turn: 0, tLeft: 0, done: false, sel: null, lock: false }
      ],
      total: 600000,
      gLeft: 600000,
      paused: false
    };
    window.S = S;
    QI[q1.id] = q1;
    QI[q2.id] = q2;
    QI[q3.id] = q3;
    view = "play";
    render();
  });

  await page.waitForTimeout(500);

  const ifpCheck = await page.evaluate(() => {
    const qEl0 = document.querySelector("#col0 .qt");
    const qEl1 = document.querySelector("#col1 .qt");
    const qEl2 = document.querySelector("#col2 .qt");

    const opt0 = Array.from(document.querySelectorAll("#col0 .opt-text"));
    const opt1 = Array.from(document.querySelectorAll("#col1 .opt-text"));
    const opt2 = Array.from(document.querySelectorAll("#col2 .opt-text"));

    return {
      col0_hasKatex: qEl0.querySelectorAll(".katex").length > 0,
      col1_hasKatex: qEl1.querySelectorAll(".katex").length > 0,
      col2_hasKatex: qEl2.querySelectorAll(".katex").length > 0,
      opt0_allHaveKatex: opt0.every(el => el.querySelectorAll(".katex").length > 0),
      opt1_allHaveKatex: opt1.every(el => el.querySelectorAll(".katex").length > 0),
      opt2_allHaveKatex: opt2.every(el => el.querySelectorAll(".katex").length > 0),
      noErrors: document.querySelectorAll(".katex-error").length === 0
    };
  });

  console.log("IFP screen live check:", ifpCheck);
  if (!ifpCheck.col0_hasKatex || !ifpCheck.col1_hasKatex || !ifpCheck.col2_hasKatex ||
      !ifpCheck.opt0_allHaveKatex || !ifpCheck.opt1_allHaveKatex || !ifpCheck.opt2_allHaveKatex ||
      !ifpCheck.noErrors) {
    throw new Error("Live IFP screen KaTeX check failed");
  }

  // 3. Test portal index.html and js/stages/penyisihan.js
  console.log("\n3. Navigating to portal index.html...");
  await page.goto("http://localhost:3000/");
  await page.waitForTimeout(600);

  const portalCheck = await page.evaluate(() => {
    // Check if StagePenyisihan exists
    const hasNormalize = typeof window.normalizeMath === "function";
    const test1 = window.normalizeMath ? window.normalizeMath("x^2 + 5x - 14 = 0") : "";
    const test2 = window.normalizeMath ? window.normalizeMath("49 cm^2") : "";
    return {
      hasNormalize,
      test1,
      test2,
      hasKatex: typeof window.katex !== "undefined"
    };
  });

  console.log("Portal check:", portalCheck);
  if (!portalCheck.hasNormalize || !portalCheck.test1.includes("$x^2 + 5x - 14 = 0$") || !portalCheck.test2.includes("$49\\text{ cm}^{2}$")) {
    throw new Error("Portal normalizeMath check failed");
  }

  console.log("\n✅ ALL KUADRAT / FORMULA TESTS PASSED 100%!");
  await browser.close();
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
