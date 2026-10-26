/**
 * Babak 2: Semifinal Module
 * Dedicated Setup Panel, Digital Draw Animation, 45-Kotak Board, and Rotating Round-Robin
 */
(function(window) {
  'use strict';

  let G = null;
  let activeTab = 'board'; // 'board' | 'setup' | 'draw'
  let timerInterval = null;

  function fmtMath(text) {
    if (!text) return '';
    if (typeof window !== 'undefined' && typeof window.normalizeMath === 'function') {
      text = window.normalizeMath(text);
    }
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

  const StageSemifinal = {
    async init(containerEl) {
      this.container = containerEl;
      G = await window.PortalStorage.getSemifinalState();

      // Ensure game boxes are initialized from bank_semifinal
      if (!G.game || !G.game.boxes || G.game.boxes.length === 0) {
        await this.initGameStructure();
      }

      this.render();
    },

    async initGameStructure() {
      const questions = await window.PortalStorage.getStageBank('semifinal');
      const teams = (G.cfg && G.cfg.tim) || ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5', 'Tim 6', 'Tim 7', 'Tim 8', 'Tim 9'];

      const boxes = [];
      const types = G.cfg.jenis || [
        { k: 'BS', n: 'B/S', cnt: 18, val: 100, sec: 20 },
        { k: 'PG1', n: 'PG 1', cnt: 9, val: 150, sec: 30 },
        { k: 'PG2', n: 'PG 2', cnt: 9, val: 200, sec: 45 },
        { k: 'ES', n: 'Essay', cnt: 9, val: 300, sec: 90 }
      ];

      let boxIdx = 1;
      types.forEach(tp => {
        const pool = questions.filter(q => q.tipe === tp.k);
        for (let i = 0; i < tp.cnt; i++) {
          const q = pool[i % (pool.length || 1)] || { q: `Pertanyaan kotak ${boxIdx}`, o: [], ans: 'Kunci jawaban' };
          boxes.push({
            idx: boxIdx,
            type: tp.k,
            name: tp.n,
            val: tp.val,
            sec: tp.sec,
            done: false,
            q: q.q,
            o: q.o || [],
            ans: q.ans || '',
            img: q.img || null
          });
          boxIdx++;
        }
      });

      G.game = {
        teams: teams.map(name => ({ name, score: 0 })),
        boxes: boxes,
        turn: 0,
        round: 1
      };
      await window.PortalStorage.saveSemifinalState(G);
    },

    render() {
      if (!this.container) return;
      const game = G.game || { teams: [], boxes: [], turn: 0, round: 1 };
      const curTeamIdx = game.turn % (game.teams.length || 1);
      const activeTeam = game.teams[curTeamIdx] || { name: 'Tim 1', score: 0 };

      this.container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:14px;">
          <div>
            <h2 style="font-size:24px;font-weight:900;">🎲 Babak Semifinal (45 Kotak Terbuka)</h2>
            <p style="color:var(--text-mut);font-size:14px;">
              Giliran aktif: <b style="color:var(--gold);font-size:16px;">${activeTeam.name}</b> (Ronde ${game.round || 1}) · Lolos ke Final: Top ${G.cfg.lolos || 5}
            </p>
          </div>
          
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;background:rgba(255,255,255,0.06);border:1px solid var(--card-border);padding:3px;border-radius:12px;">
              <button class="btn btn-ghost btn-sm ${activeTab === 'board' ? 'btn-primary' : ''}" id="s_tab_board" style="padding:6px 14px;font-size:13px;">🎯 Papan 45 Kotak</button>
              <button class="btn btn-ghost btn-sm ${activeTab === 'setup' ? 'btn-primary' : ''}" id="s_tab_setup" style="padding:6px 14px;font-size:13px;">⚙️ Pengaturan Semifinal</button>
            </div>
            <button class="btn btn-gold btn-sm" id="s_btn_advance">🏆 Kirim 5 Terbaik ke Final</button>
          </div>
        </div>

        <div id="s_content_area"></div>
      `;

      this.bindTabEvents();
      this.renderCurrentSubView();
    },

    bindTabEvents() {
      document.getElementById('s_tab_board').onclick = () => { activeTab = 'board'; this.render(); };
      document.getElementById('s_tab_setup').onclick = () => { activeTab = 'setup'; this.render(); };

      const advBtn = document.getElementById('s_btn_advance');
      if (advBtn) {
        advBtn.onclick = async () => {
          try {
            const top5 = await window.PortalStorage.advanceSemifinalToFinal();
            alert(`Berhasil! 5 Tim Finalis berikut telah siap dikirim ke Babak Grand Final:\n\n${top5.join(', ')}`);
          } catch (e) {
            alert(e.message || 'Gagal memproses!');
          }
        };
      }
    },

    async renderCurrentSubView() {
      const area = document.getElementById('s_content_area');
      if (!area) return;

      if (activeTab === 'board') {
        this.renderBoardView(area);
      } else if (activeTab === 'setup') {
        this.renderSetupView(area);
      }
    },

    // ─── SUBVIEW 1: PAPAN PERMAINAN ─────────────────────────
    renderBoardView(area) {
      const game = G.game;
      const curTeamIdx = game.turn % (game.teams.length || 1);

      area.innerHTML = `
        <!-- Scoreboard Bar -->
        <div class="semi-scorebar">
          ${game.teams.map((t, i) => `
            <div class="semi-team-pill ${i === curTeamIdx ? 'active-turn' : ''}" style="--c:var(--c${i % 9});">
              <b>${t.name}</b>
              <span>${t.score}</span>
            </div>
          `).join('')}
        </div>

        <!-- 45 Grid Boxes -->
        <div class="semi-board-grid">
          ${game.boxes.map((b, idx) => `
            <button class="semi-tile t-${b.type} ${b.done ? 'done' : ''}" data-box="${idx}" ${b.done ? 'disabled' : ''}>
              ${b.idx}
              <small>${b.val}</small>
            </button>
          `).join('')}
        </div>

        <!-- Question Popup Modal -->
        <div id="semi-modal" class="modal-overlay">
          <div class="glass-panel" style="width:min(860px, 100%);text-align:left;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <span id="sm_badge" class="badge" style="background:var(--blue);color:#fff;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:800;">SOAL</span>
              <div id="sm_timer" style="font-size:28px;font-weight:900;color:var(--gold);">30</div>
            </div>
            <div id="sm_qtext" style="font-size:22px;font-weight:700;line-height:1.4;margin-bottom:14px;"></div>
            <div id="sm_media"></div>
            <div id="sm_ans" style="display:none;padding:12px;border-radius:10px;background:rgba(16,185,129,0.15);border:1px solid var(--ok);color:var(--ok);font-weight:bold;margin:14px 0;"></div>
            
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;flex-wrap:wrap;gap:10px;">
              <button class="btn btn-ghost" id="sm_btn_key">🔑 Kunci Jawaban</button>
              <div style="display:flex;gap:10px;">
                <button class="btn btn-success" id="sm_btn_ok">✔ Benar (Penuh)</button>
                <button class="btn btn-gold" id="sm_btn_half">½ Setengah</button>
                <button class="btn btn-danger" id="sm_btn_no">✖ Salah (0)</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Tile click
      area.querySelectorAll('.semi-tile').forEach(btn => {
        btn.onclick = () => {
          const idx = +btn.dataset.box;
          this.openQuestion(idx);
        };
      });
    },

    openQuestion(boxIdx) {
      const box = G.game.boxes[boxIdx];
      if (!box || box.done) return;

      const modal = document.getElementById('semi-modal');
      const badge = document.getElementById('sm_badge');
      const timerEl = document.getElementById('sm_timer');
      const qText = document.getElementById('sm_qtext');
      const mediaEl = document.getElementById('sm_media');
      const ansEl = document.getElementById('sm_ans');

      badge.textContent = `KOTAK ${box.idx} · ${box.name} · ${box.val} POIN`;
      qText.innerHTML = fmtMath(box.q);
      mediaEl.innerHTML = box.img ? `<img src="${box.img}" class="q-media-img" alt="Soal">` : '';
      ansEl.textContent = 'Kunci: ' + box.ans;
      ansEl.style.display = 'none';

      let remSec = box.sec || 30;
      timerEl.textContent = remSec;
      modal.classList.add('active');

      if (window.SoundFX) window.SoundFX.playTileOpen();

      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        remSec--;
        timerEl.textContent = remSec;
        if (remSec <= 0) {
          clearInterval(timerInterval);
          if (window.SoundFX) window.SoundFX.playWrong();
        }
      }, 1000);

      document.getElementById('sm_btn_key').onclick = () => {
        ansEl.style.display = ansEl.style.display === 'none' ? 'block' : 'none';
      };

      const closeAndScore = async (multiplier) => {
        clearInterval(timerInterval);
        box.done = true;
        const curTeamIdx = G.game.turn % G.game.teams.length;
        const addPoin = Math.floor(box.val * multiplier);
        G.game.teams[curTeamIdx].score += addPoin;
        G.game.turn++;
        if (G.game.turn % G.game.teams.length === 0) {
          G.game.round = (G.game.round || 1) + 1;
        }

        await window.PortalStorage.saveSemifinalState(G);
        modal.classList.remove('active');

        if (multiplier === 1 && window.SoundFX) window.SoundFX.playCorrect();
        else if (multiplier === 0.5 && window.SoundFX) window.SoundFX.playHalf();
        else if (multiplier === 0 && window.SoundFX) window.SoundFX.playWrong();

        this.render();
      };

      document.getElementById('sm_btn_ok').onclick = () => closeAndScore(1);
      document.getElementById('sm_btn_half').onclick = () => closeAndScore(0.5);
      document.getElementById('sm_btn_no').onclick = () => closeAndScore(0);
    },

    // ─── SUBVIEW 2: PENGATURAN SEMIFINAL ────────────────────
    renderSetupView(area) {
      const teams = (G.cfg && G.cfg.tim) || [];

      area.innerHTML = `
        <div class="glass-panel">
          <h3 style="font-size:20px;font-weight:800;margin-bottom:16px;color:var(--gold);">⚙️ Pengaturan Khusus Babak Semifinal</h3>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:20px;">
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Jumlah Tim Semifinalis (2–12)</label>
              <input type="number" id="set_s_ntim" class="input-field" value="${G.cfg.nTim || 9}" min="2" max="12">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Jumlah Tim Lolos ke Final</label>
              <input type="number" id="set_s_nlolos" class="input-field" value="${G.cfg.lolos || 5}" min="1" max="6">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Urutan Ronde Berikutnya</label>
              <select id="set_s_ronde" class="input-field">
                <option value="geser" ${G.cfg.ronde === 'geser' ? 'selected' : ''}>Bergeser Satu Posisi (Adil)</option>
                <option value="tetap" ${G.cfg.ronde === 'tetap' ? 'selected' : ''}>Sama Setiap Ronde</option>
              </select>
            </div>
          </div>

          <h4 style="font-size:15px;font-weight:700;margin:16px 0 8px;">Daftar Nama Tim Semifinal:</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:20px;">
            ${Array.from({ length: G.cfg.nTim || 9 }, (_, i) => `
              <input type="text" class="input-field set_s_team_name" data-idx="${i}" value="${teams[i] || `Tim ${i + 1}`}">
            `).join('')}
          </div>

          <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button class="btn btn-ghost" id="set_s_btn_reset">Reset Papan &amp; Mulai Ulang Semifinal</button>
            <button class="btn btn-primary" id="set_s_btn_save">Simpan Pengaturan Semifinal</button>
          </div>
        </div>
      `;

      document.getElementById('set_s_btn_save').onclick = async () => {
        G.cfg.nTim = +document.getElementById('set_s_ntim').value;
        G.cfg.lolos = +document.getElementById('set_s_nlolos').value;
        G.cfg.ronde = document.getElementById('set_s_ronde').value;

        const newTeams = [];
        area.querySelectorAll('.set_s_team_name').forEach(inp => {
          newTeams.push(inp.value.trim() || `Tim ${+inp.dataset.idx + 1}`);
        });
        G.cfg.tim = newTeams;

        await window.PortalStorage.saveSemifinalState(G);
        alert('Pengaturan Semifinal berhasil disimpan!');
        activeTab = 'board';
        this.render();
      };

      document.getElementById('set_s_btn_reset').onclick = async () => {
        if (confirm('Mulai ulang papan semifinal? Seluruh kotak akan ditutup kembali dan skor direset.')) {
          await this.initGameStructure();
          alert('Papan semifinal berhasil direset.');
          activeTab = 'board';
          this.render();
        }
      };
    }
  };

  window.StageSemifinal = StageSemifinal;
})(window);
