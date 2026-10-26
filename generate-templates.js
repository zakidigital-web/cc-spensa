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
// 2. TEMPLATE KHUSUS SOAL BENAR / SALAH (TRUE / FALSE - 4 KOLOM)
// ══════════════════════════════════════════════════════════════
async function buildBenarSalahTemplate() {
  const notes = [
    "Format tabel 4 kolom bersih & standar: No, Pernyataan / Soal & Gambar, Kunci (B / S), dan Keterangan / Pembahasan.",
    "Kolom 'Kunci (B / S)': Cukup tulis huruf 'B' (jika pernyataan Benar) atau 'S' (jika pernyataan Salah). Boleh juga ditulis 'Benar' atau 'Salah'.",
    "Mendukung Rumus Matematika LaTeX: Tulis rumus di dalam tanda dollar $...$, contoh: $15 \\times 4 = 60$, $\\frac{1}{2} > \\frac{1}{4}$, $\\sqrt{144} = 12$.",
    "Mendukung Gambar Ilustrasi: Silakan salin (copy-paste) atau sisipkan gambar langsung ke dalam sel kolom 'Pernyataan / Soal'.",
    "Kolom 'Keterangan / Pembahasan' bersifat opsional untuk catatan alasan juri atau penjelasan kepada peserta.",
    "File template ini dapat diimpor secara langsung ke Bank Soal Babak Semifinal tanpa perlu kolom pilihan ganda tambahan."
  ];

  const models = [
    "Model BS-1: Benar/Salah Sains & Fakta Alamiah (Contoh: Paus termasuk mamalia, Gas terbanyak adalah Nitrogen)",
    "Model BS-2: Benar/Salah Numerasi & Perhitungan Matematika (Contoh: Kelipatan 4 adalah genap, Rata-rata 5 bilangan)",
    "Model BS-3: Benar/Salah Logika Geometri & Bangun Datar (Contoh: Persegi adalah persegi panjang)",
    "Model BS-4: Benar/Salah Sejarah, Kenegaraan & Pengetahuan Umum (Contoh: Zona waktu Indonesia, Pendirian ASEAN)",
    "Model BS-5: Benar/Salah Silogisme & Logika Bahasa (Contoh: Pernyataan implikasi sebab-akibat)"
  ];

  const headerRows = [
    new TableRow({
      children: [
        hCell("No", 8),
        hCell("Pernyataan / Soal & Gambar (Rumus LaTeX $...$)", 52),
        hCell("Kunci (B / S)", 14),
        hCell("Keterangan / Pembahasan (Opsional)", 26)
      ]
    })
  ];

  const sampleBS = [
    ["1", "Indonesia memiliki tiga zona waktu, yaitu WIB, WITA, dan WIT.", "B", "Indonesia menggunakan tiga zona waktu resmi (WIB, WITA, WIT)."],
    ["2", "Bilangan 1 merupakan bilangan prima karena hanya memiliki satu faktor positif.", "S", "Bilangan prima harus memiliki tepat dua faktor positif yang berbeda (1 dan dirinya sendiri)."],
    ["3", "Jika suatu bilangan habis dibagi 4, bilangan tersebut pasti habis dibagi 2.", "B", "Setiap kelipatan 4 pasti merupakan bilangan genap / habis dibagi 2."],
    ["4", "Tumbuhan menyerap oksigen dan melepaskan karbon dioksida sebagai satu-satunya proses pertukaran gas sepanjang hidupnya.", "S", "Tumbuhan juga melakukan fotosintesis (menyerap CO2 dan melepaskan O2 saat ada cahaya)."],
    ["5", "Perubahan wujud dari gas menjadi cair disebut kondensasi atau pengembunan.", "B", "Kondensasi adalah proses fisis perubahan wujud uap gas menjadi cairan."],
    ["6", "Candi Borobudur merupakan salah satu warisan budaya Indonesia yang bercorak Buddha.", "B", "Candi Borobudur dibangun pada abad ke-8 bercorak agama Buddha Mahayana."],
    ["7", "Jika harga barang Rp80.000 naik 25%, harga akhirnya menjadi Rp100.000.", "B", "Besar kenaikan: 25% x Rp80.000 = Rp20.000. Harga akhir = Rp100.000."],
    ["8", "Semua benda yang tenggelam di air memiliki massa lebih besar daripada semua benda yang mengapung, tanpa dipengaruhi ukuran dan volume benda.", "S", "Terapung atau tenggelam ditentukan oleh massa jenis (densitas relatif) dan gaya apung Archimedes, bukan semata-mata massa absolut."],
    ["9", "Dalam rantai makanan, energi yang tersedia umumnya semakin berkurang pada tingkat trofik yang lebih tinggi.", "B", "Hukum termodinamika & efisiensi ekologi: terjadi kehilangan energi ~90% pada setiap perpindahan tingkat trofik."],
    ["10", "Jika rata-rata lima bilangan adalah 12, jumlah kelima bilangan tersebut adalah 60.", "B", "Jumlah data = rata-rata x banyak data = 12 x 5 = 60."],
    ["11", "Semua persegi merupakan persegi panjang, tetapi semua persegi panjang belum tentu merupakan persegi.", "B", "Persegi memenuhi seluruh definisi persegi panjang (keempat sudut siku-siku) dengan tambahan sifat khusus keempat sisinya sama panjang."],
    ["12", "Bunyi dapat merambat melalui ruang hampa tanpa memerlukan medium perantara.", "S", "Bunyi merupakan gelombang mekanik yang mutlak membutuhkan medium materi (padat, cair, gas) untuk merambat."],
    ["13", "Jika dua bilangan positif memiliki hasil kali 36, jumlah kedua bilangan tersebut pasti 13.", "S", "Contoh penyangkal: pasangan 6 dan 6 menghasilkan hasil kali 36 namun jumlahnya 12 (bukan 13)."],
    ["14", "ASEAN didirikan pada 8 Agustus 1967 di Bangkok, Thailand.", "B", "Deklarasi Bangkok ditandatangani oleh 5 negara perintis pada 8 Agustus 1967."],
    ["15", "Dalam demokrasi, hasil pemungutan suara selalu membuat semua orang memperoleh pilihan yang mereka inginkan.", "S", "Pemungutan suara menetapkan keputusan mayoritas, bukan pemenuhan seluruh keinginan individual."],
    ["16", "Jika jarak pada peta semakin besar, jarak sebenarnya pasti semakin besar meskipun skala petanya berbeda.", "S", "Jarak sebenarnya berbanding terbalik dengan pembagi skala; skala yang berbeda dapat menghasilkan jarak sebenarnya yang berbeda arah."],
    ["17", "Pada rangkaian listrik paralel, setiap cabang memiliki jalur aliran arus tersendiri.", "B", "Karakteristik rangkaian paralel: arus listrik total terbagi ke masing-masing cabang penghantar."],
    ["18", "Jika suatu pernyataan berbunyi 'Semua peserta yang lolos adalah siswa kelas IX', maka dapat dipastikan bahwa semua siswa kelas IX lolos.", "S", "Pernyataan bernilai satu arah; tidak dapat dibalik karena siswa kelas IX yang tidak lolos bisa saja ada."]
  ];

  const bodyRows = sampleBS.map(row => new TableRow({
    children: [
      bCell(row[0], 8, AlignmentType.CENTER),
      bCell(row[1], 52),
      bCell(row[2], 14, AlignmentType.CENTER, true),
      bCell(row[3], 26, AlignmentType.LEFT, false, true)
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeaderSection(
          "TEMPLATE BANK SOAL: BENAR / SALAH (TRUE / FALSE)",
          "Format Standar Bersih 4 Kolom Khusus Soal Benar / Salah IFP",
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
  fs.writeFileSync("./templates/Template_Soal_Benar_Salah.docx", buffer);
  if (fs.existsSync("./soal")) {
    fs.writeFileSync("./soal/Template_Soal_Benar_Salah.docx", buffer);
  }
  console.log("✓ Template Benar / Salah generated (bytes):", buffer.length);
}

// ══════════════════════════════════════════════════════════════
// 3. TEMPLATE BABAK SEMIFINAL (MULTI-TABEL RESMI: BS, PG, ESAI)
// ══════════════════════════════════════════════════════════════
async function buildSemifinalTemplate() {
  const notes = [
    "Template Semifinal Resmi ini menggunakan 3 tabel terpisah yang rapi dan terstruktur:",
    "  1. TABEL 1 (BENAR / SALAH - 4 Kolom): No, Pernyataan & Gambar, Kunci (B/S), Pembahasan.",
    "  2. TABEL 2 (PILIHAN GANDA - 8 Kolom): No, Kategori (PG150 / PG200), Pertanyaan, Opsi A, B, C, D, Kunci (A/B/C/D).",
    "  3. TABEL 3 (ESAI REBUTAN & CADANGAN - 4 Kolom): No, Jenis (ES / CAD), Pertanyaan Rebutan, Kunci Jawaban Dewan Juri.",
    "Format ini bebas dari kolom dummy '-' dan langsung dapat diedit dengan mudah oleh para guru / penyusun soal.",
    "Sistem secara otomatis membaca seluruh tabel di dalam file dokumen ini sekaligus."
  ];

  const models = [
    "Tabel 1: Soal Benar / Salah (Babak 1, +100 poin, salah -50, durasi 20 detik)",
    "Tabel 2: Pilihan Ganda Sedang (Babak 2 - PG150, +150 poin, durasi 30 detik)",
    "Tabel 2: Pilihan Ganda Sukar / Hitungan (Babak 3 - PG200, +200 poin, durasi 45 detik)",
    "Tabel 3: Soal Esai Rebutan (Babak 4 - ES, +100 s.d. +300 poin dinilai juri, durasi 90 detik)",
    "Tabel 3: Soal Cadangan Siaga (CAD, untuk tie-break atau anulir darurat panggung)"
  ];

  // ─── Table 1: Benar / Salah (4 Kolom) ───────────────
  const t1Header = new TableRow({
    children: [
      hCell("No", 8),
      hCell("Pernyataan / Soal & Gambar (Rumus LaTeX $...$)", 52),
      hCell("Kunci (B / S)", 14),
      hCell("Keterangan / Pembahasan (Opsional)", 26)
    ]
  });

  const t1Data = [
    ["1", "Indonesia memiliki tiga zona waktu, yaitu WIB, WITA, dan WIT.", "B", "Indonesia menggunakan tiga zona waktu resmi."],
    ["2", "Bilangan 1 merupakan bilangan prima karena hanya memiliki satu faktor positif.", "S", "Bilangan prima memiliki tepat dua faktor positif."],
    ["3", "Jika suatu bilangan habis dibagi 4, bilangan tersebut pasti habis dibagi 2.", "B", "Setiap kelipatan 4 pasti habis dibagi 2."],
    ["4", "Tumbuhan menyerap oksigen dan melepaskan karbon dioksida sebagai satu-satunya proses pertukaran gas sepanjang hidupnya.", "S", "Tumbuhan juga melakukan fotosintesis."],
    ["5", "Perubahan wujud dari gas menjadi cair disebut kondensasi atau pengembunan.", "B", "Kondensasi adalah perubahan wujud gas menjadi cair."],
    ["6", "Candi Borobudur merupakan salah satu warisan budaya Indonesia yang bercorak Buddha.", "B", "Candi Borobudur bercorak Buddha Mahayana."],
    ["7", "Jika harga barang Rp80.000 naik 25%, harga akhirnya menjadi Rp100.000.", "B", "25% x Rp80.000 = Rp20.000. Total = Rp100.000."],
    ["8", "Semua benda yang tenggelam di air memiliki massa lebih besar daripada semua benda yang mengapung, tanpa dipengaruhi ukuran dan volume benda.", "S", "Ditentukan massa jenis dan gaya apung."],
    ["9", "Dalam rantai makanan, energi yang tersedia umumnya semakin berkurang pada tingkat trofik yang lebih tinggi.", "B", "Terjadi penyusutan energi antartingkat trofik."],
    ["10", "Jika rata-rata lima bilangan adalah 12, jumlah kelima bilangan tersebut adalah 60.", "B", "Jumlah = 5 x 12 = 60."],
    ["11", "Semua persegi merupakan persegi panjang, tetapi semua persegi panjang belum tentu merupakan persegi.", "B", "Persegi memenuhi seluruh sifat persegi panjang."],
    ["12", "Bunyi dapat merambat melalui ruang hampa tanpa medium.", "S", "Bunyi memerlukan medium untuk merambat."],
    ["13", "Jika dua bilangan positif memiliki hasil kali 36, jumlah kedua bilangan tersebut pasti 13.", "S", "Contoh 6x6=36 menghasilkan jumlah 12."],
    ["14", "ASEAN didirikan pada 8 Agustus 1967 di Bangkok, Thailand.", "B", "Deklarasi Bangkok, 8 Agustus 1967."],
    ["15", "Dalam demokrasi, hasil pemungutan suara selalu membuat semua orang memperoleh pilihan yang mereka inginkan.", "S", "Keputusan diambil berdasarkan suara mayoritas."],
    ["16", "Jika jarak pada peta semakin besar, jarak sebenarnya pasti semakin besar meskipun skala petanya berbeda.", "S", "Perlu memperhitungkan skala peta."],
    ["17", "Pada rangkaian listrik paralel, setiap cabang memiliki jalur arus tersendiri.", "B", "Rangkaian paralel memiliki cabang arus."],
    ["18", "Jika suatu pernyataan berbunyi 'Semua peserta yang lolos adalah siswa kelas IX', maka dapat dipastikan bahwa semua siswa kelas IX lolos.", "S", "Tidak berarti semua siswa kelas IX lolos."]
  ];

  const t1Rows = t1Data.map(r => new TableRow({
    children: [
      bCell(r[0], 8, AlignmentType.CENTER),
      bCell(r[1], 52),
      bCell(r[2], 14, AlignmentType.CENTER, true),
      bCell(r[3], 26, AlignmentType.LEFT, false, true)
    ]
  }));

  // ─── Table 2: Pilihan Ganda PG150 & PG200 (8 Kolom) ────────
  const t2Header = new TableRow({
    children: [
      hCell("No", 5),
      hCell("Kategori", 12),
      hCell("Pertanyaan & Gambar (Rumus LaTeX $...$)", 39),
      hCell("Pilihan A", 10),
      hCell("Pilihan B", 10),
      hCell("Pilihan C", 10),
      hCell("Pilihan D", 10),
      hCell("Kunci", 4)
    ]
  });

  const t2Data = [
    ["1", "PG150", "Negara yang dijuluki Negeri Matahari Terbit adalah ...", "Tiongkok", "Jepang", "Korea Selatan", "Thailand", "B"],
    ["2", "PG150", "Hasil dari $125 : 5 + 7 \\times 3$ adalah ...", "32", "42", "46", "60", "C"],
    ["3", "PG150", "Tokoh yang dikenal sebagai Proklamator Kemerdekaan Indonesia bersama Mohammad Hatta adalah ...", "Ki Hajar Dewantara", "Jenderal Sudirman", "Soekarno", "Soepomo", "C"],
    ["4", "PG150", "Organ tubuh manusia yang berfungsi menyaring darah dan menghasilkan urine adalah ...", "Jantung", "Ginjal", "Paru-paru", "Lambung", "B"],
    ["5", "PG150", "Benua terbesar di dunia berdasarkan luas wilayah adalah ...", "Afrika", "Eropa", "Amerika Utara", "Asia", "D"],
    ["6", "PG150", "Sinonim kata cermat adalah ...", "Ceroboh", "Teliti", "Lambat", "Ragu-ragu", "B"],
    ["7", "PG200", "Sebuah persegi panjang memiliki panjang 12 cm dan lebar 5 cm. Kelilingnya adalah ...", "17 cm", "30 cm", "34 cm", "60 cm", "C"],
    ["8", "PG200", "Gas yang paling banyak terdapat di atmosfer Bumi adalah ...", "Oksigen", "Karbon dioksida", "Nitrogen", "Hidrogen", "C"],
    ["9", "PG200", "Sebuah tabung memiliki jari-jari $r = 7\\text{ cm}$ dan tinggi $t = 10\\text{ cm}$. Berapakah volumenya? ($\\pi = \\frac{22}{7}$)", "1.540 cm³", "770 cm³", "3.080 cm³", "154 cm³", "A"],
    ["10", "PG200", "Hasil operasi aljabar dari $(2x + 3)(x - 4)$ adalah ...", "$2x^2 - 5x - 12$", "$2x^2 + 5x - 12$", "$2x^2 - 11x - 12$", "$2x^2 - 5x + 12$", "A"]
  ];

  const t2Rows = t2Data.map(r => new TableRow({
    children: [
      bCell(r[0], 5, AlignmentType.CENTER),
      bCell(r[1], 12, AlignmentType.CENTER, true),
      bCell(r[2], 39),
      bCell(r[3], 10),
      bCell(r[4], 10),
      bCell(r[5], 10),
      bCell(r[6], 10),
      bCell(r[7], 4, AlignmentType.CENTER, true)
    ]
  }));

  // ─── Table 3: Esai Rebutan & Cadangan (4 Kolom) ─────────────
  const t3Header = new TableRow({
    children: [
      hCell("No", 8),
      hCell("Jenis Soal", 14),
      hCell("Pertanyaan Rebutan & Gambar (Rumus LaTeX $...$)", 48),
      hCell("Kunci Jawaban Dewan Juri", 30)
    ]
  });

  const t3Data = [
    ["1", "ES", "Tiga bilangan bulat positif berbeda memiliki jumlah 24. Bilangan terbesar dua kali bilangan terkecil, sedangkan bilangan tengah 4 lebih besar daripada bilangan terkecil. Tentukan ketiga bilangan tersebut!", "5, 9, dan 10. (Misal x, x+4, 2x => 4x+4=24 => x=5)."],
    ["2", "ES", "Sebuah toko menaikkan harga tas sebesar 20%, lalu mendiskonnya 20%. Jika harga awal Rp250.000, berapakah harga akhirnya? Apakah kembali ke harga awal?", "Rp240.000 (tidak kembali ke harga awal, karena dasar persentase berbeda)."],
    ["3", "ES", "Jika tanggal 1 suatu bulan jatuh pada hari Rabu, pada hari apakah hari ke-100 jatuh jika dihitung menurut siklus 7 hari?", "Hari Kamis. (Selisih 99 hari, 99 mod 7 = 1 hari setelah Rabu)."],
    ["4", "ES", "Dalam sebuah kelas, 30 siswa menyukai Matematika, 22 siswa menyukai IPA, dan 12 menyukai keduanya. Berapa jumlah siswa yang menyukai setidaknya salah satu pelajaran?", "40 siswa. (30 + 22 - 12 = 40)."],
    ["5", "CAD", "SOAL CADANGAN: Siapakah pencipta lagu kebangsaan Indonesia Raya?", "Wage Rudolf Supratman (W.R. Supratman)."],
    ["6", "CAD", "SOAL CADANGAN: Berapakah hasil dari $25 \\times 4 + 50$?", "150."]
  ];

  const t3Rows = t3Data.map(r => new TableRow({
    children: [
      bCell(r[0], 8, AlignmentType.CENTER),
      bCell(r[1], 14, AlignmentType.CENTER, true),
      bCell(r[2], 48),
      bCell(r[3], 30, AlignmentType.LEFT, true)
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeaderSection(
          "TEMPLATE BANK SOAL BABAK SEMIFINAL",
          "Format Multi-Tabel Resmi: Benar / Salah, Pilihan Ganda & Esai Rebutan IFP",
          notes,
          models
        ),
        new Paragraph({
          spacing: { before: 180, after: 100 },
          children: [
            new TextRun({ text: "🟦 TABEL 1: SOAL BENAR / SALAH (BABAK 1 — 18 KOTAK)", bold: true, size: 22, color: "1E3A8A" })
          ]
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [t1Header, ...t1Rows]
        }),
        new Paragraph({
          spacing: { before: 260, after: 100 },
          children: [
            new TextRun({ text: "🟩 TABEL 2: SOAL PILIHAN GANDA (BABAK 2 & 3 — PG150 & PG200)", bold: true, size: 22, color: "1E3A8A" })
          ]
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [t2Header, ...t2Rows]
        }),
        new Paragraph({
          spacing: { before: 260, after: 100 },
          children: [
            new TextRun({ text: "🟨 TABEL 3: SOAL ESAI REBUTAN & CADANGAN (BABAK 4 & TIE-BREAK)", bold: true, size: 22, color: "1E3A8A" })
          ]
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [t3Header, ...t3Rows]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("./templates/Template_Soal_Semifinal.docx", buffer);
  if (fs.existsSync("./soal")) {
    fs.writeFileSync("./soal/Template_Soal_Semifinal.docx", buffer);
  }
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
  await buildBenarSalahTemplate();
  await buildSemifinalTemplate();
  await buildFinalTemplate();
  console.log("🎉 SEMUA TEMPLATE WORD DENGAN SELURUH MODEL SOAL BERHASIL DI-GENERATE LENGKAP!");
}

main().catch(err => {
  console.error("Error generating templates:", err);
  process.exit(1);
});
