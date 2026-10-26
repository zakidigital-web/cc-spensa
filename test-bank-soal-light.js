import { chromium } from 'playwright';

async function runLightTest() {
  console.log('Testing Bank Soal in Light Mode...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/');
  // Toggle to light mode
  await page.click('#btn-toggle-theme');
  await page.waitForTimeout(300);

  // Navigate to bank soal
  await page.click('button[data-view="bank"]');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshot-bank-light-initial.png' });
  console.log('📸 Saved screenshot-bank-light-initial.png');

  // Select 2 items
  const checkboxes = page.locator('#bank-list-container .q-checkbox');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.waitForTimeout(200);

  await page.screenshot({ path: 'screenshot-bank-light-selected.png' });
  console.log('📸 Saved screenshot-bank-light-selected.png');

  // Open Edit Modal in light mode
  await page.click('#bank-list-container .question-card-item .btn-edit');
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'screenshot-bank-light-modal-edit.png' });
  console.log('📸 Saved screenshot-bank-light-modal-edit.png');

  await browser.close();
  console.log('✅ Light mode test completed!');
}

runLightTest();
