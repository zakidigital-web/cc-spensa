import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Testing Fresh Device / Cleared Storage Cloud Hydration...');

  const browser = await chromium.launch({ headless: true });
  // Brand new incognito context (zero localStorage, zero IndexedDB)
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Loading portal on completely clean browser context...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Navigate to Bank Soal
    await page.click('button[data-view="bank"]');
    await page.waitForTimeout(1000);

    const cloudStatusText = await page.textContent('#cloud-db-status-text');
    console.log('   Cloud DB Status Text:', cloudStatusText);

    const countP7 = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Penyisihan Kelas 7 Hydrated from Cloud: ${countP7} questions`);

    await page.click('#btn_jenjang_8');
    await page.waitForTimeout(500);
    const countP8 = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Penyisihan Kelas 8 Hydrated from Cloud: ${countP8} questions`);

    await page.click('#btn_jenjang_9');
    await page.waitForTimeout(500);
    const countP9 = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Penyisihan Kelas 9 Hydrated from Cloud: ${countP9} questions`);

    await page.click('#bank_tab_semifinal');
    await page.waitForTimeout(500);
    const countSemi = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Semifinal Hydrated from Cloud: ${countSemi} questions`);

    await page.click('#bank_tab_final');
    await page.waitForTimeout(500);
    const countFinal = await page.$$eval('#bank-list-container .question-card-item', els => els.length);
    console.log(`   Grand Final Hydrated from Cloud: ${countFinal} questions`);

    if (countP7 === 44 && countP8 === 68 && countP9 === 68 && countSemi === 48 && countFinal === 16) {
      console.log('\n🎉 ALL 244 QUESTIONS SUCCESSFULLY HYDRATED FROM NEON POSTGRESQL ON FRESH DEVICE!');
    } else {
      throw new Error(`Counts mismatch: P7=${countP7}, P8=${countP8}, P9=${countP9}, Semi=${countSemi}, Final=${countFinal}`);
    }
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
