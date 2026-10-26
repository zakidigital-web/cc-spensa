import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Starting Bank Soal Jenjang (Kelas 7, 8, 9) Verification Test...');
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

    // Verify view-bank is active
    const isViewBankActive = await page.evaluate(() => {
      const v = document.getElementById('view-bank');
      return v && v.classList.contains('active');
    });
    console.log(`   View Bank active: ${isViewBankActive}`);
    if (!isViewBankActive) throw new Error('View Bank is not active!');

    // 3. Verify Jenjang Strip is visible for Penyisihan
    console.log('3. Checking Jenjang strip visibility for Babak Penyisihan...');
    const isStripVisible = await page.evaluate(() => {
      const strip = document.getElementById('penyisihan-jenjang-strip');
      return strip && strip.style.display !== 'none';
    });
    console.log(`   Penyisihan Jenjang Strip visible: ${isStripVisible}`);
    if (!isStripVisible) throw new Error('Jenjang strip is not visible for Penyisihan!');

    // Check counts
    const count7 = await page.textContent('#count_jenjang_7');
    const count8 = await page.textContent('#count_jenjang_8');
    const count9 = await page.textContent('#count_jenjang_9');
    console.log(`   Jenjang counts: Kelas 7=${count7}, Kelas 8=${count8}, Kelas 9=${count9}`);

    // Check active jenjang pill (should be 7 by default)
    const isK7Active = await page.evaluate(() => {
      return document.getElementById('btn_jenjang_7').classList.contains('active');
    });
    console.log(`   Kelas 7 pill active: ${isK7Active}`);
    if (!isK7Active) throw new Error('Kelas 7 should be active by default!');

    // 4. Switch to Kelas 8
    console.log('4. Switching to Kelas 8...');
    await page.click('#btn_jenjang_8');
    await page.waitForTimeout(400);

    const isK8Active = await page.evaluate(() => {
      return document.getElementById('btn_jenjang_8').classList.contains('active');
    });
    const labelText8 = await page.textContent('#active-bank-stage-label');
    console.log(`   Kelas 8 pill active: ${isK8Active}, Label: ${labelText8.trim()}`);
    if (!isK8Active || !labelText8.includes('Kelas 8')) {
      throw new Error('Failed to switch to Kelas 8!');
    }

    // Check card badges in Kelas 8
    const cardBadgesK8 = await page.$$eval('#bank-list-container .question-card-item .q-card-badge', badges => {
      return badges.slice(0, 3).map(b => b.textContent.trim());
    });
    console.log(`   Sample card badges in Kelas 8:`, cardBadgesK8);
    for (const b of cardBadgesK8) {
      if (!b.includes('Kelas 8')) {
        throw new Error(`Expected card badge to contain 'Kelas 8', got: ${b}`);
      }
    }

    // 5. Switch to Kelas 9
    console.log('5. Switching to Kelas 9...');
    await page.click('#btn_jenjang_9');
    await page.waitForTimeout(400);

    const isK9Active = await page.evaluate(() => {
      return document.getElementById('btn_jenjang_9').classList.contains('active');
    });
    const labelText9 = await page.textContent('#active-bank-stage-label');
    console.log(`   Kelas 9 pill active: ${isK9Active}, Label: ${labelText9.trim()}`);
    if (!isK9Active || !labelText9.includes('Kelas 9')) {
      throw new Error('Failed to switch to Kelas 9!');
    }

    const cardBadgesK9 = await page.$$eval('#bank-list-container .question-card-item .q-card-badge', badges => {
      return badges.slice(0, 3).map(b => b.textContent.trim());
    });
    console.log(`   Sample card badges in Kelas 9:`, cardBadgesK9);
    for (const b of cardBadgesK9) {
      if (!b.includes('Kelas 9')) {
        throw new Error(`Expected card badge to contain 'Kelas 9', got: ${b}`);
      }
    }

    // 6. Test Adding Question specifically to Kelas 8
    console.log('6. Adding a unique test question to Kelas 8...');
    await page.click('#btn_jenjang_8');
    await page.waitForTimeout(300);

    const count8Before = parseInt(await page.textContent('#count_jenjang_8'), 10);
    const count7Before = parseInt(await page.textContent('#count_jenjang_7'), 10);
    const count9Before = parseInt(await page.textContent('#count_jenjang_9'), 10);

    await page.click('#btn-add-question');
    await page.waitForTimeout(300);

    // Check modal jenjang radio
    const radio8Checked = await page.evaluate(() => {
      const r = document.querySelector('input[name="edit-q-jenjang"][value="8"]');
      return r && r.checked;
    });
    console.log(`   Modal radio Kelas 8 checked: ${radio8Checked}`);
    if (!radio8Checked) throw new Error('Modal radio for Kelas 8 should be checked!');

    const uniqueTextK8 = `[K8-TEST-${Date.now()}] Berapakah luas lingkaran jika jari-jari 7 cm?`;
    await page.fill('#edit-q-text', uniqueTextK8);
    await page.fill('#edit-opt-0', '154 cm²');
    await page.fill('#edit-opt-1', '144 cm²');
    await page.fill('#edit-opt-2', '120 cm²');
    await page.fill('#edit-opt-3', '100 cm²');

    await page.click('#btn-save-edit-q');
    await page.waitForTimeout(600);

    const count8After = parseInt(await page.textContent('#count_jenjang_8'), 10);
    const count7After = parseInt(await page.textContent('#count_jenjang_7'), 10);
    const count9After = parseInt(await page.textContent('#count_jenjang_9'), 10);

    console.log(`   Count check -> K8: ${count8Before} -> ${count8After}, K7: ${count7Before} -> ${count7After}, K9: ${count9Before} -> ${count9After}`);
    if (count8After !== count8Before + 1) throw new Error('Kelas 8 count did not increment!');
    if (count7After !== count7Before) throw new Error('Kelas 7 count should NOT have changed!');
    if (count9After !== count9Before) throw new Error('Kelas 9 count should NOT have changed!');

    // 7. Verify switching to Semifinal hides Jenjang Strip
    console.log('7. Switching to Babak Semifinal...');
    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(400);

    const isStripHiddenSemi = await page.evaluate(() => {
      const strip = document.getElementById('penyisihan-jenjang-strip');
      return !strip || strip.style.display === 'none';
    });
    console.log(`   Jenjang Strip hidden in Semifinal: ${isStripHiddenSemi}`);
    if (!isStripHiddenSemi) throw new Error('Jenjang strip should be hidden in Semifinal!');

    // 8. Verify switching to Grand Final hides Jenjang Strip
    console.log('8. Switching to Babak Grand Final...');
    await page.click('#bank_tab_final');
    await page.waitForTimeout(400);

    const isStripHiddenFinal = await page.evaluate(() => {
      const strip = document.getElementById('penyisihan-jenjang-strip');
      return !strip || strip.style.display === 'none';
    });
    console.log(`   Jenjang Strip hidden in Grand Final: ${isStripHiddenFinal}`);
    if (!isStripHiddenFinal) throw new Error('Jenjang strip should be hidden in Grand Final!');

    // 9. Switch back to Penyisihan
    console.log('9. Switching back to Babak Penyisihan...');
    await page.click('#bank_tab_penyisihan');
    await page.waitForTimeout(400);

    const isStripVisibleBack = await page.evaluate(() => {
      const strip = document.getElementById('penyisihan-jenjang-strip');
      return strip && strip.style.display !== 'none';
    });
    console.log(`   Jenjang Strip visible when back in Penyisihan: ${isStripVisibleBack}`);
    if (!isStripVisibleBack) throw new Error('Jenjang strip should be visible when returning to Penyisihan!');

    // Take screenshot of bank view with jenjang pills
    await page.screenshot({ path: 'screenshot-bank-jenjang.png' });
    console.log('   📸 Saved screenshot-bank-jenjang.png');

    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Bank Soal Jenjang separation is working flawlessly.');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    await page.screenshot({ path: 'screenshot-bank-jenjang-failure.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
