import fs from "fs";

// Load docx UMD bundle
const code = fs.readFileSync("./vendor/docx.min.js", "utf8");
const fn = new Function(code + "; return docx;");
const docx = fn();

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel
} = docx;

const borderThin = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
const cellBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

function hCell(text, widthPercent) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: cellBorders,
    shading: { fill: "1E3A8A" }, // Deep Navy Luxury
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Calibri", size: 20 })]
      })
    ]
  });
}

function bCell(text, widthPercent, align = AlignmentType.LEFT, bold = false, italic = false) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: cellBorders,
    margins: { top: 90, bottom: 90, left: 130, right: 130 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, font: "Calibri", size: 19, bold, italics: italic })]
      })
    ]
  });
}

function makeHeaderSection(title, subtitle, stageNotes, modelDescriptions = []) {
  const noteParagraphs = stageNotes.map(note => new Paragraph({
    spacing: { after: 60 },
    bullet: { level: 0 },
    children: [
      new TextRun({ text: note, size: 19, font: "Calibri", color: "334155" })
    ]
  }));

  const modelParagraphs = modelDescriptions.length > 0 ? [
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({ text: "💡 DAFTAR MODEL & VARIASI SOAL PADA TEMPLATE INI:", bold: true, size: 21, font: "Calibri", color: "1E3A8A" })
      ]
    }),
    ...modelDescriptions.map(desc => new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({ text: desc, size: 19, font: "Calibri", color: "1E293B" })
      ]
    }))
  ] : [];

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: title, bold: true, size: 30, font: "Calibri", color: "1E3A8A" })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({ text: subtitle, italics: true, size: 21, font: "Calibri", color: "475569" })
      ]
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "📋 PANDUAN PENGISIAN & KETENTUAN FORMAT:", bold: true, size: 21, font: "Calibri", color: "D97706" })
      ]
    }),
    ...noteParagraphs,
    ...modelParagraphs,
    new Paragraph({ spacing: { after: 180 }, children: [] })
  ];
}

