import { chromium } from 'playwright';

async function runTests() {
  console.log('🚀 Starting Admin Authentication & Protected Views Test Suite...');
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
    // ════════════ TEST 1: Unauthenticated portal navigation ════════════
    console.log('\n--- Scenario 1: Unauthenticated Navigation to Bank & Laporan ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Ensure clean state (logged out)
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('cc_admin_auth');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const loginBtnVisible = await page.isVisible('#btn-admin-login');
    const badgeHidden = await page.evaluate(() => {
      const b = document.getElementById('admin-session-badge');
      return !b || b.style.display === 'none';
    });
    assert(loginBtnVisible, 'Admin Login button visible in header when logged out');
    assert(badgeHidden, 'Admin session badge hidden when logged out');

    // Click "Bank Soal Word" in nav
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(300);

    const authModalActive = await page.evaluate(() => {
      const m = document.getElementById('admin-auth-modal');
      return m && m.classList.contains('active');
    });
    const hubActive = await page.evaluate(() => {
      const v = document.getElementById('view-hub');
      return v && v.classList.contains('active');
    });
    const bankNotActive = await page.evaluate(() => {
      const v = document.getElementById('view-bank');
      return !v || !v.classList.contains('active');
    });
    assert(authModalActive, 'Admin Auth Modal appears when clicking Bank Soal while logged out');
    assert(hubActive, 'Hub remains active view');
    assert(bankNotActive, 'Bank Soal view remains blocked/inactive');

    // Cancel modal
    await page.click('#btn-cancel-admin-auth');
    await page.waitForTimeout(200);
    const modalClosed = await page.evaluate(() => {
      const m = document.getElementById('admin-auth-modal');
      return !m || !m.classList.contains('active');
    });
    assert(modalClosed, 'Admin Auth Modal closes on Batal');

    // ════════════ TEST 2: Credential validation & Error feedback ════════════
    console.log('\n--- Scenario 2: Wrong Credentials Handling ---');
    // Click "Lihat Laporan Juara Final" on hub quick action banner
    await page.click('button[data-view="laporan"]');
    await page.waitForTimeout(300);

    // Enter wrong credentials
    await page.fill('#admin-auth-user', 'operator');
    await page.fill('#admin-auth-pass', 'wrongpass');
    await page.click('#btn-submit-admin-auth');
    await page.waitForTimeout(200);

    let errorVisible = await page.evaluate(() => {
      const err = document.getElementById('admin-auth-error');
      return err && err.style.display !== 'none';
    });
    assert(errorVisible, 'Error banner displayed for wrong credentials');

    // Wrong password for admin
    await page.fill('#admin-auth-user', 'admin');
    await page.fill('#admin-auth-pass', '123456');
    await page.click('#btn-submit-admin-auth');
    await page.waitForTimeout(200);

    errorVisible = await page.evaluate(() => {
      const err = document.getElementById('admin-auth-error');
      return err && err.style.display !== 'none';
    });
    assert(errorVisible, 'Error banner still displayed for wrong password');

    // ════════════ TEST 3: Successful Login & Transition ════════════
    console.log('\n--- Scenario 3: Valid Login with user: admin, pass: spensa123 ---');
    await page.fill('#admin-auth-user', 'admin');
    await page.fill('#admin-auth-pass', 'spensa123');
    await page.click('#btn-submit-admin-auth');
    await page.waitForTimeout(500);

    const loginSuccessModalClosed = await page.evaluate(() => {
      const m = document.getElementById('admin-auth-modal');
      return !m || !m.classList.contains('active');
    });
    const laporanActive = await page.evaluate(() => {
      const v = document.getElementById('view-laporan');
      return v && v.classList.contains('active');
    });
    const badgeVisible = await page.evaluate(() => {
      const b = document.getElementById('admin-session-badge');
      return b && b.style.display !== 'none';
    });
    const isAuthStored = await page.evaluate(() => {
      return sessionStorage.getItem('cc_admin_auth') === '1' && localStorage.getItem('cc_admin_auth') === '1';
    });

    assert(loginSuccessModalClosed, 'Modal closes on correct admin credentials');
    assert(laporanActive, 'Transition automatically succeeds to requested view (Laporan)');
    assert(badgeVisible, 'Admin session badge is now visible in header');
    assert(isAuthStored, 'Auth state persisted in sessionStorage and localStorage');

    // Access Bank Soal while logged in (should not prompt modal)
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(300);

    const bankNowActive = await page.evaluate(() => {
      const v = document.getElementById('view-bank');
      return v && v.classList.contains('active');
    });
    const modalStillClosed = await page.evaluate(() => {
      const m = document.getElementById('admin-auth-modal');
      return !m || !m.classList.contains('active');
    });
    assert(bankNowActive, 'Bank Soal opens directly without re-prompting when authenticated');
    assert(modalStillClosed, 'Modal remains closed');

    // ════════════ TEST 4: Cloud Sync Button Protection ════════════
    console.log('\n--- Scenario 4: Cloud Database Sync ---');
    const syncBtnExists = await page.isVisible('#btn-sync-cloud');
    assert(syncBtnExists, 'Sinkronkan Cloud button exists in Bank toolbar');
    await page.click('#btn-sync-cloud');
    await page.waitForTimeout(1000);
    const syncNotPrompted = await page.evaluate(() => {
      const m = document.getElementById('admin-auth-modal');
      return !m || !m.classList.contains('active');
    });
    assert(syncNotPrompted, 'Cloud sync executed smoothly for authenticated admin');

    // ════════════ TEST 5: Admin Logout Flow ════════════
    console.log('\n--- Scenario 5: Admin Logout Flow ---');
    await page.click('#btn-admin-logout');
    await page.waitForTimeout(500);

    const loggedOutAuthCleared = await page.evaluate(() => {
      return !sessionStorage.getItem('cc_admin_auth') && !localStorage.getItem('cc_admin_auth');
    });
    const redirectedToHub = await page.evaluate(() => {
      const v = document.getElementById('view-hub');
      return v && v.classList.contains('active');
    });
    const badgeHiddenAfterLogout = await page.evaluate(() => {
      const b = document.getElementById('admin-session-badge');
      return !b || b.style.display === 'none';
    });
    assert(loggedOutAuthCleared, 'Auth tokens cleared from storage upon logout');
    assert(redirectedToHub, 'User redirected away from protected Bank view to Hub');
    assert(badgeHiddenAfterLogout, 'Admin badge hidden after logout');

    // Verify trying to go back to Bank triggers auth modal again
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(300);
    const modalPromptedAgain = await page.evaluate(() => {
      const m = document.getElementById('admin-auth-modal');
      return m && m.classList.contains('active');
    });
    assert(modalPromptedAgain, 'Accessing Bank after logout triggers login modal again');
    await page.click('#btn-cancel-admin-auth');

    // ════════════ TEST 6: Standalone Penyisihan Arena Authentication ════════════
    console.log('\n--- Scenario 6: Standalone Penyisihan Arena ---');
    await page.goto('http://localhost:3000/penyisihan', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Ensure logged out in this context
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('cc_admin_auth');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Click "Kelola Bank Soal"
    await page.click('button[data-act="tobank"]');
    await page.waitForTimeout(300);

    let penyisihanModalVisible = await page.isVisible('#admin_auth_modal');
    assert(penyisihanModalVisible, 'Admin Auth modal opens in Penyisihan arena when clicking Kelola Bank Soal');

    // Submit wrong credentials
    await page.fill('#auth_u', 'admin');
    await page.fill('#auth_p', 'wrong');
    await page.click('#auth_submit');
    await page.waitForTimeout(200);
    let pErrVisible = await page.isVisible('#auth_err');
    assert(pErrVisible, 'Error message shown in Penyisihan arena for wrong password');

    // Submit correct credentials
    await page.fill('#auth_p', 'spensa123');
    await page.click('#auth_submit');
    await page.waitForTimeout(400);

    const penyisihanBankOpened = await page.evaluate(() => {
      return typeof view !== 'undefined' && view === 'bank';
    });
    assert(penyisihanBankOpened, 'Penyisihan bank view opened successfully after admin login');

    // Test logout in arena
    const logoutBtnInPenyisihan = await page.isVisible('button[data-act="adminlogout"]');
    assert(logoutBtnInPenyisihan, 'Keluar Admin button exists in Penyisihan bank toolbar');
    await page.click('button[data-act="adminlogout"]');
    await page.waitForTimeout(300);

    const penyisihanReturnedToSetup = await page.evaluate(() => {
      return typeof view !== 'undefined' && view === 'setup';
    });
    assert(penyisihanReturnedToSetup, 'Penyisihan returned to setup view after admin logout');

    // ════════════ TEST 7: Standalone Semifinal Arena Authentication ════════════
    console.log('\n--- Scenario 7: Standalone Semifinal Arena ---');
    await page.goto('http://localhost:3000/semifinal', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Ensure logged out
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('cc_admin_auth');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await page.click('button[data-act="tobank"]');
    await page.waitForTimeout(300);

    let semiModalVisible = await page.isVisible('#admin_auth_modal');
    assert(semiModalVisible, 'Admin Auth modal opens in Semifinal arena when clicking Kelola Bank Soal');

    await page.fill('#auth_u', 'admin');
    await page.fill('#auth_p', 'spensa123');
    await page.click('#auth_submit');
    await page.waitForTimeout(400);

    const semiBankOpened = await page.evaluate(() => {
      return typeof view !== 'undefined' && view === 'bank';
    });
    assert(semiBankOpened, 'Semifinal bank view opened successfully after admin login');

    const logoutBtnInSemi = await page.isVisible('button[data-act="adminlogout"]');
    assert(logoutBtnInSemi, 'Keluar Admin button exists in Semifinal bank toolbar');
    await page.click('button[data-act="adminlogout"]');
    await page.waitForTimeout(300);

    const semiReturnedToSetup = await page.evaluate(() => {
      return typeof view !== 'undefined' && view === 'setup';
    });
    assert(semiReturnedToSetup, 'Semifinal returned to setup view after admin logout');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    await browser.close();
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════');
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
