/**
 * Unified Storage Engine (IndexedDB + Auto-Migration + Dual-Sync Bridge)
 * Centralizes stage-specific settings, isolated question banks, and tournament state.
 * Bridges seamlessly with legacy IndexedDB ('cerdascermat') and localStorage ('cc-final3').
 */
(function(window) {
  'use strict';

  const DB_NAME = 'cerdascermat_portal_v2';
  const DB_VERSION = 1;

  let dbPromise = null;
  let legacyDbPromise = null;

  function openDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.createObjectStore('kv');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function openLegacyDB() {
    if (!legacyDbPromise) {
      legacyDbPromise = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open('cerdascermat', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('kv')) {
              db.createObjectStore('kv');
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      });
    }
    return legacyDbPromise;
  }

  async function get(key) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('kv', 'readonly');
        const store = tx.objectStore('kv');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });
    } catch (e) {
      return undefined;
    }
  }

  async function set(key, val) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        const req = store.put(val, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return false;
    }
  }

  async function getLegacy(key) {
    try {
      const db = await openLegacyDB();
      return new Promise((resolve) => {
        const tx = db.transaction('kv', 'readonly');
        const store = tx.objectStore('kv');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });
    } catch (e) {
      return undefined;
    }
  }

  async function setLegacy(key, val) {
    try {
      const db = await openLegacyDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        const req = store.put(val, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return false;
    }
  }

  const defaultEventConfig = {
    title: 'CERDAS CERMAT IFP TINGKAT SMP',
    schoolName: 'SMP NEGERI 1 KABUPATEN',
    eventDate: new Date().toISOString().split('T')[0],
    subTitle: 'Kompetisi Interaktif Multidisiplin Berbasis Smart Screen IFP',
    chairmanName: 'Drs. H. Ahmad Fauzi, M.Pd.',
    juryChiefName: 'Dr. Hj. Siti Rahmawati, M.Si.',
    principalName: 'H. Bambang Irawan, S.Pd., M.M.',
    theme: 'dark',
    sound: true
  };

  // ─── CLOUD DATABASE BRIDGE (NEON POSTGRESQL API) ─────────────
  async function cloudSyncPost(endpoint, payload) {
    if (typeof window === 'undefined' || !window.fetch) return false;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        return data && data.success;
      }
      return false;
    } catch (e) {
      console.warn('cloudSyncPost error:', e);
      return false;
    }
  }

  const Storage = {
    get,
    set,
    getLegacy,
    setLegacy,

    async checkCloudDatabase() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          return data && data.status === 'online' ? data : null;
        }
      } catch (e) {}
      return null;
    },

    async syncFromCloud() {
      try {
        const cloud = await this.checkCloudDatabase();
        if (!cloud) return { success: false, reason: 'offline' };

        // 1. Config sync
        const resCfg = await fetch('/api/config');
        if (resCfg.ok) {
          const dataCfg = await resCfg.json();
          if (dataCfg && dataCfg.config) {
            await set('event_config', dataCfg.config);
          }
        }

        // 2. Question Banks sync for all stages from PostgreSQL
        const resB = await fetch('/api/banks?stage=all');
        let totalCount = 0;
        let stagesCount = { penyisihan_7: 0, penyisihan_8: 0, penyisihan_9: 0, semifinal: 0, final: 0 };

        if (resB.ok) {
          const dataB = await resB.json();
          if (dataB && dataB.success && Array.isArray(dataB.questions) && dataB.questions.length > 0) {
            const allQ = dataB.questions;
            totalCount = allQ.length;

            const p7 = allQ.filter(q => q.stage === 'penyisihan_7' || q.jenjang === 7);
            const p8 = allQ.filter(q => q.stage === 'penyisihan_8' || q.jenjang === 8);
            const p9 = allQ.filter(q => q.stage === 'penyisihan_9' || q.stage === 'penyisihan' || q.jenjang === 9);
            const semi = allQ.filter(q => q.stage === 'semifinal');
            const fin = allQ.filter(q => q.stage === 'final');

            stagesCount = {
              penyisihan_7: p7.length,
              penyisihan_8: p8.length,
              penyisihan_9: p9.length,
              semifinal: semi.length,
              final: fin.length
            };

            // 2a. Hydrate Legacy Penyisihan DB ('bank' in 'cerdascermat')
            let b = (await getLegacy('bank')) || { mapel: [], soal: { 7: [], 8: [], 9: [] } };
            b.soal = b.soal || { 7: [], 8: [], 9: [] };
            if (p7.length > 0) { b.soal[7] = p7; localStorage.removeItem('cc_cleared_penyisihan_7'); }
            if (p8.length > 0) { b.soal[8] = p8; localStorage.removeItem('cc_cleared_penyisihan_8'); }
            if (p9.length > 0) { b.soal[9] = p9; localStorage.removeItem('cc_cleared_penyisihan_9'); }
            if (p7.length > 0 || p8.length > 0 || p9.length > 0) {
              localStorage.removeItem('cc_cleared_penyisihan');
            }

            const mapelSet = new Set((b.mapel || []).map(m => (typeof m === 'string' ? m : m.n)));
            [...p7, ...p8, ...p9].forEach(q => {
              if (q.mapel && !mapelSet.has(q.mapel)) {
                b.mapel.push({ n: q.mapel, k: 0 });
                mapelSet.add(q.mapel);
              }
            });
            await setLegacy('bank', b);

            // Hydrate portal v2 IndexedDB
            await set('bank_penyisihan_7', p7);
            await set('bank_penyisihan_8', p8);
            await set('bank_penyisihan_9', p9);
            await set('bank_penyisihan', p9);

            // 2b. Hydrate Semifinal DB ('bank3' in 'cerdascermat')
            if (semi.length > 0) {
              await setLegacy('bank3', { soal: semi });
              await set('bank_semifinal', semi);
              localStorage.removeItem('cc_cleared_semifinal');
            }

            // 2c. Hydrate Grand Final ('cc-final3' in localStorage)
            if (fin.length > 0) {
              let curFinal = {};
              try { curFinal = JSON.parse(localStorage.getItem('cc-final3') || '{}'); } catch(e) {}
              curFinal.q = fin.map(q => q.img ? `${q.q} ||| ${q.ans} ||| img:${q.img}` : `${q.q} ||| ${q.ans}`).join('\n');
              curFinal.qObj = fin;
              localStorage.setItem('cc-final3', JSON.stringify(curFinal));
              await set('bank_final', fin);
              localStorage.removeItem('cc_cleared_final');
            }

            // 2d. Reload active iframes if available to reflect changes live
            ['frame-penyisihan', 'frame-semifinal', 'frame-final'].forEach(id => {
              const frame = document.getElementById(id);
              if (frame && frame.contentWindow) {
                try { frame.contentWindow.location.reload(); } catch(e) {}
              }
            });
          }
        }

        return { success: true, count: totalCount, stages: stagesCount };
      } catch (e) {
        console.warn('Sync from cloud error:', e);
        return { success: false, reason: e.message };
      }
    },

    async getConfig() {
      const saved = await get('event_config');
      return Object.assign({}, defaultEventConfig, saved || {});
    },
    async saveConfig(cfg) {
      cloudSyncPost('/api/config', cfg);
      return set('event_config', cfg);
    },

    // ─── STAGE-SPECIFIC QUESTION BANKS ─────────────────────────
    async getStageBank(stage) {
      const key = `bank_${stage}`;
      const clearKey = `cc_cleared_${stage}`;
      let bank = await get(key);
      const isCleared = (localStorage.getItem(clearKey) === 'true') ||
                        (stage === 'penyisihan' && (
                          localStorage.getItem('cc_cleared_penyisihan_7') === 'true' ||
                          localStorage.getItem('cc_cleared_penyisihan_8') === 'true' ||
                          localStorage.getItem('cc_cleared_penyisihan_9') === 'true' ||
                          localStorage.getItem('cc_cleared_penyisihan') === 'true'
                        ));
      if ((!bank || !Array.isArray(bank) || bank.length === 0) && !isCleared) {
        if (window.DEFAULT_BANKS && window.DEFAULT_BANKS[stage]) {
          bank = JSON.parse(JSON.stringify(window.DEFAULT_BANKS[stage]));
          await set(key, bank);
        } else {
          bank = [];
        }
      }
      return bank || [];
    },
    async saveStageBank(stage, questions) {
      if (questions && questions.length === 0) {
        localStorage.setItem(`cc_cleared_${stage}`, 'true');
      } else if (questions && questions.length > 0) {
        localStorage.removeItem(`cc_cleared_${stage}`);
      }
      await set(`bank_${stage}`, questions);
      const cloudSuccess = await cloudSyncPost('/api/banks', { stage, questions });
      return { success: true, cloud: cloudSuccess };
    },

    // ─── BABAK 1: PENYISIHAN ───────────────────────────────────
    async getPenyisihanState() {
      let legacySkor = await getLegacy('skor');
      let legacyCfg = await getLegacy('cfg');

      let state = await get('state_penyisihan');
      if (!state) {
        const defaultTeams = ['9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I'];
        state = {
          cfg: {
            jenjang: 9,
            nTim: 9,
            tim: { 7: ['7A','7B','7C','7D','7E','7F','7G','7H','7I'], 8: ['8A','8B','8C','8D','8E','8F','8G','8H','8I'], 9: defaultTeams },
            gel: 0,
            anak: 10,
            wSoal: 30,
            gMenit: 30,
            poin: 2,
            penalti: 0,
            mode: 'batas',
            kunci: true,
            label: true,
            pin: ''
          },
          skor: { 7: {}, 8: {}, 9: {} }
        };
      }

      if (legacyCfg) state.cfg = Object.assign({}, state.cfg, legacyCfg);
      if (legacySkor) state.skor = Object.assign({ 7: {}, 8: {}, 9: {} }, state.skor, legacySkor);

      await set('state_penyisihan', state);
      return state;
    },
    async savePenyisihanState(state) {
      cloudSyncPost('/api/state', { stage: 'penyisihan', config: state.cfg, state_data: { skor: state.skor } });
      if (state.cfg) await setLegacy('cfg', state.cfg);
      if (state.skor) await setLegacy('skor', state.skor);
      return set('state_penyisihan', state);
    },

    // ─── BABAK 2: SEMIFINAL ─────────────────────────────────────
    async getSemifinalState() {
      let legacyCfg3 = await getLegacy('cfg3');
      let legacyGame3 = await getLegacy('game3');

      let state = await get('state_semifinal');
      if (!state) {
        const defaultTeams = ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5', 'Tim 6', 'Tim 7', 'Tim 8', 'Tim 9'];
        const jenis = [
          { k: 'BS', n: 'Benar / Salah', cnt: 18, val: 100, sec: 20 },
          { k: 'PG1', n: 'Pilihan Ganda I', cnt: 9, val: 150, sec: 30 },
          { k: 'PG2', n: 'Pilihan Ganda II', cnt: 9, val: 200, sec: 45 },
          { k: 'ES', n: 'Essay', cnt: 9, val: 300, sec: 90 }
        ];
        state = {
          cfg: {
            nTim: 9,
            tim: defaultTeams,
            lolos: 5,
            awal: 'undi',
            ronde: 'geser',
            suara: true,
            pin: '',
            jenis: jenis
          },
          game: null
        };
      }

      if (legacyCfg3) state.cfg = Object.assign({}, state.cfg, legacyCfg3);
      if (legacyGame3) state.game = legacyGame3;

      await set('state_semifinal', state);
      return state;
    },
    async saveSemifinalState(state) {
      cloudSyncPost('/api/state', { stage: 'semifinal', config: state.cfg, state_data: { game: state.game } });
      if (state.cfg) await setLegacy('cfg3', state.cfg);
      if (state.game) await setLegacy('game3', state.game);
      return set('state_semifinal', state);
    },

    // ─── BABAK 3: GRAND FINAL ───────────────────────────────────
    async getFinalState() {
      // Prioritize live state from Grand Final localStorage ('cc-final3')
      try {
        const local = localStorage.getItem('cc-final3');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed && Array.isArray(parsed.score) && Array.isArray(parsed.names)) {
            await set('state_final', parsed);
            return parsed;
          }
        }
      } catch (e) {}

      let state = await get('state_final');
      if (!state) {
        const defaultTeams = ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5'];
        state = {
          title: 'CERDAS CERMAT FINAL',
          n: 5,
          init: 100,
          dur: 90,
          np: 5,
          snd: 1,
          rb: 0,
          names: defaultTeams,
          score: Array(5).fill(100),
          done: Array(15).fill(false),
          started: false
        };
        await set('state_final', state);
        try {
          localStorage.setItem('cc-final3', JSON.stringify(state));
        } catch (e) {}
      }
      return state;
    },
    async saveFinalState(state) {
      cloudSyncPost('/api/state', {
        stage: 'final',
        config: { title: state.title, n: state.n, init: state.init, dur: state.dur, np: state.np, snd: state.snd, rb: state.rb },
        state_data: { names: state.names, score: state.score, done: state.done, started: state.started }
      });
      try {
        localStorage.setItem('cc-final3', JSON.stringify(state));
      } catch (e) {}
      return set('state_final', state);
    },

    // ─── TOURNAMENT PROGRESSION (AUTO-SYNC) ─────────────────────
    async advancePenyisihanToSemifinal() {
      const penyisihan = await this.getPenyisihanState();
      const j = (penyisihan.cfg && penyisihan.cfg.jenjang) || 9;
      const skorMap = (penyisihan.skor && penyisihan.skor[j]) || {};
      const timList = (penyisihan.cfg && penyisihan.cfg.tim && penyisihan.cfg.tim[j]) || [];

      const aggregated = [];
      timList.forEach((tName, i) => {
        const sc = skorMap[tName] != null ? skorMap[tName] : (skorMap[i] != null ? skorMap[i] : 0);
        aggregated.push({ name: tName, score: sc });
      });

      aggregated.sort((a, b) => b.score - a.score);
      const top9 = aggregated.slice(0, 9).map(t => t.name);

      let semi = (await this.getSemifinalState()) || {};
      semi.cfg = semi.cfg || { nTim: 9, tim: [] };
      semi.cfg.nTim = top9.length;
      semi.cfg.tim = top9;
      semi.game = null; // reset game with new qualified teams

      await this.saveSemifinalState(semi);
      return top9;
    },

    async advanceSemifinalToFinal() {
      const semi = await this.getSemifinalState();
      let top5 = [];

      if (semi && semi.game && semi.game.teams) {
        const teams = semi.game.teams.map((t, i) => ({
          name: t.name || (semi.cfg && semi.cfg.tim && semi.cfg.tim[i]) || `Tim ${i+1}`,
          score: t.score || 0
        }));
        teams.sort((a, b) => b.score - a.score);
        top5 = teams.slice(0, 5).map(t => t.name);
      } else if (semi && semi.cfg && semi.cfg.tim) {
        top5 = semi.cfg.tim.slice(0, 5);
      } else {
        top5 = ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5'];
      }

      let finalState = (await this.getFinalState()) || {};
      finalState.n = top5.length;
      finalState.names = top5;
      finalState.init = 100;
      finalState.score = Array(top5.length).fill(100);
      finalState.done = Array(15).fill(false);
      finalState.started = false;

      await this.saveFinalState(finalState);
      return top5;
    },

    // ─── SYNCHRONIZATION & ANTI-DUPLICATION MANAGER ────────────
    normalizeQuestionKey(str) {
      return String(str || '')
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/["'“”‘’`]/g, '')
        .replace(/[.,:;?!]+$/g, '')
        .trim();
    },

    deduplicateQuestions(items = []) {
      const map = new Map();
      items.forEach(it => {
        const k = this.normalizeQuestionKey(it.q || it.question);
        if (!k) return;
        if (!map.has(k)) {
          map.set(k, Object.assign({}, it));
        } else {
          const ex = map.get(k);
          if (!ex.img && (it.img || it.image_url)) {
            ex.img = it.img || it.image_url;
          }
          const exOpts = Array.isArray(ex.o) ? ex.o : [];
          const newOpts = Array.isArray(it.o) ? it.o : [];
          if (exOpts.length === 0 && newOpts.length > 0) {
            ex.o = newOpts;
          }
          const exAns = String(ex.ans || ex.answer_key || '');
          const newAns = String(it.ans || it.answer_key || '');
          if (newAns.length > exAns.length) {
            ex.ans = newAns;
          }
        }
      });
      return Array.from(map.values());
    },

    async getSyncStats() {
      let cloudConnected = false;
      let cloudQuestions = [];

      try {
        const res = await fetch('/api/banks?stage=all', { cache: 'no-cache' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.questions)) {
            cloudConnected = true;
            cloudQuestions = data.questions;
          }
        }
      } catch (e) {
        cloudConnected = false;
      }

      const p7_c = cloudQuestions.filter(q => q.stage === 'penyisihan_7' || q.jenjang === 7);
      const p8_c = cloudQuestions.filter(q => q.stage === 'penyisihan_8' || q.jenjang === 8);
      const p9_c = cloudQuestions.filter(q => q.stage === 'penyisihan_9' || q.stage === 'penyisihan' || q.jenjang === 9);
      const semi_c = cloudQuestions.filter(q => q.stage === 'semifinal');
      const final_c = cloudQuestions.filter(q => q.stage === 'final');

      // Local questions
      const p7_l = (window.DocxEngine) ? (await window.DocxEngine.getStageQuestions('penyisihan', 7)) : [];
      const p8_l = (window.DocxEngine) ? (await window.DocxEngine.getStageQuestions('penyisihan', 8)) : [];
      const p9_l = (window.DocxEngine) ? (await window.DocxEngine.getStageQuestions('penyisihan', 9)) : [];
      const semi_l = (window.DocxEngine) ? (await window.DocxEngine.getStageQuestions('semifinal')) : [];
      const final_l = (window.DocxEngine) ? (await window.DocxEngine.getStageQuestions('final')) : [];

      const countDuplicates = (list) => {
        const seen = new Set();
        let dupes = 0;
        (list || []).forEach(q => {
          const k = this.normalizeQuestionKey(q.q || q.question);
          if (k) {
            if (seen.has(k)) dupes++;
            else seen.add(k);
          }
        });
        return dupes;
      };

      const countCrossDuplicates = (listA, listB) => {
        const setA = new Set((listA || []).map(q => this.normalizeQuestionKey(q.q || q.question)).filter(Boolean));
        let dupes = 0;
        (listB || []).forEach(q => {
          const k = this.normalizeQuestionKey(q.q || q.question);
          if (k && setA.has(k)) dupes++;
        });
        return dupes;
      };

      const stages = {
        penyisihan_7: {
          name: 'Penyisihan Kelas 7',
          local: p7_l.length,
          cloud: p7_c.length,
          localDupes: countDuplicates(p7_l),
          cloudDupes: countDuplicates(p7_c),
          crossMatches: countCrossDuplicates(p7_l, p7_c)
        },
        penyisihan_8: {
          name: 'Penyisihan Kelas 8',
          local: p8_l.length,
          cloud: p8_c.length,
          localDupes: countDuplicates(p8_l),
          cloudDupes: countDuplicates(p8_c),
          crossMatches: countCrossDuplicates(p8_l, p8_c)
        },
        penyisihan_9: {
          name: 'Penyisihan Kelas 9',
          local: p9_l.length,
          cloud: p9_c.length,
          localDupes: countDuplicates(p9_l),
          cloudDupes: countDuplicates(p9_c),
          crossMatches: countCrossDuplicates(p9_l, p9_c)
        },
        semifinal: {
          name: 'Babak Semifinal',
          local: semi_l.length,
          cloud: semi_c.length,
          localDupes: countDuplicates(semi_l),
          cloudDupes: countDuplicates(semi_c),
          crossMatches: countCrossDuplicates(semi_l, semi_c)
        },
        final: {
          name: 'Babak Grand Final',
          local: final_l.length,
          cloud: final_c.length,
          localDupes: countDuplicates(final_l),
          cloudDupes: countDuplicates(final_c),
          crossMatches: countCrossDuplicates(final_l, final_c)
        }
      };

      const totalLocal = p7_l.length + p8_l.length + p9_l.length + semi_l.length + final_l.length;
      const totalCloud = p7_c.length + p8_c.length + p9_c.length + semi_c.length + final_c.length;
      const totalDuplicates = Object.values(stages).reduce((sum, s) => sum + s.localDupes + s.cloudDupes, 0);

      return {
        cloudConnected,
        stages,
        totalLocal,
        totalCloud,
        totalDuplicates
      };
    },

    async smartMergeAllStages() {
      let cloudQuestions = [];
      try {
        const res = await fetch('/api/banks?stage=all', { cache: 'no-cache' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.questions)) {
            cloudQuestions = data.questions;
          }
        }
      } catch (e) {
        console.warn('Could not fetch cloud questions for smart merge:', e);
      }

      const stageConfigs = [
        { key: 'penyisihan_7', stage: 'penyisihan', jenjang: 7, cloudList: cloudQuestions.filter(q => q.stage === 'penyisihan_7' || q.jenjang === 7) },
        { key: 'penyisihan_8', stage: 'penyisihan', jenjang: 8, cloudList: cloudQuestions.filter(q => q.stage === 'penyisihan_8' || q.jenjang === 8) },
        { key: 'penyisihan_9', stage: 'penyisihan', jenjang: 9, cloudList: cloudQuestions.filter(q => q.stage === 'penyisihan_9' || q.stage === 'penyisihan' || q.jenjang === 9) },
        { key: 'semifinal', stage: 'semifinal', jenjang: null, cloudList: cloudQuestions.filter(q => q.stage === 'semifinal') },
        { key: 'final', stage: 'final', jenjang: null, cloudList: cloudQuestions.filter(q => q.stage === 'final') }
      ];

      let totalMergedCount = 0;
      let totalPurgedCount = 0;
      const results = {};

      for (const sc of stageConfigs) {
        const localList = (window.DocxEngine) ? (await window.DocxEngine.getStageQuestions(sc.stage, sc.jenjang || 7)) : [];
        const combined = [...localList, ...sc.cloudList];
        const deduped = this.deduplicateQuestions(combined);
        const purged = combined.length - deduped.length;

        totalMergedCount += deduped.length;
        totalPurgedCount += purged;
        results[sc.key] = { count: deduped.length, purged };

        if (window.DocxEngine) {
          await window.DocxEngine.saveStageQuestions(sc.stage, deduped, sc.jenjang || 7, false /* push to cloud */);
        }
      }

      return {
        success: true,
        totalMerged: totalMergedCount,
        totalPurged: totalPurgedCount,
        results
      };
    },

    async cleanAllDuplicates() {
      let totalPurged = 0;
      const stageConfigs = [
        { stage: 'penyisihan', jenjang: 7 },
        { stage: 'penyisihan', jenjang: 8 },
        { stage: 'penyisihan', jenjang: 9 },
        { stage: 'semifinal', jenjang: null },
        { stage: 'final', jenjang: null }
      ];

      for (const sc of stageConfigs) {
        if (!window.DocxEngine) continue;
        const curList = await window.DocxEngine.getStageQuestions(sc.stage, sc.jenjang || 7);
        const deduped = this.deduplicateQuestions(curList);
        const purged = curList.length - deduped.length;
        totalPurged += purged;
        if (purged > 0) {
          await window.DocxEngine.saveStageQuestions(sc.stage, deduped, sc.jenjang || 7, false);
        }
      }

      try {
        await fetch('/api/banks?action=clean_duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clean_duplicates' })
        });
      } catch (e) {}

      return {
        success: true,
        purgedCount: totalPurged
      };
    },

    async pushAllLocalToCloud() {
      const stageConfigs = [
        { stage: 'penyisihan_7', qStage: 'penyisihan', jenjang: 7 },
        { stage: 'penyisihan_8', qStage: 'penyisihan', jenjang: 8 },
        { stage: 'penyisihan_9', qStage: 'penyisihan', jenjang: 9 },
        { stage: 'semifinal', qStage: 'semifinal', jenjang: null },
        { stage: 'final', qStage: 'final', jenjang: null }
      ];

      let pushedTotal = 0;
      for (const sc of stageConfigs) {
        const localList = (window.DocxEngine) ? (await window.DocxEngine.getStageQuestions(sc.qStage, sc.jenjang || 7)) : [];
        const deduped = this.deduplicateQuestions(localList);
        await this.saveStageBank(sc.stage, deduped);
        pushedTotal += deduped.length;
      }

      return {
        success: true,
        pushedCount: pushedTotal
      };
    }
  };

  window.PortalStorage = Storage;
})(window);
