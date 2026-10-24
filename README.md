# 🎓 Portal Terpadu Cerdas Cermat IFP

Aplikasi web modern satu pintu (*Single Access Suite*) untuk penyelenggaraan kejuaraan **Cerdas Cermat Interaktif** berbasis Smart Screen / *Interactive Flat Panel* (IFP).

Dilengkapi sistem turnamen terintegrasi (Kualifikasi Penyisihan, Semifinal 45 Kotak, dan Grand Final Rebutan Bel), mesin pengolah soal Microsoft Word (dengan dukungan rumus matematika Equation/LaTeX dan gambar ilustrasi), serta modul Berita Acara & Laporan Hasil Kejuaraan resmi yang siap diekspor ke Word (.docx) atau dicetak ke PDF (standar A4).

---

## 🌟 Fitur Utama

1. **Satu Pintu Akses (*Single Access Portal*):**
   - Mengoperasikan Babak Penyisihan, Semifinal, dan Grand Final dalam satu URL tanpa perlu berpindah-pindah file manual.
   - Dilengkapi tema Gelap (*Midnight Luxury*) dan Terang (*Daylight*) yang dapat diubah dengan satu sentuhan.
2. **Transfer Pemenang Otomatis (*Auto-Tournament Progression*):**
   - 9 Tim teratas babak Penyisihan dapat langsung diteruskan ke Semifinal dengan tombol **"Kirim 9 Terbaik ke Semifinal"**.
   - 5 Tim teratas Semifinal otomatis siap dipanggil ke Babak Grand Final dengan modal awal 100 poin.
3. **Mesin Pengolah Soal Microsoft Word (`.docx`):**
   - **Impor Soal:** Membaca dokumen Word lengkap dengan persamaan matematika (LaTeX / Office MathML) dan gambar ilustrasi (otomatis diubah menjadi Base64).
   - **Unduh Template Word:** Menyediakan format tabel Word resmi siap isi untuk mempermudah guru/panitia dalam membuat soal.
   - **Ekspor Bank Soal:** Mengekspor bank soal ke format Word `.docx` yang rapi.
4. **Berita Acara & Laporan Hasil Kejuaraan:**
   - Format standar dokumen resmi dilengkapi Kop Surat, nomor berita acara, tabel rekapitulasi babak 1 s.d. 3, penetapan gelar juara, dan kolom tanda tangan Dewan Juri, Ketua Panitia, dan Kepala Sekolah.
   - Dapat diunduh sebagai file Microsoft Word (`.docx`) atau dicetak langsung ke PDF melalui layout A4 browser.
5. **Kesiapan Online di Vercel (*Vercel Ready*):**
   - 100% *client-side reactive* menggunakan IndexedDB lokal berkecepatan tinggi.
   - Tanpa ketergantungan server database eksternal yang rumit/berbayar, sehingga dapat di-deploy secara instan di Vercel secara gratis.

---

## 🚀 Panduan Deployment ke Vercel

### Opsi A: Deploy Melalui GitHub (Paling Mudah)
1. Buat repositori baru di GitHub (misal: `cerdas-cermat-ifp`).
2. Masukkan file di folder `CC` ke repositori tersebut:
   ```bash
   git init
   git add .
   git commit -m "feat: Portal Terpadu Cerdas Cermat IFP"
   git remote add origin https://github.com/USERNAME/cerdas-cermat-ifp.git
   git push -u origin main
   ```
3. Buka dashboard [Vercel](https://vercel.com) dan klik **"Add New Project"**.
4. Pilih repositori GitHub Anda dan klik **"Deploy"**.
5. Vercel akan membaca konfigurasi `vercel.json` dan aplikasi Anda langsung aktif online dalam hitungan detik!

### Opsi B: Deploy Langsung Menggunakan Vercel CLI
```bash
# Install Vercel CLI jika belum terpasang
npm i -g vercel

# Masuk ke direktori
cd /home/darkverst/workspace/CC

# Deploy ke production
vercel --prod
```

---

## 📂 Struktur File Direktori

```
CC/
├── index.html                                  # Aplikasi Portal Terpadu Utama
├── vercel.json                                 # Konfigurasi routing & security headers Vercel
├── package.json                                # Skrip build & dependensi
├── README.md                                   # Panduan penggunaan & instalasi
├── Mekanisme_dan_Peraturan_Cerdas_Cermat.docx  # Panduan juknis resmi dalam Word
├── Mekanisme_dan_Peraturan_Cerdas_Cermat.md    # Panduan juknis resmi dalam Markdown
├── MASTER_PLAN_PORTAL_CERDAS_CERMAT.docx       # Cetak biru arsitektur Word
├── MASTER_PLAN_PORTAL_CERDAS_CERMAT.md         # Cetak biru arsitektur Markdown
├── css/
│   ├── app.css                                 # Gaya tema, glassmorphism, dan cetak A4
│   └── katex.min.css                           # Styling rumus matematika KaTeX
├── js/
│   ├── app.js                                  # Router & controller utama
│   ├── audio.js                                # Synthesizer suara (bel, timer, efek benar/salah)
│   ├── storage.js                              # Penyimpanan IndexedDB & auto-progression
│   ├── docx-engine.js                          # Mesin impor & ekspor Word (Equation & Gambar)
│   ├── report-engine.js                        # Generator laporan hasil & berita acara
│   └── stages/
│       ├── penyisihan.js                       # Babak 1: Kualifikasi IFP 3-Split Screen
│       ├── semifinal.js                        # Babak 2: Semifinal 45 Kotak Terbuka
│       └── final.js                            # Babak 3: Grand Final Buzzer & Knockout
└── vendor/
    ├── docx.min.js                             # Library pembuat Word di browser
    ├── jszip.min.js                            # Library pengurai arsip Word XML
    ├── katex.min.js                            # Library perender rumus matematika
    └── mammoth.min.js                          # Library pembaca dokumen Word & gambar
```

---

## ⌨️ Pintasan Keyboard Operator

- **Babak Semifinal:**
  - `1` / `B` : Menetapkan jawaban **Benar**.
  - `2` : Menetapkan jawaban **Setengah Benar** (khusus Essay).
  - `3` / `S` : Menetapkan jawaban **Salah**.
  - `P` : Menjeda / Melanjutkan timer.
  - `K` : Membuka / Menutup kunci jawaban.

- **Babak Grand Final:**
  - `1` s.d. `5` : Memilih tim yang menekan bel (Tim 1 hingga Tim 5).
  - `B` : Menetapkan jawaban **Benar** (+poin sesuai tier).
  - `S` : Menetapkan jawaban **Salah** (penalti tier & memicu eliminasi jika skor $\le 0$).
  - `P` : Menjeda / Melanjutkan timer 90 detik.
  - `J` : Menampilkan kunci jawaban juri.

---
*Dibuat dengan standar keunggulan rekayasa web oleh Antigravity Engineering.*
