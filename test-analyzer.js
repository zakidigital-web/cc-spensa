import { chromium } from "playwright";

async function runAnalysis() {
  console.log("==================================================");
  console.log("🔬 CERDAS CERMAT SUITE - COMPREHENSIVE TEST ANALYZER");
  console.log("==================================================");

  const results = {
    urlTests: [],
    consoleErrors: [],
    consoleWarnings: [],
    networkFailures: [],
    tabTests: [],
    iframeTests: [],
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

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(6000);

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
  console.log("\n[1/6] Menguji akses portal: http://localhost:3000/ ...");
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
  console.log("\n[2/6] Menguji akses via IP LAN: http://10.255.18.196:3000/ ...");
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
  console.log("\n[3/6] Menguji interaktivitas navigasi tab portal ...");
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

  // TEST 4: Iframe checks inside stages
  console.log("\n[4/6] Menguji pemuatan iframe pada setiap babak ...");
  const iframes = [
    { id: "#frame-penyisihan", name: "Penyisihan", tab: "penyisihan" },
    { id: "#frame-semifinal", name: "Semifinal", tab: "semifinal" },
    { id: "#frame-final", name: "Grand Final", tab: "final" }
  ];

  for (const item of iframes) {
    try {
      await page.locator(`button[data-view="${item.tab}"]`).first().click({ timeout: 4000 });
      await page.waitForTimeout(500);

      const frameEl = page.frameLocator(item.id);
      const frameHtml = await frameEl.locator("body").innerHTML({ timeout: 4000 });
      const hasContent = frameHtml.length > 50;
      results.iframeTests.push({ name: item.name, pass: hasContent, length: frameHtml.length });
      console.log(`  ➔ Iframe ${item.name}: ${hasContent ? `TERMUAT (${frameHtml.length} chars) ✓` : "KOSONG ✗"}`);
    } catch (e) {
      results.iframeTests.push({ name: item.name, pass: false, error: e.message });
      console.error(`  ➔ Iframe ${item.name} error: ${e.message}`);
    }
  }

  // TEST 5: Bank Soal & Report Preview
  console.log("\n[5/6] Menguji Bank Soal Word dan Laporan Juara Final ...");
  try {
    await page.locator(`button[data-view="bank"]`).first().click({ timeout: 4000 });
    await page.waitForTimeout(500);

    const labelP = await page.locator("#active-bank-stage-label").innerText();
    console.log(`  ➔ Label Bank Awal: "${labelP}"`);

    // Switch to Semifinal
    await page.locator("#bank_tab_semifinal").click({ timeout: 4000 });
    await page.waitForTimeout(300);
    const labelS = await page.locator("#active-bank-stage-label").innerText();
    console.log(`  ➔ Label Bank Semifinal: "${labelS}"`);

    // Switch to Final
    await page.locator("#bank_tab_final").click({ timeout: 4000 });
    await page.waitForTimeout(300);
    const labelF = await page.locator("#active-bank-stage-label").innerText();
    console.log(`  ➔ Label Bank Final: "${labelF}"`);

    const qCount = await page.locator("#bank-list-container > div").count();
    console.log(`  ➔ Jumlah item soal terdaftar di preview: ${qCount}`);
    results.bankTests.push({ pass: true, qCount });

    // Switch to Laporan
    await page.locator(`button[data-view="laporan"]`).first().click({ timeout: 4000 });
    await page.waitForTimeout(600);

    const reportTitle = await page.locator("#report-preview-container h2").innerText().catch(() => "");
    const finalistCount = await page.locator("#report-preview-container tbody tr").count().catch(() => 0);
    console.log(`  ➔ Laporan Terender: "${reportTitle}" | Jumlah Tim Finalis: ${finalistCount}`);
    results.reportTests.push({ pass: finalistCount > 0, reportTitle, finalistCount });
  } catch (e) {
    console.error(`  ➔ Pengujian Bank Soal / Laporan error: ${e.message}`);
    results.bankTests.push({ pass: false, error: e.message });
  }

  // TEST 6: Theme Toggling
  console.log("\n[6/6] Menguji sinkronisasi tema (Dark <-> Light) ...");
  try {
    const themeBtn = page.locator("#btn-toggle-theme");
    await themeBtn.click({ timeout: 4000 });
    await page.waitForTimeout(300);

    const themeAfter1 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    console.log(`  ➔ Tema portal setelah klik 1: ${themeAfter1}`);

    // Check iframe theme
    const frameTheme = await page.frameLocator("#frame-final").locator("html").getAttribute("data-theme").catch(() => null);
    console.log(`  ➔ Tema di dalam iframe Final: ${frameTheme}`);

    await themeBtn.click({ timeout: 4000 });
    await page.waitForTimeout(300);
    const themeAfter2 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    console.log(`  ➔ Tema portal setelah klik 2: ${themeAfter2}`);

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
    console.error(`  ➔ Pengujian tema error: ${e.message}`);
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("📊 HASIL ANALISIS KELAYAKAN & STATUS");
  console.log("==================================================");
  console.log(`• Total Console Errors: ${results.consoleErrors.length}`);
  console.log(`• Total Network Failures: ${results.networkFailures.length}`);
  console.log(`• URL Tests: ${results.urlTests.filter(t => t.pass).length}/${results.urlTests.length} Passed`);
  console.log(`• Tab Tests: ${results.tabTests.filter(t => t.pass).length}/${results.tabTests.length} Passed`);
  console.log(`• Iframe Tests: ${results.iframeTests.filter(t => t.pass).length}/${results.iframeTests.length} Passed`);
  console.log(`• Bank Soal Tests: ${results.bankTests.filter(t => t.pass).length}/${results.bankTests.length} Passed`);
  console.log(`• Report Tests: ${results.reportTests.filter(t => t.pass).length}/${results.reportTests.length} Passed`);
  console.log(`• Theme Tests: ${results.themeTests.filter(t => t.pass).length}/${results.themeTests.length} Passed`);

  return results;
}

runAnalysis().catch(err => {
  console.error("FATAL ERROR IN TEST RUNNER:", err);
  process.exit(1);
});
