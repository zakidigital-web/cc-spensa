import { chromium } from "playwright";

async function auditDatabases() {
  console.log("================================================================");
  console.log("🏛️  BACKEND ARCHITECT DATABASE & STORAGE CONNECTION AUDIT");
  console.log("================================================================");

  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const auditLogs = [];
  page.on("console", msg => {
    if (msg.type() === "error") auditLogs.push(`[CONSOLE ERROR] ${msg.text()}`);
  });

  console.log("1. Membuka Portal (http://localhost:3000/)...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. Audit PortalStorage (cerdascermat_portal_v2)
  console.log("\n2. Mengaudit PortalStorage (IndexedDB: cerdascermat_portal_v2)...");
  const portalAudit = await page.evaluate(async () => {
    if (!window.PortalStorage) return { error: "PortalStorage tidak ditemukan di window!" };
    const cfg = await window.PortalStorage.getConfig();
    const penyisihanBank = await window.PortalStorage.getStageBank('penyisihan');
    const semifinalBank = await window.PortalStorage.getStageBank('semifinal');
    const finalBank = await window.PortalStorage.getStageBank('final');
    const penyisihanState = await window.PortalStorage.getPenyisihanState();
    const semifinalState = await window.PortalStorage.getSemifinalState();
    const finalState = await window.PortalStorage.getFinalState();

    return {
      hasPortalStorage: true,
      config: cfg,
      banks: {
        penyisihanCount: penyisihanBank?.length || 0,
        semifinalCount: semifinalBank?.length || 0,
        finalCount: finalBank?.length || 0
      },
      states: {
        hasPenyisihanState: !!penyisihanState,
        hasSemifinalState: !!semifinalState,
        hasFinalState: !!finalState,
        finalNames: finalState?.names,
        finalScores: finalState?.score
      }
    };
  });
  console.log("   Result PortalStorage:", JSON.stringify(portalAudit, null, 2));

  // 2. Audit Stage-Native Storage (cerdascermat & localStorage)
  console.log("\n3. Mengaudit Stage-Native Stores (IndexedDB: cerdascermat & localStorage)...");
  const nativeAudit = await page.evaluate(async () => {
    // Open cerdascermat
    const legacyDB = await new Promise((res, rej) => {
      const req = indexedDB.open('cerdascermat', 1);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }).catch(e => null);

    let legacyKeys = [];
    let bankPenyisihanInfo = null;
    let bankSemifinalInfo = null;

    if (legacyDB && legacyDB.objectStoreNames.contains('kv')) {
      legacyKeys = await new Promise((res) => {
        const tx = legacyDB.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').getAllKeys();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res([]);
      });

      const tx = legacyDB.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const bankP = await new Promise(r => { const q = store.get('bank'); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
      const bankS = await new Promise(r => { const q = store.get('bank3'); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });

      if (bankP) {
        bankPenyisihanInfo = {
          mapelCount: bankP.mapel?.length || 0,
          soal7Count: bankP.soal?.[7]?.length || 0,
          soal8Count: bankP.soal?.[8]?.length || 0,
          soal9Count: bankP.soal?.[9]?.length || 0
        };
      }
      if (bankS) {
        bankSemifinalInfo = {
          soalCount: bankS.soal?.length || 0
        };
      }
    }

    // Check localStorage
    const localFinal = localStorage.getItem('cc-final3');
    const localTheme = localStorage.getItem('portal_theme');

    return {
      legacyIndexedDB: {
        name: 'cerdascermat',
        keys: legacyKeys,
        bankPenyisihanInfo,
        bankSemifinalInfo
      },
      localStorage: {
        hasFinalFix: !!localFinal,
        finalData: localFinal ? JSON.parse(localFinal) : null,
        theme: localTheme
      }
    };
  });
  console.log("   Result Native Stores:", JSON.stringify(nativeAudit, null, 2));

  // 3. Test DocxEngine Reading Across Stages
  console.log("\n4. Menguji DocxEngine getStageQuestions() untuk 3 babak...");
  const docxAudit = await page.evaluate(async () => {
    if (!window.DocxEngine) return { error: "DocxEngine tidak ditemukan!" };
    const qP = await window.DocxEngine.getStageQuestions('penyisihan');
    const qS = await window.DocxEngine.getStageQuestions('semifinal');
    const qF = await window.DocxEngine.getStageQuestions('final');
    return {
      penyisihan: { count: qP.length, sample: qP[0]?.q },
      semifinal: { count: qS.length, sample: qS[0]?.q },
      final: { count: qF.length, sample: qF[0]?.q }
    };
  });
  console.log("   Result DocxEngine:", JSON.stringify(docxAudit, null, 2));

  // 4. Test ReportEngine Winner Computation Connection
  console.log("\n5. Menguji ReportEngine.compileFinalistsReport()...");
  const reportAudit = await page.evaluate(async () => {
    if (!window.ReportEngine) return { error: "ReportEngine tidak ditemukan!" };
    const report = await window.ReportEngine.compileFinalistsReport();
    return {
      eventTitle: report.config?.title,
      finalistsCount: report.finalists?.length,
      finalists: report.finalists?.map(f => ({
        rank: f.rank,
        title: f.title,
        name: f.name,
        score: f.score
      }))
    };
  });
  console.log("   Result ReportEngine:", JSON.stringify(reportAudit, null, 2));

  // 5. Test Live Score Sync from Grand Final to Report
  console.log("\n6. Menguji Sinkronisasi Skor Live: Simulasi skor baru di Grand Final -> Laporan...");
  const syncTest = await page.evaluate(async () => {
    // Simulate Grand Final updating score
    const simulatedFinal = {
      title: 'CERDAS CERMAT FINAL',
      n: 5,
      init: 100,
      dur: 90,
      np: 5,
      snd: 1,
      rb: 0,
      names: ['Regu Melati', 'Regu Mawar', 'Regu Anggrek', 'Regu Tulip', 'Regu Teratai'],
      score: [350, 275, 200, 150, 75],
      done: Array(15).fill(true),
      started: true
    };
    localStorage.setItem('cc-final3', JSON.stringify(simulatedFinal));

    // Now test if PortalStorage or ReportEngine reads these updated scores!
    const updatedFinalState = await window.PortalStorage.getFinalState();
    const updatedReport = await window.ReportEngine.compileFinalistsReport();

    return {
      localStorageSaved: true,
      portalStorageReadScores: updatedFinalState?.score,
      reportEngineReadScores: updatedReport?.finalists?.map(f => ({ name: f.name, score: f.score })),
      isSynchronized: updatedReport?.finalists?.[0]?.name === 'Regu Melati' && updatedReport?.finalists?.[0]?.score === 350
    };
  });
  console.log("   Result Sync Test:", JSON.stringify(syncTest, null, 2));

  await browser.close();

  console.log("\n================================================================");
  console.log("🏁 AUDIT COMPLETED. Synchronized:", syncTest.isSynchronized);
  console.log("================================================================");
}

auditDatabases().catch(console.error);
