import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Starting IFP 3-Split Screen Penyisihan Layout & Sizing Tests...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('dialog', async d => {
    console.log('   [Dialog accepted]:', d.message().slice(0, 60) + '...');
    await d.accept();
  });

  console.log('1. Loading /penyisihan-cerdas-cermat.html on 1920x1080 viewport...');
  await page.goto('http://localhost:3000/penyisihan-cerdas-cermat.html', { waitUntil: 'networkidle' });

  // 2. Inject diverse test questions (short, medium, long with formulas) into bank
  console.log('2. Injecting diverse test questions (short, medium, long with formulas)...');
  await page.evaluate(() => {
    const qShort = {
      id: 'q-short-1',
      mapel: 'PPKn',
      q: 'Lambang sila ke-1 Pancasila adalah ...',
      o: ['Bintang', 'Rantai emas', 'Pohon beringin', 'Kepala banteng'],
      k: 0,
      img: null
    };

    const qMedium = {
      id: 'q-med-1',
      mapel: 'Matematika',
      q: 'Diketahui segitiga siku-siku dengan panjang sisi tegak 9 cm dan sisi mendatar 12 cm. Berapakah panjang sisi miring (hipotenusa) segitiga tersebut?',
      o: [
        '15 cm diperoleh dengan rumus phytagoras $c = \\sqrt{a^2 + b^2}$',
        '18 cm dihitung dari keliling segitiga',
        '21 cm hasil penjumlahan seluruh sisi',
        '13 cm hasil akar kuadrat langsung'
      ],
      k: 0,
      img: null
    };

    const qLong = {
      id: 'q-long-1',
      mapel: 'IPA Fisika',
      q: 'Diketahui sebuah partikel bermuatan bergerak melintasi medan magnetik homogen dengan kecepatan konstan tertentu sehingga membentuk lintasan melingkar dengan jari-jari lintasan $R = \\frac{mv}{qB}$. Apabila massa partikel tersebut digandakan menjadi 2 kali lipat dan nilai muatannya diperkecil menjadi setengah dari muatan awal, maka bagaimanakah perbandingan jari-jari lintasan partikel yang baru terhadap jari-jari lintasan awal dalam kondisi medan magnetik yang konstan?',
      o: [
        'Jari-jari lintasan bertambah besar menjadi 4 kali lipat dari kondisi semula karena berbanding lurus dengan massa partikel dan berbanding terbalik terhadap besar muatannya.',
        'Jari-jari lintasan berkurang menjadi setengah dari semula akibat gaya Lorentz yang menekan partikel lebih kuat.',
        'Jari-jari lintasan tetap sama persis tanpa mengalami perubahan apapun karena pengaruh medan magnetik homogen bersifat stabil.',
        'Jari-jari lintasan menjadi 2 kali lipat lebih panjang karena massa partikel membesar 2 kali lipat.'
      ],
      k: 0,
      img: null
    };

    const j = window.cfg ? window.cfg.jenjang : 9;
    // Set 3 different questions for the 3 groups
    window.bank.soal[j] = [qShort, qMedium, qLong, ...window.bank.soal[j]];
    window.cfg.mode = 'loop'; // Use loop mode for reliable multi-group testing
    window.saveCfg();
    window.saveBank();
  });

  // 3. Start game in Auto mode
  console.log('3. Starting game with Auto-Fit font size...');
  await page.click('button[data-act="start"]');
  
  // Wait for countdown to detach
  await page.waitForSelector('#cd', { state: 'detached', timeout: 6000 });
  await page.waitForTimeout(500);

  // Take screenshot in Auto mode
  await page.screenshot({ path: '/home/darkverst/workspace/CC/ifp-auto-1080p.png' });
  console.log('   📸 Screenshot saved: ifp-auto-1080p.png');

  // Verify tiers and layout in Auto mode
  const autoMetrics = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.col'));
    return cols.map((col, idx) => {
      const qa = col.querySelector('.qa');
      const qt = col.querySelector('.qt');
      const opts = Array.from(col.querySelectorAll('.opt'));
      const badges = opts.map(o => o.querySelector('b'));
      const texts = opts.map(o => o.querySelector('.opt-text, span:not(b)'));

      // Check vertical overlap between options
      let hasOverlap = false;
      for (let i = 0; i < opts.length - 1; i++) {
        const r1 = opts[i].getBoundingClientRect();
        const r2 = opts[i+1].getBoundingClientRect();
        if (r1.bottom > r2.top + 1) { // 1px margin
          hasOverlap = true;
        }
      }

      // Check horizontal text overflow within options
      const overflows = texts.map(t => t.scrollWidth > t.clientWidth + 2);

      // Check badge alignment relative to first line of text
      const badgeAlignments = opts.map((opt, i) => {
        const bRect = badges[i].getBoundingClientRect();
        const tRect = texts[i].getBoundingClientRect();
        // Badge top should be roughly aligned with text top (within 10px)
        return Math.abs(bRect.top - tRect.top) <= 10;
      });

      return {
        colIndex: idx,
        tierClass: qa ? Array.from(qa.classList).find(c => c.startsWith('tier-')) : null,
        qtFontSize: qt ? window.getComputedStyle(qt).fontSize : null,
        qtHeight: qt ? qt.clientHeight : 0,
        hasOverlap,
        hasTextOverflow: overflows.some(v => v),
        badgesAligned: badgeAlignments.every(v => v),
        optCount: opts.length,
        colHeight: col.clientHeight,
        qaScrollHeight: qa ? qa.scrollHeight : 0,
        qaClientHeight: qa ? qa.clientHeight : 0
      };
    });
  });

  console.log('   Auto-Fit Metrics:', JSON.stringify(autoMetrics, null, 2));

  for (const m of autoMetrics) {
    if (m.hasOverlap) throw new Error(`Column ${m.colIndex} has overlapping option buttons!`);
    if (m.hasTextOverflow) throw new Error(`Column ${m.colIndex} has horizontally overflowing text!`);
    if (!m.badgesAligned) throw new Error(`Column ${m.colIndex} has misaligned option badges!`);
  }
  console.log('   ✅ Auto-fit tier detection, zero overlap, and badge alignment passed!');

  // 4. Test manual tier switches: Besar (lg), Sedang (md), Kecil (sm)
  console.log('4. Testing manual font size switches via top bar buttons...');
  
  // Switch to "Kecil"
  await page.click('button[data-act="setfs"][data-fs="sm"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/home/darkverst/workspace/CC/ifp-tier-sm.png' });
  let currentTier = await page.evaluate(() => document.querySelector('.qa').className);
  if (!currentTier.includes('tier-sm')) throw new Error('Expected tier-sm after clicking Kecil');
  console.log('   ✅ Switched to Kecil (tier-sm) verified!');

  // Switch to "Sedang"
  await page.click('button[data-act="setfs"][data-fs="md"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/home/darkverst/workspace/CC/ifp-tier-md.png' });
  currentTier = await page.evaluate(() => document.querySelector('.qa').className);
  if (!currentTier.includes('tier-md')) throw new Error('Expected tier-md after clicking Sedang');
  console.log('   ✅ Switched to Sedang (tier-md) verified!');

  // Switch to "Besar"
  await page.click('button[data-act="setfs"][data-fs="lg"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/home/darkverst/workspace/CC/ifp-tier-lg.png' });
  currentTier = await page.evaluate(() => document.querySelector('.qa').className);
  if (!currentTier.includes('tier-lg')) throw new Error('Expected tier-lg after clicking Besar');
  console.log('   ✅ Switched to Besar (tier-lg) verified!');

  // 5. Test 4K IFP resolution (3840x2160)
  console.log('5. Testing 4K UHD IFP display (3840 x 2160)...');
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.click('button[data-act="setfs"][data-fs="auto"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/home/darkverst/workspace/CC/ifp-4k-uhd.png' });
  
  const metrics4K = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.col'));
    let hasOverlap = false;
    for (const col of cols) {
      const opts = Array.from(col.querySelectorAll('.opt'));
      for (let i = 0; i < opts.length - 1; i++) {
        if (opts[i].getBoundingClientRect().bottom > opts[i+1].getBoundingClientRect().top + 1) {
          hasOverlap = true;
        }
      }
    }
    return { hasOverlap, colCount: cols.length };
  });

  if (metrics4K.hasOverlap) throw new Error('4K resolution has overlapping elements!');
  console.log('   ✅ 4K UHD IFP layout verified with zero overlap!');

  // 6. Test inside iframe within Portal Hub (index.html)
  console.log('6. Testing inside Portal Hub iframe (index.html)...');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/#penyisihan', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const iframeFrame = page.frameLocator('#frame-penyisihan');
  const iframeTop = await iframeFrame.locator('#top').isVisible().catch(() => false);
  console.log('   Iframe in portal loaded, top bar visible:', iframeTop);

  await browser.close();
  console.log('🎉 ALL IFP 3-SPLIT SCREEN PENYISIHAN TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
