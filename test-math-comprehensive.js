import { chromium } from 'playwright';

export function normalizeMath(text) {
  if (!text) return '';
  let str = String(text);

  // 1. Convert HTML sup/sub tags to LaTeX
  str = str.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '^{$1}');
  str = str.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '_{$1}');

  // 2. Normalize Unicode superscripts, fractions, and symbols
  const supMap = { '²': '^2', '³': '^3', '¹': '^1', '⁰': '^0', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9' };
  str = str.replace(/[²³¹⁰⁴⁵⁶⁷⁸⁹]/g, m => supMap[m] || m);
  str = str.replace(/π/g, '\\pi ');

  // 3. Normalize awkward dollar wrapping:
  // Numbers with unit dollar-power: e.g. "56 cm$^2$" -> "$56\text{ cm}^2$"
  str = str.replace(/(\b\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)\s*\$\^\{?([0-9a-zA-Z+-]+)\}?\$/g, (m, n, b, p) => {
    return `$${n}\\text{ ${b}}^{${p}}$`;
  });
  // Standalone unit dollar-power: e.g. "cm$^2$" -> "$\text{cm}^2$"
  str = str.replace(/([a-zA-Z]+)\s*\$\^\{?([0-9a-zA-Z+-]+)\}?\$/g, (m, b, p) => {
    if (/^(cm|m|km|mm|dm|kg|g|s)$/i.test(b)) {
      return `$\\text{${b}}^{${p}}$`;
    }
    return `$${b}^{${p}}$`;
  });
  // Standalone "$^2$" -> "^{2}"
  str = str.replace(/\$\^\{?([0-9a-zA-Z+-]+)\}?\$/g, '^{$1}');

  // 4. Protect existing $...$ and $$...$$ blocks
  const blocks = [];
  const addMath = (eq, isDisplay) => {
    eq = eq.trim();
    // Escape unescaped % in math mode so KaTeX does not treat it as comment
    eq = eq.replace(/(^|[^\\])%/g, '$1\\%');
    // Normalize unit powers inside math mode (e.g. cm^2 -> \text{cm}^2)
    eq = eq.replace(/\b(cm|m|km|mm|dm|m\/s|cm\/s)\^\{?([0-9]+)\}?/gi, '\\text{$1}^{$2}');
    // Fix orphan leading caret (e.g. ^2 -> {}^2)
    if (/^\^[0-9a-zA-Z]/.test(eq)) eq = '{}' + eq;
    const ph = `___MATH_${blocks.length}___`;
    blocks.push(isDisplay ? `$$${eq}$$` : `$${eq}$`);
    return ph;
  };

  str = str.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (m, d, i) => {
    return addMath(d || i, !!d);
  });

  // 5. In the remaining non-math text:
  // 5a. Numbers with units: "49 cm^2", "100 m^2", "9.8 m/s^2"
  str = str.replace(/(\b\d+(?:[.,]\d+)?)\s*(cm|m|km|mm|dm|m\/s|cm\/s)\^\{?([0-9]+)\}?/gi, (m, num, unit, pow) => {
    return addMath(`${num}\\text{ ${unit}}^{${pow}}`);
  });

  // 5b. Standalone units: "cm^2", "m^2", "m/s^2"
  str = str.replace(/\b(cm|m|km|mm|dm|m\/s|cm\/s)\^\{?([0-9]+)\}?/gi, (m, unit, pow) => {
    return addMath(`\\text{${unit}}^{${pow}}`);
  });

  // 5c. Match parenthesized expressions with powers: "(x + 2)^2", "(a + b)^2", "(x - 1)^2"
  str = str.replace(/\(([a-zA-Z0-9\s+\-*/]+)\)\^\{?([0-9a-zA-Z+-]+)\}?/g, (m, inner, pow) => {
    return addMath(`(${inner})^{${pow}}`);
  });

  // 5d. Match algebraic equations containing ^ and = (e.g. "x^2 + 5x - 14 = 0", "x^2 = 14", "a^2 + b^2 = c^2", "f(x) = ax^2 + bx + c", "y = ax^2 + bx + c")
  const term = "(?:\\d*[a-zA-Z]+(?:\\^[0-9]+)?|\\d+|[a-zA-Z]\\([a-zA-Z]\\)|\\\\pi(?:\\s*r(?:\\^[0-9]+)?)?)";
  const poly = "(?:[-+]?\\s*" + term + "(?:\\s*[+\\-*/]\\s*" + term + ")*)";
  const reEq = new RegExp("(?:(?<=\\s|^|[([\"']))(" + poly + "\\s*=\\s*" + poly + ")(?=\\s|$|[,;:?!.)\\]\"'])", "g");

  str = str.replace(reEq, (match) => {
    if (match.includes('___MATH_')) return match;
    const trimmed = match.trim();
    if (trimmed.includes('^') || /^[a-zA-Z]\([a-zA-Z]\)/.test(trimmed)) {
      return addMath(trimmed);
    }
    return match;
  });

  // 5e. Match expressions containing ^ with addition/subtraction: e.g. "x^2 + 4x + 4", "ax^2 + bx + c", "x^2 - 9"
  const rePolyOnly = new RegExp("(?:(?<=\\s|^|[([\"']))((?:[-+]?\\s*" + term + "(?:\\s*[+\\-*/]\\s*" + term + ")+))(?=\\s|$|[,;:?!.)\\]\"'])", "g");
  str = str.replace(rePolyOnly, (match) => {
    if (match.includes('___MATH_')) return match;
    const trimmed = match.trim();
    if (trimmed.includes('^')) {
      return addMath(trimmed);
    }
    return match;
  });

  // 5f. Detect \pi r^2 or \frac or \sqrt outside $
  str = str.replace(/(?:\\pi\s*r\^\{?[0-9]+\}?|\\pi\s*r\^2|\\frac\{[^}]+\}\{[^}]+\}|\\sqrt\{[^}]+\})/g, (m) => {
    return addMath(m);
  });

  // 5g. Match variable root assignments like "x = 2", "x = -7", "x_1 = 3"
  str = str.replace(/\b([a-zA-Z](?:_[0-9]+|[0-9]+)?\s*=\s*[-+]?\d+(?:[.,]\d+)?)\b/g, (m) => {
    return addMath(m);
  });

  // 5h. Standalone variable powers like "x^2", "y^2", "r^2", "a^2", "b^2", "c^2", "10^2", "2^2"
  str = str.replace(/\b([a-zA-Z0-9]+)\^\{?([0-9a-zA-Z+-]+)\}?\b/g, (m, base, pow) => {
    if (base.includes('___MATH_')) return m;
    return addMath(`${base}^{${pow}}`);
  });

  // 6. Restore protected math blocks
  str = str.replace(/___MATH_(\d+)___/g, (_, idx) => blocks[+idx]);

  return str;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/penyisihan-cerdas-cermat.html');

  const testCases = [
    // Non-math (should remain unchanged)
    { text: "Hari raya Idulfitri dirayakan setelah bulan ...", isMath: false },
    { text: "Sila ke-3 Pancasila berbunyi ...", isMath: false },
    { text: "UUD 1945 disahkan pada tanggal ...", isMath: false },
    { text: "Antonim kata \"tinggi\" adalah ...", isMath: false },

    // Existing KaTeX math (should render without error)
    { text: "Hasil dari $12 \\times 8$ adalah ...", isMath: true },
    { text: "Hasil dari $\\frac{1}{2}+\\frac{1}{4}$ adalah ...", isMath: true },
    { text: "Nilai $x$ jika $2x+6=14$ adalah ...", isMath: true },
    { text: "$x = \\frac{3}{2}$ atau $x = -4$", isMath: true },

    // Area & Units with Squares
    { text: "Luas persegi dengan sisi 7 cm adalah ... cm$^2$", isMath: true },
    { text: "Luas persegi dengan sisi 7 cm adalah ... cm^2", isMath: true },
    { text: "Luas persegi dengan sisi 7 cm adalah ... cm²", isMath: true },
    { text: "49 cm^2", isMath: true },
    { text: "28 cm²", isMath: true },
    { text: "$14\\text{ cm}^2$", isMath: true },
    { text: "56 cm$^2$", isMath: true },
    { text: "Volume balok dengan luas alas 25 cm^2 dan tinggi 10 cm", isMath: true },
    { text: "Percepatan gravitasi bumi adalah 9.8 m/s^2", isMath: true },
    { text: "Kecepatan 10 m/s²", isMath: true },

    // Quadratic Equations & Polynomials
    { text: "Akar-akar dari persamaan kuadrat x^2 + 5x - 14 = 0 adalah ...", isMath: true },
    { text: "Persamaan kuadrat x² - 9 = 0", isMath: true },
    { text: "x^2 = 14", isMath: true },
    { text: "f(x) = ax^2 + bx + c", isMath: true },
    { text: "a^2 + b^2 = c^2", isMath: true },
    { text: "Hasil dari (x + 2)^2 adalah x^2 + 4x + 4", isMath: true },
    { text: "x = 2 atau x = -7", isMath: true },
    { text: "x_1 = 3 atau x_2 = -5", isMath: true },
    { text: "Sebuah lingkaran memiliki luas \\pi r^2", isMath: true },
    { text: "Luas lingkaran adalah πr²", isMath: true },
    { text: "Nilai dari 10^2 adalah 100", isMath: true }
  ];

  const evalRes = await page.evaluate(({ cases, fnStr }) => {
    const normalize = new Function('return ' + fnStr)();
    const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function fmt(t) {
      t = normalize(t);
      let out = '', last = 0, m;
      const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
      while ((m = re.exec(t))) {
        out += esc(t.slice(last, m.index)).replace(/\n/g, '<br>');
        try {
          out += katex.renderToString(m[1] || m[2], { displayMode: !!m[1], throwOnError: false });
        } catch (e) {
          out += esc(m[0]);
        }
        last = re.lastIndex;
      }
      return out + esc(t.slice(last)).replace(/\n/g, '<br>');
    }

    return cases.map(c => {
      const rendered = fmt(c.text);
      const hasKatex = rendered.includes('class="katex"');
      const hasError = rendered.includes('katex-error');
      return {
        text: c.text,
        isMath: c.isMath,
        hasKatex,
        hasError,
        ok: c.isMath ? (hasKatex && !hasError) : (!hasError)
      };
    });
  }, { cases: testCases, fnStr: normalizeMath.toString() });

  const allPassed = evalRes.every(r => r.ok);
  console.log("All passed:", allPassed);
  if (!allPassed) {
    console.log("Failures:", evalRes.filter(r => !r.ok));
  } else {
    console.log(`Passed ${evalRes.length}/${evalRes.length} comprehensive test cases!`);
  }

  await browser.close();
}

run().catch(console.error);
