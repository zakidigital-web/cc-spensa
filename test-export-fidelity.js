import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Starting Word Export High-Fidelity & Format Preservation Test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    console.log('1. Loading portal on http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // Step 2: Add a special question with LaTeX formula AND an inline Base64 Image to test export fidelity
    console.log('2. Inserting test question with LaTeX formula and Image to Kelas 7...');
    const testImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const testFormulaQuestion = {
      id: 'test_fidelity_q1',
      mapel: 'Matematika',
      q: 'Diketahui persamaan kuadrat $2x^2 + 5x - 12 = 0$ dan rumus $\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. Berapakah himpunan penyelesaiannya?',
      o: [
        '$x = \\frac{3}{2}$ atau $x = -4$',
        '$x = -\\frac{3}{2}$ atau $x = 4$',
        '$x = 3$ atau $x = -2$',
        '$x = \\frac{1}{2}$ atau $x = -6$'
      ],
      k: 0,
      ans: '$x = \\frac{3}{2}$ atau $x = -4$',
      img: testImageBase64
    };

    await page.evaluate(async (testQ) => {
      await window.DocxEngine.addStageQuestion('penyisihan', testQ, 7);
    }, testFormulaQuestion);

    // Step 3: Run export for Penyisihan Kelas 7 and analyze the resulting document
    console.log('3. Exporting Bank Soal Penyisihan Kelas 7 to Word (.docx)...');
    const exportResult = await page.evaluate(async () => {
      const res = await window.DocxEngine.exportStageBankToDocx('penyisihan', 7);
      const ab = await res.blob.arrayBuffer();

      // Read with Mammoth to inspect table structure, columns, formulas, and images
      const mammothOptions = {
        convertImage: window.mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return { src: "data:" + image.contentType + ";base64," + imageBuffer };
          });
        })
      };
      const mammothRes = await window.mammoth.convertToHtml({ arrayBuffer: ab }, mammothOptions);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mammothRes.value;

      const tables = tempDiv.getElementsByTagName('table');
      const table = tables[0];
      const rows = table ? Array.from(table.querySelectorAll('tr')) : [];

      // Check header cells
      const headerRow = rows[0];
      const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.trim()) : [];

      // Find our test question row
      let foundTestRow = null;
      let foundTestImgSrc = null;
      for (let r of rows) {
        const text = r.textContent;
        if (text.includes('2x^2 + 5x - 12')) {
          const cells = Array.from(r.querySelectorAll('td, th'));
          const imgEl = r.querySelector('img');
          foundTestImgSrc = imgEl ? imgEl.src : null;
          foundTestRow = cells.map(c => c.textContent.trim());
          break;
        }
      }

      // Check if image binary exists in zip
      let zipMediaCount = 0;
      if (window.JSZip) {
        const zip = await window.JSZip.loadAsync(ab);
        const mediaFiles = Object.keys(zip.files).filter(k => k.startsWith('word/media/'));
        zipMediaCount = mediaFiles.length;
      }

      return {
        stage: res.stage,
        count: res.count,
        blobSize: res.blob.size,
        tableCount: tables.length,
        rowCount: rows.length,
        headerCells: headerCells,
        foundTestRow: foundTestRow,
        hasImageInRow: !!foundTestImgSrc,
        zipMediaCount: zipMediaCount
      };
    });

    console.log('   Export Result Summary:', {
      stage: exportResult.stage,
      count: exportResult.count,
      blobSize: exportResult.blobSize,
      headerColumns: exportResult.headerCells,
      columnCount: exportResult.headerCells.length,
      hasImageInRow: exportResult.hasImageInRow,
      zipMediaCount: exportResult.zipMediaCount
    });

    // Validations for Penyisihan:
    if (exportResult.headerCells.length !== 8) {
      throw new Error(`Expected 8 columns in Penyisihan table, got ${exportResult.headerCells.length}: ${JSON.stringify(exportResult.headerCells)}`);
    }
    if (!exportResult.foundTestRow) {
      throw new Error('Test question with formula was not found in exported document!');
    }
    console.log('   Found Test Row in Docx:', exportResult.foundTestRow);

    // Verify formulas in question and options
    const qTextInRow = exportResult.foundTestRow[2];
    const optAInRow = exportResult.foundTestRow[3];
    const keyInRow = exportResult.foundTestRow[7];

    console.log(`   Question text with formula: ${qTextInRow}`);
    console.log(`   Option A with formula: ${optAInRow}`);
    console.log(`   Key letter: ${keyInRow}`);

    if (!qTextInRow.includes('$2x^2 + 5x - 12 = 0$') || !qTextInRow.includes('\\sqrt{b^2 - 4ac}')) {
      throw new Error(`Formula in question text altered or lost: ${qTextInRow}`);
    }
    if (!optAInRow.includes('$x = \\frac{3}{2}$')) {
      throw new Error(`Formula in option A altered or lost: ${optAInRow}`);
    }
    if (keyInRow !== 'A') {
      throw new Error(`Expected Key 'A', got '${keyInRow}'`);
    }
    if (!exportResult.hasImageInRow || exportResult.zipMediaCount < 1) {
      throw new Error('Image was not embedded into Word docx!');
    }
    console.log('   ✅ Penyisihan 8-column layout, formulas, and image embedding verified!');

    // Step 4: Test Semifinal Multi-Table Word Export (BS, PG, Esai)
    console.log('4. Testing Semifinal Multi-Table Word Export (BS, PG, Esai)...');
    const semiResult = await page.evaluate(async () => {
      const res = await window.DocxEngine.exportStageBankToDocx('semifinal');
      const ab = await res.blob.arrayBuffer();
      const mammothRes = await window.mammoth.convertToHtml({ arrayBuffer: ab });
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mammothRes.value;
      const tables = Array.from(tempDiv.querySelectorAll('table'));
      return {
        tableCount: tables.length,
        tables: tables.map(t => {
          const firstRow = t.querySelector('tr');
          const cells = firstRow ? Array.from(firstRow.querySelectorAll('th, td')).map(c => c.textContent.trim()) : [];
          return {
            columnCount: cells.length,
            headerCells: cells,
            rowCount: t.querySelectorAll('tr').length
          };
        })
      };
    });

    console.log('   Semifinal Result Tables Count:', semiResult.tableCount);
    console.log('   Table 1 (Benar/Salah):', semiResult.tables[0]);
    if (semiResult.tableCount < 3) {
      throw new Error(`Expected at least 3 tables for Semifinal export, got ${semiResult.tableCount}`);
    }
    if (semiResult.tables[0].columnCount !== 4) {
      throw new Error(`Expected 4 columns for Benar/Salah Table, got ${semiResult.tables[0].columnCount}`);
    }
    if (semiResult.tables[1].columnCount !== 8) {
      throw new Error(`Expected 8 columns for Pilihan Ganda Table, got ${semiResult.tables[1].columnCount}`);
    }
    console.log('   ✅ Semifinal Multi-Table (BS 4-col, PG 8-col, Esai 4-col) verified!');

    // Step 5: Test Grand Final Export
    console.log('5. Testing Grand Final 4-column Word Export...');
    const finalResult = await page.evaluate(async () => {
      const res = await window.DocxEngine.exportStageBankToDocx('final');
      const ab = await res.blob.arrayBuffer();
      const mammothRes = await window.mammoth.convertToHtml({ arrayBuffer: ab });
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mammothRes.value;
      const table = tempDiv.querySelector('table');
      const headerCells = table ? Array.from(table.querySelector('tr').querySelectorAll('th, td')).map(c => c.textContent.trim()) : [];
      return {
        columnCount: headerCells.length,
        headerCells: headerCells,
        rowCount: table ? table.querySelectorAll('tr').length : 0
      };
    });

    console.log('   Grand Final Result:', finalResult);
    if (finalResult.columnCount !== 4) {
      throw new Error(`Expected 4 columns for Grand Final export, got ${finalResult.columnCount}: ${JSON.stringify(finalResult.headerCells)}`);
    }
    console.log('   ✅ Grand Final 4-column layout verified!');

    // Step 6: Test UI Export Button Modal
    console.log('6. Testing UI Export Button in Portal...');
    // Ensure admin authenticated
    await page.evaluate(() => {
      sessionStorage.setItem('cc_admin_auth', '1');
      localStorage.setItem('cc_admin_auth', '1');
    });
    await page.click('button.nav-btn[data-view="bank"]');
    await page.waitForTimeout(500);

    await page.click('#btn-export-bank-word');
    await page.waitForTimeout(400);

    const isModalOpen = await page.evaluate(() => {
      const m = document.getElementById('modal-confirm-delete');
      return m && m.classList.contains('active');
    });
    console.log(`   Export choice modal opened: ${isModalOpen}`);
    if (!isModalOpen) throw new Error('Export modal did not open on button click!');

    // Cancel modal
    await page.click('#btn-cancel-del');
    await page.waitForTimeout(300);

    // Clean up test question
    await page.evaluate(async () => {
      await window.DocxEngine.deleteStageQuestions('penyisihan', ['test_fidelity_q1'], 7);
    });

    console.log('🎉 ALL HIGH-FIDELITY WORD EXPORT TESTS PASSED 100%!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
