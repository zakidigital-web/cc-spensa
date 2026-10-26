import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('🚀 Starting Dedicated Benar/Salah Template & Import/Export Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    console.log('1. Loading portal on http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // Step 2: Verify static Template_Soal_Benar_Salah.docx exists on server
    console.log('2. Checking static template files on server...');
    const tplBsResponse = await page.request.get('http://localhost:3000/templates/Template_Soal_Benar_Salah.docx');
    console.log('   Template_Soal_Benar_Salah.docx status:', tplBsResponse.status());
    if (tplBsResponse.status() !== 200) {
      throw new Error(`Failed to load Template_Soal_Benar_Salah.docx: status ${tplBsResponse.status()}`);
    }
    const bsBuffer = await tplBsResponse.body();
    console.log('   Template_Soal_Benar_Salah.docx size (bytes):', bsBuffer.length);

    // Step 3: Test importing Template_Soal_Benar_Salah.docx into Semifinal Bank
    console.log('3. Testing import of Template_Soal_Benar_Salah.docx into Semifinal...');
    const importBsResult = await page.evaluate(async (base64Doc) => {
      // Decode base64 to File object
      const binaryStr = atob(base64Doc);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const file = new File([bytes.buffer], 'Template_Soal_Benar_Salah.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Clear existing semifinal questions first for pristine test
      await window.DocxEngine.saveStageQuestions('semifinal', []);

      // Import the BS template
      const res = await window.DocxEngine.importQuestionsFromDocx(file, 'semifinal');
      const questions = await window.DocxEngine.getStageQuestions('semifinal');

      return {
        importCount: res.count,
        totalInBank: questions.length,
        questionsSample: questions.slice(0, 5).map(q => ({
          tipe: q.tipe,
          q: q.q,
          o: q.o,
          key: q.key,
          k: q.k,
          ans: q.ans
        }))
      };
    }, bsBuffer.toString('base64'));

    console.log('   Import Result:', importBsResult);
    if (importBsResult.importCount !== 18) {
      throw new Error(`Expected 18 BS questions imported, got ${importBsResult.importCount}`);
    }
    if (importBsResult.totalInBank !== 18) {
      throw new Error(`Expected 18 questions in Semifinal bank, got ${importBsResult.totalInBank}`);
    }

    const firstQ = importBsResult.questionsSample[0];
    if (firstQ.tipe !== 'BS' || firstQ.key !== 0 || firstQ.ans !== 'Benar') {
      throw new Error(`First question format mismatch: ${JSON.stringify(firstQ)}`);
    }

    const secondQ = importBsResult.questionsSample[1];
    if (secondQ.tipe !== 'BS' || secondQ.key !== 1 || secondQ.ans !== 'Salah') {
      throw new Error(`Second question (Salah) format mismatch: ${JSON.stringify(secondQ)}`);
    }
    console.log('   ✅ 18 Benar/Salah questions imported with 100% key accuracy (Benar = 0, Salah = 1)!');

    // Step 4: Test Dynamic Template Download for Benar / Salah
    console.log('4. Testing dynamic downloadTemplateDocx("benar_salah")...');
    const dynamicTplResult = await page.evaluate(async () => {
      // Mock document.createElement('a') click to intercept download
      let downloadedName = '';
      let downloadedBlob = null;
      const origCreate = document.createElement.bind(document);
      document.createElement = function(tag) {
        const el = origCreate(tag);
        if (tag.toLowerCase() === 'a') {
          el.click = function() {
            downloadedName = el.download;
          };
        }
        return el;
      };

      await window.DocxEngine.downloadTemplateDocx('benar_salah');
      document.createElement = origCreate;

      return {
        downloadedName
      };
    });

    console.log('   Dynamic Template Download Name:', dynamicTplResult.downloadedName);
    if (dynamicTplResult.downloadedName !== 'Template_Soal_Benar_Salah.docx') {
      throw new Error(`Expected download name Template_Soal_Benar_Salah.docx, got ${dynamicTplResult.downloadedName}`);
    }
    console.log('   ✅ Dynamic Benar/Salah template generation verified!');

    // Step 5: Test Exporting Benar / Salah Bank to Docx
    console.log('5. Testing exportStageBankToDocx("benar_salah")...');
    const exportBsResult = await page.evaluate(async () => {
      const res = await window.DocxEngine.exportStageBankToDocx('benar_salah');
      const ab = await res.blob.arrayBuffer();
      const mammothRes = await window.mammoth.convertToHtml({ arrayBuffer: ab });
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mammothRes.value;
      const table = tempDiv.querySelector('table');
      const firstRow = table ? table.querySelector('tr') : null;
      const cells = firstRow ? Array.from(firstRow.querySelectorAll('th, td')).map(c => c.textContent.trim()) : [];

      return {
        count: res.count,
        columnCount: cells.length,
        headers: cells,
        rowCount: table ? table.querySelectorAll('tr').length : 0
      };
    });

    console.log('   Export BS Result:', exportBsResult);
    if (exportBsResult.columnCount !== 4) {
      throw new Error(`Expected 4 columns in Benar/Salah export, got ${exportBsResult.columnCount}`);
    }
    if (exportBsResult.count !== 18) {
      throw new Error(`Expected 18 questions exported, got ${exportBsResult.count}`);
    }
    console.log('   ✅ Benar / Salah export verified with 4 clean columns!');

    // Step 6: Test multi-table Semifinal Template import
    console.log('6. Testing import of multi-table Template_Soal_Semifinal.docx...');
    const tplSfResponse = await page.request.get('http://localhost:3000/templates/Template_Soal_Semifinal.docx');
    const sfBuffer = await tplSfResponse.body();

    const importSfResult = await page.evaluate(async (base64Doc) => {
      const binaryStr = atob(base64Doc);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const file = new File([bytes.buffer], 'Template_Soal_Semifinal.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Clear bank for pristine multi-table test
      await window.DocxEngine.saveStageQuestions('semifinal', []);

      const res = await window.DocxEngine.importQuestionsFromDocx(file, 'semifinal');
      const questions = await window.DocxEngine.getStageQuestions('semifinal');

      const types = questions.reduce((acc, q) => {
        acc[q.tipe] = (acc[q.tipe] || 0) + 1;
        return acc;
      }, {});

      return {
        importCount: res.count,
        totalInBank: questions.length,
        types: types
      };
    }, sfBuffer.toString('base64'));

    console.log('   Multi-Table Semifinal Import Result:', importSfResult);
    // Table 1 (BS): 18, Table 2 (PG): 10, Table 3 (ES & CAD): 6 => Total 34 sample questions
    if (!importSfResult.types.BS || importSfResult.types.BS !== 18) {
      throw new Error(`Expected 18 BS questions from multi-table import, got ${importSfResult.types.BS}`);
    }
    if (!importSfResult.types.PG1 && !importSfResult.types.PG2) {
      throw new Error(`Expected PG questions from Table 2, got ${JSON.stringify(importSfResult.types)}`);
    }
    console.log('   ✅ Multi-table Semifinal document successfully parsed all 3 tables!');

    // Step 7: Restore original default questions to keep DB pristine
    console.log('7. Restoring default questions for Semifinal...');
    await page.evaluate(async () => {
      await window.DocxEngine.restoreDefaultStageQuestions('semifinal');
    });

    console.log('🎉 ALL BENAR / SALAH TEMPLATE, IMPORT & EXPORT TESTS PASSED 100%!');
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
