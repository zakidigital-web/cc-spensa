/**
 * Main Application Controller & Router
 * Centralizes stage switching, bank soal management (Penyisihan/Semifinal/Final),
 * theme toggling across embedded stage frames, and official report operations.
 */
(function(window) {
  'use strict';

  let currentView = 'hub';
  let activeBankStage = 'penyisihan'; // 'penyisihan' | 'semifinal' | 'final'
  let activeJenjang = 7; // 7 | 8 | 9 (khusus babak penyisihan)
  let bankSearchQuery = '';
  let bankFilterCategory = '';
  let selectedQuestionIds = new Set();
  let allQuestionsCache = [];
  let pendingDelAction = null;

  const App = {
    async init() {
      // Guard against infinite recursive embedding if loaded in an iframe
      if (window.top !== window.self) {
        console.warn("Portal hub cannot be embedded within an iframe, aborting.");
        return;
      }

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
      this.initCloudDatabaseSync();

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
        if (window.ReportEngine) {
          try {
            window.ReportEngine.renderReportHTML('report-preview-container');
          } catch (e) {
            console.error("Error rendering report:", e);
          }
        }
      } else if (viewName === 'bank') {
        try {
          this.renderBankList();
        } catch (e) {
          console.error("Error rendering bank list:", e);
        }
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
        } else if (e.data.type === 'PENYISIHAN_BANK_CLEARED' || e.data.type === 'SEMIFINAL_BANK_CLEARED') {
          this.updateJenjangCountsUI();
          if (currentView === 'bank') {
            this.renderBankList();
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
      if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

      // Global keyboard listener for ? and Escape
      window.addEventListener('keydown', e => {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            openModal();
          }
        } else if (e.key === 'Escape') {
          closeModal();
          ['settings-modal', 'shortcuts-modal', 'modal-edit-question', 'modal-confirm-delete', 'modal-preview-question'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
          });
        } else if (e.key === 'F11' || ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) {
          e.preventDefault();
          this.toggleFullscreen();
        }
      });
    },

    // ─── TOAST NOTIFICATION HELPER ─────────────────────────
    showToast(message, type = 'success') {
      let toastEl = document.getElementById('portal-toast');
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'portal-toast';
        toastEl.style.cssText = `
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 99999;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 22px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
        `;
        document.body.appendChild(toastEl);
      }

      const bg = type === 'error' ? '#ef4444' : (type === 'warning' ? '#f59e0b' : '#10b981');
      toastEl.style.background = bg;
      toastEl.style.color = '#ffffff';
      toastEl.textContent = message;
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateY(0)';

      clearTimeout(toastEl._timer);
      toastEl._timer = setTimeout(() => {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateY(20px)';
      }, 3200);
    },

    // ─── BANK SOAL INTERACTION (SEPARATE PER STAGE) ─────────
    bindBankSoal() {
      const self = this;
      const dropzone = document.getElementById('word-dropzone');
      const fileInput = document.getElementById('word-file-input');
      const btnDownloadTpl = document.getElementById('btn-download-tpl');
      const btnExportWord = document.getElementById('btn-export-bank-word');

      const tabP = document.getElementById('bank_tab_penyisihan');
      const tabS = document.getElementById('bank_tab_semifinal');
      const tabF = document.getElementById('bank_tab_final');

      // ─── CLOUD MANUAL SYNC BUTTON ────────────────────────
      const btnSyncCloud = document.getElementById('btn-sync-cloud');
      if (btnSyncCloud) {
        btnSyncCloud.addEventListener('click', async () => {
          const iconEl = document.getElementById('btn-sync-cloud-icon');
          const textEl = document.getElementById('btn-sync-cloud-text');
          btnSyncCloud.disabled = true;
          if (iconEl) iconEl.textContent = '⏳';
          if (textEl) textEl.textContent = 'Menyinkronkan...';

          try {
            const syncRes = await window.PortalStorage.syncFromCloud();
            if (syncRes && syncRes.success) {
              await self.refreshCloudStatusUI();
              await self.renderBankList();
              self.updateJenjangCountsUI();
              self.showToast(`✅ Berhasil menyinkronkan ${syncRes.count} soal dari Database Cloud Neon!`);
            } else {
              self.showToast('⚠️ Gagal terhubung ke Database Cloud. Menggunakan penyimpanan lokal.');
            }
          } catch (err) {
            self.showToast('⚠️ Kesalahan sinkronisasi: ' + err.message);
          } finally {
            btnSyncCloud.disabled = false;
            if (iconEl) iconEl.textContent = '🔄';
            if (textEl) textEl.textContent = 'Sinkronkan Cloud';
          }
        });
      }

      if (tabP && tabS && tabF) {
        tabP.onclick = () => { activeBankStage = 'penyisihan'; this.onBankStageChange(); };
        tabS.onclick = () => { activeBankStage = 'semifinal'; this.onBankStageChange(); };
        tabF.onclick = () => { activeBankStage = 'final'; this.onBankStageChange(); };
      }

      // ─── PENYISIHAN JENJANG BUTTONS (KELAS 7, 8, 9) ────
      [7, 8, 9].forEach(j => {
        const btn = document.getElementById(`btn_jenjang_${j}`);
        if (btn) {
          btn.addEventListener('click', () => {
            activeJenjang = j;
            self.onJenjangChange();
          });
        }
      });

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
            await window.DocxEngine.downloadTemplateDocx(activeBankStage, activeJenjang);
          } catch (e) {
            alert('Gagal unduh template: ' + e.message);
          }
        });
      }

      if (btnExportWord) {
        btnExportWord.addEventListener('click', async () => {
          if (activeBankStage === 'penyisihan') {
            self.openCustomDeleteModal({
              icon: '📤',
              title: 'Ekspor Bank Soal Babak Penyisihan ke Word (.docx)',
              message: `Pilih format ekspor bank soal untuk Babak Penyisihan:<br>
                <div style="margin-top:10px;text-align:left;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;">
                  • <strong>Format Asli 8 Kolom:</strong> Menjaga 100% struktur soal, gambar, rumus LaTeX ($...$), pilihan A-D, dan kunci jawaban.<br>
                  • <strong>Kompatibel Penuh:</strong> Dokumen hasil ekspor dapat diedit di Word dan diimpor kembali secara otomatis.
                </div>`,
              buttons: [
                {
                  text: `📄 Ekspor Kelas ${activeJenjang} Saja (.docx)`,
                  class: 'btn-primary',
                  id: 'btn-export-single-class',
                  style: 'padding:10px 18px;font-weight:800;border-radius:10px;',
                  action: async () => {
                    self.showToast(`📤 Menyiapkan Bank Soal Penyisihan Kelas ${activeJenjang}...`);
                    await window.DocxEngine.exportStageBankToDocx('penyisihan', activeJenjang);
                    self.showToast(`✅ Berhasil mengekspor Bank Soal Kelas ${activeJenjang}!`);
                  }
                },
                {
                  text: `📦 Ekspor SEMUA Kelas (7, 8 & 9) Sekaligus`,
                  class: 'btn-gold',
                  id: 'btn-export-all-classes',
                  style: 'padding:10px 18px;font-weight:900;border-radius:10px;box-shadow:0 4px 14px rgba(245,158,11,0.3);',
                  action: async () => {
                    self.showToast('📤 Menyiapkan Bank Soal untuk seluruh kelas (7, 8, dan 9)...');
                    await window.DocxEngine.exportAllPenyisihanBanksToDocx();
                    self.showToast('✅ Berhasil mengekspor seluruh Bank Soal Penyisihan (3 File .docx)!');
                  }
                },
                {
                  text: 'Batal',
                  class: 'btn-ghost',
                  id: 'btn-cancel-del',
                  style: 'padding:8px 18px;',
                  action: () => {}
                }
              ]
            });
          } else {
            const stageName = activeBankStage === 'semifinal' ? 'Semifinal' : 'Grand Final';
            try {
              self.showToast(`📤 Menyiapkan Bank Soal Babak ${stageName}...`);
              await window.DocxEngine.exportStageBankToDocx(activeBankStage, activeJenjang);
              self.showToast(`✅ Berhasil mengekspor Bank Soal Babak ${stageName}!`);
            } catch (e) {
              alert('Gagal ekspor: ' + e.message);
            }
          }
        });
      }

      // ─── SEARCH & FILTER LISTENERS ───────────────────────
      const searchInput = document.getElementById('bank-search-input');
      const btnClearSearch = document.getElementById('btn-clear-search');
      const categoryFilter = document.getElementById('bank-filter-category');

      if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
          bankSearchQuery = searchInput.value;
          if (btnClearSearch) btnClearSearch.style.display = bankSearchQuery ? 'flex' : 'none';
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => self.renderBankList(), 150);
        });
      }

      if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          bankSearchQuery = '';
          btnClearSearch.style.display = 'none';
          self.renderBankList();
        });
      }

      if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
          bankFilterCategory = categoryFilter.value;
          self.renderBankList();
        });
      }

      // ─── SELECT ALL & BATCH DELETE LISTENERS ─────────────
      const selectAllCb = document.getElementById('bank-select-all');
      if (selectAllCb) {
        selectAllCb.addEventListener('change', () => {
          const visibleIds = self.getFilteredQuestions().map(q => String(q.id));
          if (selectAllCb.checked) {
            visibleIds.forEach(id => selectedQuestionIds.add(id));
          } else {
            visibleIds.forEach(id => selectedQuestionIds.delete(id));
          }
          self.updateBatchSelectionUI();
        });
      }

      const btnDeleteSelected = document.getElementById('btn-delete-selected');
      if (btnDeleteSelected) {
        btnDeleteSelected.addEventListener('click', () => {
          if (selectedQuestionIds.size === 0) return;
          const count = selectedQuestionIds.size;
          const stageDesc = (activeBankStage === 'penyisihan') ? `PENYISIHAN (Kelas ${activeJenjang})` : activeBankStage.toUpperCase();
          self.openConfirmDeleteModal({
            title: '🗑️ Hapus Soal Terpilih',
            message: `Apakah Anda yakin ingin menghapus <strong>${count} soal terpilih</strong> dari Bank Soal Babak ${stageDesc}? Tindakan ini tidak dapat dibatalkan.`,
            onConfirm: async () => {
              try {
                await window.DocxEngine.deleteStageQuestions(activeBankStage, Array.from(selectedQuestionIds), activeJenjang);
                selectedQuestionIds.clear();
                await self.renderBankList();
                self.updateJenjangCountsUI();
                self.refreshCloudStatusUI();
                self.showToast(`✅ Berhasil menghapus ${count} soal terpilih dari database & lokal!`);
              } catch (err) {
                alert('Gagal menghapus soal: ' + err.message);
              }
            }
          });
        });
      }

      const btnDeleteAll = document.getElementById('btn-delete-all');
      if (btnDeleteAll) {
        btnDeleteAll.addEventListener('click', async () => {
          if (activeBankStage === 'penyisihan') {
            const counts = await window.DocxEngine.getPenyisihanJenjangCounts();
            const countCurrent = counts[activeJenjang] || 0;
            const countTotal = (counts[7] || 0) + (counts[8] || 0) + (counts[9] || 0);

            self.openCustomDeleteModal({
              icon: '⚠️',
              title: 'Hapus Bank Soal Babak Penyisihan',
              message: `Pilih cakupan penghapusan soal untuk Babak Penyisihan:<br>
                <div style="margin-top:10px;text-align:left;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;">
                  • <strong>Kelas ${activeJenjang} saja:</strong> Menghapus ${countCurrent} soal pada Kelas ${activeJenjang}.<br>
                  • <strong>SEMUA Kelas (7, 8, & 9):</strong> Menghapus seluruh ${countTotal} soal di babak Penyisihan.<br>
                  • <strong>Semua Babak:</strong> Mengosongkan seluruh bank soal (Penyisihan, Semifinal, Final).
                </div>`,
              buttons: [
                {
                  text: `🗑️ Hapus Kelas ${activeJenjang} Saja (${countCurrent} Soal)`,
                  class: 'btn-danger-soft',
                  id: 'btn-confirm-del-action',
                  style: 'padding:10px 16px;font-weight:800;border-radius:10px;',
                  action: async () => {
                    await window.DocxEngine.clearStageQuestions('penyisihan', activeJenjang, false);
                    selectedQuestionIds.clear();
                    await self.renderBankList();
                    self.updateJenjangCountsUI();
                    self.refreshCloudStatusUI();
                    self.showToast(`⚠️ Soal Penyisihan Kelas ${activeJenjang} telah dikosongkan!`, 'warning');
                  }
                },
                {
                  text: `💥 Hapus SEMUA Kelas 7, 8 & 9 (${countTotal} Soal)`,
                  class: 'btn-danger',
                  id: 'btn-del-all-classes',
                  style: 'background:var(--bad);color:#fff;font-weight:900;border:none;padding:11px 18px;border-radius:10px;cursor:pointer;box-shadow:0 4px 14px rgba(239,68,68,0.35);',
                  action: async () => {
                    await window.DocxEngine.clearStageQuestions('penyisihan', activeJenjang, true);
                    selectedQuestionIds.clear();
                    await self.renderBankList();
                    self.updateJenjangCountsUI();
                    self.refreshCloudStatusUI();
                    self.showToast('💥 Seluruh soal Penyisihan (Kelas 7, 8, dan 9) telah dikosongkan dari database & lokal!', 'warning');
                  }
                },
                {
                  text: '🌐 Kosongkan Seluruh Bank Soal Semua Babak',
                  class: 'btn-ghost',
                  id: 'btn-del-all-stages',
                  style: 'color:var(--bad);font-weight:700;font-size:12.5px;padding:6px 12px;',
                  action: async () => {
                    await window.DocxEngine.clearAllStages();
                    selectedQuestionIds.clear();
                    await self.renderBankList();
                    self.updateJenjangCountsUI();
                    self.refreshCloudStatusUI();
                    self.showToast('⚠️ Seluruh Bank Soal Semua Babak telah dikosongkan!', 'warning');
                  }
                },
                {
                  text: 'Batal',
                  class: 'btn-ghost',
                  id: 'btn-cancel-del',
                  style: 'padding:8px 18px;',
                  action: () => {}
                }
              ]
            });
          } else {
            const stageName = activeBankStage === 'semifinal' ? 'Semifinal' : 'Grand Final';
            const questions = await window.DocxEngine.getStageQuestions(activeBankStage);
            const count = questions.length;

            self.openCustomDeleteModal({
              icon: '⚠️',
              title: `Hapus SEMUA Soal Babak ${stageName}`,
              message: `PERINGATAN: Seluruh <strong>${count} soal</strong> di Bank Soal Babak ${stageName} akan dihapus secara permanen. Anda dapat memulihkan soal standar kapan saja melalui tombol 'Pulihkan Soal Bawaan'.`,
              buttons: [
                {
                  text: `🗑️ Ya, Hapus SEMUA Soal ${stageName} (${count})`,
                  class: 'btn-danger',
                  id: 'btn-confirm-del-action',
                  style: 'background:var(--bad);color:#fff;font-weight:800;border:none;padding:10px 18px;border-radius:10px;cursor:pointer;',
                  action: async () => {
                    await window.DocxEngine.clearStageQuestions(activeBankStage, activeJenjang);
                    selectedQuestionIds.clear();
                    await self.renderBankList();
                    self.updateJenjangCountsUI();
                    self.showToast(`⚠️ Seluruh soal Babak ${stageName} telah dikosongkan!`, 'warning');
                  }
                },
                {
                  text: '🌐 Kosongkan Seluruh Bank Soal Semua Babak',
                  class: 'btn-ghost',
                  style: 'color:var(--bad);font-weight:700;font-size:12.5px;',
                  action: async () => {
                    await window.DocxEngine.clearAllStages();
                    selectedQuestionIds.clear();
                    await self.renderBankList();
                    self.updateJenjangCountsUI();
                    self.showToast('⚠️ Seluruh Bank Soal Semua Babak telah dikosongkan!', 'warning');
                  }
                },
                {
                  text: 'Batal',
                  class: 'btn-ghost',
                  id: 'btn-cancel-del',
                  style: 'padding:8px 18px;',
                  action: () => {}
                }
              ]
            });
          }
        });
      }

      const btnRestoreDefault = document.getElementById('btn-restore-default');
      if (btnRestoreDefault) {
        btnRestoreDefault.addEventListener('click', async () => {
          if (activeBankStage === 'penyisihan') {
            self.openCustomDeleteModal({
              icon: '🔄',
              title: 'Pulihkan Soal Bawaan Babak Penyisihan',
              message: `Pilih cakupan pemulihan soal standar untuk Babak Penyisihan:<br>
                <div style="margin-top:10px;text-align:left;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;">
                  • <strong>Kelas ${activeJenjang} saja:</strong> Memulihkan 44 soal standar bawaan ke Kelas ${activeJenjang}.<br>
                  • <strong>SEMUA Kelas (7, 8, & 9):</strong> Memulihkan soal standar ke Kelas 7, 8, dan 9 sekaligus.
                </div>`,
              buttons: [
                {
                  text: `🔄 Pulihkan Kelas ${activeJenjang} Saja`,
                  class: 'btn-primary',
                  id: 'btn-confirm-del-action',
                  style: 'padding:10px 18px;font-weight:800;border-radius:10px;',
                  action: async () => {
                    await window.DocxEngine.restoreDefaultStageQuestions('penyisihan', activeJenjang, false);
                    selectedQuestionIds.clear();
                    await self.renderBankList();
                    self.updateJenjangCountsUI();
                    self.refreshCloudStatusUI();
                    self.showToast(`✅ Soal standar Penyisihan Kelas ${activeJenjang} berhasil dipulihkan!`);
                  }
                },
                {
                  text: `✨ Pulihkan SEMUA Kelas (7, 8 & 9)`,
                  class: 'btn-gold',
                  style: 'padding:10px 18px;font-weight:900;border-radius:10px;box-shadow:0 4px 14px rgba(245,158,11,0.3);',
                  action: async () => {
                    await window.DocxEngine.restoreDefaultStageQuestions('penyisihan', activeJenjang, true);
                    selectedQuestionIds.clear();
                    await self.renderBankList();
                    self.updateJenjangCountsUI();
                    self.refreshCloudStatusUI();
                    self.showToast('✅ Soal standar Penyisihan untuk Kelas 7, 8, dan 9 berhasil dipulihkan!');
                  }
                },
                {
                  text: 'Batal',
                  class: 'btn-ghost',
                  id: 'btn-cancel-del',
                  style: 'padding:8px 18px;',
                  action: () => {}
                }
              ]
            });
          } else {
            const stageName = activeBankStage === 'semifinal' ? 'Semifinal' : 'Grand Final';
            self.openConfirmDeleteModal({
              title: `🔄 Pulihkan Soal Bawaan ${stageName}`,
              message: `Bank Soal Babak ${stageName} akan diisi kembali dengan daftar soal standar bawaan awal. Lanjutkan?`,
              onConfirm: async () => {
                await window.DocxEngine.restoreDefaultStageQuestions(activeBankStage, activeJenjang);
                selectedQuestionIds.clear();
                await self.renderBankList();
                self.updateJenjangCountsUI();
                self.refreshCloudStatusUI();
                self.showToast(`✅ Soal standar Babak ${stageName} berhasil dipulihkan!`);
              }
            });
          }
        });
      }

      // ─── ADD QUESTION MANUAL BUTTON ──────────────────────
      const btnAddQuestion = document.getElementById('btn-add-question');
      if (btnAddQuestion) {
        btnAddQuestion.addEventListener('click', () => {
          self.openAddQuestionModal();
        });
      }

      // ─── FORM & MODAL ACTIONS ────────────────────────────
      this.bindBankModals();

      // ─── EVENT DELEGATION FOR QUESTION CARDS ─────────────
      const container = document.getElementById('bank-list-container');
      if (container) {
        container.addEventListener('click', (e) => {
          const btnDel = e.target.closest('.btn-del');
          const btnEdit = e.target.closest('.btn-edit');
          const btnPv = e.target.closest('.btn-pv');
          const cb = e.target.closest('.q-checkbox');

          if (cb) {
            const id = cb.dataset.id;
            if (cb.checked) {
              selectedQuestionIds.add(id);
            } else {
              selectedQuestionIds.delete(id);
            }
            self.updateBatchSelectionUI();
            return;
          }

          if (btnDel) {
            const id = btnDel.dataset.id;
            const q = allQuestionsCache.find(x => String(x.id) === String(id));
            const stageDesc = (activeBankStage === 'penyisihan') ? `PENYISIHAN (Kelas ${activeJenjang})` : activeBankStage.toUpperCase();
            self.openConfirmDeleteModal({
              title: '🗑️ Hapus Soal',
              message: `Apakah Anda yakin ingin menghapus soal ini dari Bank Soal Babak ${stageDesc}?<br><br><em>"${(q ? q.q : id).slice(0, 100)}..."</em>`,
              onConfirm: async () => {
                try {
                  await window.DocxEngine.deleteStageQuestions(activeBankStage, [id], activeJenjang);
                  selectedQuestionIds.delete(String(id));
                  await self.renderBankList();
                  self.updateJenjangCountsUI();
                  self.refreshCloudStatusUI();
                  self.showToast('✅ Soal berhasil dihapus dari database & lokal!');
                } catch (err) {
                  alert('Gagal menghapus soal: ' + err.message);
                }
              }
            });
            return;
          }

          if (btnEdit) {
            const id = btnEdit.dataset.id;
            const q = allQuestionsCache.find(x => String(x.id) === String(id));
            if (q) self.openEditQuestionModal(q);
            return;
          }

          if (btnPv) {
            const id = btnPv.dataset.id;
            const q = allQuestionsCache.find(x => String(x.id) === String(id));
            if (q) self.openPreviewQuestionModal(q);
            return;
          }
        });
      }
    },

    async initCloudDatabaseSync() {
      await this.refreshCloudStatusUI();
      // Hydrate from cloud database in background
      try {
        const syncRes = await window.PortalStorage.syncFromCloud();
        if (syncRes && syncRes.success) {
          await this.refreshCloudStatusUI();
          this.updateJenjangCountsUI();
          if (currentView === 'bank') {
            await this.renderBankList();
          }
        }
      } catch (e) {
        console.warn('Initial cloud sync notice:', e);
      }
    },

    async refreshCloudStatusUI() {
      const indicator = document.getElementById('cloud-db-indicator');
      const statusText = document.getElementById('cloud-db-status-text');
      const countBadge = document.getElementById('cloud-db-count-badge');
      if (!indicator && !statusText) return;

      try {
        const health = await window.PortalStorage.checkCloudDatabase();
        if (health && health.status === 'online') {
          if (indicator) {
            indicator.style.background = '#10b981';
            indicator.style.boxShadow = '0 0 10px #10b981';
          }
          if (statusText) {
            statusText.textContent = 'Terhubung Online';
            statusText.style.background = 'rgba(16,185,129,0.18)';
            statusText.style.color = '#10b981';
            statusText.style.borderColor = 'rgba(16,185,129,0.3)';
          }
          // Fetch question count from cloud
          const resB = await fetch('/api/banks?stage=all');
          if (resB.ok) {
            const dataB = await resB.json();
            const totalQ = dataB.count != null ? dataB.count : (dataB.questions ? dataB.questions.length : 0);
            if (countBadge) {
              countBadge.textContent = `${totalQ} Soal Tersimpan di Cloud`;
            }
          }
        } else {
          if (indicator) {
            indicator.style.background = '#f59e0b';
            indicator.style.boxShadow = '0 0 10px #f59e0b';
          }
          if (statusText) {
            statusText.textContent = 'Mode Offline (IndexedDB)';
            statusText.style.background = 'rgba(245,158,11,0.18)';
            statusText.style.color = '#f59e0b';
            statusText.style.borderColor = 'rgba(245,158,11,0.3)';
          }
          if (countBadge) {
            countBadge.textContent = 'Penyimpanan Lokal Aktif';
          }
        }
      } catch (e) {
        if (indicator) {
          indicator.style.background = '#ef4444';
          indicator.style.boxShadow = '0 0 10px #ef4444';
        }
        if (statusText) {
          statusText.textContent = 'Offline';
          statusText.style.background = 'rgba(239,68,68,0.18)';
          statusText.style.color = '#ef4444';
          statusText.style.borderColor = 'rgba(239,68,68,0.3)';
        }
      }
    },

    onBankStageChange() {
      bankSearchQuery = '';
      bankFilterCategory = '';
      selectedQuestionIds.clear();
      const searchInput = document.getElementById('bank-search-input');
      if (searchInput) searchInput.value = '';
      const btnClearSearch = document.getElementById('btn-clear-search');
      if (btnClearSearch) btnClearSearch.style.display = 'none';
      this.updateBankStageUI();
    },

    onJenjangChange() {
      [7, 8, 9].forEach(j => {
        const b = document.getElementById(`btn_jenjang_${j}`);
        if (b) b.classList.toggle('active', activeJenjang === j);
      });
      bankSearchQuery = '';
      bankFilterCategory = '';
      selectedQuestionIds.clear();
      const searchInput = document.getElementById('bank-search-input');
      if (searchInput) searchInput.value = '';
      const btnClearSearch = document.getElementById('btn-clear-search');
      if (btnClearSearch) btnClearSearch.style.display = 'none';

      const badgeEl = document.getElementById('active-bank-stage-label');
      if (badgeEl) badgeEl.textContent = `Target Aktif: Babak Penyisihan — Kelas ${activeJenjang} (11 Mapel)`;

      this.renderBankList();
      this.updateJenjangCountsUI();
    },

    async updateJenjangCountsUI() {
      if (activeBankStage !== 'penyisihan') return;
      try {
        const counts = await window.DocxEngine.getPenyisihanJenjangCounts();
        [7, 8, 9].forEach(j => {
          const el = document.getElementById(`count_jenjang_${j}`);
          if (el) el.textContent = String(counts[j] || 0);
        });
      } catch (e) {}
    },

    updateBankStageUI() {
      ['penyisihan', 'semifinal', 'final'].forEach(st => {
        const btn = document.getElementById(`bank_tab_${st}`);
        if (btn) btn.classList.toggle('btn-primary', activeBankStage === st);
      });

      const jenjangStrip = document.getElementById('penyisihan-jenjang-strip');
      if (jenjangStrip) {
        jenjangStrip.style.display = (activeBankStage === 'penyisihan') ? 'flex' : 'none';
      }

      const stLabel = activeBankStage === 'penyisihan' ? `Babak Penyisihan — Kelas ${activeJenjang} (11 Mapel)` :
                      (activeBankStage === 'semifinal' ? 'Babak Semifinal (BS, PG1, PG2, Essay)' : 'Babak Grand Final (Tier 1, 2, 3)');
      const badgeEl = document.getElementById('active-bank-stage-label');
      if (badgeEl) badgeEl.textContent = `Target Aktif: ${stLabel}`;

      if (activeBankStage === 'penyisihan') {
        [7, 8, 9].forEach(j => {
          const b = document.getElementById(`btn_jenjang_${j}`);
          if (b) b.classList.toggle('active', activeJenjang === j);
        });
        this.updateJenjangCountsUI();
      }

      this.renderBankList();
    },

    async handleWordImport(file) {
      try {
        const statusEl = document.getElementById('import-status-msg');
        const stageDesc = (activeBankStage === 'penyisihan') ? `PENYISIHAN (Kelas ${activeJenjang})` : activeBankStage.toUpperCase();
        if (statusEl) statusEl.textContent = `Mengekstrak file Word ke Bank Soal ${stageDesc}...`;

        const result = await window.DocxEngine.importQuestionsFromDocx(file, activeBankStage, activeJenjang);

        if (statusEl) {
          statusEl.textContent = `✅ Berhasil mengimpor ${result.count} soal ke Bank ${stageDesc} (Ditemukan ${result.mathCount} rumus matematika)!`;
        }
        this.showToast(`✅ Berhasil mengimpor ${result.count} soal ke Bank Soal ${stageDesc} & tersimpan di Database Cloud!`);
        await this.renderBankList();
        this.updateJenjangCountsUI();
        this.refreshCloudStatusUI();
      } catch (err) {
        alert('Gagal membaca file Word: ' + err.message);
      }
    },

    getFilteredQuestions() {
      let filtered = allQuestionsCache || [];
      if (bankFilterCategory) {
        filtered = filtered.filter(q => {
          const cat = q.mapel || q.tipe || q.tier || '';
          return String(cat).toLowerCase() === bankFilterCategory.toLowerCase();
        });
      }
      if (bankSearchQuery.trim()) {
        const qTerm = bankSearchQuery.trim().toLowerCase();
        filtered = filtered.filter(q => {
          const qText = (q.q || '').toLowerCase();
          const ansText = (q.ans || '').toLowerCase();
          const catText = (q.mapel || q.tipe || q.tier || '').toLowerCase();
          const optText = (q.o && Array.isArray(q.o)) ? q.o.join(' ').toLowerCase() : '';
          return qText.includes(qTerm) || ansText.includes(qTerm) || catText.includes(qTerm) || optText.includes(qTerm);
        });
      }
      return filtered;
    },

    updateBatchSelectionUI() {
      const filtered = this.getFilteredQuestions();
      const visibleIds = filtered.map(q => String(q.id));
      const selCount = selectedQuestionIds.size;

      // Update counters
      const selCountEl = document.getElementById('bank-selected-count');
      const delCountNum = document.getElementById('btn-del-count');
      const btnDeleteSelected = document.getElementById('btn-delete-selected');

      if (selCountEl) {
        if (selCount > 0) {
          selCountEl.style.display = 'inline-flex';
          selCountEl.textContent = `${selCount} soal dipilih`;
        } else {
          selCountEl.style.display = 'none';
        }
      }
      if (delCountNum) delCountNum.textContent = String(selCount);
      if (btnDeleteSelected) btnDeleteSelected.disabled = selCount === 0;

      // Update select-all checkbox state
      const selectAllCb = document.getElementById('bank-select-all');
      if (selectAllCb) {
        if (visibleIds.length === 0) {
          selectAllCb.checked = false;
          selectAllCb.indeterminate = false;
          selectAllCb.disabled = true;
        } else {
          selectAllCb.disabled = false;
          const allVisSelected = visibleIds.every(id => selectedQuestionIds.has(id));
          const someVisSelected = visibleIds.some(id => selectedQuestionIds.has(id));
          selectAllCb.checked = allVisSelected;
          selectAllCb.indeterminate = !allVisSelected && someVisSelected;
        }
      }

      // Update card selected highlight class and checkbox
      document.querySelectorAll('#bank-list-container .question-card-item').forEach(card => {
        const id = card.dataset.id;
        const cb = card.querySelector('.q-checkbox');
        const isSel = selectedQuestionIds.has(String(id));
        card.classList.toggle('selected', isSel);
        if (cb) cb.checked = isSel;
      });
    },

    async renderBankList() {
      const container = document.getElementById('bank-list-container');
      if (!container) return;

      const qList = await window.DocxEngine.getStageQuestions(activeBankStage, activeJenjang);
      allQuestionsCache = qList;

      if (activeBankStage === 'penyisihan') {
        this.updateJenjangCountsUI();
      }

      // Populate Category Filter dropdown dynamically
      const categoryFilter = document.getElementById('bank-filter-category');
      if (categoryFilter) {
        const uniqueCategories = Array.from(new Set(qList.map(q => q.mapel || q.tipe || q.tier || 'Umum'))).filter(Boolean);
        const currentVal = bankFilterCategory;
        let optionsHtml = '<option value="">Semua Kategori / Mapel</option>';
        uniqueCategories.forEach(cat => {
          const sel = (cat.toLowerCase() === currentVal.toLowerCase()) ? 'selected' : '';
          optionsHtml += `<option value="${cat}" ${sel}>${cat}</option>`;
        });
        categoryFilter.innerHTML = optionsHtml;
      }

      const filtered = this.getFilteredQuestions();

      // Update total stats badge
      const totalStatsEl = document.getElementById('bank-total-stats');
      if (totalStatsEl) {
        const stageDesc = (activeBankStage === 'penyisihan') ? `Kelas ${activeJenjang}` : activeBankStage.toUpperCase();
        if (filtered.length === qList.length) {
          totalStatsEl.textContent = `Total: ${qList.length} Soal (${stageDesc})`;
        } else {
          totalStatsEl.textContent = `Menampilkan: ${filtered.length} dari ${qList.length} Soal (${stageDesc})`;
        }
      }

      if (!qList.length) {
        const stageHeading = (activeBankStage === 'penyisihan')
          ? `Bank Soal Babak PENYISIHAN (Kelas ${activeJenjang}) Kosong`
          : `Bank Soal Babak ${activeBankStage.toUpperCase()} Kosong`;
        container.innerHTML = `
          <div style="text-align:center;padding:48px 24px;border:2px dashed var(--card-border);border-radius:16px;background:rgba(255,255,255,0.01);">
            <div style="font-size:48px;margin-bottom:12px;">📭</div>
            <h4 style="font-size:18px;font-weight:800;margin:0 0 8px 0;">${stageHeading}</h4>
            <p style="color:var(--text-mut);font-size:14px;max-width:480px;margin:0 auto 20px auto;">
              Belum ada soal pada bagian ini. Anda dapat menambahkan soal secara manual atau memulihkan soal bawaan awal.
            </p>
            <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="window.App.openAddQuestionModal()">➕ Tambah Soal Manual</button>
              <button class="btn btn-gold" onclick="window.App.restoreDefaultQuestions()">🔄 Pulihkan Soal Bawaan</button>
            </div>
          </div>
        `;
        this.updateBatchSelectionUI();
        return;
      }

      if (!filtered.length) {
        container.innerHTML = `
          <div style="text-align:center;padding:40px 20px;border:1px dashed var(--card-border);border-radius:12px;">
            <div style="font-size:36px;margin-bottom:8px;">🔍</div>
            <h4 style="font-size:16px;font-weight:700;margin:0 0 6px 0;">Tidak Ada Soal yang Cocok</h4>
            <p style="color:var(--text-mut);font-size:13.5px;margin:0 0 14px 0;">
              Tidak ditemukan soal dengan kata kunci "<strong>${window.DocxEngine.formatMath(bankSearchQuery)}</strong>" pada kategori ini.
            </p>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('btn-clear-search').click()">✕ Bersihkan Pencarian</button>
          </div>
        `;
        this.updateBatchSelectionUI();
        return;
      }

      container.innerHTML = filtered.map((q, idx) => {
        const cat = q.mapel || q.tipe || q.tier || 'Umum';
        const isSel = selectedQuestionIds.has(String(q.id));
        const qMath = window.DocxEngine.formatMath(q.q);
        const catBadgeText = (activeBankStage === 'penyisihan') ? `Kelas ${q.jenjang || activeJenjang} · ${cat}` : cat;

        let optionsHtml = '';
        if (q.tipe === 'BS') {
          const isBenar = (q.k === 0 || String(q.ans).toLowerCase() === 'benar');
          optionsHtml = `
            <div style="margin-top:8px;">
              <span class="badge-pill" style="background:${isBenar ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${isBenar ? 'var(--ok)' : 'var(--bad)'};border-color:${isBenar ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};font-weight:800;">
                Kunci: ${isBenar ? '🟢 BENAR' : '🔴 SALAH'}
              </span>
            </div>
          `;
        } else if (q.o && q.o.length > 0) {
          optionsHtml = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:8px;margin-top:10px;">
              ${q.o.map((opt, i) => {
                const isKey = (q.k === i);
                return `
                  <div style="padding:7px 12px;border-radius:8px;background:${isKey ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isKey ? 'rgba(16,185,129,0.45)' : 'var(--card-border)'};font-size:13.5px;display:flex;align-items:flex-start;gap:8px;">
                    <strong style="color:${isKey ? 'var(--ok)' : 'var(--gold)'};min-width:18px;">${String.fromCharCode(65 + i)}.</strong>
                    <span style="flex:1;${isKey ? 'color:var(--ok);font-weight:700;' : ''}">${window.DocxEngine.formatMath(opt)}</span>
                    ${isKey ? '<span style="color:var(--ok);font-weight:900;">✓</span>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `;
        } else {
          optionsHtml = `
            <div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);font-size:13px;color:var(--ok);">
              <strong style="font-weight:800;">Kunci Jawaban:</strong>
              <span style="font-weight:700;">${window.DocxEngine.formatMath(q.ans || '')}</span>
            </div>
          `;
        }

        let extraBadge = '';
        if (q.val != null) {
          extraBadge = `<span class="badge-pill" style="font-size:11px;background:rgba(245,158,11,0.15);color:var(--gold);border-color:rgba(245,158,11,0.3);">+${q.val} / -${q.pen || 0} Poin</span>`;
        }

        return `
          <div class="question-card-item ${isSel ? 'selected' : ''}" data-id="${q.id}">
            <div class="q-card-select">
              <input type="checkbox" class="q-checkbox" data-id="${q.id}" ${isSel ? 'checked' : ''} title="Pilih soal ini">
            </div>
            <div class="q-card-content">
              <div class="q-card-header">
                <span class="q-card-badge">${catBadgeText}</span>
                ${extraBadge}
                <span style="font-size:11px;color:var(--text-mut);margin-left:auto;font-family:monospace;">ID: ${q.id}</span>
              </div>
              <div style="font-weight:700;font-size:15.5px;line-height:1.55;color:var(--text-main);margin:4px 0 8px 0;">
                <span style="color:var(--gold);font-weight:800;">${idx + 1}.</span> ${qMath}
              </div>
              ${q.img ? `<div><img src="${q.img}" style="max-height:130px;max-width:100%;border-radius:8px;margin:6px 0;border:1px solid var(--card-border);" alt="Ilustrasi Soal"></div>` : ''}
              ${optionsHtml}
            </div>
            <div class="q-card-actions">
              <button class="btn-action-sm btn-pv" data-id="${q.id}" title="Lihat Tampilan Penuh Soal">👁️ Preview</button>
              <button class="btn-action-sm btn-edit" data-id="${q.id}" title="Edit Soal Ini">✏️ Edit</button>
              <button class="btn-action-sm btn-del" data-id="${q.id}" title="Hapus Soal Ini">🗑️ Hapus</button>
            </div>
          </div>
        `;
      }).join('');

      this.updateBatchSelectionUI();
    },

    // ─── MODAL MANAGEMENT & FORM HANDLERS ────────────────
    bindBankModals() {
      const self = this;

      // Close modal events
      const closeButtons = [
        'btn-close-edit-q', 'btn-close-edit-q-x',
        'btn-cancel-del',
        'btn-close-pv', 'btn-close-pv-x'
      ];
      closeButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.addEventListener('click', () => {
            ['modal-edit-question', 'modal-confirm-delete', 'modal-preview-question'].forEach(mId => {
              const el = document.getElementById(mId);
              if (el) el.classList.remove('active');
            });
          });
        }
      });

      // Overlay click to close
      ['modal-edit-question', 'modal-confirm-delete', 'modal-preview-question'].forEach(mId => {
        const el = document.getElementById(mId);
        if (el) {
          el.addEventListener('click', (e) => {
            if (e.target === el) el.classList.remove('active');
          });
        }
      });

      // Category change in Edit Modal
      const editCategory = document.getElementById('edit-q-category');
      if (editCategory) {
        editCategory.addEventListener('change', () => {
          self.updateEditModalSectionsForType(editCategory.value);
        });
      }

      // Live KaTeX preview on typing
      const editQText = document.getElementById('edit-q-text');
      const editQPvContent = document.getElementById('edit-q-preview-content');
      if (editQText && editQPvContent) {
        editQText.addEventListener('input', () => {
          const val = editQText.value.trim();
          if (!val) {
            editQPvContent.innerHTML = '<span style="color:var(--text-mut);font-style:italic;">Preview akan muncul otomatis di sini saat mengetik...</span>';
          } else {
            editQPvContent.innerHTML = window.DocxEngine.formatMath(val);
          }
        });
      }

      // Image upload handling
      const imgFileInput = document.getElementById('edit-q-img-file');
      const imgUrlInput = document.getElementById('edit-q-img-url');
      const imgPreviewWrap = document.getElementById('edit-q-img-preview');
      const imgPreviewEl = document.getElementById('edit-q-img-el');
      const btnDelImg = document.getElementById('btn-edit-del-img');

      if (imgFileInput) {
        imgFileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const im = new Image();
            im.onload = () => {
              const scale = Math.min(1, 800 / Math.max(im.width, im.height));
              const cvs = document.createElement('canvas');
              cvs.width = im.width * scale;
              cvs.height = im.height * scale;
              const ctx = cvs.getContext('2d');
              ctx.drawImage(im, 0, 0, cvs.width, cvs.height);
              const dataUrl = cvs.toDataURL('image/jpeg', 0.85);
              if (imgPreviewEl) imgPreviewEl.src = dataUrl;
              if (imgPreviewWrap) imgPreviewWrap.style.display = 'block';
              if (btnDelImg) btnDelImg.style.display = 'inline-block';
              if (imgUrlInput) imgUrlInput.value = '';
            };
            im.src = reader.result;
          };
          reader.readAsDataURL(file);
        });
      }

      if (imgUrlInput) {
        imgUrlInput.addEventListener('input', () => {
          const val = imgUrlInput.value.trim();
          if (val) {
            if (imgPreviewEl) imgPreviewEl.src = val;
            if (imgPreviewWrap) imgPreviewWrap.style.display = 'block';
            if (btnDelImg) btnDelImg.style.display = 'inline-block';
          } else {
            if (imgPreviewWrap) imgPreviewWrap.style.display = 'none';
            if (btnDelImg) btnDelImg.style.display = 'none';
          }
        });
      }

      if (btnDelImg) {
        btnDelImg.addEventListener('click', () => {
          if (imgFileInput) imgFileInput.value = '';
          if (imgUrlInput) imgUrlInput.value = '';
          if (imgPreviewEl) imgPreviewEl.src = '';
          if (imgPreviewWrap) imgPreviewWrap.style.display = 'none';
          btnDelImg.style.display = 'none';
        });
      }

      // Save question button handler
      const btnSaveQ = document.getElementById('btn-save-edit-q');
      if (btnSaveQ) {
        btnSaveQ.addEventListener('click', async () => {
          await self.handleSaveQuestion();
        });
      }

      // Confirm delete action button handler
      const btnConfirmDel = document.getElementById('btn-confirm-del-action');
      if (btnConfirmDel) {
        btnConfirmDel.addEventListener('click', async () => {
          if (typeof pendingDelAction === 'function') {
            const action = pendingDelAction;
            pendingDelAction = null;
            const delModal = document.getElementById('modal-confirm-delete');
            if (delModal) delModal.classList.remove('active');
            await action();
          }
        });
      }
    },

    openAddQuestionModal() {
      const modal = document.getElementById('modal-edit-question');
      if (!modal) return;

      document.getElementById('modal-edit-q-title').textContent = '➕ Tambah Soal Baru';
      const badge = document.getElementById('modal-edit-q-stage-badge');
      if (badge) {
        badge.textContent = (activeBankStage === 'penyisihan')
          ? `Penyisihan (Kelas ${activeJenjang})`
          : `Babak ${activeBankStage.toUpperCase()}`;
      }

      document.getElementById('edit-q-id').value = '';
      document.getElementById('edit-q-stage').value = activeBankStage;

      // Jenjang radio selector for Penyisihan
      const jGroup = document.getElementById('group-edit-jenjang');
      if (jGroup) {
        jGroup.style.display = (activeBankStage === 'penyisihan') ? 'block' : 'none';
        const jRadio = document.querySelector(`input[name="edit-q-jenjang"][value="${activeJenjang}"]`);
        if (jRadio) jRadio.checked = true;
      }

      // Reset text & live preview
      const qText = document.getElementById('edit-q-text');
      if (qText) qText.value = '';
      const qPv = document.getElementById('edit-q-preview-content');
      if (qPv) qPv.innerHTML = '<span style="color:var(--text-mut);font-style:italic;">Preview akan muncul otomatis di sini saat mengetik...</span>';

      // Populate Category options
      this.populateCategorySelectOptions(activeBankStage);

      // Reset options & inputs
      for (let i = 0; i < 4; i++) {
        const opt = document.getElementById(`edit-opt-${i}`);
        if (opt) opt.value = '';
      }
      const r0 = document.querySelector('input[name="edit-q-key"][value="0"]');
      if (r0) r0.checked = true;
      const bs0 = document.querySelector('input[name="edit-bs-key"][value="0"]');
      if (bs0) bs0.checked = true;
      const essayAns = document.getElementById('edit-essay-ans');
      if (essayAns) essayAns.value = '';

      // Reset Grand Final points
      const valInput = document.getElementById('edit-q-val');
      const penInput = document.getElementById('edit-q-pen');
      if (valInput) valInput.value = '50';
      if (penInput) penInput.value = '25';

      // Reset Image
      const imgFileInput = document.getElementById('edit-q-img-file');
      const imgUrlInput = document.getElementById('edit-q-img-url');
      const imgPreviewWrap = document.getElementById('edit-q-img-preview');
      const imgPreviewEl = document.getElementById('edit-q-img-el');
      const btnDelImg = document.getElementById('btn-edit-del-img');
      if (imgFileInput) imgFileInput.value = '';
      if (imgUrlInput) imgUrlInput.value = '';
      if (imgPreviewEl) imgPreviewEl.src = '';
      if (imgPreviewWrap) imgPreviewWrap.style.display = 'none';
      if (btnDelImg) btnDelImg.style.display = 'none';

      // Configure sections visibility
      const catVal = document.getElementById('edit-q-category').value;
      this.updateEditModalSectionsForType(catVal);

      modal.classList.add('active');
    },

    openEditQuestionModal(q) {
      const modal = document.getElementById('modal-edit-question');
      if (!modal) return;

      document.getElementById('modal-edit-q-title').textContent = '✏️ Edit Soal';
      const qJ = q.jenjang || activeJenjang;
      const badge = document.getElementById('modal-edit-q-stage-badge');
      if (badge) {
        badge.textContent = (activeBankStage === 'penyisihan')
          ? `Penyisihan (Kelas ${qJ})`
          : `Babak ${activeBankStage.toUpperCase()}`;
      }

      document.getElementById('edit-q-id').value = q.id || '';
      document.getElementById('edit-q-stage').value = activeBankStage;

      // Jenjang radio selector for Penyisihan
      const jGroup = document.getElementById('group-edit-jenjang');
      if (jGroup) {
        jGroup.style.display = (activeBankStage === 'penyisihan') ? 'block' : 'none';
        const jRadio = document.querySelector(`input[name="edit-q-jenjang"][value="${qJ}"]`);
        if (jRadio) jRadio.checked = true;
      }

      // Populate Category options and select current category
      this.populateCategorySelectOptions(activeBankStage, q.mapel || q.tipe || q.tier);

      // Question text & live KaTeX preview
      const qText = document.getElementById('edit-q-text');
      if (qText) qText.value = q.q || '';
      const qPv = document.getElementById('edit-q-preview-content');
      if (qPv) qPv.innerHTML = window.DocxEngine.formatMath(q.q || '');

      // Populate options
      if (q.o && Array.isArray(q.o)) {
        for (let i = 0; i < 4; i++) {
          const opt = document.getElementById(`edit-opt-${i}`);
          if (opt) opt.value = q.o[i] || '';
        }
      }
      const rad = document.querySelector(`input[name="edit-q-key"][value="${q.k || 0}"]`);
      if (rad) rad.checked = true;

      // True/False
      const bsRad = document.querySelector(`input[name="edit-bs-key"][value="${q.k || 0}"]`);
      if (bsRad) bsRad.checked = true;

      // Essay
      const essayAns = document.getElementById('edit-essay-ans');
      if (essayAns) essayAns.value = q.ans || '';

      // Points for Grand Final
      const valInput = document.getElementById('edit-q-val');
      const penInput = document.getElementById('edit-q-pen');
      if (valInput) valInput.value = q.val != null ? q.val : 50;
      if (penInput) penInput.value = q.pen != null ? q.pen : 25;

      // Image
      const imgUrlInput = document.getElementById('edit-q-img-url');
      const imgPreviewWrap = document.getElementById('edit-q-img-preview');
      const imgPreviewEl = document.getElementById('edit-q-img-el');
      const btnDelImg = document.getElementById('btn-edit-del-img');
      const imgFileInput = document.getElementById('edit-q-img-file');
      if (imgFileInput) imgFileInput.value = '';

      if (q.img) {
        if (imgPreviewEl) imgPreviewEl.src = q.img;
        if (imgUrlInput) imgUrlInput.value = q.img.startsWith('http') ? q.img : '';
        if (imgPreviewWrap) imgPreviewWrap.style.display = 'block';
        if (btnDelImg) btnDelImg.style.display = 'inline-block';
      } else {
        if (imgPreviewEl) imgPreviewEl.src = '';
        if (imgUrlInput) imgUrlInput.value = '';
        if (imgPreviewWrap) imgPreviewWrap.style.display = 'none';
        if (btnDelImg) btnDelImg.style.display = 'none';
      }

      const catVal = document.getElementById('edit-q-category').value;
      this.updateEditModalSectionsForType(catVal);

      modal.classList.add('active');
    },

    openPreviewQuestionModal(q) {
      const modal = document.getElementById('modal-preview-question');
      if (!modal) return;

      const badge = document.getElementById('modal-pv-badge');
      if (badge) badge.textContent = q.mapel || q.tipe || q.tier || 'Umum';

      const qEl = document.getElementById('modal-pv-question');
      if (qEl) qEl.innerHTML = window.DocxEngine.formatMath(q.q || '');

      const imgWrap = document.getElementById('modal-pv-img-wrap');
      const imgEl = document.getElementById('modal-pv-img');
      if (q.img) {
        if (imgEl) imgEl.src = q.img;
        if (imgWrap) imgWrap.style.display = 'block';
      } else {
        if (imgWrap) imgWrap.style.display = 'none';
      }

      const optEl = document.getElementById('modal-pv-options');
      const keyEl = document.getElementById('modal-pv-key-box');

      if (q.tipe === 'BS') {
        const isBenar = (q.k === 0 || String(q.ans).toLowerCase() === 'benar');
        if (optEl) {
          optEl.innerHTML = `
            <div style="display:flex;gap:16px;">
              <div style="padding:10px 24px;border-radius:10px;font-weight:800;font-size:16px;background:${isBenar ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'};border:2px solid ${isBenar ? 'var(--ok)' : 'var(--card-border)'};color:${isBenar ? 'var(--ok)' : 'var(--text-mut)'};">
                🟢 BENAR ${isBenar ? '✓ (Kunci)' : ''}
              </div>
              <div style="padding:10px 24px;border-radius:10px;font-weight:800;font-size:16px;background:${!isBenar ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)'};border:2px solid ${!isBenar ? 'var(--bad)' : 'var(--card-border)'};color:${!isBenar ? 'var(--bad)' : 'var(--text-mut)'};">
                🔴 SALAH ${!isBenar ? '✓ (Kunci)' : ''}
              </div>
            </div>
          `;
        }
        if (keyEl) keyEl.innerHTML = `Kunci Jawaban Resmi: <strong>${isBenar ? 'BENAR' : 'SALAH'}</strong>`;
      } else if (q.o && q.o.length > 0) {
        if (optEl) {
          optEl.innerHTML = q.o.map((opt, i) => {
            const isKey = (q.k === i);
            return `
              <div style="padding:10px 16px;border-radius:10px;background:${isKey ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)'};border:2px solid ${isKey ? 'var(--ok)' : 'var(--card-border)'};font-size:15px;display:flex;align-items:flex-start;gap:12px;">
                <strong style="color:${isKey ? 'var(--ok)' : 'var(--gold)'};font-size:16px;">${String.fromCharCode(65 + i)}.</strong>
                <span style="flex:1;${isKey ? 'color:var(--ok);font-weight:700;' : ''}">${window.DocxEngine.formatMath(opt)}</span>
                ${isKey ? '<span style="color:var(--ok);font-weight:900;font-size:16px;">✓ Kunci Benar</span>' : ''}
              </div>
            `;
          }).join('');
        }
        const keyLetter = String.fromCharCode(65 + (q.k || 0));
        const keyText = q.o[q.k] || q.ans || '';
        if (keyEl) keyEl.innerHTML = `Kunci Jawaban: <strong>${keyLetter}. ${window.DocxEngine.formatMath(keyText)}</strong>`;
      } else {
        if (optEl) optEl.innerHTML = '';
        if (keyEl) keyEl.innerHTML = `Kunci Jawaban Singkat: <strong>${window.DocxEngine.formatMath(q.ans || '')}</strong>`;
      }

      modal.classList.add('active');
    },

    openCustomDeleteModal({ icon, title, message, buttons = [] }) {
      const modal = document.getElementById('modal-confirm-delete');
      if (!modal) return;

      const iconEl = document.getElementById('modal-del-icon');
      if (iconEl) iconEl.textContent = icon || '⚠️';
      const titleEl = document.getElementById('modal-del-title');
      if (titleEl) titleEl.innerHTML = title || 'Konfirmasi';
      const msgEl = document.getElementById('modal-del-msg');
      if (msgEl) msgEl.innerHTML = message || '';

      const actionsWrap = document.getElementById('modal-del-actions');
      if (actionsWrap) {
        actionsWrap.innerHTML = '';
        buttons.forEach(btnConfig => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `btn ${btnConfig.class || 'btn-ghost'}`;
          if (btnConfig.id) btn.id = btnConfig.id;
          if (btnConfig.style) btn.style.cssText += btnConfig.style;
          btn.innerHTML = btnConfig.text;
          btn.addEventListener('click', async () => {
            modal.classList.remove('active');
            if (typeof btnConfig.action === 'function') {
              try {
                await btnConfig.action();
              } catch (err) {
                alert('Terjadi kesalahan: ' + err.message);
              }
            }
          });
          actionsWrap.appendChild(btn);
        });
      }

      modal.classList.add('active');
    },

    openConfirmDeleteModal({ title, message, onConfirm }) {
      this.openCustomDeleteModal({
        icon: '⚠️',
        title: title || 'Konfirmasi Hapus',
        message: message || 'Apakah Anda yakin ingin menghapus data ini?',
        buttons: [
          {
            text: 'Ya, Hapus Sekarang',
            class: 'btn-danger',
            id: 'btn-confirm-del-action',
            style: 'background:var(--bad);color:#fff;font-weight:800;border:none;padding:10px 18px;border-radius:10px;cursor:pointer;',
            action: onConfirm
          },
          {
            text: 'Batal',
            class: 'btn-ghost',
            id: 'btn-cancel-del',
            style: 'padding:8px 18px;',
            action: () => {}
          }
        ]
      });
    },

    populateCategorySelectOptions(stage, selectedCategory = '') {
      const catSelect = document.getElementById('edit-q-category');
      const catLabel = document.getElementById('label-edit-category');
      if (!catSelect) return;

      let categories = [];
      if (stage === 'penyisihan') {
        if (catLabel) catLabel.textContent = 'Mata Pelajaran';
        categories = [
          'Pendidikan Agama', 'PPKn', 'Bahasa Indonesia', 'Matematika',
          'IPA', 'IPS', 'Bahasa Inggris', 'Seni Budaya', 'PJOK', 'Prakarya', 'Informatika'
        ];
      } else if (stage === 'semifinal') {
        if (catLabel) catLabel.textContent = 'Jenis / Format Soal';
        categories = ['BS', 'PG1', 'PG2', 'ES', 'CAD'];
      } else {
        if (catLabel) catLabel.textContent = 'Tier Soal & Poin';
        categories = ['Tier 1 (50 Poin)', 'Tier 2 (75 Poin)', 'Tier 3 (100 Poin)', 'Soal Tambahan'];
      }

      // Add any custom categories from cache
      allQuestionsCache.forEach(q => {
        const c = q.mapel || q.tipe || q.tier;
        if (c && !categories.includes(c)) categories.push(c);
      });

      catSelect.innerHTML = categories.map(c => {
        let label = c;
        if (stage === 'semifinal') {
          const names = {
            BS: 'BS — Benar / Salah',
            PG1: 'PG1 — Pilihan Ganda (150 Poin)',
            PG2: 'PG2 — Pilihan Ganda (200 Poin)',
            ES: 'ES — Isian Singkat',
            CAD: 'CAD — Cadangan'
          };
          label = names[c] || c;
        }
        const sel = (c.toLowerCase() === (selectedCategory || '').toLowerCase()) ? 'selected' : '';
        return `<option value="${c}" ${sel}>${label}</option>`;
      }).join('');
    },

    updateEditModalSectionsForType(catVal) {
      const secMc = document.getElementById('section-edit-mc');
      const secBs = document.getElementById('section-edit-bs');
      const secEssay = document.getElementById('section-edit-essay');
      const secPoints = document.getElementById('section-edit-points');

      if (activeBankStage === 'penyisihan') {
        if (secMc) secMc.style.display = 'block';
        if (secBs) secBs.style.display = 'none';
        if (secEssay) secEssay.style.display = 'none';
        if (secPoints) secPoints.style.display = 'none';
      } else if (activeBankStage === 'semifinal') {
        if (secPoints) secPoints.style.display = 'none';
        if (catVal === 'BS') {
          if (secBs) secBs.style.display = 'block';
          if (secMc) secMc.style.display = 'none';
          if (secEssay) secEssay.style.display = 'none';
        } else if (catVal === 'PG1' || catVal === 'PG2') {
          if (secMc) secMc.style.display = 'block';
          if (secBs) secBs.style.display = 'none';
          if (secEssay) secEssay.style.display = 'none';
        } else {
          // ES or CAD
          if (secEssay) secEssay.style.display = 'block';
          if (secMc) secMc.style.display = 'none';
          if (secBs) secBs.style.display = 'none';
        }
      } else {
        // Final
        if (secEssay) secEssay.style.display = 'block';
        if (secPoints) secPoints.style.display = 'grid';
        if (secMc) secMc.style.display = 'none';
        if (secBs) secBs.style.display = 'none';
      }
    },

    async handleSaveQuestion() {
      const qText = document.getElementById('edit-q-text').value.trim();
      if (!qText) {
        alert('Teks soal / pertanyaan wajib diisi!');
        document.getElementById('edit-q-text').focus();
        return;
      }

      const qId = document.getElementById('edit-q-id').value.trim();
      const stage = document.getElementById('edit-q-stage').value || activeBankStage;
      const category = document.getElementById('edit-q-category').value;

      // Extract image
      const imgPreviewEl = document.getElementById('edit-q-img-el');
      const imgVal = (imgPreviewEl && imgPreviewEl.src && imgPreviewEl.src.length > 10) ? imgPreviewEl.src : null;

      let qObj = {
        q: qText,
        img: imgVal
      };

      if (stage === 'penyisihan') {
        const jRadio = document.querySelector('input[name="edit-q-jenjang"]:checked');
        const targetJenjang = jRadio ? (parseInt(jRadio.value, 10) || activeJenjang) : activeJenjang;
        qObj.jenjang = targetJenjang;
        qObj.mapel = category;
        const options = [0, 1, 2, 3].map(i => document.getElementById(`edit-opt-${i}`).value.trim());
        if (options.some(opt => !opt)) {
          alert('Keempat pilihan jawaban A, B, C, dan D wajib diisi!');
          return;
        }
        const keyRadio = document.querySelector('input[name="edit-q-key"]:checked');
        const keyIdx = keyRadio ? parseInt(keyRadio.value, 10) : 0;
        qObj.o = options;
        qObj.k = keyIdx;
        qObj.ans = options[keyIdx];

        try {
          if (qId) {
            qObj.id = qId;
            if (targetJenjang !== activeJenjang) {
              await window.DocxEngine.deleteStageQuestions('penyisihan', [qId], activeJenjang);
            }
            await window.DocxEngine.updateStageQuestion('penyisihan', qId, qObj, targetJenjang);
            this.showToast(`✅ Soal berhasil diperbarui di Kelas ${targetJenjang}!`);
          } else {
            await window.DocxEngine.addStageQuestion('penyisihan', qObj, targetJenjang);
            this.showToast(`✅ Soal baru berhasil ditambahkan ke Kelas ${targetJenjang}!`);
          }

          const modal = document.getElementById('modal-edit-question');
          if (modal) modal.classList.remove('active');
          await this.renderBankList();
          this.updateJenjangCountsUI();
        } catch (err) {
          alert('Gagal menyimpan soal: ' + err.message);
        }
        return;
      } else if (stage === 'semifinal') {
        qObj.tipe = category;
        if (category === 'BS') {
          const bsRadio = document.querySelector('input[name="edit-bs-key"]:checked');
          const bsKey = bsRadio ? parseInt(bsRadio.value, 10) : 0;
          qObj.o = ['Benar', 'Salah'];
          qObj.k = bsKey;
          qObj.ans = bsKey === 0 ? 'Benar' : 'Salah';
        } else if (category === 'PG1' || category === 'PG2') {
          const options = [0, 1, 2, 3].map(i => document.getElementById(`edit-opt-${i}`).value.trim());
          if (options.some(opt => !opt)) {
            alert('Keempat pilihan jawaban wajib diisi!');
            return;
          }
          const keyRadio = document.querySelector('input[name="edit-q-key"]:checked');
          const keyIdx = keyRadio ? parseInt(keyRadio.value, 10) : 0;
          qObj.o = options;
          qObj.k = keyIdx;
          qObj.ans = options[keyIdx];
        } else {
          // ES or CAD
          const ansText = document.getElementById('edit-essay-ans').value.trim();
          if (!ansText) {
            alert('Kunci jawaban wajib diisi!');
            document.getElementById('edit-essay-ans').focus();
            return;
          }
          qObj.o = [];
          qObj.k = 0;
          qObj.ans = ansText;
        }
      } else {
        // Grand Final
        qObj.tier = category;
        const ansText = document.getElementById('edit-essay-ans').value.trim();
        if (!ansText) {
          alert('Kunci jawaban wajib diisi!');
          document.getElementById('edit-essay-ans').focus();
          return;
        }
        const valNum = parseInt(document.getElementById('edit-q-val').value, 10) || 50;
        const penNum = parseInt(document.getElementById('edit-q-pen').value, 10) || 25;
        qObj.ans = ansText;
        qObj.val = valNum;
        qObj.pen = penNum;
        qObj.o = [];
      }

      try {
        if (qId) {
          qObj.id = qId;
          await window.DocxEngine.updateStageQuestion(stage, qId, qObj);
          this.showToast('✅ Soal berhasil diperbarui & tersimpan di Database Cloud!');
        } else {
          await window.DocxEngine.addStageQuestion(stage, qObj);
          this.showToast('✅ Soal baru berhasil ditambahkan & tersimpan di Database Cloud!');
        }

        const modal = document.getElementById('modal-edit-question');
        if (modal) modal.classList.remove('active');
        await this.renderBankList();
        this.refreshCloudStatusUI();
      } catch (err) {
        alert('Gagal menyimpan soal: ' + err.message);
      }
    },

    async restoreDefaultQuestions() {
      try {
        await window.DocxEngine.restoreDefaultStageQuestions(activeBankStage, activeJenjang);
        selectedQuestionIds.clear();
        await this.renderBankList();
        this.updateJenjangCountsUI();
        this.refreshCloudStatusUI();
        const stageDesc = (activeBankStage === 'penyisihan') ? `PENYISIHAN (Kelas ${activeJenjang})` : activeBankStage.toUpperCase();
        this.showToast(`✅ Soal standar ${stageDesc} berhasil dipulihkan & tersimpan di Database Cloud!`);
      } catch (err) {
        alert('Gagal memulihkan soal: ' + err.message);
      }
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
      if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

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

      // ─── SEEDER & DATABASE CONTROLS ─────────────────────────
      const btnSeedFull = document.getElementById('btn-seed-full');
      if (btnSeedFull) {
        btnSeedFull.addEventListener('click', async () => {
          if (!confirm('Muat data simulasi kejuaraan lengkap (3 babak, skor riil, finalis & juara)? Data lama akan ditimpa.')) return;
          btnSeedFull.disabled = true;
          const origText = btnSeedFull.textContent;
          btnSeedFull.textContent = '⏳ Memproses...';
          try {
            await window.DatabaseSeeder.seedFullTournament();
            const updatedCfg = await window.PortalStorage.getConfig();
            Object.assign(cfg, updatedCfg);
            this.updateHeaderInfo(cfg);
            this.renderBankList();
            this.refreshReports();
            closeModal();
            alert('✅ Berhasil melakukan seed data demo kejuaraan lengkap!');
          } catch (e) {
            alert('Gagal melakukan seed: ' + e.message);
          } finally {
            btnSeedFull.disabled = false;
            btnSeedFull.textContent = origText;
          }
        });
      }

      const btnSeedClean = document.getElementById('btn-seed-clean');
      if (btnSeedClean) {
        btnSeedClean.addEventListener('click', async () => {
          if (!confirm('Reset ke Bank Soal bawaan bersih tanpa skor riwayat lama?')) return;
          btnSeedClean.disabled = true;
          try {
            await window.DatabaseSeeder.seedCleanTournament();
            this.renderBankList();
            this.refreshReports();
            closeModal();
            alert('✅ Database telah di-reset ke Bank Soal bersih siap pertandingan baru!');
          } catch (e) {
            alert('Gagal reset bank soal: ' + e.message);
          } finally {
            btnSeedClean.disabled = false;
          }
        });
      }

      const btnExportJson = document.getElementById('btn-export-db-json');
      if (btnExportJson) {
        btnExportJson.addEventListener('click', async () => {
          try {
            await window.DatabaseSeeder.exportDatabaseJSON();
          } catch (e) {
            alert('Gagal ekspor cadangan database: ' + e.message);
          }
        });
      }

      const btnImportTrigger = document.getElementById('btn-import-db-json-trigger');
      const inputImportJson = document.getElementById('input-import-db-json');
      if (btnImportTrigger && inputImportJson) {
        btnImportTrigger.addEventListener('click', () => inputImportJson.click());
        inputImportJson.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          try {
            const text = await file.text();
            await window.DatabaseSeeder.importDatabaseJSON(text);
            const updatedCfg = await window.PortalStorage.getConfig();
            Object.assign(cfg, updatedCfg);
            this.updateHeaderInfo(cfg);
            this.renderBankList();
            this.refreshReports();
            closeModal();
            alert('✅ Cadangan database JSON berhasil diimpor!');
          } catch (err) {
            alert('Gagal impor database: ' + err.message);
          } finally {
            inputImportJson.value = '';
          }
        });
      }

      const btnClearDb = document.getElementById('btn-clear-db');
      if (btnClearDb) {
        btnClearDb.addEventListener('click', async () => {
          if (!confirm('⚠️ Anda yakin ingin mengosongkan seluruh isi database? Tindakan ini tidak dapat dibatalkan.')) return;
          try {
            await window.DatabaseSeeder.clearDatabase();
            this.renderBankList();
            this.refreshReports();
            closeModal();
            alert('Database telah dikosongkan.');
          } catch (e) {
            alert('Gagal mengosongkan database: ' + e.message);
          }
        });
      }
    },

    refreshReports() {
      if (window.ReportEngine) {
        window.ReportEngine.renderReportHTML('report-preview-container');
      }
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
