import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Starting Test: Permanent Delete All Questions & No Resurrection...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    console.log('1. Loading portal on http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    console.log('2. Navigating to Bank Soal (View Bank)...');
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(600);

    // Initial counts
    const k7Init = await page.textContent('#count_jenjang_7');
    const k8Init = await page.textContent('#count_jenjang_8');
    const k9Init = await page.textContent('#count_jenjang_9');
    console.log(`   Initial counts: K7=${k7Init}, K8=${k8Init}, K9=${k9Init}`);

    // 3. Test "Hapus Kelas 7 Saja"
    console.log('3. Testing "Hapus Kelas 7 Saja"...');
    await page.click('#btn-delete-all');
    await page.waitForTimeout(300);

    // Check modal opened with custom options
    const isModalActive = await page.evaluate(() => {
      const m = document.getElementById('modal-confirm-delete');
      return m && m.classList.contains('active');
    });
    console.log(`   Modal opened: ${isModalActive}`);
    if (!isModalActive) throw new Error('Delete modal did not open!');

    // Click single class delete (btn-confirm-del-action)
    await page.click('#btn-confirm-del-action');
    await page.waitForTimeout(600);

    const k7AfterSingle = await page.textContent('#count_jenjang_7');
    const k8AfterSingle = await page.textContent('#count_jenjang_8');
    const k9AfterSingle = await page.textContent('#count_jenjang_9');
    console.log(`   Counts after single class delete: K7=${k7AfterSingle}, K8=${k8AfterSingle}, K9=${k9AfterSingle}`);
    if (k7AfterSingle !== '0' || k8AfterSingle !== '44' || k9AfterSingle !== '44') {
      throw new Error('Single class delete failed or affected other classes!');
    }

    // 4. Test "Hapus SEMUA Kelas 7, 8 & 9"
    console.log('4. Testing "Hapus SEMUA Kelas 7, 8 & 9"...');
    await page.click('#btn-delete-all');
    await page.waitForTimeout(300);

    await page.click('#btn-del-all-classes');
    await page.waitForTimeout(600);

    const k7All = await page.textContent('#count_jenjang_7');
    const k8All = await page.textContent('#count_jenjang_8');
    const k9All = await page.textContent('#count_jenjang_9');
    console.log(`   Counts after clearing all classes: K7=${k7All}, K8=${k8All}, K9=${k9All}`);
    if (k7All !== '0' || k8All !== '0' || k9All !== '0') {
      throw new Error('Clearing all classes failed!');
    }

    // 5. RELOAD page and verify NO RESURRECTION!
    console.log('5. Reloading the whole portal page to test permanence (NO resurrection)...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(600);

    const k7Reload = await page.textContent('#count_jenjang_7');
    const k8Reload = await page.textContent('#count_jenjang_8');
    const k9Reload = await page.textContent('#count_jenjang_9');
    console.log(`   Counts after reload: K7=${k7Reload}, K8=${k8Reload}, K9=${k9Reload}`);
    if (k7Reload !== '0' || k8Reload !== '0' || k9Reload !== '0') {
      throw new Error('RESURRECTION BUG DETECTED! Questions came back after reload!');
    }
    console.log('   🎉 SUCCESS: Zero resurrection! Questions stayed 0 after reload.');

    // 6. Test "Pulihkan SEMUA Kelas (7, 8 & 9)"
    console.log('6. Testing "Pulihkan SEMUA Kelas (7, 8 & 9)"...');
    await page.click('#btn-restore-default');
    await page.waitForTimeout(300);

    await page.click('#modal-del-actions .btn-gold');
    await page.waitForTimeout(600);

    const k7Restored = await page.textContent('#count_jenjang_7');
    const k8Restored = await page.textContent('#count_jenjang_8');
    const k9Restored = await page.textContent('#count_jenjang_9');
    console.log(`   Counts after restoring all classes: K7=${k7Restored}, K8=${k8Restored}, K9=${k9Restored}`);
    if (k7Restored !== '44' || k8Restored !== '44' || k9Restored !== '44') {
      throw new Error('Restoring all classes failed!');
    }

    // 7. Test "Kosongkan Seluruh Bank Soal Semua Babak"
    console.log('7. Testing "Kosongkan Seluruh Bank Soal Semua Babak"...');
    await page.click('#btn-delete-all');
    await page.waitForTimeout(300);

    await page.click('#btn-del-all-stages');
    await page.waitForTimeout(800);

    console.log('   Checking Penyisihan count:');
    const k7Wiped = await page.textContent('#count_jenjang_7');
    console.log(`   Penyisihan K7: ${k7Wiped}`);

    console.log('   Checking Semifinal count:');
    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(400);
    const semiCardsCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Semifinal cards: ${semiCardsCount}`);

    console.log('   Checking Grand Final count:');
    await page.click('#bank_tab_final');
    await page.waitForTimeout(400);
    const finalCardsCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Final cards: ${finalCardsCount}`);

    if (k7Wiped !== '0' || semiCardsCount !== 0 || finalCardsCount !== 0) {
      throw new Error('Kosongkan semua babak did not wipe all stages!');
    }

    // 8. RELOAD page and verify all stages STILL 0!
    console.log('8. Reloading portal page to verify all stages stay wiped...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(600);

    const k7Still0 = await page.textContent('#count_jenjang_7');
    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(300);
    const semiStill0 = await page.locator('#bank-list-container .question-card-item').count();
    await page.click('#bank_tab_final');
    await page.waitForTimeout(300);
    const finalStill0 = await page.locator('#bank-list-container .question-card-item').count();

    console.log(`   Counts after second reload: Penyisihan K7=${k7Still0}, Semifinal=${semiStill0}, Final=${finalStill0}`);
    if (k7Still0 !== '0' || semiStill0 !== 0 || finalStill0 !== 0) {
      throw new Error('Questions resurrected on second reload!');
    }

    // 9. Restore all defaults back so the environment is ready for normal use
    console.log('9. Restoring all stage defaults for normal environment readiness...');
    await page.click('#btn-restore-default');
    await page.waitForTimeout(200);
    await page.click('#btn-confirm-del-action');
    await page.waitForTimeout(400);

    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(300);
    await page.click('#btn-restore-default');
    await page.waitForTimeout(200);
    await page.click('#btn-confirm-del-action');
    await page.waitForTimeout(400);

    await page.click('#bank_tab_penyisihan');
    await page.waitForTimeout(300);
    await page.click('#btn-restore-default');
    await page.waitForTimeout(200);
    await page.click('#modal-del-actions .btn-gold');
    await page.waitForTimeout(500);

    const finalK7 = await page.textContent('#count_jenjang_7');
    console.log(`   Final environment state: K7=${finalK7} (ready)`);

    console.log('✅ ALL TESTS PASSED! Permanent deletion, batch choices, and anti-resurrection verified 100%!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    await page.screenshot({ path: 'screenshot-delete-all-failure.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
