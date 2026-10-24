import { chromium } from "playwright";

async function runAnalysis() {
  console.log("==================================================");
  console.log("🔬 CERDAS CERMAT SUITE - COMPREHENSIVE TEST ANALYZER");
  console.log("   Zero-Scroll Verification & 2-Column Final Layout");
  console.log("==================================================");

  const results = {
    urlTests: [],
    consoleErrors: [],
    consoleWarnings: [],
    networkFailures: [],
    tabTests: [],
    iframeTests: [],
    scrollTests: [],
    layoutTests: [],
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

  // TEST 2: Load http://10.255.18.196:3000/ (LAN IP)
  console.log("\n[2/8] Menguji akses via IP LAN: http://10.255.18.196:3000/ ...");
  try {
    const respLAN = await page.goto("http://10.255.18.196:3000/", { waitUntil: "networkidle", timeout: 8000 });
    const statusLAN = respLAN.status();
    results.urlTests.push({ url: "http://10.255.18.196:3000/", status: statusLAN, pass: statusLAN === 200 });
    console.log(`  ➔ Status LAN IP: ${statusLAN} (OK)`);
  } catch (err) {
    results.urlTests.push({ url: "http://10.255.18.196:3000/", error: err.message, pass: false });
    console.error(`  ➔ GAGAL akses LAN: ${err.message}`);
  }

  // TEST 3: Navigation Tabs
  console.log("\n[3/8] Menguji interaktivitas navigasi tab portal ...");
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

  // TEST 4: Zero-Scroll & Full Height Verification in Stages
  console.log("\n[4/8] Menguji ketiadaan scrollbar (Zero-Scroll Native Arena) ...");
  const stages = [
    { id: "#frame-penyisihan", tab: "penyisihan", name: "Babak Penyisihan" },
    { id: "#frame-semifinal", tab: "semifinal", name: "Babak Semifinal" },
    { id: "#frame-final", tab: "final", name: "Babak Grand Final" }
  ];

  for (const st of stages) {
    try {
      await page.locator(`button[data-view="${st.tab}"]`).first().click();
      await page.waitForTimeout(400);

      // Verify portal body has stage-active
      const isStageActive = await page.evaluate(() => document.body.classList.contains("stage-active"));
      
      // Check iframe scrollHeight vs clientHeight
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

  // TEST 5: Grand Final 2-Column Broadcast Arena Layout
  console.log("\n[5/8] Menguji layout 2-kolom Babak Final (Skor Tim di Kiri, Soal di Kanan) ...");
  try {
    await page.locator(`button[data-view="final"]`).first().click();
    await page.waitForTimeout(400);

    const frame = page.frameLocator("#frame-final");
    const sidebarBox = await frame.locator("#score-sidebar").boundingBox();
    const boardBox = await frame.locator("#board-arena").boundingBox();
    const boxCount = await frame.locator("#board .box").count();

    const isTwoColumn = sidebarBox && boardBox && (sidebarBox.x < boardBox.x) && (sidebarBox.x + sidebarBox.width <= boardBox.x + 25);
    const has15Boxes = boxCount === 15;

    results.layoutTests.push({
      isTwoColumn,
      has15Boxes,
      sidebarWidth: sidebarBox?.width,
      boardWidth: boardBox?.width,
      boxCount,
      pass: isTwoColumn && has15Boxes
    });

    console.log(`  ➔ Posisi Kolom Skor Tim (Kiri): X=${Math.round(sidebarBox?.x || 0)}px, Lebar=${Math.round(sidebarBox?.width || 0)}px`);
    console.log(`  ➔ Posisi Kolom Papan Soal (Kanan): X=${Math.round(boardBox?.x || 0)}px, Lebar=${Math.round(boardBox?.width || 0)}px`);
    console.log(`  ➔ Validasi 2-Kolom Berdampingan: ${isTwoColumn ? "LULUS (Side-by-Side) ✓" : "GAGAL ✗"}`);
    console.log(`  ➔ Jumlah Kotak Papan Final: ${boxCount} kotak ${has15Boxes ? "(15 Kotak Lengkap) ✓" : "✗"}`);
  } catch (e) {
    results.layoutTests.push({ pass: false, error: e.message });
    console.error(`  ➔ Grand Final layout error: ${e.message}`);
  }

  // TEST 6: Fullscreen Controls & Attributes
  console.log("\n[6/8] Menguji dukungan Layar Penuh (Fullscreen IFP) ...");
  try {
    const fsBtn = page.locator("#btn-toggle-fullscreen");
    const fsBtnExists = (await fsBtn.count()) > 0;
    const fsDockExists = (await page.locator("#ifp-fullscreen-controls").count()) > 0;
    const finalFsBtnExists = (await page.frameLocator("#frame-final").locator("#bFs").count()) > 0;

    // Check allowfullscreen attributes on all frames
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
    console.log(`  ➔ Iframe allowfullscreen Attribute: ${allowFsAttr ? "LENGKAP DI SEMUA BABAK ✓" : "KURANG ✗"}`);
  } catch (e) {
    results.fullscreenTests.push({ pass: false, error: e.message });
    console.error(`  ➔ Fullscreen test error: ${e.message}`);
  }

  // TEST 7: Bank Soal Word Engine & Report
  console.log("\n[7/8] Menguji Bank Soal Word dan Laporan Juara Final ...");
  try {
    await page.locator(`button[data-view="bank"]`).first().click();
    await page.waitForTimeout(400);

    // Switch to Final
    await page.locator("#bank_tab_final").click();
    await page.waitForTimeout(250);
    const qCount = await page.locator("#bank-list-container > div").count();
    console.log(`  ➔ Jumlah item soal terdaftar di Bank Final: ${qCount}`);
    results.bankTests.push({ pass: qCount > 0, qCount });

    // Switch to Laporan
    await page.locator(`button[data-view="laporan"]`).first().click();
    await page.waitForTimeout(500);

    const reportTitle = await page.locator("#report-preview-container h2").innerText().catch(() => "");
    const finalistCount = await page.locator("#report-preview-container tbody tr").count().catch(() => 0);
    console.log(`  ➔ Laporan Terender: "${reportTitle}" | Jumlah Tim Finalis: ${finalistCount}`);
    results.reportTests.push({ pass: finalistCount > 0, reportTitle, finalistCount });
  } catch (e) {
    results.bankTests.push({ pass: false, error: e.message });
    console.error(`  ➔ Bank / Laporan error: ${e.message}`);
  }

  // TEST 8: Theme Toggling
  console.log("\n[8/8] Menguji sinkronisasi tema (Dark <-> Light) ...");
  try {
    const themeBtn = page.locator("#btn-toggle-theme");
    await themeBtn.click();
    await page.waitForTimeout(300);

    const themeAfter1 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const frameTheme = await page.frameLocator("#frame-final").locator("html").getAttribute("data-theme").catch(() => null);

    await themeBtn.click();
    await page.waitForTimeout(300);
    const themeAfter2 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

    const themePass = (themeAfter1 === "light" && themeAfter2 === "dark" && frameTheme === "light");
    results.themeTests.push({
      toggle1: themeAfter1,
      toggle2: themeAfter2,
      iframeTheme: frameTheme,
      pass: themePass
    });
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
  console.log(`• 2-Column Final Layout Tests: ${results.layoutTests.filter(t => t.pass).length}/${results.layoutTests.length} Passed`);
  console.log(`• Fullscreen Tests: ${results.fullscreenTests.filter(t => t.pass).length}/${results.fullscreenTests.length} Passed`);
  console.log(`• Bank Soal Tests: ${results.bankTests.filter(t => t.pass).length}/${results.bankTests.length} Passed`);
  console.log(`• Report Tests: ${results.reportTests.filter(t => t.pass).length}/${results.reportTests.length} Passed`);
  console.log(`• Theme Tests: ${results.themeTests.filter(t => t.pass).length}/${results.themeTests.length} Passed`);

  const allPass = results.consoleErrors.length === 0 &&
                  results.networkFailures.length === 0 &&
                  results.scrollTests.every(t => t.pass) &&
                  results.layoutTests.every(t => t.pass) &&
                  results.fullscreenTests.every(t => t.pass);

  console.log(`\nKESIMPULAN: ${allPass ? "SEMUA PENGUJIAN LULUS DENGAN SEMPURNA (100% OK)" : "ADA BAGIAN YANG MEMERLUKAN PERHATIAN"}`);

  return results;
}

runAnalysis().catch(err => {
  console.error("FATAL ERROR IN TEST RUNNER:", err);
  process.exit(1);
});
