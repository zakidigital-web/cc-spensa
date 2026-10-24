/**
 * Database Seeder & State Manager for Cerdas Cermat Portal
 * Manages demo tournament simulation, initial seeds, clean state resets,
 * and JSON database backup/restore across IndexedDB and LocalStorage.
 */
(function(window) {
  'use strict';

  const DatabaseSeeder = {
    /**
     * Complete Tournament Simulation Seed Data
     */
    getSeedData() {
      const defaultBanks = window.DEFAULT_BANKS || {};
      const today = new Date().toISOString().split('T')[0];

      return {
        // 1. Identitas & Konfigurasi Kejuaraan
        event_config: {
          title: 'LOMBA CERDAS CERMAT IFP TINGKAT SMP TAHUN 2026',
          schoolName: 'SMP NEGERI 1 KABUPATEN',
          eventDate: today,
          subTitle: 'Kompetisi Interaktif Multidisiplin Berbasis Smart Screen IFP',
          chairmanName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          juryChiefName: 'Dr. Hj. Siti Rahmawati, M.Si.',
          principalName: 'H. Bambang Irawan, S.Pd., M.M.',
          theme: 'dark',
          sound: true
        },

        // 2. Bank Soal Babak 1: Kualifikasi Penyisihan (11 Mata Pelajaran)
        bank_penyisihan: defaultBanks.penyisihan || [],

        // 3. Bank Soal Babak 2: Semifinal (45 Kotak: BS, PG1, PG2, Essay)
        bank_semifinal: defaultBanks.semifinal || [],

        // 4. Bank Soal Babak 3: Grand Final (Tier 50, 75, 100 + Tie-Breaker)
        bank_final: defaultBanks.final || [],

        // 5. Riwayat Pertandingan Babak Penyisihan (9 Tim, 3 Gelombang, Jenjang 9)
        state_penyisihan: {
          cfg: {
            jenjang: 9,
            nTim: 9,
            tim: {
              7: ['7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H', '7I'],
              8: ['8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H', '8I'],
              9: [
                '9C - Phoenix', '9A - Garuda', '9D - Rajawali',
                '9B - Elang', '9E - Cendrawasih', '9F - Jalak',
                '9G - Merpati', '9H - Kasuari', '9I - Albatros'
              ]
            },
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
          skor: {
            7: {},
            8: {},
            9: {
              '9C - Phoenix': 92,
              '9A - Garuda': 86,
              '9D - Rajawali': 80,
              '9B - Elang': 76,
              '9E - Cendrawasih': 72,
              '9F - Jalak': 66,
              '9G - Merpati': 62,
              '9H - Kasuari': 56,
              '9I - Albatros': 50
            }
          }
        },

        // 6. Riwayat Pertandingan Babak Semifinal (9 Tim, Sistem Papan 45 Kotak)
        state_semifinal: {
          cfg: {
            nTim: 9,
            tim: [
              '9C - Phoenix', '9A - Garuda', '9D - Rajawali',
              '9B - Elang', '9E - Cendrawasih', '9F - Jalak',
              '9G - Merpati', '9H - Kasuari', '9I - Albatros'
            ],
            lolos: 5,
            awal: 'undi',
            ronde: 'geser',
            suara: true,
            pin: '',
            jenis: [
              { k: 'BS', n: 'Benar / Salah', cnt: 18, val: 100, sec: 20 },
              { k: 'PG1', n: 'Pilihan Ganda I', cnt: 9, val: 150, sec: 30 },
              { k: 'PG2', n: 'Pilihan Ganda II', cnt: 9, val: 200, sec: 45 },
              { k: 'ES', n: 'Essay', cnt: 9, val: 300, sec: 90 }
            ]
          },
          game: {
            phase: 'end',
            teams: [
              { name: '9C - Phoenix', score: 650 },
              { name: '9A - Garuda', score: 550 },
              { name: '9D - Rajawali', score: 450 },
              { name: '9B - Elang', score: 400 },
              { name: '9E - Cendrawasih', score: 350 },
              { name: '9F - Jalak', score: 250 },
              { name: '9G - Merpati', score: 200 },
              { name: '9H - Kasuari', score: 150 },
              { name: '9I - Albatros', score: 100 }
            ]
          }
        },

        // 7. Riwayat Pertandingan Babak Grand Final (5 Finalis & Skor Juara)
        state_final: {
          title: 'CERDAS CERMAT FINAL',
          n: 5,
          init: 100,
          dur: 90,
          np: 5,
          snd: 1,
          rb: 0,
          names: [
            '9C - Tim Phoenix',
            '9A - Tim Garuda',
            '9D - Tim Rajawali',
            '9B - Tim Elang',
            '9E - Tim Cendrawasih'
          ],
          score: [475, 395, 320, 260, 195],
          done: Array(15).fill(true),
          started: true
        }
      };
    },

    /**
     * Seeds complete realistic tournament simulation into IndexedDB & LocalStorage
     */
    async seedFullTournament() {
      const data = this.getSeedData();

      // 1. Config
      await window.PortalStorage.saveConfig(data.event_config);

      // 2. Question Banks
      await window.PortalStorage.saveStageBank('penyisihan', data.bank_penyisihan);
      await window.PortalStorage.saveStageBank('semifinal', data.bank_semifinal);
      await window.PortalStorage.saveStageBank('final', data.bank_final);

      // 3. Stage States
      await window.PortalStorage.savePenyisihanState(data.state_penyisihan);
      await window.PortalStorage.saveSemifinalState(data.state_semifinal);
      await window.PortalStorage.saveFinalState(data.state_final);

      // 4. Grand Final LocalStorage Direct Sync
      try {
        localStorage.setItem('cc-final3', JSON.stringify(data.state_final));
      } catch (e) {}

      // 5. Notify stages and refresh portal views
      this.broadcastSync();
      return true;
    },

    /**
     * Seeds initial clean tournament (only question banks & zeroed scores)
     */
    async seedCleanTournament() {
      const data = this.getSeedData();

      await window.PortalStorage.saveConfig(data.event_config);
      await window.PortalStorage.saveStageBank('penyisihan', data.bank_penyisihan);
      await window.PortalStorage.saveStageBank('semifinal', data.bank_semifinal);
      await window.PortalStorage.saveStageBank('final', data.bank_final);

      // Clean state for Penyisihan
      const cleanPenyisihan = {
        cfg: Object.assign({}, data.state_penyisihan.cfg),
        skor: { 7: {}, 8: {}, 9: {} }
      };
      await window.PortalStorage.savePenyisihanState(cleanPenyisihan);

      // Clean state for Semifinal
      const cleanSemifinal = {
        cfg: Object.assign({}, data.state_semifinal.cfg),
        game: null
      };
      await window.PortalStorage.saveSemifinalState(cleanSemifinal);

      // Clean state for Grand Final
      const cleanFinal = {
        title: 'CERDAS CERMAT FINAL',
        n: 5,
        init: 100,
        dur: 90,
        np: 5,
        snd: 1,
        rb: 0,
        names: ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5'],
        score: [100, 100, 100, 100, 100],
        done: Array(15).fill(false),
        started: false
      };
      await window.PortalStorage.saveFinalState(cleanFinal);

      try {
        localStorage.setItem('cc-final3', JSON.stringify(cleanFinal));
      } catch (e) {}

      this.broadcastSync();
      return true;
    },

    /**
     * Clears all IndexedDB data and LocalStorage game keys
     */
    async clearDatabase() {
      try {
        localStorage.removeItem('cc-final3');
      } catch (e) {}

      // Reset states to empty structures
      const cleanFinal = {
        title: 'CERDAS CERMAT FINAL',
        n: 5,
        init: 100,
        dur: 90,
        np: 5,
        snd: 1,
        rb: 0,
        names: ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5'],
        score: [100, 100, 100, 100, 100],
        done: Array(15).fill(false),
        started: false
      };
      await window.PortalStorage.saveFinalState(cleanFinal);

      const cleanSemi = {
        cfg: { nTim: 9, tim: ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5', 'Tim 6', 'Tim 7', 'Tim 8', 'Tim 9'], lolos: 5, awal: 'undi', ronde: 'geser', suara: true, pin: '', jenis: [] },
        game: null
      };
      await window.PortalStorage.saveSemifinalState(cleanSemi);

      const cleanPenyisihan = {
        cfg: { jenjang: 9, nTim: 9, tim: { 7: [], 8: [], 9: [] }, gel: 0, anak: 10, wSoal: 30, gMenit: 30, poin: 2, penalti: 0, mode: 'batas', kunci: true, label: true, pin: '' },
        skor: { 7: {}, 8: {}, 9: {} }
      };
      await window.PortalStorage.savePenyisihanState(cleanPenyisihan);

      this.broadcastSync();
      return true;
    },

    /**
     * Exports full database as JSON
     */
    async exportDatabaseJSON() {
      const cfg = await window.PortalStorage.getConfig();
      const pBank = await window.PortalStorage.getStageBank('penyisihan');
      const sBank = await window.PortalStorage.getStageBank('semifinal');
      const fBank = await window.PortalStorage.getStageBank('final');
      const pState = await window.PortalStorage.getPenyisihanState();
      const sState = await window.PortalStorage.getSemifinalState();
      const fState = await window.PortalStorage.getFinalState();

      const bundle = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        event_config: cfg,
        banks: {
          penyisihan: pBank,
          semifinal: sBank,
          final: fBank
        },
        states: {
          penyisihan: pState,
          semifinal: sState,
          final: fState
        }
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_database_cc_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return bundle;
    },

    /**
     * Imports a JSON database bundle
     */
    async importDatabaseJSON(jsonInput) {
      let data = jsonInput;
      if (typeof jsonInput === 'string') {
        data = JSON.parse(jsonInput);
      }

      if (data.event_config) {
        await window.PortalStorage.saveConfig(data.event_config);
      }
      if (data.banks) {
        if (data.banks.penyisihan) await window.PortalStorage.saveStageBank('penyisihan', data.banks.penyisihan);
        if (data.banks.semifinal) await window.PortalStorage.saveStageBank('semifinal', data.banks.semifinal);
        if (data.banks.final) await window.PortalStorage.saveStageBank('final', data.banks.final);
      }
      if (data.states) {
        if (data.states.penyisihan) await window.PortalStorage.savePenyisihanState(data.states.penyisihan);
        if (data.states.semifinal) await window.PortalStorage.saveSemifinalState(data.states.semifinal);
        if (data.states.final) {
          await window.PortalStorage.saveFinalState(data.states.final);
          try {
            localStorage.setItem('cc-final3', JSON.stringify(data.states.final));
          } catch (e) {}
        }
      }

      this.broadcastSync();
      return true;
    },

    /**
     * Broadcasts sync messages to active iframes and triggers portal refresh
     */
    broadcastSync() {
      // Reload iframes so game arenas immediately reflect seeded data
      ['frame-penyisihan', 'frame-semifinal', 'frame-final'].forEach(id => {
        const frame = document.getElementById(id);
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.location.reload();
          } catch (e) {}
        }
      });

      // Refresh portal report view if App is present
      if (window.App && typeof window.App.refreshReports === 'function') {
        window.App.refreshReports();
      }
      if (window.ReportEngine && typeof window.ReportEngine.renderReportHTML === 'function') {
        window.ReportEngine.renderReportHTML('report-preview-container');
      }
      if (window.App && typeof window.App.renderBankList === 'function') {
        window.App.renderBankList();
      }
    }
  };

  window.DatabaseSeeder = DatabaseSeeder;
})(window);
