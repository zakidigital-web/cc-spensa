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
  function cloudSyncPost(endpoint, payload) {
    if (typeof window === 'undefined' || !window.fetch) return;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      })
      .then(() => { if (timer) clearTimeout(timer); })
      .catch(() => {});
    } catch (e) {}
  }

  const Storage = {
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
        if (!cloud) return false;

        const resCfg = await fetch('/api/config');
        if (resCfg.ok) {
          const dataCfg = await resCfg.json();
          if (dataCfg && dataCfg.config) {
            await set('event_config', dataCfg.config);
          }
        }

        for (const stage of ['penyisihan', 'semifinal', 'final']) {
          const resB = await fetch(`/api/banks?stage=${stage}`);
          if (resB.ok) {
            const dataB = await resB.json();
            if (dataB && Array.isArray(dataB.questions) && dataB.questions.length > 0) {
              await set(`bank_${stage}`, dataB.questions);
            }
          }
        }
        return true;
      } catch (e) {
        return false;
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
      let bank = await get(key);
      if (!bank || !Array.isArray(bank) || bank.length === 0) {
        if (window.DEFAULT_BANKS && window.DEFAULT_BANKS[stage]) {
          bank = JSON.parse(JSON.stringify(window.DEFAULT_BANKS[stage]));
          await set(key, bank);
        } else {
          bank = [];
        }
      }
      return bank;
    },
    async saveStageBank(stage, questions) {
      cloudSyncPost('/api/banks', { stage, questions });
      return set(`bank_${stage}`, questions);
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
    }
  };

  window.PortalStorage = Storage;
})(window);