// ══════════════════════════════════════════════════════════════
// 1. TEMPLATE BABAK PENYISIHAN (SEMUA MODEL SOAL PILIHAN GANDA)
// ══════════════════════════════════════════════════════════════
async function buildPenyisihanTemplate() {
  const notes = [
    "Format tabel 8 kolom: No, Mata Pelajaran, Pertanyaan & Gambar, Pilihan A, B, C, D, dan Kunci Jawaban.",
    "Mendukung rumus matematika LaTeX (misal: $\\frac{1}{2}$, $\\sqrt{144}$, $x^2$), teks analisis, idiom bahasa, dan gambar.",
    "Gambar pendukung dapat di-paste/insert langsung ke dalam sel kolom 'Pertanyaan & Gambar'.",
    "Kunci Jawaban WAJIB diisi dengan satu huruf kapital: A, B, C, atau D.",
    "Sistem otomatis mengimpor soal ke seluruh kelas (Jenjang 7, 8, dan 9) serta dapat diacak oleh panitia."
  ];

  const models = [
    "Model 1: Soal Teori & Konsep Dasar (PPKn, Agama, Sejarah, Sains)",
    "Model 2: Soal Rumus Matematika (Pecahan, Akar, Eksponen, Aljabar $x$)",
    "Model 3: Soal Analisis Paragraf / Teks Bacaan (Bahasa Indonesia & Sastra)",
    "Model 4: Soal Bergambar / Diagram / Peta / Struktur Organ (IPA & IPS)",
    "Model 5: Soal Bahasa Asing / Grammar / Idiom / Terjemahan (Bahasa Inggris)",
    "Model 6: Soal Logika & Hubungan Sebab-Akibat (Penalaran Kritis)",
    "Model 7: Soal Teknologi & Komputasi (Informatika & Cyber)",
    "Model 8: Soal Seni & Budaya Tradisional (Kesenian & Budaya Nusantara)"
  ];

  const headerRows = [
    new TableRow({
      children: [
        hCell("No", 5),
        hCell("Mata Pelajaran", 18),
        hCell("Pertanyaan & Gambar (Rumus LaTeX $...$)", 37),
        hCell("Pilihan A", 10),
        hCell("Pilihan B", 10),
        hCell("Pilihan C", 10),
        hCell("Pilihan D", 10),
        hCell("Kunci", 6)
      ]
    })
  ];

  const sampleData = [
    // Model 1: Teori & Konsep Dasar
    ["1", "PPKn", "Lambang sila ke-3 dalam perisai Garuda Pancasila (Persatuan Indonesia) adalah ...", "Pohon Beringin", "Bintang Emas", "Rantai Baja", "Padi dan Kapas", "A"],
    ["2", "Pendidikan Agama", "Rukun Islam yang kedua dan wajib dilaksanakan lima waktu sehari semalam adalah ...", "Salat", "Syahadat", "Puasa Ramadan", "Zakat Mal", "A"],
    ["3", "IPS", "Organisasi kerja sama regional bangsa-bangsa di Asia Tenggara (ASEAN) didirikan pada 8 Agustus 1967 di ...", "Bangkok, Thailand", "Jakarta, Indonesia", "Manila, Filipina", "Singapura", "A"],

    // Model 2: Rumus Matematika & Eksak (Pecahan, Aljabar, Akar, Geometri)
    ["4", "Matematika", "Hasil dari operasi penjumlahan pecahan $\\frac{1}{2} + \\frac{1}{4}$ adalah ...", "$\\frac{3}{4}$", "$\\frac{2}{6}$", "$\\frac{1}{6}$", "$1$", "A"],
    ["5", "Matematika", "Jika $3x - 5 = 16$, maka nilai $x$ yang memenuhi persamaan tersebut adalah ...", "7", "5", "6", "9", "A"],
    ["6", "Matematika", "Hasil perhitungan dari $\\sqrt{144} + 2^3 - 5$ adalah ...", "15", "18", "12", "14", "A"],
    ["7", "Matematika", "Luas sebuah lingkaran dengan jari-jari $r = 7\\text{ cm}$ ($\\pi = \\frac{22}{7}$) adalah ...", "154 cm²", "44 cm²", "308 cm²", "88 cm²", "A"],

    // Model 3: Analisis Teks / Paragraf Bacaan
    ["8", "Bahasa Indonesia", "Bacalah teks berikut: 'Hutan bakau memiliki peran krusial dalam menahan gempuran ombak laut serta mencegah abrasi di sepanjang garis pantai.' Gagasan pokok paragraf di atas adalah ...", "Fungsi hutan bakau bagi pantai", "Penyebab abrasi di pesisir", "Keanekaragaman hayati bakau", "Ciri-ciri fisik tanaman bakau", "A"],
    ["9", "Bahasa Indonesia", "Kata hubung (konjungsi) yang menyatakan hubungan sebab-akibat dalam kalimat majemuk adalah ...", "Karena", "Atau", "Meskipun", "Tetapi", "A"],

    // Model 4: Soal Gambar / Diagram / Peta
    ["10", "IPA", "[Gambar: Struktur Organel Sel] Organel sel bermembran ganda yang bertindak sebagai pembangkit energi utama (ATP) melalui respirasi seluler adalah ...", "Mitokondria", "Ribosom", "Kloroplas", "Lisosom", "A"],
    ["11", "IPA", "Zat pigmen hijau pada daun tumbuhan yang berfungsi menangkap energi cahaya matahari untuk fotosintesis adalah ...", "Klorofil", "Karotenoid", "Antosianin", "Xantofil", "A"],

    // Model 5: Bahasa Asing & Grammar
    ["12", "Bahasa Inggris", "Complete the sentence with correct verb: 'Every morning, the students ... together before entering the classroom.'", "gather", "gathers", "gathering", "gathered", "A"],
    ["13", "Bahasa Inggris", "The antonym of the word 'generous' (suka memberi / dermawan) is ...", "Stingy", "Helpful", "Honest", "Polite", "A"],

    // Model 6: Logika & Hubungan Sebab-Akibat
    ["14", "PJOK & Kesehatan", "Kondisi kekurangan cairan tubuh secara berlebih akibat aktivitas fisik berat tanpa hidrasi cukup disebut ...", "Dehidrasi", "Hipotermia", "Anemia", "Hipertensi", "A"],
    ["15", "Informatika", "Perangkat keras (hardware) komputer yang bertindak sebagai 'otak' pemroses seluruh instruksi data adalah ...", "CPU", "Monitor", "RAM", "Harddisk", "A"],
    ["16", "Seni Budaya", "Alat musik tradisional Sasando yang dimainkan dengan cara dipetik berasal dari daerah ...", "Nusa Tenggara Timur", "Jawa Barat", "Sumatera Barat", "Kalimantan Barat", "A"]
  ];

  const bodyRows = sampleData.map(row => new TableRow({
    children: [
      bCell(row[0], 5, AlignmentType.CENTER),
      bCell(row[1], 18, AlignmentType.LEFT, true),
      bCell(row[2], 37),
      bCell(row[3], 10),
      bCell(row[4], 10),
      bCell(row[5], 10),
      bCell(row[6], 10),
      bCell(row[7], 6, AlignmentType.CENTER, true)
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeaderSection(
          "TEMPLATE BANK SOAL BABAK PENYISIHAN",
          "Kejuaraan Cerdas Cermat Multidisiplin Berbasis Smart Screen IFP",
          notes,
          models
        ),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [...headerRows, ...bodyRows]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("./templates/Template_Soal_Penyisihan.docx", buffer);
  console.log("✓ Template Penyisihan generated (bytes):", buffer.length);
}

// ══════════════════════════════════════════════════════════════
// 2. TEMPLATE BABAK SEMIFINAL (SEMUA MODEL SOAL 5 BABAK)
// ══════════════════════════════════════════════════════════════
async function buildSemifinalTemplate() {
  const notes = [
    "Format tabel 9 kolom: No, Jenis Soal, Pertanyaan & Gambar, Pilihan A, B, C, D, Kunci Pilihan, dan Kunci Esai Juri.",
    "Kolom 'Jenis Soal' WAJIB diisi dengan kode standar:",
    "  • BS    : Soal Benar / Salah (Babak 1, +100 poin, salah -50, durasi 20 detik)",
    "  • PG150 : Pilihan Ganda Sedang (Babak 2, +150 poin, salah -75, durasi 30 detik)",
    "  • PG200 : Pilihan Ganda Sukar / Hitungan (Babak 3, +200 poin, salah -100, durasi 45 detik)",
    "  • ES    : Soal Esai Rebutan (Babak 4, +100 s.d. +300 poin, juri memverifikasi uraian, durasi 90 detik)",
    "  • CAD   : Soal Cadangan (Digunakan sewaktu-waktu saat tie-break atau anulir soal)",
    "Untuk tipe BS: Kolom Kunci diisi 'B' (Benar) atau 'S' (Salah). Pilihan A & B otomatis Benar/Salah.",
    "Untuk tipe PG150 & PG200: Isi opsi A, B, C, D dan kolom Kunci diisi A, B, C, atau D.",
    "Untuk tipe ES & CAD: Tuliskan jawaban lengkap pada kolom 'Kunci Jawaban Esai (Juri)' sebagai pegangan dewan juri."
  ];

  const models = [
    "Model BS-1: Benar/Salah Sains & Fakta Alamiah (Contoh: Paus termasuk mamalia)",
    "Model BS-2: Benar/Salah Hitungan Matematika Cepat (Contoh: 12 x 8 = 96)",
    "Model BS-3: Benar/Salah Sejarah & Kenegaraan (Contoh: Proklamasi 17 Agustus 1945)",
    "Model PG150: Pilihan Ganda Sedang Berbobot 150 Poin (Opsi A, B, C, D)",
    "Model PG200: Pilihan Ganda Sukar Berbobot 200 Poin (Hitungan Rumus / Logika Kompleks)",
    "Model ES-1: Soal Uraian / Isian Singkat Rebutan (Kunci padat jelas untuk Dewan Juri)",
    "Model ES-2: Soal Uraian Sebutkan / Klasifikasi (Dilengkapi rubrik poin jawaban juri)",
    "Model CAD: Soal Cadangan Siaga Rebutan (Sebagai bantalan darurat panggung)"
  ];

  const headerRows = [
    new TableRow({
      children: [
        hCell("No", 5),
        hCell("Jenis Soal", 11),
        hCell("Pertanyaan & Gambar (Rumus LaTeX $...$)", 34),
        hCell("Pilihan A", 9),
        hCell("Pilihan B", 9),
        hCell("Pilihan C", 9),
        hCell("Pilihan D", 9),
        hCell("Kunci", 5),
        hCell("Kunci Jawaban Esai (Juri)", 18)
      ]
    })
  ];

  const sampleData = [
    // Model BS: Benar / Salah (Babak 1)
    ["1", "BS", "Matahari terbit dari arah timur dan tenggelam di sebelah barat.", "Benar", "Salah", "-", "-", "B", ""],
    ["2", "BS", "Paus dan lumba-lumba tergolong hewan mamalia yang bernapas dengan paru-paru.", "Benar", "Salah", "-", "-", "B", ""],
    ["3", "BS", "Hasil perhitungan dari $15 \\times 4$ adalah 55.", "Benar", "Salah", "-", "-", "S", ""],
    ["4", "BS", "Candi Prambanan merupakan candi peninggalan kebudayaan bercorak Buddha terbesar di dunia.", "Benar", "Salah", "-", "-", "S", ""],
    ["5", "BS", "Kandungan gas terbanyak yang menyusun atmosfer bumi adalah gas Nitrogen.", "Benar", "Salah", "-", "-", "B", ""],

    // Model PG150: Pilihan Ganda I (Babak 2)
    ["6", "PG150", "Ibu kota dari Provinsi Kalimantan Timur saat ini adalah ...", "Samarinda", "Balikpapan", "Bontang", "Tarakan", "A", ""],
    ["7", "PG150", "Planet terdekat dari Matahari dalam sistem tata surya kita adalah ...", "Merkurius", "Venus", "Mars", "Bumi", "A", ""],
    ["8", "PG150", "Tokoh proklamator yang menandatangani naskah teks Proklamasi Kemerdekaan RI adalah ...", "Soekarno dan Hatta", "Soepomo dan Yamin", "Sutan Sjahrir", "Ahmad Soebardjo", "A", ""],

    // Model PG200: Pilihan Ganda II (Babak 3 - Sukar / Hitungan)
    ["9", "PG200", "Sebuah tabung memiliki jari-jari $r = 7\\text{ cm}$ dan tinggi $t = 10\\text{ cm}$. Berapakah volumenya? ($\\pi = \\frac{22}{7}$)", "1.540 cm³", "770 cm³", "3.080 cm³", "154 cm³", "A", ""],
    ["10", "PG200", "Hasil operasi hitung aljabar dari $(2x + 3)(x - 4)$ adalah ...", "$2x^2 - 5x - 12$", "$2x^2 + 5x - 12$", "$2x^2 - 11x - 12$", "$2x^2 - 5x + 12$", "A", ""],
    ["11", "PG200", "Sebuah benda bermassa 4 kg bergerak dengan percepatan $5\\text{ m/s}^2$. Besar gaya yang bekerja adalah ... ($F = m \\cdot a$)", "20 Newton", "9 Newton", "1 Newton", "40 Newton", "A", ""],

    // Model ES: Soal Esai Rebutan (Babak 4)
    ["12", "ES", "Sebutkan rumusan lengkap teks sila kelima Pancasila!", "-", "-", "-", "-", "-", "Keadilan sosial bagi seluruh rakyat Indonesia."],
    ["13", "ES", "Apakah nama zat cair penghubung yang membawa oksigen dan nutrisi ke seluruh sel tubuh manusia?", "-", "-", "-", "-", "-", "Darah (atau Sel Darah Merah / Hemoglobin)."],
    ["14", "ES", "Sebutkan 3 komponen utama sistem komputer!", "-", "-", "-", "-", "-", "1. Perangkat Keras (Hardware), 2. Perangkat Lunak (Software), 3. Pengguna (Brainware)."],
    ["15", "ES", "Berapakah hasil dari operasi akar kubik $\\sqrt[3]{1.000} + 5^2$?", "-", "-", "-", "-", "-", "35 (karena 10 + 25 = 35)."],

    // Model CAD: Soal Cadangan Siaga
    ["16", "CAD", "SOAL CADANGAN: Siapakah pencipta lagu kebangsaan Indonesia Raya?", "-", "-", "-", "-", "-", "Wage Rudolf Supratman (W.R. Supratman)."],
    ["17", "CAD", "SOAL CADANGAN: Berapakah hasil dari $25 \\times 4 + 50$?", "-", "-", "-", "-", "-", "150."]
  ];

  const bodyRows = sampleData.map(row => new TableRow({
    children: [
      bCell(row[0], 5, AlignmentType.CENTER),
      bCell(row[1], 11, AlignmentType.CENTER, true),
      bCell(row[2], 34),
      bCell(row[3], 9),
      bCell(row[4], 9),
      bCell(row[5], 9),
      bCell(row[6], 9),
      bCell(row[7], 5, AlignmentType.CENTER, true),
      bCell(row[8], 18, AlignmentType.LEFT, false, true)
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeaderSection(
          "TEMPLATE BANK SOAL BABAK SEMIFINAL",
          "Kompetisi Papan Kotak Skor Multiround & Perebutan Nilai IFP",
          notes,
          models
        ),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [...headerRows, ...bodyRows]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("./templates/Template_Soal_Semifinal.docx", buffer);
  console.log("✓ Template Semifinal generated (bytes):", buffer.length);
}

// ══════════════════════════════════════════════════════════════
// 3. TEMPLATE BABAK GRAND FINAL (SEMUA MODEL KOTAK MATRIKS 3x5 + TIE BREAK)
// ══════════════════════════════════════════════════════════════
async function buildFinalTemplate() {
  const notes = [
    "Babak Grand Final menggunakan struktur matriks 15 Kotak (5 kolom x 3 baris) ditambah 1 Kotak Soal Tambahan.",
    "Format tabel 4 kolom: No, Kategori & Poin Kotak, Pertanyaan Rebutan, dan Kunci Jawaban Dewan Juri.",
    "Pembagian Kategori Poin Panggung:",
    "  • Kotak 1 s.d. 5   : Tier 1 (50 Poin | Benar +50 | Salah -25) — Fakta Singkat & Refleks Cepat",
    "  • Kotak 6 s.d. 10  : Tier 2 (75 Poin | Benar +75 | Salah -35) — Hitungan Logika & Hubungan Menengah",
    "  • Kotak 11 s.d. 15 : Tier 3 (100 Poin | Benar +100 | Salah -50) — Konseptual & Analisis Tingkat Tinggi",
    "  • Kotak 16         : Soal Tambahan Tie-Breaker (100 Poin) — Penentu Juara saat skor akhir berimbang",
    "Kunci Jawaban dituliskan secara ringkas, tegas, dan definitif sehingga Juri dapat langsung memutus Benar/Salah."
  ];

  const models = [
    "Model Tier 1 (Kotak 1-5): Pertanyaan Definisi Singkat, Akronim, Identifikasi Langsung (Kecepatan Bel)",
    "Model Tier 2 (Kotak 6-10): Pertanyaan Numerik, Rumus, Konversi Satuan, Sebab-Akibat Menengah",
    "Model Tier 3 (Kotak 11-15): Pertanyaan Sintesis, Prinsip Sains, Pemecahan Masalah, Analisis Kritis",
    "Model Tie-Breaker (Kotak 16): Pertanyaan Penentu Kemenangan Rebutan (Definitif tanpa multitafsir)"
  ];

  const headerRows = [
    new TableRow({
      children: [
        hCell("No", 8),
        hCell("Kategori & Poin Kotak", 24),
        hCell("Pertanyaan Rebutan Panggung", 44),
        hCell("Kunci Jawaban Dewan Juri", 24)
      ]
    })
  ];

  const sampleData = [
    // Tier 1: Kotak 1 - 5 (50 Poin)
    ["1", "Tier 1 (50 Poin)", "Apa kepanjangan dari singkatan CPU dalam dunia komputer?", "Central Processing Unit"],
    ["2", "Tier 1 (50 Poin)", "Manakah yang BUKAN perangkat masukan (input): keyboard, mouse, atau proyektor?", "Proyektor (Perangkat Keluaran / Output)"],
    ["3", "Tier 1 (50 Poin)", "Sistem bilangan berbasis dua yang hanya menggunakan simbol 0 dan 1 disebut?", "Biner (Binary)"],
    ["4", "Tier 1 (50 Poin)", "Apakah ekstensi file standar dokumen dokumen pengolah kata modern Microsoft Word?", ".docx"],
    ["5", "Tier 1 (50 Poin)", "Perangkat lunak untuk menjelajah halaman internet seperti Google Chrome atau Edge disebut?", "Browser / Web Browser (Peramban Web)"],

    // Tier 2: Kotak 6 - 10 (75 Poin)
    ["6", "Tier 2 (75 Poin)", "Konversikan bilangan biner 1010 ke dalam bentuk bilangan desimal!", "10 (Sepuluh)"],
    ["7", "Tier 2 (75 Poin)", "Apakah fungsi utama sistem firewall pada jaringan komputer?", "Menyaring lalu lintas data & mencegah akses tidak sah"],
    ["8", "Tier 2 (75 Poin)", "Urutan langkah-langkah logis dan terstruktur untuk menyelesaikan suatu masalah disebut?", "Algoritma"],
    ["9", "Tier 2 (75 Poin)", "Fungsi spreadsheet Microsoft Excel untuk menghitung nilai rata-rata dari rentang sel adalah?", "=AVERAGE(...)"],
    ["10", "Tier 2 (75 Poin)", "Apakah kepanjangan resmi dari singkatan URL pada alamat website?", "Uniform Resource Locator"],

    // Tier 3: Kotak 11 - 15 (100 Poin)
    ["11", "Tier 3 (100 Poin)", "Teknik computational thinking dengan memecah masalah kompleks menjadi bagian-bagian lebih kecil disebut?", "Dekomposisi (Decomposition)"],
    ["12", "Tier 3 (100 Poin)", "Berapakah hasil dari $2^8$ (jumlah variasi kombinasi pada satu byte memori)?", "256"],
    ["13", "Tier 3 (100 Poin)", "Cabang ilmu kecerdasan buatan (AI) yang mempelajari algoritma komputer untuk belajar dari data disebut?", "Machine Learning (Pembelajaran Mesin)"],
    ["14", "Tier 3 (100 Poin)", "Bentuk kejahatan siber yang mencoba mencuri informasi rahasia dengan memalsukan email/situs disebut?", "Phishing"],
    ["15", "Tier 3 (100 Poin)", "Konversikan bilangan desimal 13 ke dalam representasi biner!", "1101 (Delapan + Empat + Nol + Satu)"],

    // Soal Tambahan: Kotak 16 (100 Poin)
    ["16", "Soal Tambahan (100 Poin)", "SOAL PENENTUAN JUARA (TIE-BREAKER): Satu byte data terdiri dari berapa bit?", "8 bit"]
  ];

  const bodyRows = sampleData.map(row => new TableRow({
    children: [
      bCell(row[0], 8, AlignmentType.CENTER),
      bCell(row[1], 24, AlignmentType.LEFT, true),
      bCell(row[2], 44),
      bCell(row[3], 24, AlignmentType.LEFT, true)
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeaderSection(
          "TEMPLATE BANK SOAL BABAK GRAND FINAL",
          "Matriks 15 Kotak Rebutan & Tie-Breaker Cerdas Cermat IFP",
          notes,
          models
        ),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [...headerRows, ...bodyRows]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("./templates/Template_Soal_Grand_Final.docx", buffer);
  console.log("✓ Template Grand Final generated (bytes):", buffer.length);
}

async function main() {
  await buildPenyisihanTemplate();
  await buildSemifinalTemplate();
  await buildFinalTemplate();
  console.log("🎉 SEMUA TEMPLATE WORD DENGAN SELURUH MODEL SOAL BERHASIL DI-GENERATE LENGKAP!");
}

main().catch(err => {
  console.error("Error generating templates:", err);
  process.exit(1);
});
