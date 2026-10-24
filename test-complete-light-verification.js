import { chromium } from "playwright";

async function verifyAllLightMode() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  console.log("Navigating to http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  
  // Switch to light mode
  console.log("Switching theme to light...");
  await page.evaluate(() => window.App.applyTheme('light'));
  await page.waitForTimeout(600);

  // 1. Hub Verification
  console.log("\n--- 1. Verifying Portal Hub in Light Mode ---");
  const hubData = await page.evaluate(() => {
    const title = document.querySelector('.hub-hero h2');
    const badge = document.querySelector('.hub-hero .badge');
    const cardTitle = document.querySelector('.stage-card h3');
    const cardText = document.querySelector('.stage-card p');
    const cardNum = document.querySelector('.stage-card-num');
    const navBtn = document.querySelector('.nav-btn');

    function info(el) {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return { text: el.textContent.trim(), color: s.color, bg: s.backgroundColor, weight: s.fontWeight };
    }
    return { title: info(title), badge: info(badge), cardTitle: info(cardTitle), cardText: info(cardText), cardNum: info(cardNum), navBtn: info(navBtn) };
  });
  console.log("Hub Data:", JSON.stringify(hubData, null, 2));

  // 2. Penyisihan Verification
  console.log("\n--- 2. Verifying Babak Penyisihan in Light Mode ---");
  await page.evaluate(() => window.App.switchView('penyisihan'));
  await page.waitForTimeout(600);
  const penyisihanData = await page.evaluate(() => {
    const frame = document.getElementById('frame-penyisihan');
    const doc = frame.contentDocument;
    const win = frame.contentWindow;

    const chip = doc.querySelector('.chip');
    const chipOn = doc.querySelector('.chip.on');
    const gel = doc.querySelector('.gel');
    const tableTh = doc.querySelector('th');
    const tableTd = doc.querySelector('td');
    const input = doc.querySelector('input');

    function info(el) {
      if (!el) return null;
      const s = win.getComputedStyle(el);
      return { text: el.textContent.trim().slice(0, 30), color: s.color, bg: s.backgroundColor, weight: s.fontWeight };
    }

    return { chip: info(chip), chipOn: info(chipOn), gel: info(gel), tableTh: info(tableTh), tableTd: info(tableTd), input: info(input) };
  });
  console.log("Penyisihan Setup Data:", JSON.stringify(penyisihanData, null, 2));

  // 3. Semifinal Verification
  console.log("\n--- 3. Verifying Babak Semifinal in Light Mode ---");
  await page.evaluate(() => window.App.switchView('semifinal'));
  await page.waitForTimeout(600);
  const semifinalData = await page.evaluate(() => {
    const frame = document.getElementById('frame-semifinal');
    const doc = frame.contentDocument;
    const win = frame.contentWindow;

    const h1 = doc.querySelector('h1');
    const h2 = doc.querySelector('h2');
    const sub = doc.querySelector('.sub');
    const btnPri = doc.querySelector('button.pri');

    function info(el) {
      if (!el) return null;
      const s = win.getComputedStyle(el);
      return { text: el.textContent.trim().slice(0, 30), color: s.color, bg: s.backgroundColor, weight: s.fontWeight };
    }
    return { h1: info(h1), h2: info(h2), sub: info(sub), btnPri: info(btnPri) };
  });
  console.log("Semifinal Setup Data:", JSON.stringify(semifinalData, null, 2));

  // 4. Grand Final Verification
  console.log("\n--- 4. Verifying Babak Grand Final in Light Mode ---");
  await page.evaluate(() => window.App.switchView('final'));
  await page.waitForTimeout(600);
  const finalData = await page.evaluate(async () => {
    const frame = document.getElementById('frame-final');
    const doc = frame.contentDocument;
    const win = frame.contentWindow;

    const title = doc.querySelector('#title');
    const teamB = doc.querySelector('.team b');
    const teamPts = doc.querySelector('.team .tpts');
    const boxT0 = doc.querySelector('.box.t0');
    const boxT1 = doc.querySelector('.box.t1');
    const boxT2 = doc.querySelector('.box.t2');

    function info(el) {
      if (!el) return null;
      const s = win.getComputedStyle(el);
      return { text: el.textContent.trim().slice(0, 30), color: s.color, bg: s.backgroundColor, bgImage: s.backgroundImage.slice(0, 40), weight: s.fontWeight };
    }

    // Now trigger open question 0
    win.open(0);
    await new Promise(r => setTimeout(r, 400));

    const ov = doc.getElementById('ov');
    const qnum = doc.getElementById('qnum');
    const qbox = doc.querySelector('.qbox');
    const qtext = doc.getElementById('qtext');
    const timer = doc.getElementById('timer');
    const status = doc.getElementById('status');
    const tbBtn = doc.querySelector('#tb button');

    const modalData = {
      ov: info(ov),
      qnum: info(qnum),
      qbox: info(qbox),
      qtext: info(qtext),
      timer: info(timer),
      status: info(status),
      tbBtn: info(tbBtn)
    };

    return {
      title: info(title),
      teamB: info(teamB),
      teamPts: info(teamPts),
      boxT0: info(boxT0),
      boxT1: info(boxT1),
      boxT2: info(boxT2),
      modalData
    };
  });
  console.log("Grand Final Board & Modal Data:", JSON.stringify(finalData, null, 2));

  // Take screenshot of Grand Final open question in light mode
  await page.screenshot({ path: "screenshot-final-question-light.png" });

  // 5. Bank Soal Word Verification
  console.log("\n--- 5. Verifying Bank Soal Word in Light Mode ---");
  await page.evaluate(() => window.App.switchView('bank'));
  await page.waitForTimeout(600);
  const bankData = await page.evaluate(() => {
    const item = document.querySelector('.question-card-item');
    const badge = document.querySelector('.q-card-badge');
    const dropzone = document.querySelector('.dropzone-word');

    function info(el) {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return { text: el.textContent.trim().slice(0, 30), color: s.color, bg: s.backgroundColor, border: s.borderColor, weight: s.fontWeight };
    }
    return { item: info(item), badge: info(badge), dropzone: info(dropzone) };
  });
  console.log("Bank Soal Data:", JSON.stringify(bankData, null, 2));

  // 6. Laporan Word Verification
  console.log("\n--- 6. Verifying Laporan Word in Light Mode ---");
  await page.evaluate(() => window.App.switchView('laporan'));
  await page.waitForTimeout(600);
  const laporanData = await page.evaluate(() => {
    const paper = document.querySelector('.report-paper');
    const kopH1 = document.querySelector('.kop-teks h1');
    const tableTh = document.querySelector('.report-table th');
    const tableTd = document.querySelector('.report-table td');

    function info(el) {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return { text: el.textContent.trim().slice(0, 30), color: s.color, bg: s.backgroundColor, weight: s.fontWeight };
    }
    return { paper: info(paper), kopH1: info(kopH1), tableTh: info(tableTh), tableTd: info(tableTd) };
  });
  console.log("Laporan Data:", JSON.stringify(laporanData, null, 2));

  await browser.close();
  console.log("\n✅ All verifications completed successfully!");
}

verifyAllLightMode().catch(console.error);
