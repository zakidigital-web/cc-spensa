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

      // Handle hash routing if loaded with #stage
      const initialHash = (window.location.hash || '').replace('#', '').trim();
      if (initialHash && ['penyisihan', 'semifinal', 'final', 'bank', 'laporan', 'hub'].includes(initialHash)) {
        this.switchView(initialHash);
      } else {
        this.switchView('hub');
      }

      window.addEventListener('hashchange', () => {
        const hash = (window.location.hash || '').replace('#', '').trim();
        if (hash && ['penyisihan', 'semifinal', 'final', 'bank', 'laporan', 'hub'].includes(hash)) {
          if (currentView !== hash) this.switchView(hash);
        }
      });
    },

    updateHeaderInfo(cfg) {
      const titleEl = document.getElementById('header-event-title');
      const schoolEl = document.getElementById('header-school-name');
      if (titleEl) titleEl.textContent = cfg.title;
      if (schoolEl) schoolEl.textContent = cfg.schoolName;
    },

    applyTheme(theme) {
      theme = (theme === 'light') ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('portal_theme', theme);

      // Header Button Label & Icon
      const icon = document.getElementById('theme-icon');
      const label = document.getElementById('theme-label');
      if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
      if (label) label.textContent = theme === 'dark' ? 'Gelap' : 'Cerah';

      // Settings Modal Theme Cards Sync
      const darkCard = document.getElementById('theme-opt-dark');
      const lightCard = document.getElementById('theme-opt-light');
      const darkRadio = document.querySelector('input[name="modal-portal-theme"][value="dark"]');
      const lightRadio = document.querySelector('input[name="modal-portal-theme"][value="light"]');

      if (darkCard && lightCard) {
        darkCard.classList.toggle('active', theme === 'dark');
        lightCard.classList.toggle('active', theme === 'light');
      }
      if (darkRadio && lightRadio) {
        if (theme === 'dark') darkRadio.checked = true;
        else lightRadio.checked = true;
      }

      // Notify and sync theme with all embedded stage iframes
      ['frame-penyisihan', 'frame-semifinal', 'frame-final'].forEach(id => {
        const frame = document.getElementById(id);
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({ type: 'SET_THEME', theme: theme }, '*');
            frame.contentWindow.postMessage({ type: 'PORTAL_THEME_CHANGE', theme: theme }, '*');
            if (frame.contentDocument && frame.contentDocument.documentElement) {
              frame.contentDocument.documentElement.setAttribute('data-theme', theme);
              if (frame.contentDocument.body) {
                frame.contentDocument.body.setAttribute('data-theme', theme);
              }
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
      document.documentElement.classList.toggle('stage-active', isStage);
      document.body.classList.toggle('stage-active', isStage);

      // Update URL hash for deep-linking
      if (window.location.hash.replace('#', '') !== viewName) {
        history.replaceState(null, '', `#${viewName}`);
      }

      // Sync theme on iframe switch
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      this.applyTheme(currentTheme);

      if (viewName === 'laporan') {
        if (window.ReportEngine) window.ReportEngine.renderReportHTML('report-preview-container');
      } else if (viewName === 'bank') {
        this.renderBankList();
      }
    },

    toggleFullscreen() {
      const doc = document;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (doc.documentElement.requestFullscreen) {
          doc.documentElement.requestFullscreen().catch(() => {});
        } else if (doc.documentElement.webkitRequestFullscreen) {
          doc.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        }
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
        fsBtn.addEventListener('click', () => this.toggleFullscreen());
      }

      const fsExitDock = document.getElementById('btn-fs-exit-dock');
      if (fsExitDock) {
        fsExitDock.addEventListener('click', () => {
          if (document.fullscreenElement || document.webkitFullscreenElement) {
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

      // Universal Fullscreen Event Handlers
      const updateFullscreenClasses = () => {
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        document.documentElement.classList.toggle('is-fullscreen', isFS);
        document.body.classList.toggle('is-fullscreen', isFS);

        ['frame-penyisihan', 'frame-semifinal', 'frame-final'].forEach(id => {
          const frame = document.getElementById(id);
          if (frame && frame.contentWindow) {
            try {
              frame.contentWindow.postMessage({ type: 'FULLSCREEN_CHANGE', isFullscreen: isFS }, '*');
            } catch (e) {}
          }
        });
      };

      document.addEventListener('fullscreenchange', updateFullscreenClasses);
      document.addEventListener('webkitfullscreenchange', updateFullscreenClasses);

      // Listen to postMessage from stage iframes (e.g. Layar Penuh button inside iframe)
      window.addEventListener('message', e => {
        if (!e.data) return;
        if (e.data.type === 'TOGGLE_FULLSCREEN') {
          this.toggleFullscreen();
        } else if (e.data.type === 'EXIT_FULLSCREEN') {
          if (document.fullscreenElement || document.webkitFullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        } else if (e.data.type === 'SWITCH_VIEW' && e.data.view) {
          this.switchView(e.data.view);
        } else if (e.data.type === 'FINAL_STATE_UPDATED' && e.data.state) {
          if (window.PortalStorage) {
            window.PortalStorage.saveFinalState(e.data.state);
          }
          if (currentView === 'laporan' && window.ReportEngine) {
            window.ReportEngine.renderReportHTML('report-preview-container');
          }
        } else if (e.data.type === 'PENYISIHAN_SKOR_UPDATED') {
          if (window.PortalStorage) {
            window.PortalStorage.getPenyisihanState();
          }
        } else if (e.data.type === 'SEMIFINAL_GAME_UPDATED') {
          if (window.PortalStorage) {
            window.PortalStorage.getSemifinalState();
          }
        }
      });
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
        } else if (e.key === 'F11' || ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) {
          e.preventDefault();
          this.toggleFullscreen();
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
            const fileNameMap = {
              penyisihan: 'templates/Template_Soal_Penyisihan.docx',
              semifinal: 'templates/Template_Soal_Semifinal.docx',
              final: 'templates/Template_Soal_Grand_Final.docx'
            };
            const fileUrl = fileNameMap[activeBankStage];
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = `Template_Soal_${activeBankStage.toUpperCase()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } catch (e) {
            await window.DocxEngine.downloadTemplateDocx(activeBankStage);
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
      const btnCloseX = document.getElementById('btn-close-settings-x');
      const btnSave = document.getElementById('btn-save-settings');

      const darkCard = document.getElementById('theme-opt-dark');
      const lightCard = document.getElementById('theme-opt-light');
      const darkRadio = document.querySelector('input[name="modal-portal-theme"][value="dark"]');
      const lightRadio = document.querySelector('input[name="modal-portal-theme"][value="light"]');

      const setModalThemeUI = (theme) => {
        if (darkCard && lightCard) {
          darkCard.classList.toggle('active', theme === 'dark');
          lightCard.classList.toggle('active', theme === 'light');
        }
        if (darkRadio && lightRadio) {
          if (theme === 'dark') darkRadio.checked = true;
          else lightRadio.checked = true;
        }
      };

      if (darkCard) {
        darkCard.addEventListener('click', () => {
          setModalThemeUI('dark');
          this.applyTheme('dark');
        });
      }
      if (lightCard) {
        lightCard.addEventListener('click', () => {
          setModalThemeUI('light');
          this.applyTheme('light');
        });
      }

      if (btnOpen && modal) {
        btnOpen.addEventListener('click', () => {
          document.getElementById('set-event-title').value = cfg.title;
          document.getElementById('set-school-name').value = cfg.schoolName;
          document.getElementById('set-event-date').value = cfg.eventDate;
          document.getElementById('set-jury-name').value = cfg.juryChiefName;
          document.getElementById('set-chairman-name').value = cfg.chairmanName;
          document.getElementById('set-principal-name').value = cfg.principalName;

          const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          setModalThemeUI(currentTheme);

          modal.classList.add('active');
        });
      }

      const closeModal = () => modal && modal.classList.remove('active');
      if (btnClose) btnClose.addEventListener('click', closeModal);
      if (btnCloseX) btnCloseX.addEventListener('click', closeModal);

      if (btnSave && modal) {
        btnSave.addEventListener('click', async () => {
          const checkedRadio = document.querySelector('input[name="modal-portal-theme"]:checked');
          const selectedTheme = checkedRadio ? checkedRadio.value : (cfg.theme || 'dark');
          this.applyTheme(selectedTheme);
          cfg.theme = selectedTheme;

          cfg.title = document.getElementById('set-event-title').value.trim() || cfg.title;
          cfg.schoolName = document.getElementById('set-school-name').value.trim() || cfg.schoolName;
          cfg.eventDate = document.getElementById('set-event-date').value.trim() || cfg.eventDate;
          cfg.juryChiefName = document.getElementById('set-jury-name').value.trim() || cfg.juryChiefName;
          cfg.chairmanName = document.getElementById('set-chairman-name').value.trim() || cfg.chairmanName;
          cfg.principalName = document.getElementById('set-principal-name').value.trim() || cfg.principalName;

          await window.PortalStorage.saveConfig(cfg);
          this.updateHeaderInfo(cfg);
          closeModal();
          alert('Pengaturan tema dan identitas berhasil disimpan!');
        });
      }
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
