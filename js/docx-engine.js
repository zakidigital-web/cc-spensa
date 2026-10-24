/**
 * Word (.docx) Engine for Cerdas Cermat IFP
 * Handles Equation (LaTeX / Office MathML), Images (Base64), and Clean Tables
 * Directly connects to the native storage of Penyisihan, Semifinal, and Grand Final
 */
(function(window) {
  'use strict';

  function openCerdasCermatDB() {
    return new Promise((res, rej) => {
      try {
        const q = indexedDB.open('cerdascermat', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('kv');
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      } catch (e) {
        rej(e);
      }
    });
  }

  function kvGetLegacy(key) {
    return openCerdasCermatDB().then(db => new Promise(r => {
      const g = db.transaction('kv').objectStore('kv').get(key);
      g.onsuccess = () => r(g.result);
      g.onerror = () => r(undefined);
    })).catch(() => undefined);
  }

  function kvSetLegacy(key, val) {
    return openCerdasCermatDB().then(db => new Promise((r, rej) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(val, key);
      t.oncomplete = () => r(true);
      t.onerror = () => rej(t.error);
    })).catch(() => false);
  }

  function parseOMathNode(node) {
    if (!node) return '';
    let result = '';

    for (let child of node.childNodes) {
      const name = child.nodeName;

      if (name === 'm:t' || name.endsWith(':t')) {
        result += child.textContent || '';
      } else if (name === 'm:f' || name.endsWith(':f')) {
        let num = '', den = '';
        for (let sub of child.childNodes) {
          if (sub.nodeName.includes('num')) num = parseOMathNode(sub);
          if (sub.nodeName.includes('den')) den = parseOMathNode(sub);
        }
        result += `\\frac{${num}}{${den}}`;
      } else if (name === 'm:rad' || name.endsWith(':rad')) {
        let e = '';
        for (let sub of child.childNodes) {
          if (sub.nodeName.includes('e')) e = parseOMathNode(sub);
        }
        result += `\\sqrt{${e}}`;
      } else if (name === 'm:sSup' || name.endsWith(':sSup')) {
        let base = '', sup = '';
        for (let sub of child.childNodes) {
          if (sub.nodeName.includes('e')) base = parseOMathNode(sub);
          if (sub.nodeName.includes('sup')) sup = parseOMathNode(sub);
        }
        result += `{${base}}^{${sup}}`;
      } else if (name === 'm:sSub' || name.endsWith(':sSub')) {
        let base = '', subVal = '';
        for (let sub of child.childNodes) {
          if (sub.nodeName.includes('e')) base = parseOMathNode(sub);
          if (sub.nodeName.includes('sub')) subVal = parseOMathNode(sub);
        }
        result += `{${base}}_{${subVal}}`;
      } else if (name === 'm:d' || name.endsWith(':d')) {
        result += `\\left( ${parseOMathNode(child)} \\right)`;
      } else {
        result += parseOMathNode(child);
      }
    }
    return result;
  }

  async function extractEquationsFromDocx(arrayBuffer) {
    const mathMap = [];
    if (!window.JSZip) return mathMap;

    try {
      const zip = await window.JSZip.loadAsync(arrayBuffer);
      const docXmlFile = zip.file('word/document.xml');
      if (!docXmlFile) return mathMap;

      const xmlText = await docXmlFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const paragraphs = xmlDoc.getElementsByTagName('w:p');
      for (let p of paragraphs) {
        const mathNodes = p.getElementsByTagName('m:oMath');
        for (let m of mathNodes) {
          const latex = parseOMathNode(m);
          if (latex && latex.trim()) {
            mathMap.push(latex.trim());
          }
        }
      }
    } catch (e) {
      console.warn('Math XML parser warning:', e);
    }
    return mathMap;
  }

  const DocxEngine = {
    async getStageQuestions(stage = 'penyisihan') {
      if (stage === 'penyisihan') {
        const b = await kvGetLegacy('bank');
        if (b && b.soal) {
          const s7 = b.soal[7] || [];
          const s8 = b.soal[8] || [];
          const s9 = b.soal[9] || [];
          return s9.length ? s9 : (s8.length ? s8 : s7);
        }
      } else if (stage === 'semifinal') {
        const b3 = await kvGetLegacy('bank3');
        if (b3 && b3.soal) return b3.soal;
      } else {
        try {
          const f = JSON.parse(localStorage.getItem('cc-final3') || '{}');
          if (f && f.q) {
            return f.q.split('\n').filter(Boolean).map((line, i) => {
              const p = line.split('|||');
              const tier = i < 5 ? 'Tier 1 (50 Poin)' : (i < 10 ? 'Tier 2 (75 Poin)' : (i < 15 ? 'Tier 3 (100 Poin)' : 'Soal Tambahan'));
              return {
                id: `fn_${i+1}`,
                tier: tier,
                q: (p[0] || '').trim(),
                ans: (p[1] || '').trim(),
                img: null
              };
            });
          }
        } catch (e) {}
      }
      return (window.DEFAULT_BANKS && window.DEFAULT_BANKS[stage]) || [];
    },

    async importQuestionsFromDocx(file, targetStage = 'penyisihan') {
      if (!window.mammoth) throw new Error('Library Mammoth.js belum siap!');

      const arrayBuffer = await file.arrayBuffer();
      const mathEquations = await extractEquationsFromDocx(arrayBuffer);

      const mammothOptions = {
        convertImage: window.mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return { src: "data:" + image.contentType + ";base64," + imageBuffer };
          });
        })
      };

      const result = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, mammothOptions);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = result.value;

      const parsedQuestions = [];
      const tables = tempDiv.getElementsByTagName('table');

      if (tables.length > 0) {
        const rows = tables[0].querySelectorAll('tr');
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td, th');
          if (cells.length < 3) continue;

          const category = cells[1] ? cells[1].textContent.trim() : 'Umum';
          const qCell = cells[2];
          const imgEl = qCell ? qCell.querySelector('img') : null;
          const imgSrc = imgEl ? imgEl.src : null;
          const qText = qCell ? qCell.textContent.trim() : '';

          if (targetStage === 'penyisihan') {
            const optA = cells[3] ? cells[3].textContent.trim() : '';
            const optB = cells[4] ? cells[4].textContent.trim() : '';
            const optC = cells[5] ? cells[5].textContent.trim() : '';
            const optD = cells[6] ? cells[6].textContent.trim() : '';
            const keyRaw = cells[7] ? cells[7].textContent.trim().toUpperCase() : 'A';
            const options = [optA, optB, optC, optD];

            let keyIdx = 0;
            if (keyRaw === 'B' || keyRaw === '1') keyIdx = 1;
            else if (keyRaw === 'C' || keyRaw === '2') keyIdx = 2;
            else if (keyRaw === 'D' || keyRaw === '3') keyIdx = 3;

            parsedQuestions.push({
              id: 'imp_' + Date.now().toString(36) + i,
              mapel: category,
              q: qText,
              o: options.length >= 2 ? options : ['A', 'B', 'C', 'D'],
              k: keyIdx,
              img: imgSrc
            });
          } else if (targetStage === 'semifinal') {
            const tipe = (/ES|ESSAY|URAIAN/i.test(category)) ? 'ES' :
                         (/CAD/i.test(category)) ? 'CAD' :
                         (/PG200|PG2/i.test(category)) ? 'PG2' :
                         (/PG150|PG1|PG/i.test(category)) ? 'PG1' : 'BS';

            // Support both 9-column and legacy 5-column formats
            let options = [];
            let keyIndex = null;
            let ansText = '';

            if (cells.length >= 8) {
              const optA = cells[3] ? cells[3].textContent.trim() : '';
              const optB = cells[4] ? cells[4].textContent.trim() : '';
              const optC = cells[5] ? cells[5].textContent.trim() : '';
              const optD = cells[6] ? cells[6].textContent.trim() : '';
              const keyRaw = cells[7] ? cells[7].textContent.trim().toUpperCase() : '';
              const esRaw = cells[8] ? cells[8].textContent.trim() : (cells[7] ? cells[7].textContent.trim() : '');

              if (tipe === 'BS') {
                options = ['Benar', 'Salah'];
                keyIndex = /S|SALAH|FALSE|1/i.test(keyRaw || optA) ? 1 : 0;
              } else if (tipe === 'PG1' || tipe === 'PG2') {
                options = [optA, optB, optC, optD];
                keyIndex = (keyRaw === 'B' || keyRaw === '1') ? 1 :
                           (keyRaw === 'C' || keyRaw === '2') ? 2 :
                           (keyRaw === 'D' || keyRaw === '3') ? 3 : 0;
              } else {
                options = [];
                keyIndex = null;
                ansText = esRaw;
              }
            } else {
              const optRaw = cells[3] ? cells[3].textContent.trim() : '';
              const keyRaw = cells[4] ? cells[4].textContent.trim() : '';
              if (tipe === 'BS') {
                options = ['Benar', 'Salah'];
                keyIndex = /S|SALAH|FALSE|1/i.test(keyRaw) ? 1 : 0;
              } else if (tipe === 'PG1' || tipe === 'PG2') {
                options = optRaw.split(',').map(s => s.trim());
                keyIndex = (keyRaw.toUpperCase() === 'B' || keyRaw === '1') ? 1 :
                           (keyRaw.toUpperCase() === 'C' || keyRaw === '2') ? 2 :
                           (keyRaw.toUpperCase() === 'D' || keyRaw === '3') ? 3 : 0;
              } else {
                ansText = keyRaw || optRaw;
              }
            }

            parsedQuestions.push({
              id: 'sm_imp_' + Date.now().toString(36) + i,
              tipe: tipe,
              q: qText,
              o: options,
              key: keyIndex,
              ans: ansText,
              img: imgSrc
            });
          } else {
            // Final
            const keyRaw = cells[3] ? cells[3].textContent.trim() : (cells[2] ? cells[2].textContent.trim() : '');
            parsedQuestions.push({
              q: qText,
              ans: keyRaw,
              tier: category
            });
          }
        }
      }

      // Save directly to the native stage storage
      if (targetStage === 'penyisihan') {
        let b = (await kvGetLegacy('bank')) || { mapel: [], soal: { 7: [], 8: [], 9: [] } };
        b.soal = b.soal || { 7: [], 8: [], 9: [] };
        // Sync to all jenjang classes 7, 8, and 9 so questions are immediately available
        b.soal[7] = (b.soal[7] || []).concat(parsedQuestions);
        b.soal[8] = (b.soal[8] || []).concat(parsedQuestions);
        b.soal[9] = (b.soal[9] || []).concat(parsedQuestions);
        await kvSetLegacy('bank', b);

        // Also save to PortalStorage
        if (window.PortalStorage) {
          await window.PortalStorage.saveStageBank('penyisihan', b.soal[9]);
        }

        // Reload iframe
        const frame = document.getElementById('frame-penyisihan');
        if (frame && frame.contentWindow) {
          try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
        }
      } else if (targetStage === 'semifinal') {
        let b3 = (await kvGetLegacy('bank3')) || { soal: [] };
        b3.soal = (b3.soal || []).concat(parsedQuestions);
        await kvSetLegacy('bank3', b3);

        if (window.PortalStorage) {
          await window.PortalStorage.saveStageBank('semifinal', b3.soal);
        }

        const frame = document.getElementById('frame-semifinal');
        if (frame && frame.contentWindow) {
          try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
        }
      } else {
        try {
          let curFinal = JSON.parse(localStorage.getItem('cc-final3') || '{}');
          const newLines = parsedQuestions.map(q => `${q.q} ||| ${q.ans}`);
          curFinal.q = (curFinal.q ? curFinal.q + '\n' : '') + newLines.join('\n');
          localStorage.setItem('cc-final3', JSON.stringify(curFinal));

          if (window.PortalStorage) {
            const finalItems = curFinal.q.split('\n').filter(Boolean).map((line, idx) => {
              const p = line.split('|||');
              return {
                id: `fn_${idx+1}`,
                tier: idx < 5 ? 'Tier 1 (50 Poin)' : (idx < 10 ? 'Tier 2 (75 Poin)' : (idx < 15 ? 'Tier 3 (100 Poin)' : 'Soal Tambahan')),
                q: (p[0] || '').trim(),
                ans: (p[1] || '').trim()
              };
            });
            await window.PortalStorage.saveStageBank('final', finalItems);
          }

          const frame = document.getElementById('frame-final');
          if (frame && frame.contentWindow) {
            try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
          }
        } catch (e) {}
      }

      return {
        count: parsedQuestions.length,
        questions: parsedQuestions,
        mathCount: mathEquations.length,
        stage: targetStage
      };
    },

    async downloadTemplateDocx(stage = 'penyisihan') {
      if (!window.docx) throw new Error('Library docx.js belum siap!');

      const {
        Document, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, BorderStyle
      } = window.docx;

      const borderThin = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
      const cellBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

      function createHeaderCell(text, width) {
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: { fill: "1E3A8A" },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Calibri", size: 19 })] })]
        });
      }

      function createCell(text, width, align = AlignmentType.LEFT) {
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: align, children: [new TextRun({ text, font: "Calibri", size: 18 })] })]
        });
      }

      let title = "TEMPLATE SOAL BABAK PENYISIHAN";
      const rows = [];

      if (stage === 'penyisihan') {
        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 6),
            createHeaderCell("Mata Pelajaran (11 Mapel)", 20),
            createHeaderCell("Pertanyaan & Gambar", 34),
            createHeaderCell("Pilihan A", 10),
            createHeaderCell("Pilihan B", 10),
            createHeaderCell("Pilihan C", 10),
            createHeaderCell("Pilihan D", 10),
            createHeaderCell("Kunci", 10)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("1", 6, AlignmentType.CENTER),
            createCell("Informatika", 20),
            createCell("Kepanjangan dari CPU adalah ...", 34),
            createCell("Central Processing Unit", 10),
            createCell("Computer Personal Unit", 10),
            createCell("Central Program Utility", 10),
            createCell("Control Processing Unit", 10),
            createCell("A", 10, AlignmentType.CENTER)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("2", 6, AlignmentType.CENTER),
            createCell("Matematika", 20),
            createCell("Hasil dari persamaan $2x + 6 = 14$ adalah ...", 34),
            createCell("4", 10),
            createCell("5", 10),
            createCell("3", 10),
            createCell("8", 10),
            createCell("A", 10, AlignmentType.CENTER)
          ]
        }));
      } else if (stage === 'semifinal') {
        title = "TEMPLATE SOAL BABAK SEMIFINAL";
        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 5),
            createHeaderCell("Jenis Soal", 12),
            createHeaderCell("Pertanyaan & Gambar (Bisa Rumus $...$)", 33),
            createHeaderCell("Pilihan A", 9),
            createHeaderCell("Pilihan B", 9),
            createHeaderCell("Pilihan C", 9),
            createHeaderCell("Pilihan D", 9),
            createHeaderCell("Kunci", 6),
            createHeaderCell("Kunci Jawaban Esai (Juri)", 18)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("1", 5, AlignmentType.CENTER),
            createCell("BS", 12, AlignmentType.CENTER),
            createCell("Matahari terbit dari arah timur dan tenggelam di barat.", 33),
            createCell("Benar", 9),
            createCell("Salah", 9),
            createCell("-", 9),
            createCell("-", 9),
            createCell("B", 6, AlignmentType.CENTER),
            createCell("-", 18)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("2", 5, AlignmentType.CENTER),
            createCell("PG150", 12, AlignmentType.CENTER),
            createCell("Ibu kota Provinsi Jawa Timur adalah ...", 33),
            createCell("Surabaya", 9),
            createCell("Malang", 9),
            createCell("Madiun", 9),
            createCell("Kediri", 9),
            createCell("A", 6, AlignmentType.CENTER),
            createCell("-", 18)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("3", 5, AlignmentType.CENTER),
            createCell("PG200", 12, AlignmentType.CENTER),
            createCell("Hasil dari operasi pecahan $\\frac{3}{4} + \\frac{1}{2}$ adalah ...", 33),
            createCell("$\\frac{5}{4}$", 9),
            createCell("$\\frac{4}{6}$", 9),
            createCell("$\\frac{3}{8}$", 9),
            createCell("$1$", 9),
            createCell("A", 6, AlignmentType.CENTER),
            createCell("-", 18)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("4", 5, AlignmentType.CENTER),
            createCell("ES", 12, AlignmentType.CENTER),
            createCell("Sebutkan bunyi sila ke-4 dalam rumusan dasar negara Pancasila!", 33),
            createCell("-", 9),
            createCell("-", 9),
            createCell("-", 9),
            createCell("-", 9),
            createCell("-", 6, AlignmentType.CENTER),
            createCell("Kerakyatan yang dipimpin oleh hikmat kebijaksanaan dalam permusyawaratan/perwakilan.", 18)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("5", 5, AlignmentType.CENTER),
            createCell("CAD", 12, AlignmentType.CENTER),
            createCell("Hasil dari perhitungan $25 \\times 4$ adalah ...", 33),
            createCell("-", 9),
            createCell("-", 9),
            createCell("-", 9),
            createCell("-", 9),
            createCell("-", 6, AlignmentType.CENTER),
            createCell("100", 18)
          ]
        }));
      } else {
        title = "TEMPLATE SOAL BABAK GRAND FINAL";
        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 8),
            createHeaderCell("Tier & Poin (Tier 1/2/3/Cadangan)", 24),
            createHeaderCell("Teks Pertanyaan Rebutan & Kotak", 44),
            createHeaderCell("Kunci Jawaban Singkat & Jelas", 24)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("1", 8, AlignmentType.CENTER),
            createCell("Tier 1 (50 Poin)", 24),
            createCell("Apa kepanjangan dari CPU?", 44),
            createCell("Central Processing Unit", 24)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("6", 8, AlignmentType.CENTER),
            createCell("Tier 2 (75 Poin)", 24),
            createCell("Ubah bilangan biner 1010 ke dalam bentuk desimal!", 44),
            createCell("10", 24)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("11", 8, AlignmentType.CENTER),
            createCell("Tier 3 (100 Poin)", 24),
            createCell("Ubah bilangan desimal 13 ke representasi biner!", 44),
            createCell("1101", 24)
          ]
        }));
        rows.push(new TableRow({
          children: [
            createCell("16", 8, AlignmentType.CENTER),
            createCell("Soal Tambahan (100 Poin)", 24),
            createCell("SOAL TAMBAHAN: Satu byte terdiri dari berapa bit?", 44),
            createCell("8 bit", 24)
          ]
        }));
      }

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [new TextRun({ text: title, bold: true, color: "1E3A8A", size: 26, font: "Calibri" })]
            }),
            new Paragraph({
              spacing: { after: 180 },
              children: [new TextRun({ text: "Petunjuk: Masukkan soal pada baris di bawah. Anda dapat menyisipkan rumus matematika ($...$) dan gambar langsung.", italics: true, color: "64748B", size: 18, font: "Calibri" })]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            })
          ]
        }]
      });

      const blob = await window.docx.Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Soal_${stage.toUpperCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    },

    async exportStageBankToDocx(stage) {
      if (!window.docx) throw new Error('Library docx.js belum siap!');
      const questions = await this.getStageQuestions(stage);

      const {
        Document, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, BorderStyle
      } = window.docx;

      const borderThin = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
      const cellBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

      function createHeaderCell(text, width) {
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: { fill: "1E3A8A" },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Calibri", size: 19 })] })]
        });
      }

      function createCell(text, width, align = AlignmentType.LEFT) {
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text || '-'), font: "Calibri", size: 18 })] })]
        });
      }

      const rows = [
        new TableRow({
          children: [
            createHeaderCell("No", 6),
            createHeaderCell("Kategori", 20),
            createHeaderCell("Pertanyaan", 44),
            createHeaderCell("Kunci Jawaban", 30)
          ]
        })
      ];

      questions.forEach((q, i) => {
        let ansText = q.ans || '';
        if (q.o && q.o.length && q.k != null) {
          ansText = `${String.fromCharCode(65 + q.k)}. ${q.o[q.k] || ''}`;
        }
        rows.push(new TableRow({
          children: [
            createCell(String(i + 1), 6, AlignmentType.CENTER),
            createCell(q.mapel || q.tipe || q.tier || 'Umum', 20),
            createCell(q.q, 44),
            createCell(ansText, 30)
          ]
        }));
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [new TextRun({ text: `BANK SOAL RESMI: BABAK ${stage.toUpperCase()}`, bold: true, color: "1E3A8A", size: 26, font: "Calibri" })]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            })
          ]
        }]
      });

      const blob = await window.docx.Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank_Soal_${stage.toUpperCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  window.DocxEngine = DocxEngine;
})(window);
