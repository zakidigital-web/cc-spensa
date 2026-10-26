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

  function formatMathText(t) {
    if (!t) return '';
    t = String(t);
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    if (!window.katex) return esc(t);

    let out = '', last = 0, m;
    const re = /\$\$([\s\S]+?)\$\$|\$([^\$\n]+?)\$/g;
    while ((m = re.exec(t)) !== null) {
      out += esc(t.slice(last, m.index));
      const eq = m[1] || m[2], disp = !!m[1];
      try {
        out += window.katex.renderToString(eq, { displayMode: disp, throwOnError: false });
      } catch (e) {
        out += esc(m[0]);
      }
      last = m.index + m[0].length;
    }
    return out + esc(t.slice(last));
  }

  function getImageBytesAndDimensions(imgData) {
    return new Promise((resolve) => {
      if (!imgData || typeof imgData !== 'string') return resolve(null);
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 3500);

      const done = (val) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(val);
        }
      };

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let w = img.naturalWidth || img.width || 200;
        let h = img.naturalHeight || img.height || 150;
        const maxWidth = 260;
        const maxHeight = 180;
        const scale = Math.min(1, maxWidth / w, maxHeight / h);
        const targetW = Math.max(20, Math.round(w * scale));
        const targetH = Math.max(20, Math.round(h * scale));

        try {
          if (imgData.startsWith('data:')) {
            const base64Data = imgData.split(',')[1];
            if (!base64Data) return done(null);
            const bin = atob(base64Data);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            done({ bytes, width: targetW, height: targetH });
          } else {
            fetch(imgData)
              .then(res => res.arrayBuffer())
              .then(ab => done({ bytes: new Uint8Array(ab), width: targetW, height: targetH }))
              .catch(() => done(null));
          }
        } catch (e) {
          done(null);
        }
      };
      img.onerror = () => done(null);
      img.src = imgData;
    });
  }

  const DocxEngine = {
    formatMath(text) {
      return formatMathText(text);
    },

    async getPenyisihanJenjangCounts() {
      const b = await kvGetLegacy('bank');
      const counts = { 7: 0, 8: 0, 9: 0 };
      let hasAny = false;
      [7, 8, 9].forEach(j => {
        if (b && b.soal && Array.isArray(b.soal[j]) && b.soal[j].length > 0) {
          counts[j] = b.soal[j].length;
          hasAny = true;
        }
      });

      // If local cache is empty and not cleared, check cloud database
      if (!hasAny && !localStorage.getItem('cc_cleared_penyisihan')) {
        try {
          const res = await fetch('/api/banks?stage=penyisihan');
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
              data.questions.forEach(q => {
                const j = q.jenjang || (q.stage === 'penyisihan_8' ? 8 : (q.stage === 'penyisihan_9' ? 9 : 7));
                counts[j] = (counts[j] || 0) + 1;
              });
            }
          }
        } catch (e) {}
      }

      return counts;
    },

    async getStageQuestions(stage = 'penyisihan', jenjang = 7, forceCloud = false) {
      let list = [];
      const j = parseInt(jenjang, 10) || 7;
      const clearKey = (stage === 'penyisihan') ? `cc_cleared_${stage}_${j}` : `cc_cleared_${stage}`;
      const isExplicitlyCleared = (localStorage.getItem(clearKey) === 'true') ||
                                  (stage === 'penyisihan' && localStorage.getItem('cc_cleared_penyisihan') === 'true');

      if (!forceCloud) {
        if (stage === 'penyisihan') {
          const b = await kvGetLegacy('bank');
          if (b && b.soal && Array.isArray(b.soal[j]) && b.soal[j].length > 0) {
            list = b.soal[j];
          }
        } else if (stage === 'semifinal') {
          const b3 = await kvGetLegacy('bank3');
          if (b3 && b3.soal && Array.isArray(b3.soal) && b3.soal.length > 0) {
            list = b3.soal;
          }
        } else {
          try {
            const f = JSON.parse(localStorage.getItem('cc-final3') || '{}');
            if (f && f.q && f.q.trim()) {
              list = f.q.split('\n').filter(Boolean).map((line, i) => {
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
      }

      // If local list is empty and NOT explicitly cleared (or forced cloud reload), fetch from PostgreSQL Cloud DB
      if ((!list || list.length === 0 || forceCloud) && !isExplicitlyCleared) {
        try {
          const targetApiStage = (stage === 'penyisihan') ? `penyisihan_${j}` : stage;
          const res = await fetch(`/api/banks?stage=${targetApiStage}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
              list = data.questions;
              // Hydrate local cache without echoing back to cloud
              await this.saveStageQuestions(stage, list, j, true /* skipCloudPush */);
            }
          }
        } catch (e) {
          console.warn('Could not reach cloud database for questions:', e);
        }
      }

      // If still empty and not explicitly cleared by user, load defaults
      if ((!list || list.length === 0) && !isExplicitlyCleared && window.DEFAULT_BANKS && window.DEFAULT_BANKS[stage]) {
        list = JSON.parse(JSON.stringify(window.DEFAULT_BANKS[stage]));
        if (stage === 'penyisihan') {
          list = list.map((q, idx) => {
            q.jenjang = j;
            q.id = `p_${j}_${idx + 1}`;
            return q;
          });
        }
        await this.saveStageQuestions(stage, list, j, false);
      }

      return (list || []).map((q, idx) => {
        if (!q.id) q.id = (stage === 'penyisihan') ? `p_${j}_${idx + 1}` : `${stage}_${idx + 1}`;
        if (stage === 'penyisihan' && !q.jenjang) q.jenjang = j;
        return q;
      });
    },

    async saveStageQuestions(stage = 'penyisihan', questions = [], jenjang = 7, skipCloudPush = false) {
      const j = parseInt(jenjang, 10) || 7;
      const clearKey = (stage === 'penyisihan') ? `cc_cleared_${stage}_${j}` : `cc_cleared_${stage}`;
      if (questions.length === 0) {
        localStorage.setItem(clearKey, 'true');
        if (stage === 'penyisihan') {
          localStorage.setItem('cc_init_penyisihan', 'true');
        } else if (stage === 'semifinal') {
          localStorage.setItem('cc_init_semifinal', 'true');
        }
      } else {
        localStorage.removeItem(clearKey);
        if (stage === 'penyisihan') {
          localStorage.removeItem('cc_cleared_penyisihan');
        }
      }

      let cloudPromise = null;

      if (stage === 'penyisihan') {
        let b = (await kvGetLegacy('bank')) || { mapel: [], soal: { 7: [], 8: [], 9: [] } };
        b.soal = b.soal || { 7: [], 8: [], 9: [] };
        b.soal[j] = questions;

        const existingMapel = new Set((b.mapel || []).map(m => (typeof m === 'string' ? m : m.n)));
        questions.forEach(q => {
          if (q.mapel && !existingMapel.has(q.mapel)) {
            b.mapel.push({ n: q.mapel, k: 0 });
            existingMapel.add(q.mapel);
          }
        });

        await kvSetLegacy('bank', b);
        if (window.PortalStorage) {
          await window.PortalStorage.set(`bank_penyisihan_${j}`, questions);
          if (j === 9) await window.PortalStorage.set('bank_penyisihan', questions);
          if (!skipCloudPush) {
            cloudPromise = window.PortalStorage.saveStageBank(`penyisihan_${j}`, questions);
          }
        }
        const frame = document.getElementById('frame-penyisihan');
        if (frame && frame.contentWindow) {
          try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
        }
      } else if (stage === 'semifinal') {
        let b3 = (await kvGetLegacy('bank3')) || { soal: [] };
        b3.soal = questions;
        await kvSetLegacy('bank3', b3);
        if (window.PortalStorage) {
          await window.PortalStorage.set('bank_semifinal', questions);
          if (!skipCloudPush) {
            cloudPromise = window.PortalStorage.saveStageBank('semifinal', questions);
          }
        }
        const frame = document.getElementById('frame-semifinal');
        if (frame && frame.contentWindow) {
          try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
        }
      } else if (stage === 'final') {
        try {
          let curFinal = JSON.parse(localStorage.getItem('cc-final3') || '{}');
          const lines = questions.map(q => `${q.q} ||| ${q.ans}`);
          curFinal.q = lines.join('\n');
          localStorage.setItem('cc-final3', JSON.stringify(curFinal));
        } catch(e) {}
        if (window.PortalStorage) {
          await window.PortalStorage.set('bank_final', questions);
          if (!skipCloudPush) {
            cloudPromise = window.PortalStorage.saveStageBank('final', questions);
          }
        }
        const frame = document.getElementById('frame-final');
        if (frame && frame.contentWindow) {
          try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
        }
      }

      if (cloudPromise) {
        try {
          await cloudPromise;
        } catch (e) {
          console.warn('Cloud sync error during save:', e);
        }
      }

      return questions;
    },

    async deleteStageQuestions(stage, idsToDelete = [], jenjang = 7) {
      const idSet = new Set(idsToDelete.map(String));
      let questions = await this.getStageQuestions(stage, jenjang);
      questions = questions.filter(q => !idSet.has(String(q.id)));
      return this.saveStageQuestions(stage, questions, jenjang);
    },

    async clearStageQuestions(stage, jenjang = 7, clearAllJenjang = false) {
      if (stage === 'penyisihan' && clearAllJenjang) {
        localStorage.setItem('cc_cleared_penyisihan_7', 'true');
        localStorage.setItem('cc_cleared_penyisihan_8', 'true');
        localStorage.setItem('cc_cleared_penyisihan_9', 'true');
        localStorage.setItem('cc_cleared_penyisihan', 'true');
        localStorage.setItem('cc_init_penyisihan', 'true');

        let b = (await kvGetLegacy('bank')) || { mapel: [], soal: { 7: [], 8: [], 9: [] } };
        b.soal = { 7: [], 8: [], 9: [] };
        await kvSetLegacy('bank', b);

        if (window.PortalStorage) {
          await window.PortalStorage.saveStageBank('penyisihan_7', []);
          await window.PortalStorage.saveStageBank('penyisihan_8', []);
          await window.PortalStorage.saveStageBank('penyisihan_9', []);
          await window.PortalStorage.saveStageBank('penyisihan_all', []);
        }

        const frame = document.getElementById('frame-penyisihan');
        if (frame && frame.contentWindow) {
          try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
        }
        return [];
      }
      return this.saveStageQuestions(stage, [], jenjang);
    },

    async clearAllStages() {
      await this.clearStageQuestions('penyisihan', 7, true);
      await this.clearStageQuestions('semifinal');
      await this.clearStageQuestions('final');
      if (window.PortalStorage) {
        await window.PortalStorage.saveStageBank('clear_all', []);
      }
      return true;
    },

    async updateStageQuestion(stage, qId, updatedData, jenjang = 7) {
      let questions = await this.getStageQuestions(stage, jenjang);
      const idx = questions.findIndex(q => String(q.id) === String(qId));
      if (idx !== -1) {
        questions[idx] = Object.assign({}, questions[idx], updatedData);
      } else {
        questions.push(updatedData);
      }
      return this.saveStageQuestions(stage, questions, jenjang);
    },

    async addStageQuestion(stage, newQuestion, jenjang = 7) {
      let questions = await this.getStageQuestions(stage, jenjang);
      const j = parseInt(jenjang, 10) || 7;
      if (!newQuestion.id) {
        newQuestion.id = (stage === 'penyisihan')
          ? `p_${j}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
          : `${stage}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      }
      if (stage === 'penyisihan') {
        newQuestion.jenjang = j;
      }
      questions.push(newQuestion);
      return this.saveStageQuestions(stage, questions, jenjang);
    },

    async restoreDefaultStageQuestions(stage, jenjang = 7, restoreAllJenjang = false) {
      if (stage === 'penyisihan' && restoreAllJenjang) {
        localStorage.removeItem('cc_cleared_penyisihan_7');
        localStorage.removeItem('cc_cleared_penyisihan_8');
        localStorage.removeItem('cc_cleared_penyisihan_9');
        localStorage.removeItem('cc_cleared_penyisihan');
        const defaults = (window.DEFAULT_BANKS && window.DEFAULT_BANKS.penyisihan) || [];
        for (let j of [7, 8, 9]) {
          const cloned = JSON.parse(JSON.stringify(defaults)).map((q, idx) => {
            q.jenjang = j;
            q.id = `p_${j}_${idx + 1}`;
            return q;
          });
          await this.saveStageQuestions('penyisihan', cloned, j);
        }
        return true;
      }

      const j = parseInt(jenjang, 10) || 7;
      const clearKey = (stage === 'penyisihan') ? `cc_cleared_${stage}_${j}` : `cc_cleared_${stage}`;
      localStorage.removeItem(clearKey);
      if (stage === 'penyisihan') {
        localStorage.removeItem('cc_cleared_penyisihan');
      }
      const defaults = (window.DEFAULT_BANKS && window.DEFAULT_BANKS[stage]) || [];
      let cloned = JSON.parse(JSON.stringify(defaults));
      if (stage === 'penyisihan') {
        cloned = cloned.map((q, idx) => {
          q.jenjang = j;
          q.id = `p_${j}_${idx + 1}`;
          return q;
        });
      }
      return this.saveStageQuestions(stage, cloned, jenjang);
    },

    async importQuestionsFromDocx(file, targetStage = 'penyisihan', targetJenjang = 7) {
      if (!window.mammoth) throw new Error('Library Mammoth.js belum siap!');

      const j = parseInt(targetJenjang, 10) || 7;
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
        for (let t = 0; t < tables.length; t++) {
          const rows = tables[t].querySelectorAll('tr');
          if (rows.length < 2) continue;

          // Header inspection
          const headerCells = rows[0].querySelectorAll('td, th');
          const headerTexts = Array.from(headerCells).map(c => c.textContent.trim().toLowerCase());
          const isBsHeader = headerTexts.some(h => /b\s*[\/\-]\s*s|benar|salah/i.test(h)) ||
            (targetStage === 'semifinal' && headerTexts.some(h => /pernyataan/i.test(h)) && !headerTexts.some(h => /pilihan|opsi/i.test(h)));
          const isPgHeader = headerTexts.some(h => /pilihan|opsi/i.test(h)) || headerCells.length >= 7;
          const isEsaiHeader = headerTexts.some(h => /esai|essay|uraian|juri|rubrik/i.test(h));

          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td, th');
            if (cells.length < 2) continue;

            // 1. Check if 9-column unified Semifinal table
            if (cells.length >= 8 && targetStage === 'semifinal' && (/BS|PG1|PG2|ES|CAD/i.test(cells[1].textContent.trim()))) {
              const rawType = cells[1].textContent.trim().toUpperCase();
              const tipe = (/ES|ESSAY|URAIAN/i.test(rawType)) ? 'ES' :
                           (/CAD/i.test(rawType)) ? 'CAD' :
                           (/PG200|PG2/i.test(rawType)) ? 'PG2' :
                           (/PG150|PG1|PG/i.test(rawType)) ? 'PG1' : 'BS';
              const qCell = cells[2];
              const imgEl = qCell ? qCell.querySelector('img') : null;
              const imgSrc = imgEl ? imgEl.src : null;
              const qText = qCell ? qCell.textContent.trim() : '';

              const optA = cells[3] ? cells[3].textContent.trim() : '';
              const optB = cells[4] ? cells[4].textContent.trim() : '';
              const optC = cells[5] ? cells[5].textContent.trim() : '';
              const optD = cells[6] ? cells[6].textContent.trim() : '';
              const keyRaw = cells[7] ? cells[7].textContent.trim().toUpperCase() : '';
              const esRaw = cells[8] ? cells[8].textContent.trim() : (cells[7] ? cells[7].textContent.trim() : '');

              if (tipe === 'BS') {
                const isSalah = /^(S|SALAH|FALSE|1)/i.test(keyRaw || optA);
                parsedQuestions.push({
                  id: `sm_imp_${Date.now().toString(36)}_${t}_${i}`,
                  tipe: 'BS',
                  q: qText,
                  o: ['Benar', 'Salah'],
                  key: isSalah ? 1 : 0,
                  k: isSalah ? 1 : 0,
                  ans: isSalah ? 'Salah' : 'Benar',
                  img: imgSrc
                });
              } else if (tipe === 'PG1' || tipe === 'PG2') {
                let keyIdx = 0;
                if (keyRaw === 'B' || keyRaw === '1') keyIdx = 1;
                else if (keyRaw === 'C' || keyRaw === '2') keyIdx = 2;
                else if (keyRaw === 'D' || keyRaw === '3') keyIdx = 3;
                parsedQuestions.push({
                  id: `sm_imp_${Date.now().toString(36)}_${t}_${i}`,
                  tipe: tipe,
                  q: qText,
                  o: [optA, optB, optC, optD],
                  key: keyIdx,
                  k: keyIdx,
                  ans: [optA, optB, optC, optD][keyIdx] || '',
                  img: imgSrc
                });
              } else {
                parsedQuestions.push({
                  id: `sm_imp_${Date.now().toString(36)}_${t}_${i}`,
                  tipe: tipe,
                  q: qText,
                  o: [],
                  key: 0,
                  k: 0,
                  ans: esRaw || optA,
                  img: imgSrc
                });
              }
              continue;
            }

            // 2. Check if 7-8 column Multiple Choice table (Penyisihan or Semifinal PG)
            if (cells.length >= 7 && (isPgHeader || targetStage === 'penyisihan')) {
              let category = 'Umum';
              let qCell, optA, optB, optC, optD, keyRaw;
              if (cells.length >= 8) {
                category = cells[1].textContent.trim();
                qCell = cells[2];
                optA = cells[3] ? cells[3].textContent.trim() : '';
                optB = cells[4] ? cells[4].textContent.trim() : '';
                optC = cells[5] ? cells[5].textContent.trim() : '';
                optD = cells[6] ? cells[6].textContent.trim() : '';
                keyRaw = cells[7] ? cells[7].textContent.trim().toUpperCase() : 'A';
              } else {
                qCell = cells[1];
                optA = cells[2] ? cells[2].textContent.trim() : '';
                optB = cells[3] ? cells[3].textContent.trim() : '';
                optC = cells[4] ? cells[4].textContent.trim() : '';
                optD = cells[5] ? cells[5].textContent.trim() : '';
                keyRaw = cells[6] ? cells[6].textContent.trim().toUpperCase() : 'A';
              }
              const imgEl = qCell ? qCell.querySelector('img') : null;
              const imgSrc = imgEl ? imgEl.src : null;
              const qText = qCell ? qCell.textContent.trim() : '';
              const options = [optA, optB, optC, optD];
              let keyIdx = 0;
              if (keyRaw === 'B' || keyRaw === '1') keyIdx = 1;
              else if (keyRaw === 'C' || keyRaw === '2') keyIdx = 2;
              else if (keyRaw === 'D' || keyRaw === '3') keyIdx = 3;

              if (targetStage === 'penyisihan') {
                parsedQuestions.push({
                  id: `imp_${j}_${Date.now().toString(36)}_${t}_${i}`,
                  jenjang: j,
                  mapel: category,
                  q: qText,
                  o: options,
                  k: keyIdx,
                  ans: options[keyIdx] || '',
                  img: imgSrc
                });
              } else if (targetStage === 'semifinal') {
                const isPG2 = /PG2|SUKAR|HITUNGAN/i.test(category);
                parsedQuestions.push({
                  id: `sm_imp_${Date.now().toString(36)}_${t}_${i}`,
                  tipe: isPG2 ? 'PG2' : 'PG1',
                  q: qText,
                  o: options,
                  key: keyIdx,
                  k: keyIdx,
                  ans: options[keyIdx] || '',
                  img: imgSrc
                });
              }
              continue;
            }

            // 3. Check if Benar / Salah Table (3-5 columns)
            let isRowBs = isBsHeader || targetStage === 'semifinal' || targetStage === 'benar_salah';
            let qCell = null, keyRaw = '', desc = '';

            if (cells.length === 3) {
              const c1 = cells[1].textContent.trim();
              const c2 = cells[2].textContent.trim();
              if (/^[BS]$/i.test(c1) || /^(BENAR|SALAH)$/i.test(c1)) {
                keyRaw = c1;
                qCell = cells[2];
                isRowBs = true;
              } else if (/^[BS]$/i.test(c2) || /^(BENAR|SALAH)$/i.test(c2)) {
                qCell = cells[1];
                keyRaw = c2;
                isRowBs = true;
              } else {
                qCell = cells[1];
                keyRaw = c2;
              }
            } else if (cells.length === 4) {
              const c1 = cells[1].textContent.trim();
              const c2 = cells[2].textContent.trim();
              const c3 = cells[3].textContent.trim();
              if (/^BS$/i.test(c1)) {
                qCell = cells[2];
                keyRaw = c3;
                isRowBs = true;
              } else if (/^[BS]$/i.test(c2) || /^(BENAR|SALAH)$/i.test(c2)) {
                qCell = cells[1];
                keyRaw = c2;
                desc = c3;
                isRowBs = true;
              } else if (/^[BS]$/i.test(c3) || /^(BENAR|SALAH)$/i.test(c3)) {
                qCell = cells[1];
                keyRaw = c3;
                desc = c2;
                isRowBs = true;
              } else if (isEsaiHeader || /ES|CAD/i.test(c1)) {
                isRowBs = false;
                qCell = cells[2] || cells[1];
                keyRaw = c3 || c2;
              } else {
                qCell = cells[1];
                keyRaw = c2;
                desc = c3;
              }
            } else if (cells.length === 5) {
              const c1 = cells[1].textContent.trim();
              const c3 = cells[3].textContent.trim();
              if (/^BS$/i.test(c1) || /^[BS]$/i.test(c3) || /^(BENAR|SALAH)$/i.test(c3)) {
                qCell = cells[2];
                keyRaw = c3;
                desc = cells[4] ? cells[4].textContent.trim() : '';
                isRowBs = true;
              } else {
                qCell = cells[2];
                keyRaw = cells[3] ? cells[3].textContent.trim() : '';
                desc = cells[4] ? cells[4].textContent.trim() : '';
              }
            }

            if (isRowBs && qCell) {
              const imgEl = qCell.querySelector('img');
              const imgSrc = imgEl ? imgEl.src : null;
              const qText = qCell.textContent.trim();
              if (qText) {
                const isSalah = /^(S|SALAH|F|FALSE|1)/i.test(keyRaw.trim());
                if (targetStage === 'semifinal' || targetStage === 'benar_salah') {
                  parsedQuestions.push({
                    id: `sm_bs_imp_${Date.now().toString(36)}_${t}_${i}`,
                    tipe: 'BS',
                    q: qText,
                    o: ['Benar', 'Salah'],
                    key: isSalah ? 1 : 0,
                    k: isSalah ? 1 : 0,
                    ans: isSalah ? 'Salah' : 'Benar',
                    img: imgSrc,
                    desc: desc
                  });
                } else if (targetStage === 'penyisihan') {
                  parsedQuestions.push({
                    id: `imp_${j}_${Date.now().toString(36)}_${t}_${i}`,
                    jenjang: j,
                    mapel: 'Umum',
                    q: qText,
                    o: ['Benar', 'Salah', '-', '-'],
                    k: isSalah ? 1 : 0,
                    ans: isSalah ? 'Salah' : 'Benar',
                    img: imgSrc
                  });
                }
                continue;
              }
            }

            // 4. Fallback for Esai or Grand Final
            if (qCell) {
              const imgEl = qCell.querySelector('img');
              const imgSrc = imgEl ? imgEl.src : null;
              const qText = qCell.textContent.trim();
              if (!qText) continue;

              if (targetStage === 'semifinal') {
                const isCad = /CAD/i.test(cells[1] ? cells[1].textContent : '');
                parsedQuestions.push({
                  id: `sm_imp_${Date.now().toString(36)}_${t}_${i}`,
                  tipe: isCad ? 'CAD' : 'ES',
                  q: qText,
                  o: [],
                  key: 0,
                  k: 0,
                  ans: keyRaw,
                  img: imgSrc
                });
              } else if (targetStage === 'final') {
                const tier = cells[1] ? cells[1].textContent.trim() : 'Tier 1 (50 Poin)';
                parsedQuestions.push({
                  q: qText,
                  ans: keyRaw,
                  tier: tier,
                  img: imgSrc
                });
              }
            }
          }
        }
      }

      // Save directly to the native stage storage using unified saveStageQuestions
      const effectiveStage = (targetStage === 'benar_salah' || targetStage === 'bs') ? 'semifinal' : targetStage;
      const curQuestions = await this.getStageQuestions(effectiveStage, j);
      await this.saveStageQuestions(effectiveStage, curQuestions.concat(parsedQuestions), j);

      return {
        count: parsedQuestions.length,
        questions: parsedQuestions,
        mathCount: mathEquations.length,
        stage: effectiveStage,
        jenjang: j
      };
    },

    async downloadTemplateDocx(stage = 'penyisihan', jenjang = 7) {
      if (!window.docx) throw new Error('Library docx.js belum siap!');
      const j = parseInt(jenjang, 10) || 7;

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
      let multiTables = null;

      if (stage === 'benar_salah' || stage === 'bs') {
        title = "TEMPLATE BANK SOAL: BENAR / SALAH (TRUE / FALSE)";
        subtitle = "Format Standar Bersih 4 Kolom Khusus Soal Benar / Salah IFP";
        petunjuk = [
          "Format tabel 4 kolom bersih & standar: No, Pernyataan / Soal & Gambar, Kunci (B / S), dan Keterangan / Pembahasan.",
          "Kolom 'Kunci (B / S)': Cukup tulis huruf 'B' (jika pernyataan Benar) atau 'S' (jika pernyataan Salah). Boleh juga ditulis 'Benar' atau 'Salah'.",
          "Mendukung Rumus Matematika LaTeX: Tulis rumus di dalam tanda dollar $...$, contoh: $15 \\times 4 = 60$, $\\frac{1}{2} > \\frac{1}{4}$, $\\sqrt{144} = 12$.",
          "Mendukung Gambar Ilustrasi: Silakan salin (copy-paste) atau sisipkan gambar langsung ke dalam sel kolom 'Pernyataan / Soal'.",
          "Kolom 'Keterangan / Pembahasan' bersifat opsional untuk catatan alasan juri atau penjelasan kepada peserta.",
          "File template ini dapat diimpor secara langsung ke Bank Soal Babak Semifinal tanpa perlu kolom pilihan ganda tambahan."
        ];
        models = [
          "Model BS-1: Benar/Salah Sains & Fakta Alamiah (Contoh: Paus termasuk mamalia, Gas terbanyak adalah Nitrogen)",
          "Model BS-2: Benar/Salah Numerasi & Perhitungan Matematika (Contoh: Kelipatan 4 adalah genap, Rata-rata 5 bilangan)",
          "Model BS-3: Benar/Salah Logika Geometri & Bangun Datar (Contoh: Persegi adalah persegi panjang)",
          "Model BS-4: Benar/Salah Sejarah, Kenegaraan & Pengetahuan Umum (Contoh: Zona waktu Indonesia, Pendirian ASEAN)",
          "Model BS-5: Benar/Salah Silogisme & Logika Bahasa (Contoh: Pernyataan implikasi sebab-akibat)"
        ];
        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 8),
            createHeaderCell("Pernyataan / Soal & Gambar (Rumus LaTeX $...$)", 52),
            createHeaderCell("Kunci (B / S)", 14),
            createHeaderCell("Keterangan / Pembahasan (Opsional)", 26)
          ]
        }));
        const sampleBS = [
          ["1", "Indonesia memiliki tiga zona waktu, yaitu WIB, WITA, dan WIT.", "B", "Indonesia menggunakan tiga zona waktu resmi."],
          ["2", "Bilangan 1 merupakan bilangan prima karena hanya memiliki satu faktor positif.", "S", "Bilangan prima memiliki tepat dua faktor positif."],
          ["3", "Jika suatu bilangan habis dibagi 4, bilangan tersebut pasti habis dibagi 2.", "B", "Setiap kelipatan 4 pasti merupakan bilangan genap."],
          ["4", "Tumbuhan menyerap oksigen dan melepaskan karbon dioksida sebagai satu-satunya proses pertukaran gas sepanjang hidupnya.", "S", "Tumbuhan juga melakukan fotosintesis."],
          ["5", "Perubahan wujud dari gas menjadi cair disebut kondensasi atau pengembunan.", "B", "Kondensasi adalah perubahan wujud gas menjadi cair."],
          ["6", "Candi Borobudur merupakan salah satu warisan budaya Indonesia yang bercorak Buddha.", "B", "Candi Borobudur bercorak Buddha Mahayana."],
          ["7", "Jika harga barang Rp80.000 naik 25%, harga akhirnya menjadi Rp100.000.", "B", "25% x Rp80.000 = Rp20.000. Total = Rp100.000."],
          ["8", "Semua benda yang tenggelam di air memiliki massa lebih besar daripada semua benda yang mengapung, tanpa dipengaruhi ukuran dan volume benda.", "S", "Ditentukan oleh massa jenis dan gaya apung."],
          ["9", "Dalam rantai makanan, energi yang tersedia umumnya semakin berkurang pada tingkat trofik yang lebih tinggi.", "B", "Penyusutan energi ~90% antartingkat trofik."],
          ["10", "Jika rata-rata lima bilangan adalah 12, jumlah kelima bilangan tersebut adalah 60.", "B", "Jumlah = 5 x 12 = 60."],
          ["11", "Semua persegi merupakan persegi panjang, tetapi semua persegi panjang belum tentu merupakan persegi.", "B", "Persegi memenuhi seluruh sifat persegi panjang."],
          ["12", "Bunyi dapat merambat melalui ruang hampa tanpa medium.", "S", "Bunyi adalah gelombang mekanik."],
          ["13", "Jika dua bilangan positif memiliki hasil kali 36, jumlah kedua bilangan tersebut pasti 13.", "S", "Pasangan 6x6=36 berjumlah 12."],
          ["14", "ASEAN didirikan pada 8 Agustus 1967 di Bangkok, Thailand.", "B", "Deklarasi Bangkok, 8 Agustus 1967."],
          ["15", "Dalam demokrasi, hasil pemungutan suara selalu membuat semua orang memperoleh pilihan yang mereka inginkan.", "S", "Keputusan diambil berdasarkan suara mayoritas."],
          ["16", "Jika jarak pada peta semakin besar, jarak sebenarnya pasti semakin besar meskipun skala petanya berbeda.", "S", "Perlu memperhitungkan skala peta."],
          ["17", "Pada rangkaian listrik paralel, setiap cabang memiliki jalur arus tersendiri.", "B", "Rangkaian paralel memiliki cabang arus tersendiri."],
          ["18", "Jika suatu pernyataan berbunyi 'Semua peserta yang lolos adalah siswa kelas IX', maka dapat dipastikan bahwa semua siswa kelas IX lolos.", "S", "Tidak dapat dibalik."]
        ];
        sampleBS.forEach(r => {
          rows.push(new TableRow({
            children: [
              createCell(r[0], 8, AlignmentType.CENTER),
              createCell(r[1], 52),
              createCell(r[2], 14, AlignmentType.CENTER),
              createCell(r[3], 26)
            ]
          }));
        });
      } else if (stage === 'penyisihan') {
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
        subtitle = "Format Multi-Tabel Resmi: Benar / Salah, Pilihan Ganda & Esai Rebutan IFP";
        petunjuk = [
          "Template Semifinal Resmi ini menggunakan 3 tabel terpisah yang rapi dan terstruktur:",
          "  1. TABEL 1 (BENAR / SALAH - 4 Kolom): No, Pernyataan & Gambar, Kunci (B/S), Pembahasan.",
          "  2. TABEL 2 (PILIHAN GANDA - 8 Kolom): No, Kategori (PG150 / PG200), Pertanyaan, Opsi A, B, C, D, Kunci (A/B/C/D).",
          "  3. TABEL 3 (ESAI REBUTAN & CADANGAN - 4 Kolom): No, Jenis (ES / CAD), Pertanyaan Rebutan, Kunci Jawaban Dewan Juri.",
          "Format ini bebas dari kolom dummy '-' dan langsung dapat diedit dengan mudah oleh para guru / penyusun soal.",
          "Sistem secara otomatis membaca seluruh tabel di dalam file dokumen ini sekaligus."
        ];
        models = [
          "Tabel 1: Soal Benar / Salah (Babak 1, +100 poin, salah -50, durasi 20 detik)",
          "Tabel 2: Pilihan Ganda Sedang (Babak 2 - PG150, +150 poin, durasi 30 detik)",
          "Tabel 2: Pilihan Ganda Sukar / Hitungan (Babak 3 - PG200, +200 poin, durasi 45 detik)",
          "Tabel 3: Soal Esai Rebutan (Babak 4 - ES, +100 s.d. +300 poin dinilai juri, durasi 90 detik)",
          "Tabel 3: Soal Cadangan Siaga (CAD, untuk tie-break atau anulir darurat panggung)"
        ];

        // Multi-table structure for Semifinal
        const t1Rows = [
          new TableRow({
            children: [
              createHeaderCell("No", 8),
              createHeaderCell("Pernyataan / Soal & Gambar (Rumus LaTeX $...$)", 52),
              createHeaderCell("Kunci (B / S)", 14),
              createHeaderCell("Keterangan / Pembahasan (Opsional)", 26)
            ]
          })
        ];
        const bsData = [
          ["1", "Indonesia memiliki tiga zona waktu, yaitu WIB, WITA, dan WIT.", "B", "Indonesia menggunakan tiga zona waktu resmi."],
          ["2", "Bilangan 1 merupakan bilangan prima karena hanya memiliki satu faktor positif.", "S", "Bilangan prima memiliki tepat dua faktor positif."],
          ["3", "Jika suatu bilangan habis dibagi 4, bilangan tersebut pasti habis dibagi 2.", "B", "Setiap kelipatan 4 pasti habis dibagi 2."],
          ["4", "Tumbuhan menyerap oksigen dan melepaskan karbon dioksida sebagai satu-satunya proses pertukaran gas sepanjang hidupnya.", "S", "Tumbuhan juga melakukan fotosintesis."],
          ["5", "Perubahan wujud dari gas menjadi cair disebut kondensasi atau pengembunan.", "B", "Kondensasi adalah perubahan wujud gas menjadi cair."],
          ["6", "Candi Borobudur merupakan salah satu warisan budaya Indonesia yang bercorak Buddha.", "B", "Candi Borobudur bercorak Buddha Mahayana."],
          ["7", "Jika harga barang Rp80.000 naik 25%, harga akhirnya menjadi Rp100.000.", "B", "25% x Rp80.000 = Rp20.000. Total = Rp100.000."],
          ["8", "Semua benda yang tenggelam di air memiliki massa lebih besar daripada semua benda yang mengapung, tanpa dipengaruhi ukuran dan volume benda.", "S", "Ditentukan massa jenis dan gaya apung."],
          ["9", "Dalam rantai makanan, energi yang tersedia umumnya semakin berkurang pada tingkat trofik yang lebih tinggi.", "B", "Terjadi penyusutan energi antartingkat trofik."],
          ["10", "Jika rata-rata lima bilangan adalah 12, jumlah kelima bilangan tersebut adalah 60.", "B", "Jumlah = 5 x 12 = 60."],
          ["11", "Semua persegi merupakan persegi panjang, tetapi semua persegi panjang belum tentu merupakan persegi.", "B", "Persegi memenuhi seluruh sifat persegi panjang."],
          ["12", "Bunyi dapat merambat melalui ruang hampa tanpa medium.", "S", "Bunyi memerlukan medium untuk merambat."],
          ["13", "Jika dua bilangan positif memiliki hasil kali 36, jumlah kedua bilangan tersebut pasti 13.", "S", "Contoh 6x6=36 menghasilkan jumlah 12."],
          ["14", "ASEAN didirikan pada 8 Agustus 1967 di Bangkok, Thailand.", "B", "Deklarasi Bangkok, 8 Agustus 1967."],
          ["15", "Dalam demokrasi, hasil pemungutan suara selalu membuat semua orang memperoleh pilihan yang mereka inginkan.", "S", "Keputusan diambil berdasarkan suara mayoritas."],
          ["16", "Jika jarak pada peta semakin besar, jarak sebenarnya pasti semakin besar meskipun skala petanya berbeda.", "S", "Perlu memperhitungkan skala peta."],
          ["17", "Pada rangkaian listrik paralel, setiap cabang memiliki jalur arus tersendiri.", "B", "Rangkaian paralel memiliki cabang arus."],
          ["18", "Jika suatu pernyataan berbunyi 'Semua peserta yang lolos adalah siswa kelas IX', maka dapat dipastikan bahwa semua siswa kelas IX lolos.", "S", "Tidak berarti semua siswa kelas IX lolos."]
        ];
        bsData.forEach(r => {
          t1Rows.push(new TableRow({
            children: [
              createCell(r[0], 8, AlignmentType.CENTER),
              createCell(r[1], 52),
              createCell(r[2], 14, AlignmentType.CENTER),
              createCell(r[3], 26)
            ]
          }));
        });

        const t2Rows = [
          new TableRow({
            children: [
              createHeaderCell("No", 5),
              createHeaderCell("Kategori", 12),
              createHeaderCell("Pertanyaan & Gambar (Rumus LaTeX $...$)", 39),
              createHeaderCell("Pilihan A", 10),
              createHeaderCell("Pilihan B", 10),
              createHeaderCell("Pilihan C", 10),
              createHeaderCell("Pilihan D", 10),
              createHeaderCell("Kunci", 4)
            ]
          })
        ];
        const pgData = [
          ["1", "PG150", "Negara yang dijuluki Negeri Matahari Terbit adalah ...", "Tiongkok", "Jepang", "Korea Selatan", "Thailand", "B"],
          ["2", "PG150", "Hasil dari $125 : 5 + 7 \\times 3$ adalah ...", "32", "42", "46", "60", "C"],
          ["3", "PG150", "Tokoh yang dikenal sebagai Proklamator Kemerdekaan Indonesia bersama Mohammad Hatta adalah ...", "Ki Hajar Dewantara", "Jenderal Sudirman", "Soekarno", "Soepomo", "C"],
          ["4", "PG150", "Organ tubuh manusia yang berfungsi menyaring darah dan menghasilkan urine adalah ...", "Jantung", "Ginjal", "Paru-paru", "Lambung", "B"],
          ["5", "PG150", "Benua terbesar di dunia berdasarkan luas wilayah adalah ...", "Afrika", "Eropa", "Amerika Utara", "Asia", "D"],
          ["6", "PG150", "Sinonim kata cermat adalah ...", "Ceroboh", "Teliti", "Lambat", "Ragu-ragu", "B"],
          ["7", "PG200", "Sebuah persegi panjang memiliki panjang 12 cm dan lebar 5 cm. Kelilingnya adalah ...", "17 cm", "30 cm", "34 cm", "60 cm", "C"],
          ["8", "PG200", "Gas yang paling banyak terdapat di atmosfer Bumi adalah ...", "Oksigen", "Karbon dioksida", "Nitrogen", "Hidrogen", "C"],
          ["9", "PG200", "Sebuah tabung memiliki jari-jari $r = 7\\text{ cm}$ dan tinggi $t = 10\\text{ cm}$. Berapakah volumenya? ($\\pi = \\frac{22}{7}$)", "1.540 cm³", "770 cm³", "3.080 cm³", "154 cm³", "A"],
          ["10", "PG200", "Hasil operasi aljabar dari $(2x + 3)(x - 4)$ adalah ...", "$2x^2 - 5x - 12$", "$2x^2 + 5x - 12$", "$2x^2 - 11x - 12$", "$2x^2 - 5x + 12$", "A"]
        ];
        pgData.forEach(r => {
          t2Rows.push(new TableRow({
            children: [
              createCell(r[0], 5, AlignmentType.CENTER),
              createCell(r[1], 12, AlignmentType.CENTER),
              createCell(r[2], 39),
              createCell(r[3], 10),
              createCell(r[4], 10),
              createCell(r[5], 10),
              createCell(r[6], 10),
              createCell(r[7], 4, AlignmentType.CENTER)
            ]
          }));
        });

        const t3Rows = [
          new TableRow({
            children: [
              createHeaderCell("No", 8),
              createHeaderCell("Jenis Soal", 14),
              createHeaderCell("Pertanyaan Rebutan & Gambar (Rumus LaTeX $...$)", 48),
              createHeaderCell("Kunci Jawaban Dewan Juri", 30)
            ]
          })
        ];
        const esData = [
          ["1", "ES", "Tiga bilangan bulat positif berbeda memiliki jumlah 24. Bilangan terbesar dua kali bilangan terkecil, sedangkan bilangan tengah 4 lebih besar daripada bilangan terkecil. Tentukan ketiga bilangan tersebut!", "5, 9, dan 10. (Misal x, x+4, 2x => 4x+4=24 => x=5)."],
          ["2", "ES", "Sebuah toko menaikkan harga tas sebesar 20%, lalu mendiskonnya 20%. Jika harga awal Rp250.000, berapakah harga akhirnya? Apakah kembali ke harga awal?", "Rp240.000 (tidak kembali ke harga awal, karena dasar persentase berbeda)."],
          ["3", "ES", "Jika tanggal 1 suatu bulan jatuh pada hari Rabu, pada hari apakah hari ke-100 jatuh jika dihitung menurut siklus 7 hari?", "Hari Kamis. (Selisih 99 hari, 99 mod 7 = 1 hari setelah Rabu)."],
          ["4", "ES", "Dalam sebuah kelas, 30 siswa menyukai Matematika, 22 siswa menyukai IPA, dan 12 menyukai keduanya. Berapa jumlah siswa yang menyukai setidaknya salah satu pelajaran?", "40 siswa. (30 + 22 - 12 = 40)."],
          ["5", "CAD", "SOAL CADANGAN: Siapakah pencipta lagu kebangsaan Indonesia Raya?", "Wage Rudolf Supratman (W.R. Supratman)."],
          ["6", "CAD", "SOAL CADANGAN: Berapakah hasil dari $25 \\times 4 + 50$?", "150."]
        ];
        esData.forEach(r => {
          t3Rows.push(new TableRow({
            children: [
              createCell(r[0], 8, AlignmentType.CENTER),
              createCell(r[1], 14, AlignmentType.CENTER),
              createCell(r[2], 48),
              createCell(r[3], 30)
            ]
          }));
        });

        multiTables = [
          { title: "🟦 TABEL 1: SOAL BENAR / SALAH (BABAK 1 — 18 KOTAK)", rows: t1Rows },
          { title: "🟩 TABEL 2: SOAL PILIHAN GANDA (BABAK 2 & 3 — PG150 & PG200)", rows: t2Rows },
          { title: "🟨 TABEL 3: SOAL ESAI REBUTAN & CADANGAN (BABAK 4 & TIE-BREAK)", rows: t3Rows }
        ];
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

      const docChildren = [
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
        new Paragraph({ spacing: { after: 140 }, children: [] })
      ];

      if (multiTables && multiTables.length > 0) {
        multiTables.forEach(tObj => {
          docChildren.push(
            new Paragraph({
              spacing: { before: 180, after: 80 },
              children: [new TextRun({ text: tObj.title, bold: true, color: "1E3A8A", size: 21, font: "Calibri" })]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tObj.rows
            })
          );
        });
      } else {
        docChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows
          })
        );
      }

      const doc = new Document({
        sections: [{ children: docChildren }]
      });

      const blob = await window.docx.Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (stage === 'benar_salah' || stage === 'bs') ? `Template_Soal_Benar_Salah.docx` :
                   (stage === 'penyisihan') ? `Template_Soal_Penyisihan_Kelas_${j}.docx` :
                   (stage === 'semifinal') ? `Template_Soal_Semifinal.docx` : `Template_Soal_Grand_Final.docx`;
      a.click();
      URL.revokeObjectURL(url);
    },

    async exportStageBankToDocx(stage, jenjang = 7) {
      if (!window.docx) throw new Error('Library docx.js belum siap!');
      const j = parseInt(jenjang, 10) || 7;
      const isBs = (stage === 'benar_salah' || stage === 'bs');
      const queryStage = isBs ? 'semifinal' : stage;
      const rawQuestions = await this.getStageQuestions(queryStage, j);
      const questions = isBs ? rawQuestions.filter(q => q.tipe === 'BS') : rawQuestions;

      if (!questions || questions.length === 0) {
        throw new Error(`Bank soal babak ${stage.toUpperCase()} (Kelas ${j}) saat ini kosong. Tidak ada soal yang diekspor.`);
      }

      const {
        Document, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, BorderStyle, ImageRun
      } = window.docx;

      const borderThin = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
      const cellBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

      function createHeaderCell(text, width, align = AlignmentType.CENTER) {
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: { fill: "1E3A8A" },
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
          children: [new Paragraph({
            alignment: align,
            children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Calibri", size: 19 })]
          })]
        });
      }

      function createCell(content, width, align = AlignmentType.LEFT, imgInfo = null) {
        const textStr = (content == null || content === '') ? '-' : String(content);
        const lines = textStr.split('\n');
        const textRuns = [];
        lines.forEach((line, idx) => {
          textRuns.push(new TextRun({
            text: line,
            break: idx > 0 ? 1 : 0,
            font: "Calibri",
            size: 18,
            color: "0F172A"
          }));
        });

        const paragraphs = [
          new Paragraph({
            alignment: align,
            spacing: { after: imgInfo ? 80 : 0 },
            children: textRuns
          })
        ];

        if (imgInfo && imgInfo.bytes) {
          paragraphs.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 40 },
            children: [
              new ImageRun({
                data: imgInfo.bytes,
                transformation: { width: imgInfo.width, height: imgInfo.height }
              })
            ]
          }));
        }

        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: paragraphs
        });
      }

      // Pre-process all images in parallel
      const imageInfoMap = {};
      await Promise.all(questions.map(async (q) => {
        if (q.img) {
          try {
            const info = await getImageBytesAndDimensions(q.img);
            if (info) imageInfoMap[q.id] = info;
          } catch (e) {}
        }
      }));

      const rows = [];
      let multiTables = null;
      let docTitle = "";
      let docSubtitle = "";

      if (stage === 'penyisihan') {
        docTitle = `BANK SOAL RESMI: BABAK PENYISIHAN (KELAS ${j})`;
        docSubtitle = `Kejuaraan Cerdas Cermat Multidisiplin IFP — Total ${questions.length} Soal — Format Resmi 8 Kolom`;

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

        questions.forEach((q, i) => {
          const imgInfo = imageInfoMap[q.id] || null;
          let keyLetter = 'A';
          if (q.k != null && q.k >= 0 && q.k <= 3) {
            keyLetter = 'ABCD'[q.k];
          } else if (q.key != null && q.key >= 0 && q.key <= 3) {
            keyLetter = 'ABCD'[q.key];
          } else if (typeof q.k === 'string' && /^[A-D]$/i.test(q.k)) {
            keyLetter = q.k.toUpperCase();
          } else if (typeof q.key === 'string' && /^[A-D]$/i.test(q.key)) {
            keyLetter = q.key.toUpperCase();
          } else if (q.ans && q.o && Array.isArray(q.o)) {
            const idx = q.o.findIndex(opt => opt.trim() === String(q.ans).trim());
            if (idx !== -1) keyLetter = 'ABCD'[idx];
          }

          const optA = (q.o && q.o[0] != null) ? q.o[0] : '';
          const optB = (q.o && q.o[1] != null) ? q.o[1] : '';
          const optC = (q.o && q.o[2] != null) ? q.o[2] : '';
          const optD = (q.o && q.o[3] != null) ? q.o[3] : '';

          rows.push(new TableRow({
            children: [
              createCell(String(i + 1), 5, AlignmentType.CENTER),
              createCell(q.mapel || 'Pendidikan Agama', 18),
              createCell(q.q || '', 37, AlignmentType.LEFT, imgInfo),
              createCell(optA, 10),
              createCell(optB, 10),
              createCell(optC, 10),
              createCell(optD, 10),
              createCell(keyLetter, 6, AlignmentType.CENTER)
            ]
          }));
        });
      } else if (stage === 'benar_salah' || stage === 'bs') {
        const bsQuestions = questions.filter(q => q.tipe === 'BS');
        docTitle = "BANK SOAL RESMI: BENAR / SALAH (TRUE / FALSE)";
        docSubtitle = `Kejuaraan Cerdas Cermat Multidisiplin IFP — Total ${bsQuestions.length} Soal — Format Standar 4 Kolom Bersih`;

        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 8),
            createHeaderCell("Pernyataan / Soal & Gambar (Rumus LaTeX $...$)", 52),
            createHeaderCell("Kunci (B / S)", 14),
            createHeaderCell("Keterangan / Pembahasan (Opsional)", 26)
          ]
        }));

        bsQuestions.forEach((q, i) => {
          const imgInfo = imageInfoMap[q.id] || null;
          const isSalah = (q.key === 1 || q.k === 1 || String(q.ans).toLowerCase() === 'salah' || String(q.ans).toLowerCase() === 's');
          const keyVal = isSalah ? 'S' : 'B';
          const desc = q.desc || (isSalah ? 'Pernyataan Salah' : 'Pernyataan Benar');

          rows.push(new TableRow({
            children: [
              createCell(String(i + 1), 8, AlignmentType.CENTER),
              createCell(q.q || '', 52, AlignmentType.LEFT, imgInfo),
              createCell(keyVal, 14, AlignmentType.CENTER),
              createCell(desc, 26)
            ]
          }));
        });
      } else if (stage === 'semifinal') {
        docTitle = "BANK SOAL RESMI: BABAK SEMIFINAL";
        docSubtitle = `Kejuaraan Cerdas Cermat Multidisiplin IFP — Total ${questions.length} Soal — Format Multi-Tabel Resmi`;

        const bsQuestions = questions.filter(q => q.tipe === 'BS');
        const pgQuestions = questions.filter(q => q.tipe === 'PG1' || q.tipe === 'PG2');
        const esQuestions = questions.filter(q => q.tipe !== 'BS' && q.tipe !== 'PG1' && q.tipe !== 'PG2');

        // Table 1: Benar / Salah (4 Kolom Bersih)
        const t1Rows = [
          new TableRow({
            children: [
              createHeaderCell("No", 8),
              createHeaderCell("Pernyataan / Soal & Gambar (Rumus LaTeX $...$)", 52),
              createHeaderCell("Kunci (B / S)", 14),
              createHeaderCell("Keterangan / Pembahasan (Opsional)", 26)
            ]
          })
        ];

        bsQuestions.forEach((q, i) => {
          const imgInfo = imageInfoMap[q.id] || null;
          const isSalah = (q.key === 1 || q.k === 1 || String(q.ans).toLowerCase() === 'salah' || String(q.ans).toLowerCase() === 's');
          const keyVal = isSalah ? 'S' : 'B';
          const desc = q.desc || (isSalah ? 'Pernyataan Salah' : 'Pernyataan Benar');
          t1Rows.push(new TableRow({
            children: [
              createCell(String(i + 1), 8, AlignmentType.CENTER),
              createCell(q.q || '', 52, AlignmentType.LEFT, imgInfo),
              createCell(keyVal, 14, AlignmentType.CENTER),
              createCell(desc, 26)
            ]
          }));
        });

        // Table 2: Pilihan Ganda PG1 & PG2 (8 Kolom)
        const t2Rows = [
          new TableRow({
            children: [
              createHeaderCell("No", 5),
              createHeaderCell("Kategori", 12),
              createHeaderCell("Pertanyaan & Gambar (Rumus LaTeX $...$)", 39),
              createHeaderCell("Pilihan A", 10),
              createHeaderCell("Pilihan B", 10),
              createHeaderCell("Pilihan C", 10),
              createHeaderCell("Pilihan D", 10),
              createHeaderCell("Kunci", 4)
            ]
          })
        ];

        pgQuestions.forEach((q, i) => {
          const imgInfo = imageInfoMap[q.id] || null;
          const keyIdx = (q.key != null) ? q.key : (q.k != null ? q.k : 0);
          const keyVal = (keyIdx >= 0 && keyIdx <= 3) ? 'ABCD'[keyIdx] : 'A';
          const optA = (q.o && q.o[0] != null) ? q.o[0] : '';
          const optB = (q.o && q.o[1] != null) ? q.o[1] : '';
          const optC = (q.o && q.o[2] != null) ? q.o[2] : '';
          const optD = (q.o && q.o[3] != null) ? q.o[3] : '';

          t2Rows.push(new TableRow({
            children: [
              createCell(String(i + 1), 5, AlignmentType.CENTER),
              createCell(q.tipe || 'PG1', 12, AlignmentType.CENTER),
              createCell(q.q || '', 39, AlignmentType.LEFT, imgInfo),
              createCell(optA, 10),
              createCell(optB, 10),
              createCell(optC, 10),
              createCell(optD, 10),
              createCell(keyVal, 4, AlignmentType.CENTER)
            ]
          }));
        });

        // Table 3: Esai Rebutan & Cadangan (4 Kolom)
        const t3Rows = [
          new TableRow({
            children: [
              createHeaderCell("No", 8),
              createHeaderCell("Jenis Soal", 14),
              createHeaderCell("Pertanyaan Rebutan & Gambar (Rumus LaTeX $...$)", 48),
              createHeaderCell("Kunci Jawaban Dewan Juri", 30)
            ]
          })
        ];

        esQuestions.forEach((q, i) => {
          const imgInfo = imageInfoMap[q.id] || null;
          t3Rows.push(new TableRow({
            children: [
              createCell(String(i + 1), 8, AlignmentType.CENTER),
              createCell(q.tipe || 'ES', 14, AlignmentType.CENTER),
              createCell(q.q || '', 48, AlignmentType.LEFT, imgInfo),
              createCell(q.ans || '', 30)
            ]
          }));
        });

        multiTables = [
          { title: `🟦 BAGIAN 1: SOAL BENAR / SALAH (BABAK 1 — ${bsQuestions.length} SOAL)`, rows: t1Rows },
          { title: `🟩 BAGIAN 2: SOAL PILIHAN GANDA (BABAK 2 & 3 — ${pgQuestions.length} SOAL)`, rows: t2Rows },
          { title: `🟨 BAGIAN 3: SOAL ESAI REBUTAN & CADANGAN (BABAK 4 — ${esQuestions.length} SOAL)`, rows: t3Rows }
        ];
      } else {
        // Grand Final
        docTitle = "BANK SOAL RESMI: BABAK GRAND FINAL";
        docSubtitle = `Kejuaraan Cerdas Cermat Multidisiplin IFP — Total ${questions.length} Soal — Format Resmi 4 Kolom`;

        rows.push(new TableRow({
          children: [
            createHeaderCell("No", 8),
            createHeaderCell("Kategori & Poin Kotak", 24),
            createHeaderCell("Pertanyaan Rebutan Panggung", 44),
            createHeaderCell("Kunci Jawaban Dewan Juri", 24)
          ]
        }));

        questions.forEach((q, i) => {
          const imgInfo = imageInfoMap[q.id] || null;
          const tier = q.tier || (i < 5 ? 'Tier 1 (50 Poin)' : i < 10 ? 'Tier 2 (75 Poin)' : i < 15 ? 'Tier 3 (100 Poin)' : 'Soal Tambahan (100 Poin)');

          rows.push(new TableRow({
            children: [
              createCell(String(i + 1), 8, AlignmentType.CENTER),
              createCell(tier, 24),
              createCell(q.q || '', 44, AlignmentType.LEFT, imgInfo),
              createCell(q.ans || '', 24)
            ]
          }));
        });
      }

      const exportDateStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const docBodyElements = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: docTitle, bold: true, color: "1E3A8A", size: 28, font: "Calibri" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: `${docSubtitle} • Diekspor pada ${exportDateStr}`, italics: true, color: "475569", size: 19, font: "Calibri" })]
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: "📋 KETENTUAN PENGGUNAAN DOKUMEN:", bold: true, color: "D97706", size: 20, font: "Calibri" })]
        }),
        new Paragraph({
          spacing: { after: 30 },
          bullet: { level: 0 },
          children: [new TextRun({ text: "Dokumen ini diekspor langsung dari Bank Soal Cerdas Cermat IFP dengan mempertahankan 100% format asli (tabel, rumus LaTeX $...$, gambar, opsi pilihan A-D, dan kunci jawaban).", size: 18, font: "Calibri", color: "334155" })]
        }),
        new Paragraph({
          spacing: { after: 120 },
          bullet: { level: 0 },
          children: [new TextRun({ text: "Dokumen ini dapat langsung diedit di Microsoft Word dan diimpor kembali ke Bank Soal secara otomatis.", size: 18, font: "Calibri", color: "334155" })]
        })
      ];

      if (multiTables && multiTables.length > 0) {
        multiTables.forEach(tObj => {
          docBodyElements.push(
            new Paragraph({
              spacing: { before: 180, after: 80 },
              children: [new TextRun({ text: tObj.title, bold: true, color: "1E3A8A", size: 21, font: "Calibri" })]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tObj.rows
            })
          );
        });
      } else {
        docBodyElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows
          })
        );
      }

      const doc = new Document({
        sections: [{ children: docBodyElements }]
      });

      const blob = await window.docx.Packer.toBlob(doc);
      if (typeof document !== 'undefined') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (stage === 'benar_salah' || stage === 'bs') ? `Bank_Soal_Benar_Salah_Resmi.docx` :
                     (stage === 'penyisihan') ? `Bank_Soal_Penyisihan_Kelas_${j}.docx` :
                     (stage === 'semifinal') ? `Bank_Soal_Semifinal_Resmi.docx` : `Bank_Soal_${stage.toUpperCase()}.docx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }

      return {
        stage,
        jenjang: j,
        count: questions.length,
        blob
      };
    },

    async exportBenarSalahBankToDocx() {
      return this.exportStageBankToDocx('benar_salah');
    },

    async exportAllPenyisihanBanksToDocx() {
      for (const j of [7, 8, 9]) {
        await this.exportStageBankToDocx('penyisihan', j);
        await new Promise(r => setTimeout(r, 450));
      }
      return true;
    }
  };

  window.DocxEngine = DocxEngine;
})(window);
