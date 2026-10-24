/**
 * Babak 3: Grand Final Module
 * Dedicated Setup Panel, High-Stakes Tiered Scoring, Buzzer System, & Knockout Elimination
 */
(function(window) {
  'use strict';

  let F = null;
  let activeTab = 'arena'; // 'arena' | 'setup'
  let timerInterval = null;
  const TIER = [50, 75, 100];
  const PENALTY = [25, 35, 50];

  function fmtMath(text) {
    if (!text) return '';
    text = String(text);
    if (!window.katex) return text;
    return text.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (m, d, i) => {
      try {
        return window.katex.renderToString(d || i, { displayMode: !!d, throwOnError: false });
      } catch (e) {
        return m;
      }
    });
  }

  const StageFinal = {
    async init(containerEl) {
      this.container = containerEl;
      F = await window.PortalStorage.getFinalState();
      this.render();
    },

    async getQuestionData(idx) {
      const questions = await window.PortalStorage.getStageBank('final');
      if (idx < questions.length) {
        return questions[idx];
      }
      return {
        q: `Pertanyaan Final No. ${idx + 1}`,
        ans: 'Kunci jawaban'
      };
    },

    render() {
      if (!this.container) return;
      const nextIdx = F.done.indexOf(false);
      const isFinished = nextIdx === -1 && F.started;

      let winnerName = '';
      if (isFinished) {
        let maxSc = -999;
        let wIdx = 0;
        F.score.forEach((sc, i) => {
          if (sc > maxSc) {
            maxSc = sc;
            wIdx = i;
          }
        });
        winnerName = F.names[wIdx] || `Tim ${wIdx + 1}`;
      }

      this.container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:14px;">
          <div>
            <h2 style="font-size:24px;font-weight:900;">🔥 Babak Grand Final (Rebutan Bel &amp; Eliminasi)</h2>
            <p style="color:var(--text-mut);font-size:14px;">
              Modal Awal: ${F.init || 100} Poin · Durasi: ${F.dur || 90}s · Penalti Waktu Habis: -${F.np || 5} · Gugur Jika Poin &le; 0
            </p>
          </div>
          
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="display:flex;background:rgba(255,255,255,0.06);border:1px solid var(--card-border);padding:3px;border-radius:12px;">
              <button class="btn btn-ghost btn-sm ${activeTab === 'arena' ? 'btn-primary' : ''}" id="f_tab_arena" style="padding:6px 14px;font-size:13px;">🏆 Arena Rebutan</button>
              <button class="btn btn-ghost btn-sm ${activeTab === 'setup' ? 'btn-primary' : ''}" id="f_tab_setup" style="padding:6px 14px;font-size:13px;">⚙️ Pengaturan Final</button>
            </div>
          </div>
        </div>

        <div id="f_content_area"></div>
      `;

      this.bindTabEvents();
      this.renderCurrentSubView(isFinished, winnerName);
    },

    bindTabEvents() {
      document.getElementById('f_tab_arena').onclick = () => { activeTab = 'arena'; this.render(); };
      document.getElementById('f_tab_setup').onclick = () => { activeTab = 'setup'; this.render(); };
    },

    renderCurrentSubView(isFinished, winnerName) {
      const area = document.getElementById('f_content_area');
      if (!area) return;

      if (activeTab === 'arena') {
        this.renderArenaView(area, isFinished, winnerName);
      } else if (activeTab === 'setup') {
        this.renderSetupView(area);
      }
    },

    // ─── SUBVIEW 1: ARENA GRAND FINAL ────────────────────────
    renderArenaView(area, isFinished, winnerName) {
      const nextIdx = F.done.indexOf(false);

      area.innerHTML = `
        ${isFinished ? `
          <div class="glass-panel" style="text-align:center;padding:32px;margin-bottom:20px;border-color:var(--gold);">
            <h1 style="color:var(--gold);font-size:36px;font-weight:900;">👑 SELAMAT KEPADA JUARA 1</h1>
            <h2 style="font-size:30px;margin:8px 0;font-weight:800;">${winnerName}</h2>
            <p style="color:var(--text-mut);font-size:15px;">Kejuaraan Grand Final Cerdas Cermat IFP telah selesai.</p>
          </div>
        ` : ''}

        <!-- 5 Teams Scoreboard -->
        <div class="final-scoreboard">
          ${F.names.map((name, i) => {
            const sc = F.score[i];
            const isEliminated = sc <= 0;
            return `
              <div class="final-team-card ${isEliminated ? 'eliminated' : ''}" style="--c:var(--c${i});">
                <span class="badge" style="background:var(--c${i});color:#000;width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;margin-bottom:6px;">${i + 1}</span>
                <b style="font-size:15px;display:block;">${name}</b>
                <span>${isEliminated ? 'TERELIMINASI' : sc}</span>
                <small style="color:var(--text-mut);font-size:12px;">Tombol Bel: [${i + 1}]</small>
              </div>
            `;
          }).join('')}
        </div>

        <!-- 15 Tiered Question Boxes -->
        <div class="final-board-grid">
          ${F.done.map((done, i) => {
            const tierIdx = Math.floor(i / 5);
            const val = TIER[tierIdx];
            const isNext = i === nextIdx;

            return `
              <button class="final-box tier-${tierIdx} ${done ? 'done' : ''} ${isNext ? 'active-next' : ''}" data-idx="${i}" ${isNext ? '' : 'disabled'}>
                ${i + 1}
                <small style="font-size:12px;margin-top:4px;opacity:0.9;">+${val} / -${PENALTY[tierIdx]}</small>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Arena Modal Overlay -->
        <div id="final-modal" class="modal-overlay">
          <div class="final-arena">
            <span id="fm_badge" class="badge" style="background:var(--gold);color:#000;padding:6px 20px;border-radius:30px;font-size:14px;font-weight:800;">SOAL</span>
            
            <div style="display:flex;align-items:center;justify-content:center;gap:36px;flex-wrap:wrap;width:100%;">
              <div class="timer-ring-container">
                <svg viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="12"></circle>
                  <circle id="fm_ring" cx="100" cy="100" r="90" fill="none" stroke="var(--ok)" stroke-width="12" stroke-linecap="round" stroke-dasharray="565.5" transform="rotate(-90 100 100)"></circle>
                </svg>
                <div id="fm_timer" class="timer-text-display">90</div>
              </div>

              <div class="glass-panel" style="flex:1 1 500px;text-align:left;padding:26px 30px;">
                <div id="fm_qtext" style="font-size:26px;font-weight:700;line-height:1.4;"></div>
                <div id="fm_media"></div>
                <div id="fm_ans" style="display:none;margin-top:14px;color:var(--ok);font-size:20px;font-weight:bold;"></div>
              </div>
            </div>

            <!-- Team Buzzer Selector -->
            <div id="fm_buzzers" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:10px;">
              ${F.names.map((name, i) => {
                const el = F.score[i] <= 0;
                return `
                  <button class="btn btn-ghost fm-team-btn" data-team="${i}" style="border-color:var(--c${i});" ${el ? 'disabled' : ''}>
                    ${i + 1}. ${name}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Controls -->
            <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;justify-content:center;">
              <button class="btn btn-ghost" id="fm_btn_ans">🔑 Kunci Jawaban (J)</button>
              <button class="btn btn-success" id="fm_btn_ok">✔ Benar (B)</button>
              <button class="btn btn-danger" id="fm_btn_no">✖ Salah (S)</button>
              <button class="btn btn-ghost" id="fm_btn_pause">⏸ Jeda (P)</button>
              <button class="btn btn-ghost" id="fm_btn_close">Kembali ke Papan</button>
            </div>
          </div>
        </div>
      `;

      const nextBtn = area.querySelector(`.final-box[data-idx="${nextIdx}"]`);
      if (nextBtn) {
        nextBtn.onclick = () => this.openQuestion(nextIdx);
      }
    },

    async openQuestion(qIdx) {
      const qData = await this.getQuestionData(qIdx);
      const tierIdx = Math.floor(qIdx / 5);
      const val = TIER[tierIdx] || 100;
      const pen = PENALTY[tierIdx] || 50;

      const modal = document.getElementById('final-modal');
      const badge = document.getElementById('fm_badge');
      const qText = document.getElementById('fm_qtext');
      const mediaEl = document.getElementById('fm_media');
      const ansEl = document.getElementById('fm_ans');
      const timerEl = document.getElementById('fm_timer');
      const ringEl = document.getElementById('fm_ring');

      F.started = true;
      badge.textContent = `SOAL ${qIdx + 1} | +${val} POIN | SALAH -${pen}`;
      qText.innerHTML = fmtMath(qData.q);
      mediaEl.innerHTML = qData.img ? `<img src="${qData.img}" class="q-media-img" alt="Soal">` : '';
      ansEl.textContent = 'Kunci: ' + qData.ans;
      ansEl.style.display = 'none';

      let remSec = F.dur || 90;
      let isPaused = false;
      let selectedTeam = null;

      timerEl.textContent = remSec;
      modal.classList.add('active');

      if (window.SoundFX) window.SoundFX.playTileOpen();

      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (isPaused) return;
        remSec--;
        timerEl.textContent = remSec;
        const fraction = remSec / (F.dur || 90);
        ringEl.style.strokeDashoffset = 565.5 * (1 - fraction);
        ringEl.style.stroke = fraction > 0.5 ? '#10b981' : (fraction > 0.2 ? '#f59e0b' : '#ef4444');

        if (remSec <= 15 && remSec > 0 && F.snd) {
          if (window.SoundFX) window.SoundFX.playHeartbeat();
        }

        if (remSec <= 0) {
          clearInterval(timerInterval);
          if (window.SoundFX) window.SoundFX.playWrong();
          if (selectedTeam === null) {
            F.score = F.score.map(sc => (sc > 0 ? Math.max(0, sc - (F.np || 5)) : 0));
            alert(`Waktu habis tanpa ada bel! Seluruh tim dipotong -${F.np || 5} poin.`);
          }
          F.done[qIdx] = true;
          window.PortalStorage.saveFinalState(F);
          modal.classList.remove('active');
          this.render();
        }
      }, 1000);

      // Buzzer selection
      const teamBtns = modal.querySelectorAll('.fm-team-btn');
      teamBtns.forEach(btn => {
        btn.onclick = () => {
          const tIdx = +btn.dataset.team;
          if (F.score[tIdx] <= 0) return;
          selectedTeam = tIdx;
          isPaused = true;
          teamBtns.forEach(b => b.classList.remove('btn-primary'));
          btn.classList.add('btn-primary');
          if (window.SoundFX) window.SoundFX.playBuzzer();
        };
      });

      document.getElementById('fm_btn_ans').onclick = () => {
        ansEl.style.display = ansEl.style.display === 'none' ? 'block' : 'none';
      };

      document.getElementById('fm_btn_pause').onclick = (e) => {
        isPaused = !isPaused;
        e.target.textContent = isPaused ? '▶ Lanjut (P)' : '⏸ Jeda (P)';
      };

      document.getElementById('fm_btn_ok').onclick = async () => {
        if (selectedTeam === null) {
          alert('Pilih tim penekan bel terlebih dahulu!');
          return;
        }
        clearInterval(timerInterval);
        F.score[selectedTeam] += val;
        F.done[qIdx] = true;
        await window.PortalStorage.saveFinalState(F);
        if (window.SoundFX) window.SoundFX.playCorrect();
        modal.classList.remove('active');
        this.render();

        if (F.done.indexOf(false) === -1 && window.SoundFX) {
          window.SoundFX.triggerConfetti();
        }
      };

      document.getElementById('fm_btn_no').onclick = async () => {
        if (selectedTeam === null) {
          alert('Pilih tim penekan bel terlebih dahulu!');
          return;
        }
        clearInterval(timerInterval);
        F.score[selectedTeam] = Math.max(0, F.score[selectedTeam] - pen);
        F.done[qIdx] = true;
        await window.PortalStorage.saveFinalState(F);
        if (window.SoundFX) window.SoundFX.playWrong();
        modal.classList.remove('active');
        this.render();
      };

      document.getElementById('fm_btn_close').onclick = () => {
        clearInterval(timerInterval);
        modal.classList.remove('active');
      };
    },

    // ─── SUBVIEW 2: PENGATURAN FINAL ────────────────────────
    renderSetupView(area) {
      const names = F.names || [];

      area.innerHTML = `
        <div class="glass-panel">
          <h3 style="font-size:20px;font-weight:800;margin-bottom:16px;color:var(--gold);">⚙️ Pengaturan Khusus Babak Grand Final</h3>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:20px;">
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Jumlah Tim Finalis (2–6)</label>
              <input type="number" id="set_f_ntim" class="input-field" value="${F.n || 5}" min="2" max="6">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Modal Poin Awal</label>
              <input type="number" id="set_f_init" class="input-field" value="${F.init || 100}" min="10">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Durasi per Soal (Detik)</label>
              <input type="number" id="set_f_dur" class="input-field" value="${F.dur || 90}" min="10" max="300">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Pengurangan Waktu Habis Tanpa Bel</label>
              <input type="number" id="set_f_np" class="input-field" value="${F.np || 5}" min="0">
            </div>
          </div>

          <h4 style="font-size:15px;font-weight:700;margin:16px 0 8px;">Daftar Nama Tim Finalis:</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:8px;margin-bottom:20px;">
            ${Array.from({ length: F.n || 5 }, (_, i) => `
              <input type="text" class="input-field set_f_team_name" data-idx="${i}" value="${names[i] || `Tim ${i + 1}`}">
            `).join('')}
          </div>

          <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button class="btn btn-ghost" id="set_f_btn_reset">Reset Skor Final ke Modal 100</button>
            <button class="btn btn-primary" id="set_f_btn_save">Simpan Pengaturan Grand Final</button>
          </div>
        </div>
      `;

      document.getElementById('set_f_btn_save').onclick = async () => {
        F.n = +document.getElementById('set_f_ntim').value;
        F.init = +document.getElementById('set_f_init').value;
        F.dur = +document.getElementById('set_f_dur').value;
        F.np = +document.getElementById('set_f_np').value;

        const newNames = [];
        area.querySelectorAll('.set_f_team_name').forEach(inp => {
          newNames.push(inp.value.trim() || `Tim ${+inp.dataset.idx + 1}`);
        });
        F.names = newNames;

        await window.PortalStorage.saveFinalState(F);
        alert('Pengaturan Grand Final berhasil disimpan!');
        activeTab = 'arena';
        this.render();
      };

      document.getElementById('set_f_btn_reset').onclick = async () => {
        if (confirm('Reset ulang babak final? Skor seluruh tim kembali ke modal awal dan semua kotak dibuka kembali.')) {
          F.score = Array(F.n).fill(F.init || 100);
          F.done = Array(15).fill(false);
          F.started = false;
          await window.PortalStorage.saveFinalState(F);
          alert('Grand Final berhasil direset.');
          activeTab = 'arena';
          this.render();
        }
      };
    }
  };

  window.StageFinal = StageFinal;
})(window);
