import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Starting Bank Soal Interactive Feature Test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Listen to console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    console.log('1. Loading portal on http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    console.log('2. Navigating to Bank Soal (View Bank)...');
    await page.click('button[data-view="bank"]');
    await page.waitForTimeout(600);

    // Verify view-bank is active
    const isViewBankActive = await page.evaluate(() => {
      const v = document.getElementById('view-bank');
      return v && v.classList.contains('active');
    });
    console.log(`   View Bank active: ${isViewBankActive}`);
    if (!isViewBankActive) throw new Error('View Bank not active!');

    // Check question items rendered
    const initialCardsCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`3. Initial question cards count in Penyisihan: ${initialCardsCount}`);
    if (initialCardsCount === 0) throw new Error('No question cards found in Penyisihan!');

    // Take screenshot of initial bank list
    await page.screenshot({ path: 'screenshot-bank-initial.png' });
    console.log('   📸 Saved screenshot-bank-initial.png');

    // 4. Test Search
    console.log('4. Testing Live Search...');
    await page.fill('#bank-search-input', 'Islam');
    await page.waitForTimeout(300);
    const searchCardsCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Questions matching "Islam": ${searchCardsCount}`);
    if (searchCardsCount === 0) throw new Error('Search for "Islam" returned 0 items!');

    // Clear search
    await page.click('#btn-clear-search');
    await page.waitForTimeout(200);
    const restoredCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Count after clearing search: ${restoredCount}`);
    if (restoredCount !== initialCardsCount) throw new Error('Clear search did not restore all cards!');

    // 5. Test "➕ Tambah Soal Manual"
    console.log('5. Testing Tambah Soal Manual...');
    await page.click('#btn-add-question');
    await page.waitForTimeout(300);

    const isEditModalActive = await page.evaluate(() => {
      const m = document.getElementById('modal-edit-question');
      return m && m.classList.contains('active');
    });
    console.log(`   Modal edit question opened: ${isEditModalActive}`);
    if (!isEditModalActive) throw new Error('Edit modal did not open!');

    // Select category Matematika
    await page.selectOption('#edit-q-category', 'Matematika');

    // Type LaTeX question text
    const testQuestionText = 'Berapakah nilai dari $\\sqrt{144} + 5^2$?';
    await page.fill('#edit-q-text', testQuestionText);

    // Verify live KaTeX preview
    const previewContent = await page.locator('#edit-q-preview-content').innerHTML();
    const hasKatexSpan = previewContent.includes('katex');
    console.log(`   KaTeX formula rendered in live preview: ${hasKatexSpan}`);

    // Fill options
    await page.fill('#edit-opt-0', '35');
    await page.fill('#edit-opt-1', '37');
    await page.fill('#edit-opt-2', '40');
    await page.fill('#edit-opt-3', '42');

    // Select option B (index 1) as correct
    await page.check('input[name="edit-q-key"][value="1"]');

    // Take screenshot of add question modal with KaTeX preview
    await page.screenshot({ path: 'screenshot-modal-add-katex.png' });
    console.log('   📸 Saved screenshot-modal-add-katex.png');

    // Save
    await page.click('#btn-save-edit-q');
    await page.waitForTimeout(500);

    const afterAddCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Count after adding question: ${afterAddCount} (was ${initialCardsCount})`);
    if (afterAddCount !== initialCardsCount + 1) throw new Error('Question was not added!');

    // Verify the new question is visible with math formula
    await page.fill('#bank-search-input', '144');
    await page.waitForTimeout(300);
    const addedCard = page.locator('#bank-list-container .question-card-item').first();
    const addedCardText = await addedCard.innerText();
    console.log(`   Found newly added question: ${addedCardText.includes('144')}`);
    await page.click('#btn-clear-search');
    await page.waitForTimeout(200);

    // 6. Test "✏️ Edit Soal"
    console.log('6. Testing Edit Soal...');
    await page.fill('#bank-search-input', '144');
    await page.waitForTimeout(300);
    await page.click('#bank-list-container .question-card-item .btn-edit');
    await page.waitForTimeout(300);

    // Modify text
    await page.fill('#edit-q-text', 'Berapakah nilai dari $\\sqrt{144} + 5^2$? (Revisi Soal)');
    await page.click('#btn-save-edit-q');
    await page.waitForTimeout(500);

    const revisedCardText = await page.locator('#bank-list-container .question-card-item').first().innerText();
    console.log(`   Edited question has '(Revisi Soal)': ${revisedCardText.includes('(Revisi Soal)')}`);
    if (!revisedCardText.includes('(Revisi Soal)')) throw new Error('Edit was not saved!');

    // 7. Test "👁️ Preview Soal"
    console.log('7. Testing Preview Soal Modal...');
    await page.click('#bank-list-container .question-card-item .btn-pv');
    await page.waitForTimeout(300);
    const isPvModalActive = await page.evaluate(() => {
      const m = document.getElementById('modal-preview-question');
      return m && m.classList.contains('active');
    });
    console.log(`   Preview modal opened: ${isPvModalActive}`);
    if (!isPvModalActive) throw new Error('Preview modal did not open!');

    // Take screenshot of preview modal
    await page.screenshot({ path: 'screenshot-modal-preview.png' });
    console.log('   📸 Saved screenshot-modal-preview.png');
    await page.click('#btn-close-pv');
    await page.waitForTimeout(200);

    // 8. Test "🗑️ Hapus Soal Tunggal"
    console.log('8. Testing Single Delete...');
    await page.click('#bank-list-container .question-card-item .btn-del');
    await page.waitForTimeout(300);
    const isDelModalActive = await page.evaluate(() => {
      const m = document.getElementById('modal-confirm-delete');
      return m && m.classList.contains('active');
    });
    console.log(`   Confirm delete modal opened: ${isDelModalActive}`);
    if (!isDelModalActive) throw new Error('Delete confirmation modal did not open!');

    // Confirm deletion
    await page.click('#btn-confirm-del-action');
    await page.waitForTimeout(500);
    await page.click('#btn-clear-search');
    await page.waitForTimeout(200);

    const afterSingleDelCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Count after deleting newly created question: ${afterSingleDelCount} (should be ${initialCardsCount})`);
    if (afterSingleDelCount !== initialCardsCount) throw new Error('Single delete failed!');

    // 9. Test "🗑️ Hapus Terpilih (Batch Delete)"
    console.log('9. Testing Batch Delete...');
    // Select first 2 questions
    const checkboxes = page.locator('#bank-list-container .q-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.waitForTimeout(200);

    const selBadgeText = await page.locator('#bank-selected-count').innerText();
    console.log(`   Selected count badge: "${selBadgeText}"`);
    const btnDelText = await page.locator('#btn-delete-selected').innerText();
    console.log(`   Batch delete button text: "${btnDelText}"`);

    // Click batch delete button
    await page.click('#btn-delete-selected');
    await page.waitForTimeout(300);
    await page.click('#btn-confirm-del-action');
    await page.waitForTimeout(500);

    const afterBatchDelCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Count after batch deleting 2 questions: ${afterBatchDelCount} (was ${initialCardsCount})`);
    if (afterBatchDelCount !== initialCardsCount - 2) throw new Error('Batch delete failed!');

    // 10. Test "⚠️ Hapus SEMUA Soal"
    console.log('10. Testing Delete All Questions...');
    await page.click('#btn-delete-all');
    await page.waitForTimeout(300);
    await page.click('#btn-confirm-del-action');
    await page.waitForTimeout(500);

    const afterClearAllCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Count after clearing all questions: ${afterClearAllCount}`);
    const emptyStateText = await page.locator('#bank-list-container').innerText();
    console.log(`   Empty state message displayed: ${emptyStateText.includes('Kosong')}`);
    if (afterClearAllCount !== 0) throw new Error('Clear all did not empty the bank!');

    // Take screenshot of empty state
    await page.screenshot({ path: 'screenshot-bank-empty.png' });
    console.log('   📸 Saved screenshot-bank-empty.png');

    // 11. Test "🔄 Pulihkan Soal Bawaan"
    console.log('11. Testing Restore Default Questions...');
    await page.click('#btn-restore-default');
    await page.waitForTimeout(300);
    await page.click('#btn-confirm-del-action');
    await page.waitForTimeout(600);

    const restoredAllCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Count after restoring default questions: ${restoredAllCount}`);
    if (restoredAllCount !== initialCardsCount) throw new Error('Restore default questions failed!');

    // 12. Test Stage Switching (Semifinal & Final)
    console.log('12. Testing Stage Switching to Semifinal & Final...');
    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(500);
    const semiCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Semifinal bank questions loaded: ${semiCount}`);
    if (semiCount === 0) throw new Error('Semifinal questions failed to load!');

    await page.click('#bank_tab_final');
    await page.waitForTimeout(500);
    const finalCount = await page.locator('#bank-list-container .question-card-item').count();
    console.log(`   Grand Final bank questions loaded: ${finalCount}`);
    if (finalCount === 0) throw new Error('Grand Final questions failed to load!');

    // Take final screenshot
    await page.screenshot({ path: 'screenshot-bank-final-stage.png' });
    console.log('   📸 Saved screenshot-bank-final-stage.png');

    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    await page.screenshot({ path: 'screenshot-test-error.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
