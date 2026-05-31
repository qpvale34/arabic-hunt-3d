const fatha = "\u064e";
const kasra = "\u0650";
const damma = "\u064f";

function buildDualForms(symbol) {
  return {
    isolated: symbol,
    initial: `${symbol}\u0640`,
    medial: `\u0640${symbol}\u0640`,
    final: `\u0640${symbol}`,
  };
}

function buildRightOnlyForms(symbol) {
  return {
    isolated: symbol,
    initial: symbol,
    medial: null,
    final: `\u0640${symbol}`,
  };
}

function buildHarakatSet(symbol, stem) {
  return [
    { id: "fatha", label: "Fetha", arabic: `${symbol}${fatha}`, latin: `${stem}a` },
    { id: "kasra", label: "Kesra", arabic: `${symbol}${kasra}`, latin: `${stem}i` },
    { id: "damma", label: "Damma", arabic: `${symbol}${damma}`, latin: `${stem}u` },
  ];
}

function withForms(entry) {
  if (entry.forms) {
    return entry;
  }

  const forms = entry.joining === "right"
    ? buildRightOnlyForms(entry.symbol)
    : buildDualForms(entry.symbol);

  return { ...entry, forms };
}

const palette = [
  ["#255f95", "#7fd8ff"],
  ["#2f7b47", "#a8f5bf"],
  ["#9c295d", "#ff9bcb"],
  ["#8b420f", "#ffca67"],
  ["#5a3d97", "#8ec6ff"],
  ["#2f8b66", "#bdf8d9"],
];
const exampleIllustrationCache = new Map();

