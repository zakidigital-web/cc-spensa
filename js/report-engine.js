/**
 * Official Report & Berita Acara Generator
 * Exclusively spotlights the Grand Finalists and Champions (Juara 1, 2, 3, Harapan 1 & 2)
 * Clean, official format ready for Word (.docx) export and direct A4 print.
 */
(function(window) {
  'use strict';

  const ReportEngine = {
    async compileFinalistsReport() {
      const cfg = await window.PortalStorage.getConfig();
      const finalState = await window.PortalStorage.getFinalState();

      const finalists = [];
      if (finalState && finalState.names && finalState.score) {
        finalState.names.forEach((name, i) => {
          finalists.push({
            name: name || `Tim ${i + 1}`,
            score: finalState.score[i] != null ? finalState.score[i] : 100,
            originalIndex: i
          });
        });
        // Sort highest score first
        finalists.sort((a, b) => b.score - a.score);
      } else {
        // Fallback default finalists
        ['Tim 1', 'Tim 2', 'Tim 3', 'Tim 4', 'Tim 5'].forEach((name, i) => {
          finalists.push({ name, score: 100 - i * 15, originalIndex: i });
        });
      }

      const titles = [
        { title: 'JUARA 1', desc: 'Pemenang Utama / Medali Emas', badge: '🥇' },
        { title: 'JUARA 2', desc: 'Runner Up 1 / Medali Perak', badge: '🥈' },
        { title: 'JUARA 3', desc: 'Runner Up 2 / Medali Perunggu', badge: '🥉' },
        { title: 'JUARA HARAPAN 1', desc: 'Peringkat IV Finalis', badge: '🎖️' },
        { title: 'JUARA HARAPAN 2', desc: 'Peringkat V Finalis', badge: '🎖️' }
      ];

      finalists.forEach((f, idx) => {
        const meta = titles[idx] || { title: `FINALIS ${idx + 1}`, desc: 'Peserta Grand Final', badge: '🎗️' };
        f.rank = idx + 1;
        f.title = meta.title;
        f.desc = meta.desc;
        f.badge = meta.badge;
      });

      return {
        config: cfg,
        finalists: finalists
      };
    },

    async renderReportHTML(targetContainerId) {
      const el = document.getElementById(targetContainerId);
      if (!el) return;

      const data = await this.compileFinalistsReport();
      const cfg = data.config;
      const finalists = data.finalists;

      const tableRows = finalists.map((t, idx) => `
        <tr style="${idx === 0 ? 'background:rgba(245, 158, 11, 0.12);font-weight:bold;' : ''}">
          <td style="text-align:center;font-size:16px;">${t.badge} ${t.rank}</td>
          <td style="font-size:15px;"><b>${t.name}</b></td>
          <td style="text-align:center;font-size:17px;font-weight:900;color:${idx === 0 ? '#b45309' : '#1e3a8a'};">${t.score}</td>
          <td style="text-align:center;font-weight:800;color:${idx === 0 ? '#b45309' : '#1e3a8a'};">${t.title}</td>
          <td style="font-size:13px;color:#475569;">${t.desc}</td>
        </tr>
      `).join('');

      el.innerHTML = `
        <div class="report-paper">
          <!-- Kop Surat Resmi -->
          <div class="kop-surat">
            <div class="kop-text">
              <h2>PANITIA PELAKSANA KEJUARAAN</h2>
              <h1>${cfg.schoolName.toUpperCase()}</h1>
              <p>${cfg.subTitle} · Tahun Ajaran 2026/2027</p>
            </div>
          </div>

          <!-- Judul Dokumen -->
          <div style="text-align:center;margin-bottom:20px;">
            <h3 style="font-size:18px;text-decoration:underline;text-transform:uppercase;margin-bottom:4px;">
              BERITA ACARA &amp; PENETAPAN JUARA BABAK GRAND FINAL
            </h3>
            <p style="font-size:13px;color:#475569;">Nomor: 421.3/CC-FINAL/${new Date().getFullYear()}</p>
          </div>

          <!-- Narasi Pembuka -->
          <p style="text-align:justify;font-size:14px;line-height:1.6;margin-bottom:16px;">
            Pada hari ini bertempat di aula utama / panggung kehormatan <b>${cfg.schoolName}</b>, telah dilaksanakan secara resmi Babak Grand Final kejuaraan <b>${cfg.title}</b>. Berdasarkan hasil akumulasi skor akhir, ketepatan jawaban, dan keputusan musyawarah Dewan Juri, dengan ini ditetapkan para pemenang kejuaraan sebagai berikut:
          </p>

          <!-- Tabel Pemenang / Finalis Saja -->
          <table class="report-table">
            <thead>
              <tr>
                <th style="width:12%;">Peringkat</th>
                <th style="width:30%;">Nama Regu / Kelas</th>
                <th style="width:18%;">Skor Akhir</th>
                <th style="width:22%;">Gelar Juara</th>
                <th style="width:18%;">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <!-- Pernyataan Sah -->
          <p style="text-align:justify;font-size:14px;line-height:1.6;margin-top:16px;">
            Keputusan Dewan Juri ini bersifat mutlak, mengikat, dan disahkan tanpa adanya intervensi dari pihak mana pun. Seluruh finalis berhak menerima piagam penghargaan, piala kejuaraan, dan dana pembinaan sesuai ketentuan panitia.
          </p>

          <p style="text-align:right;font-size:13.5px;margin-top:20px;">
            Ditetapkan di: <b>${cfg.schoolName}</b><br>
            Tanggal: <b>${cfg.eventDate}</b>
          </p>

          <!-- Tanda Tangan Tiga Pihak -->
          <div class="signature-block">
            <div class="sign-box">
              <p>Ketua Dewan Juri,</p>
              <div class="sign-space"></div>
              <p><b><u>${cfg.juryChiefName}</u></b><br><span style="font-size:12px;color:#64748b;">NIP. 19780512 200501 1 004</span></p>
            </div>
            <div class="sign-box">
              <p>Ketua Panitia Pelaksana,</p>
              <div class="sign-space"></div>
              <p><b><u>${cfg.chairmanName}</u></b><br><span style="font-size:12px;color:#64748b;">NIP. 19820315 200801 1 009</span></p>
            </div>
            <div class="sign-box">
              <p>Mengetahui,<br>Kepala Sekolah,</p>
              <div class="sign-space" style="height:54px;"></div>
              <p><b><u>${cfg.principalName}</u></b><br><span style="font-size:12px;color:#64748b;">NIP. 19690410 199412 1 002</span></p>
            </div>
          </div>
        </div>
      `;
    },

    async exportReportToDocx() {
      if (!window.docx) throw new Error('Library docx.js belum siap!');

      const {
        Document, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, BorderStyle, convertInchesToTwip
      } = window.docx;

      const data = await this.compileFinalistsReport();
      const cfg = data.config;
      const finalists = data.finalists;

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

      function createCell(text, width, align = AlignmentType.LEFT, bold = false) {
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text || '-'), bold, font: "Calibri", size: 18 })] })]
        });
      }

      const rows = [
        new TableRow({
          children: [
            createHeaderCell("Peringkat", 15),
            createHeaderCell("Nama Regu / Finalis", 35),
            createHeaderCell("Skor Akhir", 20),
            createHeaderCell("Gelar Juara", 30)
          ]
        })
      ];

      finalists.forEach((t, i) => {
        rows.push(new TableRow({
          children: [
            createCell(String(t.rank), 15, AlignmentType.CENTER, i === 0),
            createCell(t.name, 35, AlignmentType.LEFT, i === 0),
            createCell(String(t.score), 20, AlignmentType.CENTER, true),
            createCell(t.title, 30, AlignmentType.CENTER, true)
          ]
        }));
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1), right: convertInchesToTwip(1) } }
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "PANITIA PELAKSANA KEJUARAAN", bold: true, size: 22, font: "Calibri" })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: cfg.schoolName.toUpperCase(), bold: true, size: 26, font: "Calibri", color: "1E3A8A" })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              border: { bottom: { color: "000000", space: 4, style: BorderStyle.DOUBLE, size: 12 } },
              children: [new TextRun({ text: cfg.subTitle, italics: true, size: 18, font: "Calibri", color: "64748B" })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [new TextRun({ text: "BERITA ACARA & PENETAPAN JUARA GRAND FINAL", bold: true, underline: {}, size: 24, font: "Calibri" })]
            }),
            new Paragraph({
              spacing: { after: 140 },
              children: [new TextRun({ text: `Pada hari ini telah diselesaikan Babak Grand Final ${cfg.title} di ${cfg.schoolName}. Berdasarkan penilaian Dewan Juri, berikut adalah penetapan resmi para pemenang kejuaraan:`, font: "Calibri", size: 20 })]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            }),
            new Paragraph({
              spacing: { before: 200, after: 200 },
              children: [new TextRun({ text: "Keputusan Dewan Juri bersifat final, mengikat, dan tidak dapat diganggu gugat.", italics: true, font: "Calibri", size: 18 })]
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 240 },
              children: [new TextRun({ text: `Ditetapkan pada: ${cfg.eventDate}`, font: "Calibri", size: 18 })]
            })
          ]
        }]
      });

      const blob = await window.docx.Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan_Juara_Grand_Final_${cfg.title.replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    },

    printPDF() {
      window.print();
    }
  };

  window.ReportEngine = ReportEngine;
})(window);
