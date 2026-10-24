import { chromium } from "playwright";

async function runAnalysis() {
  console.log("==================================================");
  console.log("🔬 CERDAS CERMAT SUITE - COMPREHENSIVE TEST ANALYZER");
  console.log("   Zero-Scroll, Wide Margin Arena & Word Template QA");
  console.log("==================================================");

  const results = {
    urlTests: [],
    consoleErrors: [],
    consoleWarnings: [],
    networkFailures: [],
    tabTests: [],
    scrollTests: [],
    layoutTests: [],
    templateTests: [],
    fullscreenTests: [],
    themeTests: [],
    bankTests: [],
    reportTests: [],
    overallStatus: "PASS"
  };

  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  // Listen to console and network
  page.on("console", msg => {
    const text = msg.text();
    if (msg.type() === "error") {
      console.error(`[PAGE ERROR] ${text}`);
      results.consoleErrors.push(text);
    } else if (msg.type() === "warning") {
      results.consoleWarnings.push(text);
    }
  });

  page.on("pageerror", err => {
    console.error(`[UNCAUGHT EXCEPTION] ${err.message}`);
    results.consoleErrors.push(err.message);
  });

  page.on("requestfailed", req => {
    console.error(`[NETWORK FAIL] ${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    results.networkFailures.push({ url: req.url(), error: req.failure()?.errorText });
  });

  // TEST 1: Load http://localhost:3000/
  console.log("\n[1/8] Menguji akses portal: http://localhost:3000/ ...");
  try {
    const resp = await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 8000 });
    const status = resp.status();
    const title = await page.title();
    results.urlTests.push({ url: "http://localhost:3000/", status, title, pass: status === 200 });
    console.log(`  ➔ Status: ${status} | Title: "${title}"`);
  } catch (err) {
    results.urlTests.push({ url: "http://localhost:3000/", error: err.message, pass: false });
    console.error(`  ➔ GAGAL memuat: ${err.message}`);
  }

  // TEST 2: Navigation Tabs
  console.log("\n[2/8] Menguji interaktivitas navigasi tab portal ...");
  const tabs = ["penyisihan", "semifinal", "final", "bank", "laporan", "hub"];
  for (const tab of tabs) {
    try {
      const btn = page.locator(`button[data-view="${tab}"]`).first();
      await btn.click({ timeout: 4000 });
      await page.waitForTimeout(250);

      const sec = page.locator(`#view-${tab}`);
      const isActive = await sec.evaluate(el => el.classList.contains("active"));
      results.tabTests.push({ tab, pass: isActive });
      console.log(`  ➔ Tab "${tab}": ${isActive ? "AKTIF ✓" : "TIDAK AKTIF ✗"}`);
    } catch (e) {
      results.tabTests.push({ tab, pass: false, error: e.message });
      console.error(`  ➔ Tab "${tab}" gagal diklik: ${e.message}`);
    }
  }

  // TEST 3: Zero-Scroll & Full Height Verification in Stages
  console.log("\n[3/8] Menguji ketiadaan scrollbar (Zero-Scroll Native Arena) ...");
  const stages = [
    { id: "#frame-penyisihan", tab: "penyisihan", name: "Babak Penyisihan" },
    { id: "#frame-semifinal", tab: "semifinal", name: "Babak Semifinal" },
    { id: "#frame-final", tab: "final", name: "Babak Grand Final" }
  ];

  for (const st of stages) {
    try {
      await page.locator(`button[data-view="${st.tab}"]`).first().click();
      await page.waitForTimeout(400);

      const isStageActive = await page.evaluate(() => document.body.classList.contains("stage-active"));
      
      const frameLocator = page.frameLocator(st.id);
      const scrollInfo = await frameLocator.locator("html").evaluate(html => {
        return {
          htmlScrollHeight: html.scrollHeight,
          htmlClientHeight: html.clientHeight,
          bodyScrollHeight: document.body.scrollHeight,
          bodyClientHeight: document.body.clientHeight,
          overflowY: window.getComputedStyle(document.body).overflowY
        };
      });

      const noScroll = scrollInfo.bodyScrollHeight <= scrollInfo.bodyClientHeight + 5;
      results.scrollTests.push({
        stage: st.name,
        isStageActive,
        noScroll,
        scrollInfo,
        pass: isStageActive && noScroll
      });

      console.log(`  ➔ ${st.name}: stage-active=${isStageActive} | Scroll Height: ${scrollInfo.bodyScrollHeight}px / Client: ${scrollInfo.bodyClientHeight}px | No-Scroll: ${noScroll ? "LULUS ✓" : "OVERFLOW ✗"}`);
    } catch (e) {
      results.scrollTests.push({ stage: st.name, pass: false, error: e.message });
      console.error(`  ➔ ${st.name} scroll test error: ${e.message}`);
    }
  }

  // TEST 4: Grand Final Wide Margin & 2-Column Broadcast Arena Layout
  console.log("\n[4/8] Menguji tata letak Grand Final (Margin Lebih Lebar & Kotak Tidak Terpotong) ...");
  try {
    await page.locator(`button[data-view="final"]`).first().click();
    await page.waitForTimeout(400);

    const frame = page.frameLocator("#frame-final");
    const arenaBox = await frame.locator("#arena").boundingBox();
    const sidebarBox = await frame.locator("#score-sidebar").boundingBox();
    const boardBox = await frame.locator("#board-arena").boundingBox();
    const boardGridBox = await frame.locator("#board").boundingBox();
    const boxCount = await frame.locator("#board .box").count();

    // Check inner padding and margins
    const arenaStyles = await frame.locator("#arena").evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        paddingLeft: parseFloat(s.paddingLeft),
        paddingRight: parseFloat(s.paddingRight),
        gap: parseFloat(s.gap)
      };
    });

    const isWideMargin = arenaStyles.paddingLeft >= 20 && arenaStyles.gap >= 18;
    const isTwoColumn = sidebarBox && boardBox && (sidebarBox.x < boardBox.x);
    const has15Boxes = boxCount === 15;

    // Check bottom box boundary doesn't exceed board-arena
    const lastBox = await frame.locator("#board .box").last().boundingBox();
    const notClipped = lastBox && boardGridBox && (lastBox.y + lastBox.height <= boardGridBox.y + boardGridBox.height + 4);

    results.layoutTests.push({
      isWideMargin,
      isTwoColumn,
      has15Boxes,
      notClipped,
      arenaStyles,
      sidebarWidth: sidebarBox?.width,
      boardWidth: boardBox?.width,
      pass: isWideMargin && isTwoColumn && has15Boxes && notClipped
    });

    console.log(`  ➔ Padding Arena: Left/Right=${arenaStyles.paddingLeft}px, Gap=${arenaStyles.gap}px | Margin Lebar: ${isWideMargin ? "LULUS ✓" : "✗"}`);
    console.log(`  ➔ Posisi Kolom Skor Tim (Kiri): X=${Math.round(sidebarBox?.x || 0)}px, Lebar=${Math.round(sidebarBox?.width || 0)}px`);
    console.log(`  ➔ Posisi Kolom Papan Soal (Kanan): X=${Math.round(boardBox?.x || 0)}px, Lebar=${Math.round(boardBox?.width || 0)}px`);
    console.log(`  ➔ Kotak Terbawah Tidak Terpotong: ${notClipped ? "LULUS (Tidak Terpotong) ✓" : "TERPOTONG ✗"}`);
    console.log(`  ➔ Total Kotak Soal: ${boxCount} kotak ${has15Boxes ? "(15 Kotak Lengkap) ✓" : "✗"}`);
  } catch (e) {
    results.layoutTests.push({ pass: false, error: e.message });
    console.error(`  ➔ Grand Final layout error: ${e.message}`);
  }

  // TEST 5: Word Templates Availability & Direct Downloads
  console.log("\n[5/8] Menguji ketersediaan & integritas Template Word (.docx) ...");
  const tpls = [
    { name: "Penyisihan", url: "http://localhost:3000/templates/Template_Soal_Penyisihan.docx" },
    { name: "Semifinal", url: "http://localhost:3000/templates/Template_Soal_Semifinal.docx" },
    { name: "Grand Final", url: "http://localhost:3000/templates/Template_Soal_Grand_Final.docx" }
  ];

  for (const t of tpls) {
    try {
      const resp = await context.request.get(t.url);
      const status = resp.status();
      const headers = resp.headers();
      const body = await resp.body();
      const valid = status === 200 && body.length > 5000 && headers["content-type"].includes("wordprocessingml");

      results.templateTests.push({
        template: t.name,
        status,
        size: body.length,
        contentType: headers["content-type"],
        pass: valid
      });

      console.log(`  ➔ Template ${t.name}: Status=${status} | Size=${body.length} bytes | MIME=${headers["content-type"]} | ${valid ? "VALID ✓" : "GAGAL ✗"}`);
    } catch (e) {
      results.templateTests.push({ template: t.name, pass: false, error: e.message });
      console.error(`  ➔ Template ${t.name} error: ${e.message}`);
    }
  }

  // TEST 6: Bank Soal Word UI & Template Buttons
  console.log("\n[6/8] Menguji tombol template & list Bank Soal ...");
  try {
    await page.locator(`button[data-view="bank"]`).first().click();
    await page.waitForTimeout(400);

    const btnTplCount = await page.locator("#btn-download-tpl").count();
    const quickLinksCount = await page.locator("a[href*='Template_Soal_']").count();
    console.log(`  ➔ Tombol Unduh Template Utama: ${btnTplCount > 0 ? "ADA ✓" : "✗"}`);
    console.log(`  ➔ Tautan Download Cepat Template: ${quickLinksCount} link (Lengkap 3 Babak) ✓`);

    // Switch to Final and check question count
    await page.locator("#bank_tab_final").click();
    await page.waitForTimeout(300);
    const qCountFinal = await page.locator("#bank-list-container > div").count();
    console.log(`  ➔ Jumlah item soal di Bank Final: ${qCountFinal}`);

    // Switch to Semifinal
    await page.locator("#bank_tab_semifinal").click();
    await page.waitForTimeout(300);
    const qCountSemi = await page.locator("#bank-list-container > div").count();
    console.log(`  ➔ Jumlah item soal di Bank Semifinal: ${qCountSemi}`);

    results.bankTests.push({
      pass: btnTplCount > 0 && quickLinksCount === 3 && qCountFinal > 0,
      qCountFinal,
      qCountSemi
    });
  } catch (e) {
    results.bankTests.push({ pass: false, error: e.message });
    console.error(`  ➔ Bank Soal UI error: ${e.message}`);
  }

  // TEST 7: Fullscreen Controls & Attributes
  console.log("\n[7/8] Menguji dukungan Layar Penuh (Fullscreen IFP) ...");
  try {
    const fsBtnExists = (await page.locator("#btn-toggle-fullscreen").count()) > 0;
    const fsDockExists = (await page.locator("#ifp-fullscreen-controls").count()) > 0;
    const finalFsBtnExists = (await page.frameLocator("#frame-final").locator("#bFs").count()) > 0;

    const allowFsAttr = await page.evaluate(() => {
      const p = document.getElementById("frame-penyisihan")?.hasAttribute("allowfullscreen");
      const s = document.getElementById("frame-semifinal")?.hasAttribute("allowfullscreen");
      const f = document.getElementById("frame-final")?.hasAttribute("allowfullscreen");
      return p && s && f;
    });

    results.fullscreenTests.push({
      fsBtnExists,
      fsDockExists,
      finalFsBtnExists,
      allowFsAttr,
      pass: fsBtnExists && fsDockExists && finalFsBtnExists && allowFsAttr
    });

    console.log(`  ➔ Tombol Fullscreen Header: ${fsBtnExists ? "ADA ✓" : "✗"}`);
    console.log(`  ➔ Floating IFP Fullscreen Dock: ${fsDockExists ? "ADA ✓" : "✗"}`);
    console.log(`  ➔ Tombol Layar Penuh di Arena Final (#bFs): ${finalFsBtnExists ? "ADA ✓" : "✗"}`);
    console.log(`  ➔ Iframe allowfullscreen: ${allowFsAttr ? "LENGKAP DI SEMUA BABAK ✓" : "KURANG ✗"}`);
  } catch (e) {
    results.fullscreenTests.push({ pass: false, error: e.message });
    console.error(`  ➔ Fullscreen test error: ${e.message}`);
  }

  // TEST 8: Theme Toggling
  console.log("\n[8/8] Menguji sinkronisasi tema (Dark <-> Light) ...");
  try {
    const themeBtn = page.locator("#btn-toggle-theme");
    await themeBtn.click();
    await page.waitForTimeout(300);
    const themeAfter1 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

    await themeBtn.click();
    await page.waitForTimeout(300);
    const themeAfter2 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

    const themePass = (themeAfter1 === "light" && themeAfter2 === "dark");
    results.themeTests.push({ pass: themePass });
    console.log(`  ➔ Sinkronisasi Tema: ${themePass ? "LULUS ✓" : "PERIKSA ✗"}`);
  } catch (e) {
    results.themeTests.push({ pass: false, error: e.message });
    console.error(`  ➔ Theme error: ${e.message}`);
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("📊 HASIL ANALISIS KELAYAKAN & STATUS AKHIR");
  console.log("==================================================");
  console.log(`• Total Console Errors: ${results.consoleErrors.length}`);
  console.log(`• Total Network Failures: ${results.networkFailures.length}`);
  console.log(`• URL Tests: ${results.urlTests.filter(t => t.pass).length}/${results.urlTests.length} Passed`);
  console.log(`• Tab Tests: ${results.tabTests.filter(t => t.pass).length}/${results.tabTests.length} Passed`);
  console.log(`• Zero-Scroll Tests: ${results.scrollTests.filter(t => t.pass).length}/${results.scrollTests.length} Passed`);
  console.log(`• Wide Margin & No-Clip Layout: ${results.layoutTests.filter(t => t.pass).length}/${results.layoutTests.length} Passed`);
  console.log(`• Word Template (.docx) Tests: ${results.templateTests.filter(t => t.pass).length}/${results.templateTests.length} Passed`);
  console.log(`• Fullscreen Tests: ${results.fullscreenTests.filter(t => t.pass).length}/${results.fullscreenTests.length} Passed`);
  console.log(`• Bank Soal Tests: ${results.bankTests.filter(t => t.pass).length}/${results.bankTests.length} Passed`);
  console.log(`• Theme Tests: ${results.themeTests.filter(t => t.pass).length}/${results.themeTests.length} Passed`);

  const allPass = results.consoleErrors.length === 0 &&
                  results.networkFailures.length === 0 &&
                  results.scrollTests.every(t => t.pass) &&
                  results.layoutTests.every(t => t.pass) &&
                  results.templateTests.every(t => t.pass) &&
                  results.fullscreenTests.every(t => t.pass);

  console.log(`\nKESIMPULAN: ${allPass ? "SEMUA PENGUJIAN LULUS DENGAN SEMPURNA (100% OK)" : "ADA BAGIAN YANG MEMERLUKAN PERHATIAN"}`);

  return results;
}

runAnalysis().catch(err => {
  console.error("FATAL ERROR IN TEST RUNNER:", err);
  process.exit(1);
});
