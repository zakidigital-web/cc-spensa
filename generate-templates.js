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
    shading: { fill: "1E3A8A" }, // Deep Navy
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Calibri", size: 20 })]
      })
    ]
  });
}

function bCell(text, widthPercent, align = AlignmentType.LEFT, bold = false) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: cellBorders,
    margins: { top: 90, bottom: 90, left: 130, right: 130 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, font: "Calibri", size: 19, bold })]
      })
    ]
  });
}

function makeHeaderSection(title, subtitle, stageNotes) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: title, bold: true, size: 32, font: "Calibri", color: "1E3A8A" })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: subtitle, italics: true, size: 22, font: "Calibri", color: "475569" })
      ]
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "📋 PETUNJUK PENGISIAN & KETENTUAN FORMAT:", bold: true, size: 21, font: "Calibri", color: "D97706" })
      ]
    }),
    ...stageNotes.map(note => new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({ text: note, size: 19, font: "Calibri", color: "334155" })
      ]
    })),
    new Paragraph({ spacing: { after: 180 }, children: [] })
  ];
}

// ══════════════════════════════════════════════════════════════
// 1. TEMPLATE BABAK PENYISIHAN
// ══════════════════════════════════════════════════════════════
async function buildPenyisihanTemplate() {
  const notes = [
    "Format tabel terdiri dari 8 kolom: No, Mata Pelajaran, Teks Soal / Persamaan, Pilihan A, B, C, D, dan Kunci.",
    "Rumus / Persamaan Matematika dapat dituliskan menggunakan Equation Word atau format LaTeX (misal: $\\frac{1}{2}+\\frac{1}{4}$ atau $\\sqrt{144}=12$).",
    "Gambar pendukung dapat di-paste / insert langsung ke dalam sel kolom 'Pertanyaan & Gambar'.",
    "Kunci jawaban diisi dengan huruf kapital: A, B, C, atau D.",
    "Mata pelajaran dapat disesuaikan (Pendidikan Agama, PPKn, Bahasa Indonesia, Matematika, IPA, IPS, Bahasa Inggris, dll)."
  ];

  const headerRows = [
    new TableRow({
      children: [
        hCell("No", 6),
        hCell("Mata Pelajaran", 18),
        hCell("Pertanyaan & Gambar (Bisa Rumus $...$)", 36),
        hCell("Pilihan A", 10),
        hCell("Pilihan B", 10),
        hCell("Pilihan C", 10),
        hCell("Pilihan D", 10),
        hCell("Kunci", 8)
      ]
    })
  ];

  const sampleData = [
    ["1", "Matematika", "Hasil penjumlahan pecahan $\\frac{1}{2} + \\frac{1}{4}$ adalah ...", "$\\frac{3}{4}$", "$\\frac{2}{6}$", "$\\frac{1}{6}$", "$1$", "A"],
    ["2", "Matematika", "Jika $2x + 6 = 14$, maka nilai dari $x$ adalah ...", "4", "5", "3", "8", "A"],
    ["3", "IPA", "Organel sel yang berfungsi sebagai tempat respirasi sel dan penghasil energi utama adalah ...", "Mitokondria", "Ribosom", "Kloroplas", "Lisosom", "A"],
    ["4", "Bahasa Indonesia", "Ide pokok atau gagasan yang menjadi dasar pengembangan sebuah paragraf disebut ...", "Gagasan utama", "Kalimat penjelas", "Kesimpulan", "Ringkasan", "A"],
    ["5", "PPKn", "Lambang sila ke-3 Pancasila (Persatuan Indonesia) adalah ...", "Pohon Beringin", "Bintang", "Rantai Emas", "Padi dan Kapas", "A"],
    ["6", "IPS", "Organisasi negara-negara Asia Tenggara (ASEAN) didirikan pada tanggal 8 Agustus 1967 di kota ...", "Bangkok", "Jakarta", "Manila", "Singapura", "A"],
    ["7", "Bahasa Inggris", "The antonym of the word \"generous\" is ...", "Stingy", "Kind", "Helpful", "Polite", "A"],
    ["8", "Informatika", "Perangkat keras komputer yang berfungsi memproses instruksi dan mengeksekusi program adalah ...", "CPU", "Monitor", "Keyboard", "Printer", "A"]
  ];

  const bodyRows = sampleData.map(row => new TableRow({
    children: [
      bCell(row[0], 6, AlignmentType.CENTER),
      bCell(row[1], 18, AlignmentType.LEFT, true),
      bCell(row[2], 36),
      bCell(row[3], 10),
      bCell(row[4], 10),
      bCell(row[5], 10),
      bCell(row[6], 10),
      bCell(row[7], 8, AlignmentType.CENTER, true)
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeaderSection(
          "TEMPLATE BANK SOAL BABAK PENYISIHAN",
          "Kejuaraan Cerdas Cermat Multidisiplin Berbasis Smart Screen IFP",
          notes
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
// 2. TEMPLATE BABAK SEMIFINAL
// ══════════════════════════════════════════════════════════════
async function buildSemifinalTemplate() {
  const notes = [
    "Format tabel 9 kolom: No, Jenis Soal, Pertanyaan & Gambar, Pilihan A, Pilihan B, Pilihan C, Pilihan D, Kunci (A/B/C/D atau B/S), dan Kunci Esai.",
    "Jenis Soal wajib diisi dengan kode: BS (Benar/Salah), PG150 (Pilihan Ganda I), PG200 (Pilihan Ganda II), ES (Esai/Uraian), atau CAD (Cadangan).",
    "Untuk tipe BS: Pilihan A & B otomatis Benar/Salah, kolom Kunci diisi 'B' (Benar) atau 'S' (Salah).",
    "Untuk tipe PG150 & PG200: Isi Pilihan A, B, C, D, dan kolom Kunci dengan A, B, C, atau D.",
    "Untuk tipe ES & CAD: Tuliskan kunci jawaban lengkap pada kolom 'Kunci Jawaban Esai' untuk panduan dewan juri."
  ];

  const headerRows = [
    new TableRow({
      children: [
        hCell("No", 5),
        hCell("Jenis Soal", 12),
        hCell("Pertanyaan & Gambar (Rumus $...$)", 33),
        hCell("Pilihan A", 9),
        hCell("Pilihan B", 9),
        hCell("Pilihan C", 9),
        hCell("Pilihan D", 9),
        hCell("Kunci", 6),
        hCell("Kunci Jawaban Esai (Juri)", 18)
      ]
    })
  ];

  const sampleData = [
    ["1", "BS", "Matahari terbit dari arah timur dan tenggelam di barat.", "Benar", "Salah", "-", "-", "B", ""],
    ["2", "BS", "Paus termasuk ke dalam golongan hewan mamalia.", "Benar", "Salah", "-", "-", "B", ""],
    ["3", "BS", "Hasil perhitungan perkalian dari $7 \\times 8$ adalah 54.", "Benar", "Salah", "-", "-", "S", ""],
    ["4", "PG150", "Ibu kota Provinsi Jawa Timur adalah ...", "Surabaya", "Malang", "Madiun", "Kediri", "A", ""],
    ["5", "PG150", "Planet terbesar dalam sistem tata surya kita adalah ...", "Jupiter", "Saturnus", "Uranus", "Neptunus", "A", ""],
    ["6", "PG200", "Hasil dari operasi pecahan $\\frac{3}{4} + \\frac{1}{2}$ adalah ...", "$\\frac{5}{4}$", "$\\frac{4}{6}$", "$\\frac{3}{8}$", "$1$", "A", ""],
    ["7", "PG200", "Sebuah lingkaran memiliki diameter 14 cm. Luas lingkaran tersebut adalah ... ($\\pi = \\frac{22}{7}$)", "154 cm²", "44 cm²", "308 cm²", "88 cm²", "A", ""],
    ["8", "ES", "Sebutkan bunyi sila ke-4 dalam rumusan dasar negara Pancasila!", "-", "-", "-", "-", "-", "Kerakyatan yang dipimpin oleh hikmat kebijaksanaan dalam permusyawaratan/perwakilan."],
    ["9", "ES", "Sebutkan bahan dan hasil akhir dari proses fotosintesis tumbuhan!", "-", "-", "-", "-", "-", "Bahan: Karbon dioksida (CO2), air (H2O), cahaya matahari. Hasil: Glukosa dan oksigen (O2)."],
    ["10", "CAD", "Hasil dari perhitungan $25 \\times 4$ adalah ...", "-", "-", "-", "-", "-", "100"]
  ];

  const bodyRows = sampleData.map(row => new TableRow({
    children: [
      bCell(row[0], 5, AlignmentType.CENTER),
      bCell(row[1], 12, AlignmentType.CENTER, true),
      bCell(row[2], 33),
      bCell(row[3], 9),
      bCell(row[4], 9),
      bCell(row[5], 9),
      bCell(row[6], 9),
      bCell(row[7], 6, AlignmentType.CENTER, true),
      bCell(row[8], 18)
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeaderSection(
          "TEMPLATE BANK SOAL BABAK SEMIFINAL",
          "Kompetisi Pemilihan Kotak & Perebutan Skor Multiround IFP",
          notes
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
// 3. TEMPLATE BABAK GRAND FINAL
// ══════════════════════════════════════════════════════════════
async function buildFinalTemplate() {
  const notes = [
    "Babak Grand Final memiliki total 15 kotak pertanyaan (matriks 5 kolom × 3 baris) + 1 soal cadangan / tie-breaker.",
    "Tier 1 (Kotak 1 s.d. 5): Soal berbobot 50 poin (salah -25).",
    "Tier 2 (Kotak 6 s.d. 10): Soal berbobot 75 poin (salah -35).",
    "Tier 3 (Kotak 11 s.d. 15): Soal berbobot 100 poin (salah -50).",
    "Kotak 16 (Soal Tambahan): Digunakan saat terjadi skor imbang (tie-breaker) berbobot 100 poin.",
    "Kunci jawaban diisi secara padat dan jelas agar juri dapat langsung mengambil keputusan benar/salah secara cepat."
  ];

  const headerRows = [
    new TableRow({
      children: [
        hCell("No", 8),
        hCell("Kategori & Poin", 24),
        hCell("Teks Pertanyaan Rebutan & Kotak", 44),
        hCell("Kunci Jawaban Singkat & Jelas", 24)
      ]
    })
  ];

  const sampleData = [
    ["1", "Tier 1 (50 Poin)", "Apa kepanjangan dari CPU?", "Central Processing Unit"],
    ["2", "Tier 1 (50 Poin)", "Mana yang BUKAN perangkat input: keyboard, mouse, atau monitor?", "Monitor"],
    ["3", "Tier 1 (50 Poin)", "Sistem bilangan yang hanya memakai angka 0 dan 1 disebut?", "Biner"],
    ["4", "Tier 1 (50 Poin)", "Ekstensi standar file dokumen pengolah kata Microsoft Word adalah?", ".docx"],
    ["5", "Tier 1 (50 Poin)", "Aplikasi untuk menjelajah halaman situs internet seperti Chrome dan Firefox disebut?", "Browser (Peramban)"],
    ["6", "Tier 2 (75 Poin)", "Ubah bilangan biner 1010 ke dalam bentuk desimal!", "10"],
    ["7", "Tier 2 (75 Poin)", "Apa fungsi utama dari sistem firewall pada jaringan komputer?", "Menyaring lalu lintas data & mencegah akses tidak sah"],
    ["8", "Tier 2 (75 Poin)", "Urutan langkah-langkah logis untuk menyelesaikan suatu masalah secara sistematis disebut?", "Algoritma"],
    ["9", "Tier 2 (75 Poin)", "Rumus spreadsheet untuk menghitung jumlah total dari sel A1 sampai A5 adalah?", "=SUM(A1:A5)"],
    ["10", "Tier 2 (75 Poin)", "URL merupakan singkatan dari kepanjangan apa?", "Uniform Resource Locator"],
    ["11", "Tier 3 (100 Poin)", "Teknik memecah masalah besar dan kompleks menjadi bagian-bagian yang lebih kecil disebut?", "Dekomposisi"],
    ["12", "Tier 3 (100 Poin)", "Berapakah hasil dari 2 pangkat 8 (jumlah kombinasi 8 bit atau 1 byte)?", "256"],
    ["13", "Tier 3 (100 Poin)", "Cabang kecerdasan artifisial (AI) yang belajar dari pola data untuk membuat prediksi adalah?", "Machine Learning"],
    ["14", "Tier 3 (100 Poin)", "Kejahatan siber yang mencoba mencuri data sensitif melalui pesan atau situs palsu disebut?", "Phishing"],
    ["15", "Tier 3 (100 Poin)", "Konversikan bilangan desimal 13 ke dalam representasi bilangan biner!", "1101"],
    ["16", "Soal Tambahan (100 Poin)", "SOAL TAMBAHAN: Satu byte terdiri dari berapa bit?", "8 bit"]
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
          notes
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
  console.log("🎉 SEMUA TEMPLATE WORD BERHASIL DIBUAT DENGAN LENGKAP!");
}

main().catch(err => {
  console.error("Error generating templates:", err);
  process.exit(1);
});
