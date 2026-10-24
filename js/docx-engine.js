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
      let subtitle = "Kejuaraan Cerdas Cermat Multidisiplin Berbasis Smart Screen IFP";
      let petunjuk = [
        "Format tabel 8 kolom: No, Mata Pelajaran, Pertanyaan & Gambar, Pilihan A, B, C, D, dan Kunci Jawaban.",
        "Mendukung rumus matematika LaTeX (misal: $\\frac{1}{2}$, $\\sqrt{144}$, $x^2$), teks analisis, idiom bahasa, dan gambar.",
        "Gambar pendukung dapat di-paste/insert langsung ke dalam sel kolom 'Pertanyaan & Gambar'.",
        "Kunci Jawaban WAJIB diisi dengan satu huruf kapital: A, B, C, atau D."
      ];
      let models = [
        "Model 1: Soal Teori & Konsep Dasar (PPKn, Agama, Sejarah)",
        "Model 2: Soal Rumus Matematika & Eksak (Pecahan, Aljabar, Akar, Geometri)",
        "Model 3: Soal Analisis Paragraf / Teks Bacaan (Bahasa Indonesia & Sastra)",
        "Model 4: Soal Bergambar / Diagram / Peta / Organ (IPA & IPS)",
        "Model 5: Soal Bahasa Asing / Grammar / Idiom (Bahasa Inggris)",
        "Model 6: Soal Logika & Hubungan Sebab-Akibat"
      ];
      const rows = [];

      if (stage === 'penyisihan') {
        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 5),
            createHeaderCell("Mata Pelajaran", 18),
            createHeaderCell("Pertanyaan & Gambar (Rumus LaTeX $...$)", 37),
            createHeaderCell("Pilihan A", 10),
            createHeaderCell("Pilihan B", 10),
            createHeaderCell("Pilihan C", 10),
            createHeaderCell("Pilihan D", 10),
            createHeaderCell("Kunci", 6)
          ]
        }));
        const pData = [
          ["1", "PPKn", "Lambang sila ke-3 dalam perisai Garuda Pancasila (Persatuan Indonesia) adalah ...", "Pohon Beringin", "Bintang Emas", "Rantai Baja", "Padi dan Kapas", "A"],
          ["2", "Pendidikan Agama", "Rukun Islam yang kedua dan wajib dilaksanakan lima waktu sehari semalam adalah ...", "Salat", "Syahadat", "Puasa Ramadan", "Zakat Mal", "A"],
          ["3", "IPS", "Organisasi kerja sama regional bangsa-bangsa Asia Tenggara (ASEAN) didirikan pada 8 Agustus 1967 di ...", "Bangkok, Thailand", "Jakarta, Indonesia", "Manila, Filipina", "Singapura", "A"],
          ["4", "Matematika", "Hasil dari operasi penjumlahan pecahan $\\frac{1}{2} + \\frac{1}{4}$ adalah ...", "$\\frac{3}{4}$", "$\\frac{2}{6}$", "$\\frac{1}{6}$", "$1$", "A"],
          ["5", "Matematika", "Jika $3x - 5 = 16$, maka nilai $x$ yang memenuhi persamaan tersebut adalah ...", "7", "5", "6", "9", "A"],
          ["6", "Matematika", "Hasil perhitungan dari $\\sqrt{144} + 2^3 - 5$ adalah ...", "15", "18", "12", "14", "A"],
          ["7", "Matematika", "Luas sebuah lingkaran dengan jari-jari $r = 7\\text{ cm}$ ($\\pi = \\frac{22}{7}$) adalah ...", "154 cm²", "44 cm²", "308 cm²", "88 cm²", "A"],
          ["8", "Bahasa Indonesia", "Bacalah teks berikut: 'Hutan bakau memiliki peran krusial dalam menahan gempuran ombak laut serta mencegah abrasi di sepanjang garis pantai.' Gagasan pokok paragraf di atas adalah ...", "Fungsi hutan bakau bagi pantai", "Penyebab abrasi di pesisir", "Keanekaragaman hayati bakau", "Ciri-ciri fisik tanaman bakau", "A"],
          ["9", "IPA", "[Gambar: Struktur Organel Sel] Organel sel bermembran ganda yang bertindak sebagai pembangkit energi utama (ATP) melalui respirasi seluler adalah ...", "Mitokondria", "Ribosom", "Kloroplas", "Lisosom", "A"],
          ["10", "Bahasa Inggris", "The antonym of the word 'generous' (suka memberi / dermawan) is ...", "Stingy", "Helpful", "Honest", "Polite", "A"],
          ["11", "Informatika", "Perangkat keras (hardware) komputer yang bertindak sebagai 'otak' pemroses instruksi data adalah ...", "CPU", "Monitor", "RAM", "Harddisk", "A"]
        ];
        pData.forEach(r => {
          rows.push(new TableRow({
            children: [
              createCell(r[0], 5, AlignmentType.CENTER),
              createCell(r[1], 18),
              createCell(r[2], 37),
              createCell(r[3], 10),
              createCell(r[4], 10),
              createCell(r[5], 10),
              createCell(r[6], 10),
              createCell(r[7], 6, AlignmentType.CENTER)
            ]
          }));
        });
      } else if (stage === 'semifinal') {
        title = "TEMPLATE SOAL BABAK SEMIFINAL";
        subtitle = "Kompetisi Papan Kotak Skor Multiround & Perebutan Nilai IFP";
        petunjuk = [
          "Format tabel 9 kolom: No, Jenis Soal, Pertanyaan & Gambar, Pilihan A, B, C, D, Kunci Pilihan, dan Kunci Esai Juri.",
          "Kode Jenis Soal WAJIB diisi: BS (Benar/Salah), PG150 (Pilihan Ganda I), PG200 (Pilihan Ganda II), ES (Esai Rebutan), atau CAD (Cadangan).",
          "Untuk tipe BS: Kolom Kunci diisi 'B' (Benar) atau 'S' (Salah).",
          "Untuk tipe PG150 & PG200: Isi pilihan A, B, C, D dan kolom Kunci diisi A, B, C, atau D.",
          "Untuk tipe ES & CAD: Tuliskan jawaban lengkap pada kolom 'Kunci Jawaban Esai (Juri)'."
        ];
        models = [
          "Model BS: Benar / Salah (Babak 1, +100 poin, salah -50, durasi 20 detik)",
          "Model PG150: Pilihan Ganda Sedang (Babak 2, +150 poin, salah -75, durasi 30 detik)",
          "Model PG200: Pilihan Ganda Sukar / Hitungan (Babak 3, +200 poin, salah -100, durasi 45 detik)",
          "Model ES: Esai Rebutan (Babak 4, verifikasi jawaban juri, durasi 90 detik)",
          "Model CAD: Cadangan Siaga (Saat tie-break atau anulir soal)"
        ];
        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 5),
            createHeaderCell("Jenis Soal", 11),
            createHeaderCell("Pertanyaan & Gambar (Rumus LaTeX $...$)", 34),
            createHeaderCell("Pilihan A", 9),
            createHeaderCell("Pilihan B", 9),
            createHeaderCell("Pilihan C", 9),
            createHeaderCell("Pilihan D", 9),
            createHeaderCell("Kunci", 5),
            createHeaderCell("Kunci Jawaban Esai (Juri)", 18)
          ]
        }));
        const sData = [
          ["1", "BS", "Matahari terbit dari arah timur dan tenggelam di sebelah barat.", "Benar", "Salah", "-", "-", "B", ""],
          ["2", "BS", "Paus dan lumba-lumba tergolong hewan mamalia yang bernapas dengan paru-paru.", "Benar", "Salah", "-", "-", "B", ""],
          ["3", "BS", "Hasil perhitungan dari $15 \\times 4$ adalah 55.", "Benar", "Salah", "-", "-", "S", ""],
          ["4", "PG150", "Ibu kota dari Provinsi Kalimantan Timur saat ini adalah ...", "Samarinda", "Balikpapan", "Bontang", "Tarakan", "A", ""],
          ["5", "PG150", "Planet terdekat dari Matahari dalam sistem tata surya kita adalah ...", "Merkurius", "Venus", "Mars", "Bumi", "A", ""],
          ["6", "PG200", "Sebuah tabung memiliki jari-jari $r = 7\\text{ cm}$ dan tinggi $t = 10\\text{ cm}$. Berapakah volumenya? ($\\pi = \\frac{22}{7}$)", "1.540 cm³", "770 cm³", "3.080 cm³", "154 cm³", "A", ""],
          ["7", "PG200", "Hasil operasi hitung aljabar dari $(2x + 3)(x - 4)$ adalah ...", "$2x^2 - 5x - 12$", "$2x^2 + 5x - 12$", "$2x^2 - 11x - 12$", "$2x^2 - 5x + 12$", "A", ""],
          ["8", "ES", "Sebutkan rumusan lengkap teks sila kelima Pancasila!", "-", "-", "-", "-", "-", "Keadilan sosial bagi seluruh rakyat Indonesia."],
          ["9", "ES", "Apakah nama zat cair yang membawa oksigen dan nutrisi ke seluruh sel tubuh manusia?", "-", "-", "-", "-", "-", "Darah (atau Hemoglobin / Sel Darah Merah)."],
          ["10", "CAD", "SOAL CADANGAN: Siapakah pencipta lagu kebangsaan Indonesia Raya?", "-", "-", "-", "-", "-", "Wage Rudolf Supratman (W.R. Supratman)."]
        ];
        sData.forEach(r => {
          rows.push(new TableRow({
            children: [
              createCell(r[0], 5, AlignmentType.CENTER),
              createCell(r[1], 11, AlignmentType.CENTER),
              createCell(r[2], 34),
              createCell(r[3], 9),
              createCell(r[4], 9),
              createCell(r[5], 9),
              createCell(r[6], 9),
              createCell(r[7], 5, AlignmentType.CENTER),
              createCell(r[8], 18)
            ]
          }));
        });
      } else {
        title = "TEMPLATE SOAL BABAK GRAND FINAL";
        subtitle = "Matriks 15 Kotak Rebutan & Tie-Breaker Cerdas Cermat IFP";
        petunjuk = [
          "Babak Grand Final memiliki struktur matriks 15 Kotak (5 kolom x 3 baris) + 1 Kotak Soal Tambahan.",
          "Format tabel 4 kolom: No, Kategori & Poin Kotak, Pertanyaan Rebutan, dan Kunci Jawaban Dewan Juri.",
          "Pembagian Poin Panggung: Tier 1 (50 Poin), Tier 2 (75 Poin), Tier 3 (100 Poin), dan Kotak 16 Soal Tambahan (100 Poin)."
        ];
        models = [
          "Model Tier 1 (Kotak 1-5): Fakta Singkat & Refleks Cepat (50 Poin)",
          "Model Tier 2 (Kotak 6-10): Hitungan Logika & Hubungan Menengah (75 Poin)",
          "Model Tier 3 (Kotak 11-15): Konseptual & Analisis Tingkat Tinggi (100 Poin)",
          "Model Tie-Breaker (Kotak 16): Soal Tambahan Penentuan Kemenangan (100 Poin)"
        ];
        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 8),
            createHeaderCell("Kategori & Poin Kotak", 24),
            createHeaderCell("Pertanyaan Rebutan Panggung", 44),
            createHeaderCell("Kunci Jawaban Dewan Juri", 24)
          ]
        }));
        const fData = [
          ["1", "Tier 1 (50 Poin)", "Apa kepanjangan dari singkatan CPU dalam dunia komputer?", "Central Processing Unit"],
          ["2", "Tier 1 (50 Poin)", "Manakah yang BUKAN perangkat masukan (input): keyboard, mouse, atau proyektor?", "Proyektor (Perangkat Keluaran / Output)"],
          ["3", "Tier 1 (50 Poin)", "Sistem bilangan berbasis dua yang hanya menggunakan simbol 0 dan 1 disebut?", "Biner (Binary)"],
          ["4", "Tier 1 (50 Poin)", "Apakah ekstensi file standar dokumen dokumen pengolah kata modern Microsoft Word?", ".docx"],
          ["5", "Tier 1 (50 Poin)", "Perangkat lunak untuk menjelajah halaman internet seperti Google Chrome atau Edge disebut?", "Browser / Web Browser (Peramban Web)"],
          ["6", "Tier 2 (75 Poin)", "Konversikan bilangan biner 1010 ke dalam bentuk bilangan desimal!", "10 (Sepuluh)"],
          ["7", "Tier 2 (75 Poin)", "Apakah fungsi utama sistem firewall pada jaringan komputer?", "Menyaring lalu lintas data & mencegah akses tidak sah"],
          ["8", "Tier 2 (75 Poin)", "Urutan langkah-langkah logis dan terstruktur untuk menyelesaikan suatu masalah disebut?", "Algoritma"],
          ["9", "Tier 2 (75 Poin)", "Fungsi spreadsheet Microsoft Excel untuk menghitung nilai rata-rata dari rentang sel adalah?", "=AVERAGE(...)"],
          ["10", "Tier 2 (75 Poin)", "Apakah kepanjangan resmi dari singkatan URL pada alamat website?", "Uniform Resource Locator"],
          ["11", "Tier 3 (100 Poin)", "Teknik computational thinking dengan memecah masalah kompleks menjadi bagian-bagian lebih kecil disebut?", "Dekomposisi (Decomposition)"],
          ["12", "Tier 3 (100 Poin)", "Berapakah hasil dari $2^8$ (jumlah variasi kombinasi pada satu byte memori)?", "256"],
          ["13", "Tier 3 (100 Poin)", "Cabang ilmu kecerdasan buatan (AI) yang mempelajari algoritma komputer untuk belajar dari data disebut?", "Machine Learning (Pembelajaran Mesin)"],
          ["14", "Tier 3 (100 Poin)", "Bentuk kejahatan siber yang mencoba mencuri informasi rahasia dengan memalsukan email/situs disebut?", "Phishing"],
          ["15", "Tier 3 (100 Poin)", "Konversikan bilangan desimal 13 ke dalam representasi biner!", "1101 (Delapan + Empat + Nol + Satu)"],
          ["16", "Soal Tambahan (100 Poin)", "SOAL PENENTUAN JUARA (TIE-BREAKER): Satu byte data terdiri dari berapa bit?", "8 bit"]
        ];
        fData.forEach(r => {
          rows.push(new TableRow({
            children: [
              createCell(r[0], 8, AlignmentType.CENTER),
              createCell(r[1], 24),
              createCell(r[2], 44),
              createCell(r[3], 24)
            ]
          }));
        });
      }

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
              children: [new TextRun({ text: title, bold: true, color: "1E3A8A", size: 28, font: "Calibri" })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 140 },
              children: [new TextRun({ text: subtitle, italics: true, color: "475569", size: 20, font: "Calibri" })]
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: "📋 PANDUAN PENGISIAN & KETENTUAN FORMAT:", bold: true, color: "D97706", size: 20, font: "Calibri" })]
            }),
            ...petunjuk.map(p => new Paragraph({
              spacing: { after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: p, size: 18, font: "Calibri", color: "334155" })]
            })),
            new Paragraph({
              spacing: { before: 100, after: 60 },
              children: [new TextRun({ text: "💡 DAFTAR MODEL SOAL YANG DIDUKUNG:", bold: true, color: "1E3A8A", size: 20, font: "Calibri" })]
            }),
            ...models.map(m => new Paragraph({
              spacing: { after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: m, size: 18, font: "Calibri", color: "1E293B" })]
            })),
            new Paragraph({ spacing: { after: 140 }, children: [] }),
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
