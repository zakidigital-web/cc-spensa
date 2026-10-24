/**
 * Main Application Controller & Router
 * Centralizes stage switching, bank soal management (Penyisihan/Semifinal/Final),
 * theme toggling across embedded stage frames, and official report operations.
 */
(function(window) {
  'use strict';

  let currentView = 'hub';
  let activeBankStage = 'penyisihan'; // 'penyisihan' | 'semifinal' | 'final'

  const App = {
    async init() {
      const cfg = await window.PortalStorage.getConfig();
      const savedTheme = localStorage.getItem('portal_theme') || cfg.theme || 'dark';
      this.applyTheme(savedTheme);

      if (window.SoundFX) {
        window.SoundFX.setSoundEnabled(cfg.sound !== false);
      }

      this.updateHeaderInfo(cfg);
      this.bindNavigation();
      this.bindBankSoal();
      this.bindLaporan();
      this.bindSettings(cfg);
      this.bindShortcuts();

      // Protocol alert for file:// protocol
      if (window.location.protocol === 'file:') {
        const alertEl = document.getElementById('protocol-alert');
        if (alertEl) alertEl.style.display = 'flex';
      }

      // Pre-unlock AudioContext on first user interaction
      const unlockAudio = () => {
        if (window.SoundFX) window.SoundFX.playTileOpen();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });

      // Attach iframe load theme sync
      ['frame-penyisihan', 'frame-semifinal', 'frame-final'].forEach(id => {
        const frame = document.getElementById(id);
        if (frame) {
          frame.addEventListener('load', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            this.applyTheme(currentTheme);
          });
        }
      });

      this.switchView('hub');
    },

    updateHeaderInfo(cfg) {
      const titleEl = document.getElementById('header-event-title');
      const schoolEl = document.getElementById('header-school-name');
      if (titleEl) titleEl.textContent = cfg.title;
      if (schoolEl) schoolEl.textContent = cfg.schoolName;
    },

    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('portal_theme', theme);
      const icon = document.getElementById('theme-icon');
      if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
      }

      // Notify and sync theme with all embedded stage iframes
      ['frame-penyisihan', 'frame-semifinal', 'frame-final'].forEach(id => {
        const frame = document.getElementById(id);
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({ type: 'SET_THEME', theme: theme }, '*');
            if (frame.contentDocument && frame.contentDocument.documentElement) {
              frame.contentDocument.documentElement.setAttribute('data-theme', theme);
            }
          } catch (e) {}
        }
      });
    },

    async toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
      const cfg = await window.PortalStorage.getConfig();
      cfg.theme = next;
      await window.PortalStorage.saveConfig(cfg);
    },

    switchView(viewName) {
      currentView = viewName;

      // Update Nav Buttons
      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
      });

      // Update View Sections
      document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active');
      });

      const targetSec = document.getElementById(`view-${viewName}`);
      if (targetSec) {
        targetSec.classList.add('active');
      }

      // Zero-scroll native presentation arena when viewing stage iframes
      const isStage = ['penyisihan', 'semifinal', 'final'].includes(viewName);
      document.body.classList.toggle('stage-active', isStage);

      // Sync theme on iframe switch
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      this.applyTheme(currentTheme);

      if (viewName === 'laporan') {
        if (window.ReportEngine) window.ReportEngine.renderReportHTML('report-preview-container');
      } else if (viewName === 'bank') {
        this.renderBankList();
      }
    },

    bindNavigation() {
      document.querySelectorAll('[data-view]').forEach(el => {
        el.addEventListener('click', () => {
          this.switchView(el.dataset.view);
        });
      });

      const themeBtn = document.getElementById('btn-toggle-theme');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => this.toggleTheme());
      }

      const fsBtn = document.getElementById('btn-toggle-fullscreen');
      if (fsBtn) {
        fsBtn.addEventListener('click', () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        });
      }

      const fsExitDock = document.getElementById('btn-fs-exit-dock');
      if (fsExitDock) {
        fsExitDock.addEventListener('click', () => {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        });
      }

      const fsHubDock = document.getElementById('btn-fs-hub-dock');
      if (fsHubDock) {
        fsHubDock.addEventListener('click', () => {
          this.switchView('hub');
        });
      }
    },

    // ─── KEYBOARD SHORTCUTS MODAL ─────────────────────────
    bindShortcuts() {
      const modal = document.getElementById('shortcuts-modal');
      const btnOpen = document.getElementById('btn-open-shortcuts');
      const btnClose = document.getElementById('btn-close-shortcuts');
      const btnOk = document.getElementById('btn-ok-shortcuts');

      const openModal = () => { if (modal) modal.classList.add('active'); };
      const closeModal = () => { if (modal) modal.classList.remove('active'); };

      if (btnOpen) btnOpen.addEventListener('click', openModal);
      if (btnClose) btnClose.addEventListener('click', closeModal);
      if (btnOk) btnOk.addEventListener('click', closeModal);

      // Global keyboard listener for ? and Escape
      window.addEventListener('keydown', e => {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            openModal();
          }
        } else if (e.key === 'Escape') {
          closeModal();
          const setModal = document.getElementById('settings-modal');
          if (setModal) setModal.classList.remove('active');
        }
      });
    },

    // ─── BANK SOAL INTERACTION (SEPARATE PER STAGE) ─────────
    bindBankSoal() {
      const dropzone = document.getElementById('word-dropzone');
      const fileInput = document.getElementById('word-file-input');
      const btnDownloadTpl = document.getElementById('btn-download-tpl');
      const btnExportWord = document.getElementById('btn-export-bank-word');

      const tabP = document.getElementById('bank_tab_penyisihan');
      const tabS = document.getElementById('bank_tab_semifinal');
      const tabF = document.getElementById('bank_tab_final');

      if (tabP && tabS && tabF) {
        tabP.onclick = () => { activeBankStage = 'penyisihan'; this.updateBankStageUI(); };
        tabS.onclick = () => { activeBankStage = 'semifinal'; this.updateBankStageUI(); };
        tabF.onclick = () => { activeBankStage = 'final'; this.updateBankStageUI(); };
      }

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            this.handleWordImport(e.dataTransfer.files[0]);
          }
        });

        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            this.handleWordImport(e.target.files[0]);
          }
        });
      }

      if (btnDownloadTpl) {
        btnDownloadTpl.addEventListener('click', async () => {
          try {
            await window.DocxEngine.downloadTemplateDocx(activeBankStage);
          } catch (e) {
            alert('Gagal mengunduh template: ' + e.message);
          }
        });
      }

      if (btnExportWord) {
        btnExportWord.addEventListener('click', async () => {
          try {
            await window.DocxEngine.exportStageBankToDocx(activeBankStage);
          } catch (e) {
            alert('Gagal ekspor: ' + e.message);
          }
        });
      }
    },

    updateBankStageUI() {
      ['penyisihan', 'semifinal', 'final'].forEach(st => {
        const btn = document.getElementById(`bank_tab_${st}`);
        if (btn) btn.classList.toggle('btn-primary', activeBankStage === st);
      });

      const stLabel = activeBankStage === 'penyisihan' ? 'Babak Penyisihan (11 Mapel)' :
                      (activeBankStage === 'semifinal' ? 'Babak Semifinal (BS, PG1, PG2, Essay)' : 'Babak Grand Final (Tier 1, 2, 3)');
      const badgeEl = document.getElementById('active-bank-stage-label');
      if (badgeEl) badgeEl.textContent = `Target Aktif: ${stLabel}`;

      this.renderBankList();
    },

    async handleWordImport(file) {
      try {
        const statusEl = document.getElementById('import-status-msg');
        if (statusEl) statusEl.textContent = `Mengekstrak file Word ke Bank Soal ${activeBankStage.toUpperCase()}...`;

        const result = await window.DocxEngine.importQuestionsFromDocx(file, activeBankStage);

        if (statusEl) {
          statusEl.textContent = `✅ Berhasil mengimpor ${result.count} soal ke Bank ${activeBankStage.toUpperCase()} (Ditemukan ${result.mathCount} rumus matematika)!`;
        }
        alert(`Berhasil mengimpor ${result.count} soal ke Bank Soal Babak ${activeBankStage.toUpperCase()}!`);
        this.renderBankList();
      } catch (err) {
        alert('Gagal membaca file Word: ' + err.message);
      }
    },

    async renderBankList() {
      const container = document.getElementById('bank-list-container');
      if (!container) return;

      const qList = await window.DocxEngine.getStageQuestions(activeBankStage);

      if (!qList.length) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-mut);">Belum ada soal di Bank Soal ${activeBankStage.toUpperCase()}. Silakan unggah file Word template di atas.</div>`;
        return;
      }

      container.innerHTML = qList.map((q, idx) => {
        const cat = q.mapel || q.tipe || q.tier || 'Umum';
        let keyText = q.ans || '';
        if (q.o && q.o.length && q.k != null) {
          keyText = `${String.fromCharCode(65 + q.k)}. ${q.o[q.k] || ''}`;
        }

        return `
          <div class="question-card-item">
            <span class="q-card-badge">${cat}</span>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${idx + 1}. ${q.q}</div>
              ${q.img ? `<img src="${q.img}" style="max-height:120px;border-radius:8px;margin:8px 0;border:1px solid var(--card-border);" alt="Ilustrasi">` : ''}
              ${q.o && q.o.length ? `
                <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--text-mut);margin-top:6px;">
                  ${q.o.map((opt, i) => `
                    <span style="${q.k === i ? 'color:var(--ok);font-weight:bold;' : ''}">
                      ${String.fromCharCode(65 + i)}. ${opt} ${q.k === i ? '✓' : ''}
                    </span>
                  `).join('')}
                </div>
              ` : `
                <div style="font-size:13px;color:var(--ok);font-weight:bold;margin-top:4px;">Kunci: ${keyText}</div>
              `}
            </div>
          </div>
        `;
      }).join('');
    },

    // ─── LAPORAN INTERACTION ──────────────────────────────
    bindLaporan() {
      const btnExportDocx = document.getElementById('btn-export-report-docx');
      const btnPrintPDF = document.getElementById('btn-print-report-pdf');

      if (btnExportDocx) {
        btnExportDocx.addEventListener('click', async () => {
          try {
            await window.ReportEngine.exportReportToDocx();
          } catch (e) {
            alert('Gagal ekspor laporan Word: ' + e.message);
          }
        });
      }

      if (btnPrintPDF) {
        btnPrintPDF.addEventListener('click', () => {
          window.ReportEngine.printPDF();
        });
      }
    },

    // ─── SETTINGS MODAL ───────────────────────────────────
    bindSettings(cfg) {
      const modal = document.getElementById('settings-modal');
      const btnOpen = document.getElementById('btn-open-settings');
      const btnClose = document.getElementById('btn-close-settings');
      const btnSave = document.getElementById('btn-save-settings');

      if (btnOpen && modal) {
        btnOpen.addEventListener('click', () => {
          document.getElementById('set-event-title').value = cfg.title;
          document.getElementById('set-school-name').value = cfg.schoolName;
          document.getElementById('set-event-date').value = cfg.eventDate;
          document.getElementById('set-jury-name').value = cfg.juryChiefName;
          document.getElementById('set-chairman-name').value = cfg.chairmanName;
          document.getElementById('set-principal-name').value = cfg.principalName;
          modal.classList.add('active');
        });
      }

      if (btnClose && modal) {
        btnClose.addEventListener('click', () => modal.classList.remove('active'));
      }

      if (btnSave && modal) {
        btnSave.addEventListener('click', async () => {
          cfg.title = document.getElementById('set-event-title').value.trim() || cfg.title;
          cfg.schoolName = document.getElementById('set-school-name').value.trim() || cfg.schoolName;
          cfg.eventDate = document.getElementById('set-event-date').value.trim() || cfg.eventDate;
          cfg.juryChiefName = document.getElementById('set-jury-name').value.trim() || cfg.juryChiefName;
          cfg.chairmanName = document.getElementById('set-chairman-name').value.trim() || cfg.chairmanName;
          cfg.principalName = document.getElementById('set-principal-name').value.trim() || cfg.principalName;

          await window.PortalStorage.saveConfig(cfg);
          this.updateHeaderInfo(cfg);
          modal.classList.remove('active');
          alert('Pengaturan umum berhasil disimpan!');
        });
      }
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
