import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Starting Test: Disable / 0 Waktu Pengerjaan per Soal...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('dialog', async d => {
    console.log('   [Dialog accepted]:', d.message().slice(0, 50));
    await d.accept();
  });

  console.log('1. Loading penyisihan-cerdas-cermat.html...');
  await page.goto('http://localhost:3000/penyisihan-cerdas-cermat.html', { waitUntil: 'networkidle' });

  // 2. Set wSoal to 0 in Setup
  console.log('2. Setting Waktu per Soal input to 0 in Setup screen...');
  await page.fill('#wSoal', '0');
  
  const savedCfg = await page.evaluate(() => {
    window.readSetup();
    return window.cfg.wSoal;
  });
  console.log('   Saved cfg.wSoal:', savedCfg);
  if (savedCfg !== 0) throw new Error(`Expected cfg.wSoal === 0, got ${savedCfg}`);

  // 3. Start Game
  console.log('3. Starting game with wSoal = 0 (disabled)...');
  await page.click('button[data-act="start"]');
  await page.waitForSelector('#cd', { state: 'detached', timeout: 6000 });
  await page.waitForTimeout(500);

  // 4. Verify Arena UI when wSoal = 0
  const arenaState = await page.evaluate(() => {
    const tm0 = document.querySelector('#tm0');
    const bar0 = document.querySelector('.col#col0 .tb');
    const cols = document.querySelectorAll('.col').length;
    return {
      cols,
      tmText: tm0 ? tm0.textContent.trim() : null,
      barDisplay: bar0 ? window.getComputedStyle(bar0).display : null,
      g0_tLeft: window.S && window.S.groups[0] ? window.S.groups[0].tLeft : null,
      cfgWSoal: window.S && window.S.cfg ? window.S.cfg.wSoal : null
    };
  });
  console.log('   Arena state with disabled timer:', arenaState);

  if (arenaState.cfgWSoal !== 0) throw new Error(`Expected S.cfg.wSoal === 0, got ${arenaState.cfgWSoal}`);
  if (!arenaState.tmText.includes('Bebas') && !arenaState.tmText.includes('∞')) {
    throw new Error(`Expected timer text to show '∞ Bebas', got '${arenaState.tmText}'`);
  }
  if (arenaState.barDisplay !== 'none') {
    throw new Error(`Expected timer progress bar .tb to have display: 'none', got '${arenaState.barDisplay}'`);
  }
  console.log('   ✅ Timer indicator correctly shows "∞ Bebas" and progress bar is hidden!');

  // 5. Wait 3 seconds to verify questions DO NOT timeout
  console.log('5. Waiting 3 seconds to verify no auto-advance timeout occurs...');
  await page.waitForTimeout(3000);
  const questionIndexBefore = await page.evaluate(() => window.S.groups[0].i);
  if (questionIndexBefore !== 0) {
    throw new Error(`Expected group 0 to still be on question 0, but it advanced to ${questionIndexBefore}`);
  }
  console.log('   ✅ Verified: No timeout/auto-advance occurred while wSoal = 0!');

  // 6. Answer Question 1 manually to verify advance works seamlessly
  console.log('6. Answering question manually on Column 0...');
  await page.click('#col0 .opt:first-child');
  await page.waitForTimeout(600);

  const questionIndexAfter = await page.evaluate(() => window.S.groups[0].i);
  const tmAfter = await page.evaluate(() => document.querySelector('#tm0').textContent.trim());
  console.log(`   Group 0 advanced to question index ${questionIndexAfter}, timer text: '${tmAfter}'`);
  if (questionIndexAfter !== 1) throw new Error('Expected group 0 to advance to question 1 after manual answer');
  if (!tmAfter.includes('Bebas') && !tmAfter.includes('∞')) throw new Error('Next question timer should still be disabled');
  console.log('   ✅ Manual advance works and next question maintains disabled timer!');

  // 7. Test Panitia Panel live timer adjustment
  console.log('7. Testing Panitia Panel (⚙ Panitia) live adjustment...');
  await page.click('button[data-act="panel"]');
  await page.waitForSelector('#pm', { state: 'visible', timeout: 3000 });

  // Verify input in panel exists and has value 0
  const panelWSoalVal = await page.inputValue('#p_wsoal');
  console.log('   Panitia panel input #p_wsoal value:', panelWSoalVal);
  if (panelWSoalVal !== '0') throw new Error(`Expected panel #p_wsoal value '0', got '${panelWSoalVal}'`);

  // Change to 15 seconds
  await page.fill('#p_wsoal', '15');
  await page.dispatchEvent('#p_wsoal', 'change');
  await page.click('button[data-act="presume"]');
  await page.waitForTimeout(400);

  const resumedState = await page.evaluate(() => ({
    cfgWSoal: window.S.cfg.wSoal,
    barDisplay: window.getComputedStyle(document.querySelector('.col#col0 .tb')).display,
    tmText: document.querySelector('#tm0').textContent.trim()
  }));
  console.log('   Resumed state with 15s timer:', resumedState);
  if (resumedState.cfgWSoal !== 15) throw new Error('Expected S.cfg.wSoal to be updated to 15');
  if (resumedState.barDisplay === 'none') throw new Error('Expected progress bar to be visible when wSoal = 15');
  console.log('   ✅ Panitia panel dynamic timer update verified!');

  await browser.close();
  console.log('🎉 ALL DISABLE / 0 WAKTU PER SOAL TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
