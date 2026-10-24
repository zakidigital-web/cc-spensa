# 🎓 Portal Resmi Cerdas Cermat IFP

Aplikasi web modern satu pintu (*Single Access Suite*) untuk penyelenggaraan kejuaraan **Cerdas Cermat Interaktif** berbasis Smart Screen / *Interactive Flat Panel* (IFP).

Suite ini mengintegrasikan seluruh babak kejuaraan (**Kualifikasi Penyisihan**, **Semifinal 45 Kotak**, dan **Grand Final Knockout**) dengan mempertahankan **100% pengaturan dan tata cara asli** setiap babak, diperkuat mesin pengolah soal Microsoft Word (dengan dukungan rumus matematika Equation/LaTeX dan gambar ilustrasi), serta modul penetapan juara dan Berita Acara resmi yang siap diekspor ke Word (.docx) atau dicetak ke PDF (standar A4).

---

## 🌟 Fitur Utama

1. **Satu Pintu Akses (*Single Access Portal*):**
   - Mengoperasikan Babak Penyisihan, Semifinal, dan Grand Final dalam satu URL tanpa perlu berpindah-pindah file manual.
   - Dilengkapi tema Gelap (*Midnight Luxury*) dan Terang (*Daylight*) yang sinkron otomatis ke seluruh panggung permainan.
   - Dukungan mode **Layar Penuh (F11)** satu klik untuk kenyamanan operasional pada layar Interactive Flat Panel (IFP).
   - Opsi membuka setiap babak secara terpisah di tab/jendela mandiri untuk konfigurasi multi-monitor / proyektor panggung.

2. **Kemandirian & Integritas Pengaturan Asli Setiap Babak:**
   - **Babak Penyisihan**: Layar 3-Split Touch IFP, pengaturan jenjang kelas 7/8/9, gelombang 3 kelompok, estafet anak, timer global/soal, dan alokasi 11 mata pelajaran kurikulum SMP.
   - **Babak Semifinal**: Stepper jumlah tim 2–12, undi giliran animasi, pergeseran ronde (*fair play*), rubrik juri essay (100–300 poin), dan papan 45 kotak terbuka.
   - **Babak Grand Final**: Modal awal 100 poin, waktu 90s, penalti waktu habis tanpa bel (-5 poin), risiko poin tier (+50/-25 s.d. +100/-50), sistem gugur, dan efek detak jantung audio.
   - Sesuai regulasi kompetisi, pengaturan awal dan skor setiap babak berdiri sendiri secara mandiri tanpa pencampuran nilai antar-babak.

3. **Mesin Pengolah Soal Microsoft Word (`.docx`):**
   - **Impor Soal:** Membaca dokumen Word lengkap dengan persamaan matematika (LaTeX / Office MathML: pecahan, akar, pangkat, rumus aljabar) dan gambar ilustrasi (otomatis diubah menjadi Base64).
   - **Unduh Template Word:** Menyediakan format tabel Word resmi siap isi untuk mempermudah guru/panitia dalam membuat soal per babak.
   - **Ekspor Bank Soal:** Mengekspor seluruh bank soal aktif ke format Word `.docx` yang rapi.

4. **Berita Acara & Laporan Penetapan Juara:**
   - Sesuai juknis resmi, laporan akhir memuat rekapitulasi tim yang tampil di **Babak Grand Final** beserta penetapan Juara 1, Juara 2, Juara 3, Harapan 1, dan Harapan 2.
   - Format standar dokumen kedinasan dilengkapi Kop Surat, nomor berita acara, dan kolom tanda tangan Dewan Juri, Ketua Panitia, serta Kepala Sekolah.
   - Dapat diunduh sebagai file Microsoft Word (`.docx`) atau dicetak langsung ke PDF layout A4 browser.

5. **Kesiapan Online di Vercel (*Vercel Ready*):**
   - 100% *client-side reactive* menggunakan IndexedDB dan LocalStorage lokal berkecepatan tinggi.
   - Tanpa ketergantungan server database eksternal yang rumit/berbayar, siap di-deploy secara instan di Vercel secara gratis.

---

## 🚀 Panduan Menjalankan Secara Lokal & Jaringan

