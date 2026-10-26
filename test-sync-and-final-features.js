import { chromium } from 'playwright';

async function runTests() {
  console.log('🚀 Starting Test Suite: Synchronization & Grand Final Formulas/Images...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ════════════ SCENARIO 1: Sync Manager Admin Protection ════════════
    console.log('\n--- Scenario 1: Admin Protection on Sync Manager ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Clear admin auth to test protection
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('cc_admin_auth');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Click Bank View -> Auth modal should appear
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(300);
    const authVisibleBefore = await page.evaluate(() => {
      const m = document.getElementById('admin-auth-modal');
      return m && m.classList.contains('active');
    });
    assert(authVisibleBefore, 'Admin Auth Modal appears when accessing bank while unauthenticated');

    // Authenticate as admin
    await page.fill('#admin-auth-user', 'admin');
    await page.fill('#admin-auth-pass', 'spensa123');
    await page.click('#btn-submit-admin-auth');
    await page.waitForTimeout(500);

    const bankActive = await page.evaluate(() => {
      const v = document.getElementById('view-bank');
      return v && v.classList.contains('active');
    });
    assert(bankActive, 'Bank view active after successful admin authentication');

    // ════════════ SCENARIO 2: Sync Manager UI & Real-Time Stats ════════════
    console.log('\n--- Scenario 2: Sync Manager Modal & Stats Display ---');
    const btnSyncMgrExists = await page.evaluate(() => !!document.getElementById('btn-open-sync-manager'));
    assert(btnSyncMgrExists, 'Button "Kelola Sinkronisasi & Anti-Duplikasi" exists in toolbar');

    // Open Sync Manager modal
    await page.click('#btn-open-sync-manager');
    await page.waitForFunction(() => document.querySelectorAll('#sync-mgr-table-body tr').length >= 6, { timeout: 6000 });

    const syncModalActive = await page.evaluate(() => {
      const m = document.getElementById('modal-sync-manager');
      return m && m.classList.contains('active');
    });
    assert(syncModalActive, 'Modal "Kelola Sinkronisasi & Anti-Duplikasi" opens upon click');

    // Check table rows
    const tableInfo = await page.evaluate(() => {
      const tbody = document.getElementById('sync-mgr-table-body');
      if (!tbody) return { rows: 0, text: '' };
      return {
        rows: tbody.querySelectorAll('tr').length,
        text: tbody.textContent
      };
    });
    assert(tableInfo.rows >= 6, `Sync table contains all stage breakdown rows + total (found ${tableInfo.rows} rows)`);
    assert(tableInfo.text.includes('Penyisihan Kelas 7'), 'Table lists Penyisihan Kelas 7');
    assert(tableInfo.text.includes('Penyisihan Kelas 8'), 'Table lists Penyisihan Kelas 8');
    assert(tableInfo.text.includes('Penyisihan Kelas 9'), 'Table lists Penyisihan Kelas 9');
    assert(tableInfo.text.includes('Babak Semifinal'), 'Table lists Babak Semifinal');
    assert(tableInfo.text.includes('Babak Grand Final'), 'Table lists Babak Grand Final');
    assert(tableInfo.text.includes('TOTAL KESELURUHAN'), 'Table contains TOTAL KESELURUHAN summary');

    // Check action buttons exist
    const actionsExist = await page.evaluate(() => {
      return {
        smartMerge: !!document.getElementById('btn-action-smart-merge'),
        cleanDupes: !!document.getElementById('btn-action-clean-dupes'),
        pullCloud: !!document.getElementById('btn-action-pull-cloud'),
        pushCloud: !!document.getElementById('btn-action-push-cloud')
      };
    });
    assert(actionsExist.smartMerge, 'Action button "🤝 Gabungkan Cerdas (Smart Merge)" is present');
    assert(actionsExist.cleanDupes, 'Action button "🧹 Bersihkan Duplikat" is present');
    assert(actionsExist.pullCloud, 'Action button "☁️ Tarik Penuh Cloud" is present');
    assert(actionsExist.pushCloud, 'Action button "📤 Unggah Penuh Cloud" is present');

    // Close modal
    await page.click('#btn-close-sync-manager');
    await page.waitForTimeout(300);
    const syncModalClosed = await page.evaluate(() => {
      const m = document.getElementById('modal-sync-manager');
      return !m || !m.classList.contains('active');
    });
    assert(syncModalClosed, 'Sync Manager modal closes via close button');

    // ════════════ SCENARIO 3: Anti-Duplication & Smart Merge ════════════
    console.log('\n--- Scenario 3: Anti-Duplication & Smart Merge Logic ---');
    const mergeTestResult = await page.evaluate(async () => {
      const testQ1 = {
        id: 'test_dupe_1',
        tier: 'Tier 1 (50 Poin)',
        val: 50,
        pen: 25,
        q: 'Apakah kepanjangan dari CPU dalam komputer?',
        ans: 'Central Processing Unit',
        img: null
      };
      const testQ2 = {
        id: 'test_dupe_2',
        tier: 'Tier 1 (50 Poin)',
        val: 50,
        pen: 25,
        q: '  APAKAH KEPANJANGAN DARI CPU DALAM KOMPUTER?  ',
        ans: 'Central Processing Unit (CPU)',
        img: 'data:image/png;base64,sampleimg123'
      };

      const dedupedPair = window.PortalStorage.deduplicateQuestions([testQ1, testQ2]);
      const isDeduped = dedupedPair.length === 1;
      const enrichedWithImg = dedupedPair[0].img === 'data:image/png;base64,sampleimg123';
      const enrichedWithAns = dedupedPair[0].ans.includes('(CPU)');

      return {
        isDeduped,
        enrichedWithImg,
        enrichedWithAns
      };
    });

    assert(mergeTestResult.isDeduped, 'deduplicateQuestions successfully merges 2 identical questions with variations');
    assert(mergeTestResult.enrichedWithImg, 'Merged question retains image attribute from richest duplicate');
    assert(mergeTestResult.enrichedWithAns, 'Merged question retains longer/richer answer');

    // Test API smart merge directly
    console.log('\n--- Scenario 3b: Backend API Smart Merge Endpoint ---');
    const apiMergeRes = await page.evaluate(async () => {
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'final',
          mode: 'smart_merge',
          questions: [
            {
              id: 'fn_merge_test_1',
              tier: 'Tier 1 (50 Poin)',
              val: 50,
              pen: 25,
              q: 'Apa kepanjangan dari CPU?', // Duplicate
              ans: 'Central Processing Unit (CPU)',
              img: null
            },
            {
              id: 'fn_merge_test_new_' + Date.now(),
              tier: 'Tier 2 (75 Poin)',
              val: 75,
              pen: 35,
              q: 'Berapakah nilai dari $3^3 + \\sqrt{81}$?',
              ans: '36',
              img: null
            }
          ]
        })
      });
      return await res.json();
    });
    assert(apiMergeRes.success, 'API /api/banks accepts mode: "smart_merge" successfully');
    assert(apiMergeRes.count >= 1, `Smart merge correctly processed questions (total count ${apiMergeRes.count})`);

    // ════════════ SCENARIO 4: Grand Final Formulas & Images Support ════════════
    console.log('\n--- Scenario 4: Grand Final Formulas & Images in Game Arena ---');
    await page.goto('http://localhost:3000/final-cerdas-cermat.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Verify KaTeX library loaded in final stage
    const katexReady = await page.evaluate(() => typeof window.katex !== 'undefined');
    assert(katexReady, 'KaTeX library is loaded in final-cerdas-cermat.html');

    // Verify #qimg-box exists in overlay
    const qImgBoxExists = await page.evaluate(() => {
      const box = document.getElementById('qimg-box');
      const img = document.getElementById('qimg');
      return !!box && !!img;
    });
    assert(qImgBoxExists, 'Image container #qimg-box and <img> #qimg exist in final-cerdas-cermat.html');

    // Set structured question in S with LaTeX formula and Image
    const sampleImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await page.evaluate((imgData) => {
      window.S.started = true;
      window.S.qObj = [
        {
          id: 'fn_test_math',
          q: 'Berapakah hasil dari $2^8 + \\sqrt{144}$ jika ditambahkan $5^2$?',
          ans: '$256 + 12 + 25 = 293$',
          img: imgData,
          tier: 'Tier 1 (50 Poin)',
          val: 50,
          pen: 25
        }
      ];
      window.S.q = window.S.qObj.map(x => `${x.q} ||| ${x.ans} ||| img:${x.img}`).join('\n');
      window.save();
      // Open question 0 via openQ alias
      window.openQ(0);
    }, sampleImg);
    await page.waitForTimeout(400);

    // Check KaTeX rendered inside #qtext
    const qTextKatexCount = await page.evaluate(() => {
      const qtext = document.getElementById('qtext');
      return qtext ? qtext.querySelectorAll('.katex').length : 0;
    });
    assert(qTextKatexCount >= 2, `KaTeX formulas successfully rendered in #qtext (found ${qTextKatexCount} .katex elements)`);

    // Check Image displayed in #qimg
    const imgDisplayed = await page.evaluate(() => {
      const box = document.getElementById('qimg-box');
      const img = document.getElementById('qimg');
      return box && box.style.display === 'block' && img && img.src.startsWith('data:image/png;base64');
    });
    assert(imgDisplayed, 'Image is displayed in #qimg-box when question contains image');

    // Check KaTeX rendered in #qans when answer is revealed via shortcut 'J'
    await page.keyboard.press('j');
    await page.waitForTimeout(300);
    const qAnsKatexCount = await page.evaluate(() => {
      const qans = document.getElementById('qans');
      return qans ? qans.querySelectorAll('.katex').length : 0;
    });
    assert(qAnsKatexCount >= 1, `KaTeX formula successfully rendered in answer #qans (found ${qAnsKatexCount} .katex elements)`);

    // ════════════ SCENARIO 4b: Cerdas Cermat Final fix.html Consistency ════════════
    console.log('\n--- Scenario 4b: Cerdas Cermat Final fix.html Equivalence ---');
    await page.goto('http://localhost:3000/Cerdas%20Cermat%20Final%20fix.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const fixKatexReady = await page.evaluate(() => typeof window.katex !== 'undefined');
    const fixImgBoxReady = await page.evaluate(() => !!document.getElementById('qimg-box') && !!document.getElementById('qimg'));
    assert(fixKatexReady, 'KaTeX is loaded in Cerdas Cermat Final fix.html');
    assert(fixImgBoxReady, 'Image elements exist in Cerdas Cermat Final fix.html');

    // ════════════ SCENARIO 5: Grand Final Docx Template & Export ════════════
    console.log('\n--- Scenario 5: Word Template & Export with Math/Images ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Set admin auth session
    await page.evaluate(() => {
      sessionStorage.setItem('cc_admin_auth', '1');
      localStorage.setItem('cc_admin_auth', '1');
    });

    const exportFinalDocx = await page.evaluate(async () => {
      const expRes = await window.DocxEngine.exportStageBankToDocx('final');
      return {
        stage: expRes.stage,
        count: expRes.count,
        blobSize: expRes.blob ? expRes.blob.size : 0
      };
    });
    assert(exportFinalDocx.count > 0, `Grand Final Word export generated with ${exportFinalDocx.count} questions`);
    assert(exportFinalDocx.blobSize > 1000, `Grand Final Word export generated valid DOCX file (${exportFinalDocx.blobSize} bytes)`);

    console.log(`\n==================================================`);
    console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Test execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