function escapeSvg(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const sunLetterSymbols = new Set(["ت", "ث", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ل", "ن"]);
const moonLetterSymbols = new Set(["ا", "ب", "ج", "ح", "خ", "ع", "غ", "ف", "ق", "ك", "م", "ه", "و", "ي"]);
const heavyLetterSymbols = new Set(["خ", "ص", "ض", "ط", "ظ", "غ", "ق"]);
const contextSensitiveThicknessSymbols = new Set(["ا", "ل", "ر"]);

function getSunMoonInfo(entry) {
  if (!entry) {
    return { label: "Belirsiz", note: "" };
  }

  if (entry.joining === "ligature") {
    return {
      label: "Ligatur",
      note: "Lam-Elif birlesik yazimidir; semsi/kameri listesinde ayri sayilmaz.",
    };
  }

  if (entry.joining === "hamza") {
    return {
      label: "Sinif disi",
      note: "Hamza, semsi ve kameri harf sinifina dogrudan dahil edilmez.",
    };
  }

  if (sunLetterSymbols.has(entry.symbol)) {
    return {
      label: "Semsi Harf",
      note: "El takisindan sonra lam sesi duserek okunur.",
    };
  }

  if (moonLetterSymbols.has(entry.symbol)) {
    return {
      label: "Kameri Harf",
      note: "El takisinda lam sesi korunur ve acik okunur.",
    };
  }

  return { label: "Belirsiz", note: "" };
}

function getThicknessInfo(entry) {
  if (!entry) {
    return { label: "Belirsiz", note: "" };
  }

  if (entry.joining === "ligature") {
    return {
      label: "Duruma Gore",
      note: "Lam-Elif ligaturunun incelik-kalinlik hissi baglandigi kelimeye gore degisir.",
    };
  }

  if (heavyLetterSymbols.has(entry.symbol)) {
    return {
      label: "Kalin Harf",
      note: "Tafkhim grubunda yer alir; tok ve dolgun bir ses verir.",
    };
  }

  if (contextSensitiveThicknessSymbols.has(entry.symbol)) {
    return {
      label: "Duruma Gore",
      note: "Bu harfin incelik-kalinligi kelimedeki hareke ve komsu sese gore degisebilir.",
    };
  }

  return {
    label: "Ince Harf",
    note: "Tarqiq grubunda yumusak ve ince sesletilir.",
  };
}

export const letterCatalog = [
  {
    id: 1,
    symbol: "ا",
    nameTr: "Elif",
    nameAr: "ألف",
    latinName: "alif",
    joining: "right",
    description: "Arap alfabesinin ilk harfidir. Cogu zaman uzun a sesi veya hamza tasiyicisi olarak gorulur.",
    pronunciations: [
      { id: "fatha", label: "Fetha", arabic: `أ${fatha}`, latin: "a" },
      { id: "kasra", label: "Kesra", arabic: `إ${kasra}`, latin: "i" },
      { id: "damma", label: "Damma", arabic: `أ${damma}`, latin: "u" },
    ],
    example: {
      word: "أسد",
      transliteration: "asad",
      meaning: "aslan",
      emoji: "🦁",
      caption: "Cesur aslan",
    },
  },
  {
    id: 2,
    symbol: "ب",
    nameTr: "Be",
    nameAr: "باء",
    latinName: "ba",
    joining: "dual",
    description: "Dudaklari kapatip acarken cikan yumusak b sesidir.",
    pronunciations: buildHarakatSet("ب", "b"),
    example: {
      word: "بيت",
      transliteration: "bayt",
      meaning: "ev",
      emoji: "🏠",
      caption: "Yasanan yer",
    },
  },
  {
    id: 3,
    symbol: "ت",
    nameTr: "Te",
    nameAr: "تاء",
    latinName: "ta",
    joining: "dual",
    description: "Dilin ucu ile cikan ince t sesidir.",
    pronunciations: buildHarakatSet("ت", "t"),
    example: {
      word: "تفاح",
      transliteration: "tuffah",
      meaning: "elma",
      emoji: "🍎",
      caption: "Kirmizi elma",
    },
  },
  {
    id: 4,
    symbol: "ث",
    nameTr: "Se",
    nameAr: "ثاء",
    latinName: "tha",
    joining: "dual",
    description: "Dislerin arasindan cikan ince th sesidir.",
    pronunciations: buildHarakatSet("ث", "th"),
    example: {
      word: "ثوب",
      transliteration: "thawb",
      meaning: "elbise",
      emoji: "👕",
      caption: "Geleneksel kiyafet",
    },
  },
  {
    id: 5,
    symbol: "ج",
    nameTr: "Cim",
    nameAr: "جيم",
    latinName: "jim",
    joining: "dual",
    description: "Turkcedeki c ve j arasina yakin yumusak bir sestir.",
    pronunciations: buildHarakatSet("ج", "j"),
    example: {
      word: "جمل",
      transliteration: "jamal",
      meaning: "deve",
      emoji: "🐪",
      caption: "Copra sahnesi",
    },
  },
  {
    id: 6,
    symbol: "ح",
    nameTr: "Ha",
    nameAr: "حاء",
    latinName: "ha",
    joining: "dual",
    description: "Bogazdan gelen nefesli, yumusak bir h sesidir.",
    pronunciations: buildHarakatSet("ح", "h"),
    example: {
      word: "حليب",
      transliteration: "halib",
      meaning: "sut",
      emoji: "🥛",
      caption: "Bir bardak sut",
    },
  },
  {
    id: 7,
    symbol: "خ",
    nameTr: "Hi",
    nameAr: "خاء",
    latinName: "kha",
    joining: "dual",
    description: "Bogazin arkasindan gelen hiriltili kh sesidir.",
    pronunciations: buildHarakatSet("خ", "kh"),
    example: {
      word: "خبز",
      transliteration: "khubz",
      meaning: "ekmek",
      emoji: "🍞",
      caption: "Taze ekmek",
    },
  },
  {
    id: 8,
    symbol: "د",
    nameTr: "Dal",
    nameAr: "دال",
    latinName: "dal",
    joining: "right",
    description: "Dilin ucuyla cikan ince d sesidir.",
    pronunciations: buildHarakatSet("د", "d"),
    example: {
      word: "دب",
      transliteration: "dubb",
      meaning: "ayi",
      emoji: "🐻",
      caption: "Buyuk ayi",
    },
  },
  {
    id: 9,
    symbol: "ذ",
    nameTr: "Zel",
    nameAr: "ذال",
    latinName: "dhal",
    joining: "right",
    description: "Dislerin arasindan cikan yumusak dh sesidir.",
    pronunciations: buildHarakatSet("ذ", "dh"),
    example: {
      word: "ذئب",
      transliteration: "dhib",
      meaning: "kurt",
      emoji: "🐺",
      caption: "Gri kurt",
    },
  },
  {
    id: 10,
    symbol: "ر",
    nameTr: "Re",
    nameAr: "راء",
    latinName: "ra",
    joining: "right",
    description: "Titreyen kisa bir r sesidir.",
    pronunciations: buildHarakatSet("ر", "r"),
    example: {
      word: "رمان",
      transliteration: "rumman",
      meaning: "nar",
      emoji: "🍎",
      caption: "Nar meyvesi",
    },
  },
  {
    id: 11,
    symbol: "ز",
    nameTr: "Ze",
    nameAr: "زاي",
    latinName: "zay",
    joining: "right",
    description: "Ince ve titresimli z sesidir.",
    pronunciations: buildHarakatSet("ز", "z"),
    example: {
      word: "زهرة",
      transliteration: "zahra",
      meaning: "cicek",
      emoji: "🌸",
      caption: "Acik bir cicek",
    },
  },
  {
    id: 12,
    symbol: "س",
    nameTr: "Şın",
    nameAr: "سين",
    latinName: "sin",
    joining: "dual",
    description: "Serin, ince s sesi verir.",
    pronunciations: buildHarakatSet("س", "s"),
    example: {
      word: "سمك",
      transliteration: "samak",
      meaning: "balik",
      emoji: "🐟",
      caption: "Mavi balik",
    },
  },
  {
    id: 13,
    symbol: "ش",
    nameTr: "Sin",
    nameAr: "شين",
    latinName: "shin",
    joining: "dual",
    description: "Turkcedeki s sesinin h ile yumusatilmis hali olan sh sesidir.",
    pronunciations: buildHarakatSet("ش", "sh"),
    example: {
      word: "شمس",
      transliteration: "shams",
      meaning: "gunes",
      emoji: "☀️",
      caption: "Parlak gunes",
    },
  },
  {
    id: 14,
    symbol: "ص",
    nameTr: "Sad",
    nameAr: "صاد",
    latinName: "sad",
    joining: "dual",
    description: "Daha tok ve kalin soylenen s sesidir.",
    pronunciations: buildHarakatSet("ص", "s"),
    example: {
      word: "صقر",
      transliteration: "saqr",
      meaning: "dogan",
      emoji: "🦅",
      caption: "Keskin bakisli kus",
    },
  },
  {
    id: 15,
    symbol: "ض",
    nameTr: "Dad",
    nameAr: "ضاد",
    latinName: "dad",
    joining: "dual",
    description: "Arapcaya ozgu, kalin ve bastirilmis d sesidir.",
    pronunciations: buildHarakatSet("ض", "d"),
    example: {
      word: "ضفدع",
      transliteration: "dafda",
      meaning: "kurbaga",
      emoji: "🐸",
      caption: "Yesil kurbaga",
    },
  },
  {
    id: 16,
    symbol: "ط",
    nameTr: "Ti",
    nameAr: "طاء",
    latinName: "ta",
    joining: "dual",
    description: "Kalindan gelen, vurgulu bir t sesidir.",
    pronunciations: buildHarakatSet("ط", "t"),
    example: {
      word: "طائرة",
      transliteration: "taira",
      meaning: "ucak",
      emoji: "✈️",
      caption: "Gokte ucak",
    },
  },
  {
    id: 17,
    symbol: "ظ",
    nameTr: "Zi",
    nameAr: "ظاء",
    latinName: "za",
    joining: "dual",
    description: "Kalindan gelen, vurgulu z sesidir.",
    pronunciations: buildHarakatSet("ظ", "z"),
    example: {
      word: "ظرف",
      transliteration: "zarf",
      meaning: "zarf",
      emoji: "✉️",
      caption: "Mektup zarfi",
    },
  },
  {
    id: 18,
    symbol: "ع",
    nameTr: "Ayn",
    nameAr: "عين",
    latinName: "ayn",
    joining: "dual",
    description: "Bogazin orta kismina dayanan, Turkcede tam karsiligi olmayan ayn sesidir.",
    pronunciations: [
      { id: "fatha", label: "Fetha", arabic: `ع${fatha}`, latin: "'a" },
      { id: "kasra", label: "Kesra", arabic: `ع${kasra}`, latin: "'i" },
      { id: "damma", label: "Damma", arabic: `ع${damma}`, latin: "'u" },
    ],
    example: {
      word: "عين",
      transliteration: "ayn",
      meaning: "goz",
      emoji: "👁️",
      caption: "Bakan goz",
    },
  },
  {
    id: 19,
    symbol: "غ",
    nameTr: "Gayn",
    nameAr: "غين",
    latinName: "ghayn",
    joining: "dual",
    description: "Bogazin arkasinda titresen gh sesidir.",
    pronunciations: buildHarakatSet("غ", "gh"),
    example: {
      word: "غيمة",
      transliteration: "ghayma",
      meaning: "bulut",
      emoji: "☁️",
      caption: "Yumusak bulut",
    },
  },
  {
    id: 20,
    symbol: "ف",
    nameTr: "Fe",
    nameAr: "فاء",
    latinName: "fa",
    joining: "dual",
    description: "Dudak ve dislerle cikan ince f sesidir.",
    pronunciations: buildHarakatSet("ف", "f"),
    example: {
      word: "فراشة",
      transliteration: "farasha",
      meaning: "kelebek",
      emoji: "🦋",
      caption: "Renkli kelebek",
    },
  },
  {
    id: 21,
    symbol: "ق",
    nameTr: "Kaf",
    nameAr: "قاف",
    latinName: "qaf",
    joining: "dual",
    description: "Bogazin gerisine yakin bolgeden gelen tok q sesidir.",
    pronunciations: buildHarakatSet("ق", "q"),
    example: {
      word: "قمر",
      transliteration: "qamar",
      meaning: "ay",
      emoji: "🌙",
      caption: "Gece ayi",
    },
  },
  {
    id: 22,
    symbol: "ك",
    nameTr: "Kef",
    nameAr: "كاف",
    latinName: "kaf",
    joining: "dual",
    description: "Turkcedeki k sesine yakin yumusak bir sestir.",
    pronunciations: buildHarakatSet("ك", "k"),
    example: {
      word: "كتاب",
      transliteration: "kitab",
      meaning: "kitap",
      emoji: "📘",
      caption: "Acik kitap",
    },
  },
  {
    id: 23,
    symbol: "ل",
    nameTr: "Lam",
    nameAr: "لام",
    latinName: "lam",
    joining: "dual",
    description: "Dilin ucuyla cikan akici l sesidir.",
    pronunciations: buildHarakatSet("ل", "l"),
    example: {
      word: "ليمون",
      transliteration: "laymun",
      meaning: "limon",
      emoji: "🍋",
      caption: "Sari limon",
    },
  },
  {
    id: 24,
    symbol: "م",
    nameTr: "Mim",
    nameAr: "ميم",
    latinName: "mim",
    joining: "dual",
    description: "Dudaklari kapatip acan yumusak m sesidir.",
    pronunciations: buildHarakatSet("م", "m"),
    example: {
      word: "موز",
      transliteration: "mawz",
      meaning: "muz",
      emoji: "🍌",
      caption: "Sari muz",
    },
  },
  {
    id: 25,
    symbol: "ن",
    nameTr: "Nun",
    nameAr: "نون",
    latinName: "nun",
    joining: "dual",
    description: "Burundan duyulan n sesidir.",
    pronunciations: buildHarakatSet("ن", "n"),
    example: {
      word: "نخلة",
      transliteration: "nakhla",
      meaning: "hurma agaci",
      emoji: "🌴",
      caption: "Hurmalik",
    },
  },
  {
    id: 26,
    symbol: "و",
    nameTr: "Vav",
    nameAr: "واو",
    latinName: "waw",
    joining: "right",
    description: "Yari unlu vav sesi verir; bazen uzun u ve o tasir.",
    pronunciations: [
      { id: "fatha", label: "Fetha", arabic: `و${fatha}`, latin: "wa" },
      { id: "kasra", label: "Kesra", arabic: `و${kasra}`, latin: "wi" },
      { id: "damma", label: "Damma", arabic: `و${damma}`, latin: "wu" },
    ],
    example: {
      word: "وردة",
      transliteration: "warda",
      meaning: "gul",
      emoji: "🌹",
      caption: "Kirmizi gul",
    },
  },
  {
    id: 27,
    symbol: "ه",
    nameTr: "He",
    nameAr: "هاء",
    latinName: "ha",
    joining: "dual",
    description: "Nefesli ve hafif bir h sesidir.",
    pronunciations: buildHarakatSet("ه", "h"),
    example: {
      word: "هدية",
      transliteration: "hadiyya",
      meaning: "hediye",
      emoji: "🎁",
      caption: "Sarmali hediye",
    },
  },
  {
    id: 28,
    symbol: "لا",
    nameTr: "Lam-Elif",
    nameAr: "لام ألف",
    latinName: "lam-alif",
    joining: "ligature",
    forms: {
      isolated: "لا",
      initial: "لا",
      medial: null,
      final: "ـلا",
    },
    description: "Lam ile elifin birlesik yazimidir. Bagimsiz temel harf degil, cok kullanilan bir ligaturdur.",
    pronunciations: [
      { id: "ligature", label: "Birlesik", arabic: `ل${fatha}ا`, latin: "la" },
    ],
    example: {
      word: "لا",
      transliteration: "la",
      meaning: "hayir / yok",
      emoji: "🚫",
      caption: "Olumsuzluk ifadesi",
    },
  },
  {
    id: 29,
    symbol: "ي",
    nameTr: "Ye",
    nameAr: "ياء",
    latinName: "ya",
    joining: "dual",
    description: "Yumuak y sesi verir; bazen uzun i sesi de tasir.",
    pronunciations: [
      { id: "fatha", label: "Fetha", arabic: `ي${fatha}`, latin: "ya" },
      { id: "kasra", label: "Kesra", arabic: `ي${kasra}`, latin: "yi" },
      { id: "damma", label: "Damma", arabic: `ي${damma}`, latin: "yu" },
    ],
    example: {
      word: "يد",
      transliteration: "yad",
      meaning: "el",
      emoji: "✋",
      caption: "Acik el",
    },
  },
  {
    id: 30,
    symbol: "ء",
    nameTr: "Hemze",
    nameAr: "همزة",
    latinName: "hamza",
    joining: "hamza",
    forms: {
      isolated: "ء",
      initial: "أ",
      medial: "ـئـ",
      final: "ـء",
    },
    description: "Keskin bogaz kapanmasiyla cikan ses isaretidir. Tek basina ya da elif, vav, ya uzerinde yazilabilir.",
    pronunciations: [
      { id: "fatha", label: "Fetha", arabic: `أ${fatha}`, latin: "a" },
      { id: "kasra", label: "Kesra", arabic: `إ${kasra}`, latin: "i" },
      { id: "damma", label: "Damma", arabic: `ؤ${damma}`, latin: "u" },
    ],
    example: {
      word: "ماء",
      transliteration: "ma'",
      meaning: "su",
      emoji: "💧",
      caption: "Bir damla su",
    },
  },
].map((entry) => {
  const enriched = withForms(entry);
  return {
    ...enriched,
    sunMoon: getSunMoonInfo(enriched),
    thickness: getThicknessInfo(enriched),
  };
});

const byId = new Map(letterCatalog.map((entry) => [entry.id, entry]));

export function getLetterCatalogEntry(id) {
  return byId.get(id) ?? null;
}

export function getJoinRuleText(entry) {
  switch (entry?.joining) {
    case "right":
      return "Sadece onceki harfe baglanir.";
    case "ligature":
      return "Lam + Elif ligaturu; bagimsiz harf degil.";
    case "hamza":
      return "Tasiyici harf uzerinde ya da tek basina yazilir.";
    default:
      return "Onceki ve sonraki harflerle baglanir.";
  }
}

export function buildExampleIllustrationDataUrl(entry) {
  const example = entry?.example;
  if (!example) {
    return "";
  }

  const cacheKey = entry?.id ?? `${example.word}-${example.meaning}`;
  if (exampleIllustrationCache.has(cacheKey)) {
    return exampleIllustrationCache.get(cacheKey);
  }

  const [from, to] = palette[(Math.max(1, entry.id) - 1) % palette.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="52%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.22)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="960" height="640" rx="48" fill="url(#bg)" />
      <rect x="34" y="34" width="892" height="572" rx="42" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" />
      <rect x="170" y="72" width="620" height="138" rx="34" fill="rgba(12,16,26,0.22)" stroke="rgba(255,255,255,0.12)" />
      <circle cx="786" cy="138" r="118" fill="rgba(255,255,255,0.12)" />
      <circle cx="192" cy="548" r="162" fill="rgba(11,14,20,0.18)" />
      <circle cx="480" cy="346" r="168" fill="url(#glow)" />
      <ellipse cx="480" cy="564" rx="232" ry="60" fill="rgba(8,10,18,0.18)" />
      <ellipse cx="480" cy="564" rx="182" ry="30" fill="rgba(255,255,255,0.09)" />
      <text x="480" y="138" text-anchor="middle" font-size="88" font-family="Tahoma, Segoe UI, sans-serif" fill="#ffffff">${escapeSvg(example.word)}</text>
      <text x="480" y="183" text-anchor="middle" font-size="34" font-family="Bahnschrift, Segoe UI, sans-serif" fill="rgba(255,245,220,0.94)">${escapeSvg(example.meaning)}</text>
      <text x="480" y="456" text-anchor="middle" font-size="236" font-family="Segoe UI Emoji, Apple Color Emoji, sans-serif">${escapeSvg(example.emoji)}</text>
    </svg>
  `;

  const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  exampleIllustrationCache.set(cacheKey, dataUrl);
  return dataUrl;
}
