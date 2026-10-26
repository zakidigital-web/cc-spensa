/**
 * Babak 1: Kualifikasi / Penyisihan Module
 * Complete Setup Panel, 11-Subject Balancer, and IFP 3-Split Screen Relay Arena
 */
(function(window) {
  'use strict';

  let S = null;
  let timerInterval = null;
  let activeTab = 'arena'; // 'arena' | 'setup' | 'board'
  const MAPEL_LIST = ['Pendidikan Agama', 'PPKn', 'Bahasa Indonesia', 'Matematika', 'IPA', 'IPS', 'Bahasa Inggris', 'PJOK', 'Informatika', 'Seni Budaya', 'Prakarya / B. Daerah'];

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

  const StagePenyisihan = {
    async init(containerEl) {
      this.container = containerEl;
      S = await window.PortalStorage.getPenyisihanState();
      this.render();
    },

    render() {
      if (!this.container) return;
      const j = S.cfg.jenjang || 9;
      const teams = (S.cfg.tim && S.cfg.tim[j]) || ['9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I'];
      const gelIdx = S.cfg.gel || 0;
      const totalGel = Math.max(1, Math.ceil(teams.length / 3));

      this.container.innerHTML = `
        <!-- Sub Header & Navigation -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:14px;">
          <div>
            <h2 style="font-size:24px;font-weight:900;">⚡ Babak Kualifikasi / Penyisihan</h2>
            <p style="color:var(--text-mut);font-size:14px;">
              Layar IFP Terbagi 3 Kolom · Estafet ${S.cfg.anak || 10} Siswa per Kelompok · Mode: ${S.cfg.mode === 'loop' ? 'Tanpa Batas' : 'Terbatas'}
            </p>
          </div>
          
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;background:rgba(255,255,255,0.06);border:1px solid var(--card-border);padding:3px;border-radius:12px;">
              <button class="btn btn-ghost btn-sm ${activeTab === 'arena' ? 'btn-primary' : ''}" id="p_tab_arena" style="padding:6px 14px;font-size:13px;">🎮 Arena IFP</button>
              <button class="btn btn-ghost btn-sm ${activeTab === 'setup' ? 'btn-primary' : ''}" id="p_tab_setup" style="padding:6px 14px;font-size:13px;">⚙️ Pengaturan Awal</button>
              <button class="btn btn-ghost btn-sm ${activeTab === 'board' ? 'btn-primary' : ''}" id="p_tab_board" style="padding:6px 14px;font-size:13px;">📊 Papan Skor</button>
            </div>
            <button class="btn btn-gold btn-sm" id="p_btn_advance">⏩ Kirim 9 Terbaik ke Semifinal</button>
          </div>
        </div>

        <div id="p_content_area"></div>
      `;

      this.bindTabEvents();
      this.renderCurrentSubView();
    },

    bindTabEvents() {
      document.getElementById('p_tab_arena').onclick = () => { activeTab = 'arena'; this.render(); };
      document.getElementById('p_tab_setup').onclick = () => { activeTab = 'setup'; this.render(); };
      document.getElementById('p_tab_board').onclick = () => { activeTab = 'board'; this.render(); };

      const advBtn = document.getElementById('p_btn_advance');
      if (advBtn) {
        advBtn.onclick = async () => {
          try {
            const top9 = await window.PortalStorage.advancePenyisihanToSemifinal();
            alert(`Berhasil! 9 Regu Teratas berikut telah otomatis ditransfer ke Babak Semifinal:\n\n${top9.join(', ')}`);
          } catch (e) {
            alert(e.message || 'Gagal memproses!');
          }
        };
      }
    },

    async renderCurrentSubView() {
      const area = document.getElementById('p_content_area');
      if (!area) return;

      if (activeTab === 'arena') {
        await this.renderArena(area);
      } else if (activeTab === 'setup') {
        this.renderSetup(area);
      } else if (activeTab === 'board') {
        this.renderBoard(area);
      }
    },

    // ─── SUBVIEW 1: ARENA PLAY ──────────────────────────────
    async renderArena(area) {
      const j = S.cfg.jenjang || 9;
      const teams = (S.cfg.tim && S.cfg.tim[j]) || ['9A', '9B', '9C'];
      const gelIdx = S.cfg.gel || 0;
      const totalGel = Math.max(1, Math.ceil(teams.length / 3));
      const startIdx = gelIdx * 3;
      const curTeams = [teams[startIdx] || 'Tim A', teams[startIdx + 1] || 'Tim B', teams[startIdx + 2] || 'Tim C'];

      const questions = await window.PortalStorage.getStageBank('penyisihan');

      area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;background:var(--card-bg);padding:10px 18px;border-radius:12px;border:1px solid var(--card-border);">
          <div style="display:flex;align-items:center;gap:12px;">
            <label style="font-size:13px;font-weight:700;color:var(--text-mut);">Pilih Gelombang Bertanding:</label>
            <select id="p_gel_select" class="input-field" style="width:160px;padding:6px 10px;">
              ${Array.from({ length: totalGel }, (_, i) => `<option value="${i}" ${i === gelIdx ? 'selected' : ''}>Gelombang ${i + 1} (${teams[i*3] || ''}, ${teams[i*3+1] || ''})</option>`).join('')}
            </select>
          </div>
          <div style="font-size:13px;color:var(--gold);font-weight:700;">
            Waktu Soal: ${(S.cfg.wSoal > 0 ? (S.cfg.wSoal + 's') : 'Tanpa Batas (Disabled)')} · Poin Benar: +${S.cfg.poin || 2}
          </div>
        </div>

        <div class="split-screen-grid">
          ${curTeams.map((tName, colIdx) => {
            const sc = (S.skor[j] && S.skor[j][tName]) || 0;
            const q = questions[(colIdx + gelIdx * 3) % questions.length] || { q: 'Soal belum tersedia', o: ['A', 'B', 'C', 'D'], k: 0 };
            const runnerNum = ((colIdx + 1) % (S.cfg.anak || 10)) + 1;

            return `
              <div class="split-column" style="--border-col:var(--c${colIdx});">
                <div class="col-header">
                  <div>
                    <span style="font-size:11px;color:var(--c${colIdx});font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">KOLOM ${colIdx + 1}</span>
                    <h3>${tName}</h3>
                  </div>
                  <div class="col-score" id="p_score_col_${colIdx}">${sc}</div>
                </div>
                <div class="col-runner">
                  <span class="badge" style="background:var(--c${colIdx});color:#000;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:800;">Siswa ke-${runnerNum}</span>
                  <span style="color:var(--text-mut);font-size:12px;">Estafet Menjawab</span>
                </div>
                <div class="col-timer-bar">
                  <div class="col-timer-progress" style="width:100%;"></div>
                </div>
                <div class="col-question-area">
                  <span class="q-mapel-tag">${q.mapel || 'Umum'}</span>
                  <div class="q-text">${fmtMath(q.q)}</div>
                  ${q.img ? `<img src="${q.img}" class="q-media-img" alt="Ilustrasi Soal">` : ''}
                </div>
                <div class="q-options-grid">
                  ${(q.o || ['A', 'B', 'C', 'D']).map((opt, optIdx) => `
                    <button class="btn-opt" data-col="${colIdx}" data-team="${tName}" data-opt="${optIdx}" data-correct="${q.k === optIdx ? '1' : '0'}">
                      <span style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;">${String.fromCharCode(65 + optIdx)}</span>
                      <span>${fmtMath(opt)}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Gelombang change
      const gelSel = document.getElementById('p_gel_select');
      if (gelSel) {
        gelSel.onchange = async (e) => {
          S.cfg.gel = +e.target.value;
          await window.PortalStorage.savePenyisihanState(S);
          this.render();
        };
      }

      // Handle Option Touch
      area.querySelectorAll('.btn-opt').forEach(btn => {
        btn.onclick = async () => {
          const isCorrect = btn.dataset.correct === '1';
          const tName = btn.dataset.team;
          const colIdx = btn.dataset.col;

          S.skor[j] = S.skor[j] || {};
          const add = isCorrect ? (S.cfg.poin || 2) : 0;
          S.skor[j][tName] = (S.skor[j][tName] || 0) + add;
          await window.PortalStorage.savePenyisihanState(S);

          if (isCorrect) {
            btn.classList.add('opt-ok');
            if (window.SoundFX) window.SoundFX.playCorrect();
          } else {
            btn.classList.add('opt-bad');
            if (window.SoundFX) window.SoundFX.playWrong();
          }

          const scEl = document.getElementById(`p_score_col_${colIdx}`);
          if (scEl) scEl.textContent = S.skor[j][tName];

          setTimeout(() => {
            this.render();
          }, 800);
        };
      });
    },

    // ─── SUBVIEW 2: PENGATURAN AWAL PENYISIHAN ───────────────
    renderSetup(area) {
      const j = S.cfg.jenjang || 9;
      const teams = (S.cfg.tim && S.cfg.tim[j]) || [];

      area.innerHTML = `
        <div class="glass-panel">
          <h3 style="font-size:20px;font-weight:800;margin-bottom:16px;color:var(--gold);">⚙️ Pengaturan Khusus Babak Penyisihan</h3>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:20px;">
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Jenjang Kelas</label>
              <select id="set_p_jenjang" class="input-field">
                <option value="7" ${j === 7 ? 'selected' : ''}>Kelas 7</option>
                <option value="8" ${j === 8 ? 'selected' : ''}>Kelas 8</option>
                <option value="9" ${j === 9 ? 'selected' : ''}>Kelas 9</option>
              </select>
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Jumlah Kelompok (1–26)</label>
              <input type="number" id="set_p_ntim" class="input-field" value="${S.cfg.nTim || 9}" min="1" max="26">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Anggota per Kelompok (Giliran)</label>
              <input type="number" id="set_p_anak" class="input-field" value="${S.cfg.anak || 10}" min="1">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Waktu per Soal (Detik, 0 = Nonaktif)</label>
              <input type="number" id="set_p_wsoal" class="input-field" value="${S.cfg.wSoal ?? 30}" min="0" placeholder="0 = tanpa batas">
              <small style="color:var(--text-dim);font-size:11px;">Isi 0 untuk disable batas waktu per soal</small>
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Timer Global (Menit)</label>
              <input type="number" id="set_p_gmenit" class="input-field" value="${S.cfg.gMenit || 30}" min="1">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-mut);display:block;margin-bottom:4px;">Poin per Jawaban Benar</label>
              <input type="number" id="set_p_poin" class="input-field" value="${S.cfg.poin || 2}" min="1">
            </div>
          </div>

          <h4 style="font-size:15px;font-weight:700;margin:16px 0 8px;">Daftar Nama Tim (Kelas ${j}):</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:20px;">
            ${Array.from({ length: S.cfg.nTim || 9 }, (_, i) => `
              <input type="text" class="input-field set_p_team_name" data-idx="${i}" value="${teams[i] || `${j}${String.fromCharCode(65 + i)}`}">
            `).join('')}
          </div>

          <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button class="btn btn-ghost" id="set_p_btn_reset">Reset Skor Penyisihan</button>
            <button class="btn btn-primary" id="set_p_btn_save">Simpan Pengaturan Penyisihan</button>
          </div>
        </div>
      `;

      document.getElementById('set_p_btn_save').onclick = async () => {
        S.cfg.jenjang = +document.getElementById('set_p_jenjang').value;
        S.cfg.nTim = +document.getElementById('set_p_ntim').value;
        S.cfg.anak = +document.getElementById('set_p_anak').value;
        const rawWSoal = document.getElementById('set_p_wsoal').value;
        S.cfg.wSoal = rawWSoal === '' ? 30 : Math.max(0, +rawWSoal || 0);
        S.cfg.gMenit = +document.getElementById('set_p_gmenit').value;
        S.cfg.poin = +document.getElementById('set_p_poin').value;

        const newTeams = [];
        area.querySelectorAll('.set_p_team_name').forEach(inp => {
          newTeams.push(inp.value.trim() || `Tim ${+inp.dataset.idx + 1}`);
        });
        S.cfg.tim = S.cfg.tim || {};
        S.cfg.tim[S.cfg.jenjang] = newTeams;

        await window.PortalStorage.savePenyisihanState(S);
        alert('Pengaturan Penyisihan berhasil disimpan!');
        activeTab = 'arena';
        this.render();
      };

      document.getElementById('set_p_btn_reset').onclick = async () => {
        if (confirm('Yakin ingin mereset semua skor Babak Penyisihan menjadi 0?')) {
          S.skor = { 7: {}, 8: {}, 9: {} };
          await window.PortalStorage.savePenyisihanState(S);
          alert('Skor berhasil direset.');
          this.render();
        }
      };
    },

    // ─── SUBVIEW 3: PAPAN SKOR ──────────────────────────────
    renderBoard(area) {
      const j = S.cfg.jenjang || 9;
      const teams = (S.cfg.tim && S.cfg.tim[j]) || [];
      const skorMap = (S.skor && S.skor[j]) || {};

      const list = teams.map((name, i) => ({
        name,
        score: skorMap[name] != null ? skorMap[name] : 0
      }));
      list.sort((a, b) => b.score - a.score);

      area.innerHTML = `
        <div class="glass-panel">
          <h3 style="font-size:20px;font-weight:800;margin-bottom:16px;color:var(--gold);">📊 Klasemen Agregat Babak Penyisihan (Kelas ${j})</h3>
          <p style="color:var(--text-mut);font-size:14px;margin-bottom:16px;">
            9 Tim dengan perolehan skor teratas berhak melaju ke Babak Semifinal.
          </p>
          <table class="report-table" style="background:var(--card-bg-solid);color:var(--text-main);">
            <thead>
              <tr>
                <th style="width:10%;">Peringkat</th>
                <th style="width:50%;">Nama Regu / Kelas</th>
                <th style="width:20%;">Skor</th>
                <th style="width:20%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((t, idx) => `
                <tr style="${idx < 9 ? 'background:rgba(16,185,129,0.08);' : ''}">
                  <td style="text-align:center;font-weight:bold;">${idx + 1}</td>
                  <td><b>${t.name}</b></td>
                  <td style="text-align:center;font-size:16px;font-weight:bold;color:var(--gold);">${t.score}</td>
                  <td style="text-align:center;">${idx < 9 ? '<span style="color:var(--ok);font-weight:bold;">Lolos Semifinal</span>' : '<span style="color:var(--text-mut);">Gugur</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  };

  window.StagePenyisihan = StagePenyisihan;
})(window);
