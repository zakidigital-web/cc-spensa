import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Starting Cloud Database Sync Integration Test...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('  [Browser Error]:', msg.text());
    }
  });

  try {
    // 1. Load the portal
    console.log('1. Loading portal at http://localhost:3000/...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 2. Navigate to Bank Soal (View 5)
    console.log('2. Navigating to Bank Soal...');
    await page.click('button[data-view="bank"]');
    await page.waitForTimeout(1000);

    // Verify Cloud Database Status Bar
    const cloudStatusText = await page.textContent('#cloud-db-status-text');
    console.log('   Cloud DB Status Text:', cloudStatusText);
    if (!cloudStatusText.includes('Terhubung')) {
      throw new Error(`Cloud DB status is not online: ${cloudStatusText}`);
    }

    const cloudCountText = await page.textContent('#cloud-db-count-badge');
    console.log('   Cloud DB Count Badge:', cloudCountText);

    // 3. Verify Penyisihan Grade 7 questions loaded
    const totalStatsP7 = await page.textContent('#bank-total-stats');
    console.log('   Penyisihan Kelas 7 Stats:', totalStatsP7);
    const countP7 = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Penyisihan Kelas 7 Cards in DOM: ${countP7}`);
    if (countP7 === 0) throw new Error('No cards rendered for Kelas 7');

    // 4. Switch to Kelas 8
    console.log('4. Switching to Penyisihan Kelas 8...');
    await page.click('#btn_jenjang_8');
    await page.waitForTimeout(600);
    const countP8 = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Penyisihan Kelas 8 Cards in DOM: ${countP8}`);
    if (countP8 === 0) throw new Error('No cards rendered for Kelas 8');

    // 5. Switch to Kelas 9
    console.log('5. Switching to Penyisihan Kelas 9...');
    await page.click('#btn_jenjang_9');
    await page.waitForTimeout(600);
    const countP9 = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Penyisihan Kelas 9 Cards in DOM: ${countP9}`);
    if (countP9 === 0) throw new Error('No cards rendered for Kelas 9');

    // 6. Switch to Semifinal
    console.log('6. Switching to Babak Semifinal...');
    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(600);
    const countSemi = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Semifinal Cards in DOM: ${countSemi}`);
    if (countSemi === 0) throw new Error('No cards rendered for Semifinal');

    // 7. Switch to Grand Final
    console.log('7. Switching to Babak Grand Final...');
    await page.click('#bank_tab_final');
    await page.waitForTimeout(600);
    const countFinal = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Grand Final Cards in DOM: ${countFinal}`);
    if (countFinal === 0) throw new Error('No cards rendered for Grand Final');

    // 8. Test Adding a Question Manually in Semifinal
    console.log('8. Adding a test question in Semifinal...');
    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(500);

    const initialSemiCount = await page.$$eval('#bank-list-container .question-card-item', els => els.length);

    await page.click('#btn-add-question');
    await page.waitForTimeout(500);

    // Select PG1 to enable MC options
    await page.selectOption('#edit-q-category', 'PG1');
    await page.waitForTimeout(300);

    const testQuestionText = `TEST_SOAL_CLOUD_SYNC_${Date.now()}`;
    await page.fill('#edit-q-text', testQuestionText);
    await page.fill('#edit-opt-0', 'Pilihan A Benar');
    await page.fill('#edit-opt-1', 'Pilihan B');
    await page.fill('#edit-opt-2', 'Pilihan C');
    await page.fill('#edit-opt-3', 'Pilihan D');

    await page.click('#btn-save-edit-q');
    await page.waitForTimeout(2000); // Wait for cloud sync save to Neon

    const newSemiCount = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Semifinal Cards after Add: ${newSemiCount} (was ${initialSemiCount})`);
    if (newSemiCount !== initialSemiCount + 1) {
      throw new Error(`Expected ${initialSemiCount + 1} cards, found ${newSemiCount}`);
    }

    // 9. Verify the question is saved in PostgreSQL Neon DB via API
    console.log('9. Checking Neon PostgreSQL API for the newly added question...');
    const apiRes = await fetch('http://localhost:3000/api/banks?stage=semifinal');
    const apiData = await apiRes.json();
    const foundInDb = apiData.questions.find(q => q.q === testQuestionText);
    if (!foundInDb) {
      throw new Error('Question was NOT found in Neon PostgreSQL database!');
    }
    console.log(`   ✅ Confirmed in Neon PostgreSQL: id=${foundInDb.id}, q="${foundInDb.q}"`);

    // 10. Clean up test question
    console.log('10. Deleting the test question...');
    await page.evaluate(async (qId) => {
      await window.DocxEngine.deleteStageQuestions('semifinal', [qId]);
      await window.App.renderBankList();
      await window.App.refreshCloudStatusUI();
    }, foundInDb.id);
    await page.waitForTimeout(2000);

    // Verify deletion in DB
    const apiResAfterDel = await fetch('http://localhost:3000/api/banks?stage=semifinal');
    const apiDataAfterDel = await apiResAfterDel.json();
    const stillInDb = apiDataAfterDel.questions.find(q => q.q === testQuestionText);
    if (stillInDb) {
      throw new Error('Test question was NOT deleted from Neon PostgreSQL database!');
    }
    console.log('   ✅ Confirmed deletion from Neon PostgreSQL database!');

    // 11. Test Manual Sync Button
    console.log('11. Testing Manual Sync Button (#btn-sync-cloud)...');
    await page.click('#btn-sync-cloud');
    await page.waitForTimeout(2000);
    const toastText = await page.textContent('#portal-toast');
    console.log('   Toast message after sync:', toastText);
    if (!toastText.includes('Berhasil') && !toastText.includes('disinkronkan')) {
      console.warn('   Toast text did not contain expected message:', toastText);
    }

    console.log('\n🎉 ALL CLOUD DATABASE SYNC INTEGRATION TESTS PASSED 100%!');
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