### Menjalankan Server Lokal
Pastikan [Bun](https://bun.sh) atau [Node.js](https://nodejs.org) telah terpasang:

```bash
# Masuk ke folder proyek
cd /home/darkverst/workspace/CC

# Jalankan server
bun server.js
# atau menggunakan npm
npm start
```

Server otomatis aktif dan menampilkan alamat akses:
- **Akses Lokal (di laptop ini):** `http://localhost:3000/`
- **Akses Jaringan (di HP / Tablet / Layar IFP):** `http://10.255.18.196:3000/` *(sesuai IP Wi-Fi)*

> **Catatan Port & Firewall:** Port 3000 telah diizinkan pada firewall Linux (`ufw allow 3000/tcp`), sehingga perangkat lain di jaringan Wi-Fi yang sama dapat langsung mengakses tanpa kendala.

---

## 🌐 Panduan Deployment ke Vercel (Online)

### Opsi A: Deploy Langsung Menggunakan Vercel CLI
```bash
cd /home/darkverst/workspace/CC
npx vercel
```
Ikuti instruksi singkat di terminal, proyek Anda akan langsung tayang online dengan domain gratis Vercel (misal: `https://cerdas-cermat-ifp.vercel.app`).

### Opsi B: Deploy Melalui GitHub
1. Buat repositori baru di GitHub (misal: `cerdas-cermat-portal`).
2. Hubungkan folder ini dan push:
   ```bash
   git remote add origin https://github.com/USERNAME/cerdas-cermat-portal.git
   git branch -M main
   git push -u origin main
   ```
3. Buka dashboard [Vercel](https://vercel.com) -> **"Add New Project"** -> Pilih repositori tersebut -> Klik **"Deploy"**.
4. File `vercel.json` akan otomatis mengatur rute URL bersih (`/penyisihan`, `/semifinal`, `/final`, `/`).

---

## ⌨️ Pintasan Keyboard Operator (HUD Juri)

| Tombol | Fungsi | Area Penggunaan |
| :---: | :--- | :--- |
| **`1` – `6`** | Memilih tim yang memencet bel | Babak Grand Final |
| **`B`** | Menetapkan jawaban **BENAR** (+poin) | Semifinal & Grand Final |
| **`S`** | Menetapkan jawaban **SALAH** (-penalti) | Semifinal & Grand Final |
| **`P`** | Menjeda / Melanjutkan waktu timer | Seluruh Babak |
| **`J`** | Membuka kunci jawaban soal | Seluruh Babak |
| **`F11`** | Masuk / Keluar Mode Layar Penuh IFP | Global |
| **`?`** | Membuka jendela panduan pintasan | Global |
| **`Esc`** | Menutup modal / dialog | Global |

---

## 📂 Struktur Berkas

```
CC/
├── index.html                                  # Hub portal terpadu satu pintu
├── penyisihan-cerdas-cermat.html               # Babak 1: Kualifikasi IFP 3-Split Screen
├── semifinal-cerdas-cermat.html                # Babak 2: Semifinal 45 Kotak Terbuka
├── Cerdas Cermat Final fix.html                # Babak 3: Grand Final Bel Knockout
├── vercel.json                                 # Konfigurasi routing & caching Vercel
├── package.json                                # Skrip build & dependensi
├── server.js                                   # Web server lokal zero-dependency
├── test-analyzer.js                            # Skrip pengujian otomatis Playwright
├── CC_Portal_Complete.zip                      # Paket arsip rilis lengkap
├── css/
│   ├── app.css                                 # Gaya portal hub, glassmorphism, cetak A4
│   ├── unified-stage.css                       # Penyelarasan tema & token terpadu 3 game
│   └── katex.min.css                           # Styling rumus matematika KaTeX
├── js/
│   ├── app.js                                  # Controller utama & sinkronisasi tema
│   ├── audio.js                                # Synthesizer efek suara Web Audio API
│   ├── storage.js                              # Pengelola IndexedDB & LocalStorage
│   ├── docx-engine.js                          # Mesin impor/ekspor Word (Equation & Gambar)
│   ├── report-engine.js                        # Generator laporan berita acara juara
│   └── default-banks.js                        # Bank soal bawaan terisolasi
└── vendor/
    ├── docx.min.js                             # Library Word generator client-side
    ├── jszip.min.js                            # Library pengurai arsip Word XML
    ├── katex.min.js                            # Library perender rumus matematika
    └── mammoth.min.js                          # Library pembaca dokumen Word & gambar
```
