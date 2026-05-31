import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Presentation,
  PresentationFile,
} from "@oai/artifact-tool";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const workspaceRoot = resolve(__dirname, "..");
const projectRoot = resolve(workspaceRoot, "..");
const scratchDir = resolve(workspaceRoot, "scratch");
const renderDir = resolve(scratchDir, "renders");
const outputDir = resolve(workspaceRoot, "output");
const finalDeckPath = resolve(outputDir, "output.pptx");

const W = 1920;
const H = 1080;

const C = {
  ink: "0B0F0D",
  ink2: "111812",
  panel: "182018",
  panel2: "222B20",
  cream: "F7F2E4",
  muted: "B7BDAF",
  gold: "E8C172",
  cyan: "77DFF2",
  green: "7DDC92",
  coral: "F08F6E",
  blue: "7C9CFF",
  line: "3C4638",
  darkLine: "263026",
  white: "FFFFFF",
};

const font = {
  display: "Aptos Display",
  body: "Aptos",
  mono: "Cascadia Mono",
};

const assets = {
  gameEntry: resolve(workspaceRoot, "scratch", "assets", "game-entry.png"),
  hostBefore: resolve(workspaceRoot, "scratch", "assets", "host-before-login.png"),
  hostAfter: resolve(workspaceRoot, "scratch", "assets", "host-after-login.png"),
  botClient: resolve(workspaceRoot, "scratch", "assets", "bot-client.png"),
};

function rgb(hex) {
  return hex.replace(/^#/, "");
}

function solid(color) {
  return { type: "solid", color: rgb(color) };
}

function addShape(slide, geometry, x, y, w, h, fill = C.panel, line = C.darkLine, extras = {}) {
  const shape = slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill: solid(fill),
    line: line === null ? { width: 0 } : { style: "solid", fill: rgb(line), width: extras.lineWidth ?? 1.5 },
    ...extras,
  });
  return shape;
}

function addText(slide, value, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill: solid(opts.bg ?? C.ink),
    line: { width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    fontSize: opts.size ?? 30,
    typeface: opts.mono ? font.mono : (opts.display ? font.display : font.body),
    bold: opts.bold ?? false,
    color: rgb(opts.color ?? C.cream),
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    lineSpacing: opts.lineSpacing ?? 1.08,
    wrap: true,
  };
  return shape;
}

function addTitle(slide, section, title, subtitle = "") {
  addText(slide, section.toUpperCase(), 96, 62, 650, 32, {
    size: 18,
    bold: true,
    color: C.cyan,
    bg: C.ink,
    mono: true,
  });
  addText(slide, title, 96, 105, 1330, 150, {
    size: title.length > 62 ? 46 : title.length > 42 ? 52 : 58,
    bold: true,
    display: true,
    color: C.cream,
    bg: C.ink,
    lineSpacing: 1.02,
  });
  if (subtitle) {
    addText(slide, subtitle, 96, 255, 1240, 72, {
      size: 25,
      color: C.muted,
      bg: C.ink,
      lineSpacing: 1.12,
    });
  }
}

function addFooter(slide, index, section = "THREE.JS ARABIC GAMIFICATION") {
  addShape(slide, "rect", 96, 1014, 260, 3, C.gold, null);
  addText(slide, section, 382, 996, 900, 36, {
    size: 15,
    mono: true,
    color: C.muted,
    bg: C.ink,
  });
  addText(slide, String(index).padStart(2, "0"), 1744, 992, 80, 42, {
    size: 20,
    mono: true,
    bold: true,
    align: "right",
    color: C.gold,
    bg: C.ink,
  });
}

function addBackground(slide, variant = "default") {
  addShape(slide, "rect", 0, 0, W, H, C.ink, null);
  if (variant === "field") {
    addShape(slide, "rect", 0, 0, W, 220, C.ink2, null);
    addShape(slide, "rect", 0, 860, W, 220, C.ink2, null);
  }
  if (variant === "split") {
    addShape(slide, "rect", 0, 0, 610, H, C.ink2, null);
    addShape(slide, "rect", 610, 0, 9, H, C.gold, null);
  }
  for (let i = 0; i < 9; i += 1) {
    const x = 104 + i * 210;
    addShape(slide, "rect", x, 38, 1.5, 1004, i % 3 === 0 ? "1C251D" : "111812", null);
  }
}

function addImage(slide, path, x, y, w, h, fit = "cover", alt = "") {
  const image = slide.images.add({
    path,
    alt,
    position: { left: x, top: y, width: w, height: h },
    fit,
  });
  image.geometry = "roundRect";
  return image;
}

function addChip(slide, label, x, y, w, color = C.cyan) {
  addShape(slide, "roundRect", x, y, w, 44, "14201D", color, { lineWidth: 1.2 });
  addText(slide, label, x + 20, y + 10, w - 40, 28, {
    size: 17,
    mono: true,
    bold: true,
    color,
    bg: "14201D",
    align: "center",
  });
}

function bulletList(slide, items, x, y, w, opts = {}) {
  const gap = opts.gap ?? 54;
  items.forEach((item, index) => {
    const top = y + index * gap;
    addShape(slide, "ellipse", x, top + 8, 15, 15, opts.color ?? C.gold, null);
    addText(slide, item, x + 32, top, w - 32, opts.height ?? 50, {
      size: opts.size ?? 25,
      color: opts.textColor ?? C.cream,
      bg: opts.bg ?? C.ink,
      lineSpacing: 1.12,
    });
  });
}

function miniCard(slide, label, value, x, y, w, h, accent = C.gold) {
  addShape(slide, "roundRect", x, y, w, h, C.panel, C.darkLine);
  addText(slide, label.toUpperCase(), x + 24, y + 22, w - 48, 32, {
    size: 16,
    mono: true,
    color: accent,
    bg: C.panel,
  });
  addText(slide, value, x + 24, y + 65, w - 48, h - 80, {
    size: 28,
    bold: true,
    color: C.cream,
    bg: C.panel,
    lineSpacing: 1.05,
  });
}

function node(slide, label, x, y, w, h, accent = C.gold, sub = "") {
  addShape(slide, "roundRect", x, y, w, h, C.panel, accent, { lineWidth: 2 });
  addText(slide, label, x + 24, y + 20, w - 48, sub ? 38 : h - 34, {
    size: sub ? 25 : 27,
    bold: true,
    color: C.cream,
    bg: C.panel,
    valign: sub ? "top" : "middle",
  });
  if (sub) {
    addText(slide, sub, x + 24, y + 62, w - 48, h - 72, {
      size: 18,
      color: C.muted,
      bg: C.panel,
      lineSpacing: 1.08,
    });
  }
}

function arrow(slide, x, y, w, h, color = C.gold) {
  addShape(slide, "rightArrow", x, y, w, h, color, null);
}

function codeBlock(slide, code, x, y, w, h, title = "") {
  addShape(slide, "roundRect", x, y, w, h, "101610", C.line);
  if (title) {
    addText(slide, title, x + 28, y + 22, w - 56, 30, {
      size: 16,
      mono: true,
      bold: true,
      color: C.cyan,
      bg: "101610",
    });
  }
  addText(slide, code, x + 28, y + (title ? 64 : 28), w - 56, h - (title ? 86 : 52), {
    size: 21,
    mono: true,
    color: C.cream,
    bg: "101610",
    lineSpacing: 1.15,
  });
}

function addNotes(slide, notes) {
  slide.speakerNotes.text = notes.trim();
}

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

const slides = [];
function makeSlide({ section = "", title = "", subtitle = "", variant = "default", notes = "" }, build) {
  const slide = presentation.slides.add();
  addBackground(slide, variant);
  const index = slides.length + 1;
  if (title) addTitle(slide, section, title, subtitle);
  build?.(slide, index);
  addFooter(slide, index, section || "DERS");
  if (notes) addNotes(slide, notes);
  slides.push(slide);
  return slide;
}

makeSlide({
  variant: "field",
  notes: "Dersi bir proje turu gibi ac: once problem ve hedef, sonra dosya yapisi, sonra runtime akisi. Dinleyici bu sunumdan sonra projeyi acip hangi dosyanin ne ise yaradigini ve hangi komutun neyi baslattigini anlayabilmeli.",
}, (slide, index) => {
  addImage(slide, assets.gameEntry, 940, 118, 820, 505, "cover", "Oyun giris ekrani");
  addText(slide, "Three.js ile Arapca Ogrenme Oyunu", 96, 118, 760, 164, {
    size: 70,
    bold: true,
    display: true,
    color: C.cream,
    bg: C.ink2,
    lineSpacing: 1.0,
  });
  addText(slide, "Proje klasorunden baslayip render, fizik, multiplayer, admin paneli, asset hatti ve test stratejisine kadar ayrintili teknik ders.", 100, 330, 760, 120, {
    size: 29,
    color: C.muted,
    bg: C.ink2,
  });
  addChip(slide, "Vite + Three.js + Rapier + WebSocket", 100, 494, 520, C.cyan);
  addChip(slide, "Turkish UI / Arabic content", 100, 552, 390, C.gold);
  addShape(slide, "rect", 96, 720, 760, 4, C.gold, null);
  addText(slide, "Ders hedefi: bu klasoru sadece calistirmak degil, neden bu sekilde tasarlandigini okuyabilmek.", 100, 748, 780, 70, {
    size: 26,
    bold: true,
    color: C.cream,
    bg: C.ink2,
  });
  addFooter(slide, index, "TEKNIK DERS");
});

makeSlide({
  section: "Ders Haritasi",
  title: "Bu sunum projeyi uc katmanda anlatir",
  subtitle: "Once gereksinim, sonra dosya mimarisi, en sonda calisma zamani ve nedenleri.",
  notes: "Bu slaytta dersin sozlesmesini kur: sadece teknoloji listesi degil, dosyalarin birbirine nasil konustugunu gosterecegiz.",
}, (slide) => {
  node(slide, "1. Urun hedefi", 130, 370, 390, 220, C.gold, "Arapca harfleri 3D dunyada toplayan, mobil ve desktop oynanan egitsel oyun.");
  arrow(slide, 550, 452, 110, 58, C.gold);
  node(slide, "2. Sistem haritasi", 690, 370, 390, 220, C.cyan, "HTML girisleri, main.js, renderer, worker, server, admin panel ve asset scriptleri.");
  arrow(slide, 1110, 452, 110, 58, C.cyan);
  node(slide, "3. Neden boyle?", 1250, 370, 390, 220, C.green, "Teknoloji secimleri, trade-off'lar, test ve performans kararlarinin mantigi.");
});

makeSlide({
  section: "Proje Nedir",
  title: "Oyun, egitim icerigini 3D etkileşime ceviriyor",
  subtitle: "Oyuncu harfleri toplar, Arapca telaffuzu gorur, skor ve ilerleme bilgisiyle turu tamamlar.",
  notes: "Burada urunu kullanici perspektifinden anlat: egitsel icerik letterCatalog'da, deneyim main.js'de, gorsel dunya Three.js sahnesinde.",
}, (slide) => {
  addImage(slide, assets.gameEntry, 112, 342, 840, 525, "cover", "Oyun giris ekrani");
  bulletList(slide, [
    "Turkce arayuz, Arapca harf ve kelime icerigi.",
    "3D sahnede hareket, hazine, portal ve harf toplama akisi.",
    "Mobil dokunmatik kontrol ve desktop klavye/fare girisi.",
    "Admin tarafindan baslatilan ortak multiplayer tur mantigi.",
  ], 1040, 360, 700, { size: 27, gap: 72, color: C.cyan });
});

makeSlide({
  section: "Gereksinimler",
  title: "Baslamadan once sistemin karsilamasi gerekenler",
  subtitle: "Proje gereksinimleri hem oyun motoru hem de sinif/lobby senaryosu dusunulerek sekillenmis.",
  notes: "Bu listeyi gereksinim analizi gibi oku: teknik secimlerin cogu bu ihtiyaclardan doguyor.",
}, (slide) => {
  miniCard(slide, "Egitim", "30 Arap harfi, hareke, ornek kelime, telaffuz ve geri bildirim.", 110, 350, 380, 220, C.gold);
  miniCard(slide, "3D Deneyim", "Gercek zamanli kamera, karakter, fizik, collectible, sandik ve portal.", 535, 350, 380, 220, C.cyan);
  miniCard(slide, "Multiplayer", "Oyuncu isimleri, lobby, admin start/reset, roster ve leaderboard.", 960, 350, 380, 220, C.green);
  miniCard(slide, "Yayinlama", "Vite build, public asset senkronu, tunnel ile QR uzerinden paylasim.", 1385, 350, 380, 220, C.coral);
  codeBlock(slide, "Node.js + npm\nModern Chromium / Edge\nWebGL2; varsa WebGPU\nYerel portlar: 4173, 2567", 300, 660, 1320, 210, "Calisma ortami");
});

makeSlide({
  section: "Stack",
  title: "Kullanilan teknolojiler tek bir gorev icin secilmemis",
  subtitle: "Her teknoloji runtime'da farkli bir sorumlulugu tasiyor.",
  notes: "Burada teknoloji adlarini ezberletmek yerine rolleri vurgula. Three.js render, Rapier hareket/fizik, Vite gelistirme ve build, Node/ws oturum yonetimi.",
}, (slide) => {
  node(slide, "Three.js", 110, 360, 300, 160, C.gold, "Sahne, kamera, mesh, GLB, material, animasyon.");
  node(slide, "WebGPU/WebGL", 450, 360, 300, 160, C.cyan, "Renderer backend secimi ve cihaz uyumlulugu.");
  node(slide, "Rapier3D", 790, 360, 300, 160, C.green, "Karakter controller ve carpismalar worker icinde.");
  node(slide, "Vite", 1130, 360, 300, 160, C.coral, "Dev server, module graph, build ve proxy.");
  node(slide, "Node + ws", 1470, 360, 300, 160, C.blue, "Lobby, admin REST, WebSocket roster.");
  addShape(slide, "rect", 130, 610, 1640, 3, C.line, null);
  bulletList(slide, [
    "Vanilla JS secimi: framework katmani yok; DOM state machine dogrudan main.js icinde.",
    "GLTF Transform + meshopt: 3D assetleri runtime icin kucultup public klasorune tasir.",
    "Playwright: oyun akisini ve tarayici davranisini dogrulayan E2E test katmani.",
  ], 180, 690, 1500, { size: 28, gap: 62, color: C.gold });
});

makeSlide({
  section: "Klasor Haritasi",
  title: "Kok klasor: oyun, sunucu, asset ve test birlikte duruyor",
  subtitle: "Bu projede runtime kodu `src/`, backend `server/`, donusum araclari `scripts/`, dogrulama `tests/` altinda.",
  notes: "Klasor slaydinda bevy klasorunun yanlis anlasilmamasini sagla: asil browser oyunu Three.js/Vite tarafinda calisiyor.",
}, (slide) => {
  codeBlock(slide, `threejs_arabic_gamification/
  index.html            oyuncu girisi
  host.html / admin.html admin panel kabugu
  src/                  oyun, UI, render, worker
  server/               multiplayer REST + WebSocket
  scripts/              asset sync, share, load harness
  assets/               kaynak PNG/GLB/GLTF paketleri
  public/               runtime'a servis edilen optimize asset
  tests/                Playwright + Node testleri
  dist/                 build ciktisi`, 120, 330, 830, 550, "Klasor agaci");
  bulletList(slide, [
    "`node_modules/` bagimliliklar; elle ders konusu degil.",
    "`bevy/` proje runtime motoru degil; burada daha cok kaynak/reference arşivi ve ses var.",
    "`STATE.md` oturumlar arasi proje hafizasi; son kararlar ve mimari ozeti burada.",
    "`AGENTS.md` calisma kurallari; monolitik main.js'e saygili ilerleme bekleniyor.",
  ], 1040, 360, 720, { size: 25, gap: 74, color: C.cyan });
});

makeSlide({
  section: "Giris Dosyalari",
  title: "HTML dosyalari farkli kullanici rollerine kapilar acar",
  subtitle: "Vite build config bu entrypoint'leri Rollup input olarak paketler.",
  notes: "HTML dosyalari sadece statik sayfa degil; her biri kendi JS/CSS akisini baslatan giris noktasi.",
}, (slide) => {
  node(slide, "index.html", 140, 360, 340, 160, C.gold, "Oyuncu oyuna buradan girer; src/main.js yuklenir.");
  node(slide, "host.html", 560, 360, 340, 160, C.cyan, "Canli tur kontrol paneli; src/admin.js kullanir.");
  node(slide, "admin.html", 980, 360, 340, 160, C.green, "Ayni admin deneyiminin alternatif girisi.");
  node(slide, "bot.html", 1400, 360, 340, 160, C.coral, "Load test ve otomatik istemci simülasyonu.");
  codeBlock(slide, `rollupOptions.input = {
  main: index.html,
  admin: admin.html,
  host: host.html,
  bot: bot.html
}`, 355, 645, 1210, 210, "vite.config.js");
});

makeSlide({
  section: "src/main.js",
  title: "main.js oyunun merkezi orkestratoru",
  subtitle: "Dosya buyuk: 8.650 satir. Sahne, input, UI, multiplayer ve oyun kurallari ayni yerde yasiyor.",
  notes: "Burada monolitik yapinin avantaj ve riskini anlat: tek yerde takip kolay ama degisim maliyeti yuksek. Yeni ozelliklerde mevcut yapinin ritmine uymak onemli.",
}, (slide) => {
  miniCard(slide, "Render", "Renderer kurulumu, sahne, kamera, isik, GLB yukleme.", 120, 345, 390, 190, C.gold);
  miniCard(slide, "Oyun Durumu", "state nesnesi: mode, player, world, UI, settings, performance.", 555, 345, 390, 190, C.cyan);
  miniCard(slide, "Etkilesim", "Klavye, mouse, touch joystick, skill butonlari, card modallari.", 990, 345, 390, 190, C.green);
  miniCard(slide, "Network", "MultiplayerClient, snapshot gonderimi, roster ve matchstate eventleri.", 1425, 345, 390, 190, C.coral);
  codeBlock(slide, `import "./styles.css";
import * as THREE from "three";
import nipplejs from "nipplejs";
import { GLTFLoader } from "...";
import { createGameRenderer } from "./runtime/renderer.js";
import { getLetterCatalogEntry } from "./letterCatalog.js";`, 230, 610, 1460, 300, "Dosyanin en ustundeki bagimlilik izi");
});

makeSlide({
  section: "UI Deseni",
  title: "DOM state machine: gorunurluk CSS class'lariyla yonetiliyor",
  subtitle: "Framework yok; merkezi `dom` map ve CSS class toggle mantigi var.",
  notes: "Bu deseni anlatirken React/Vue yok diye eksik demiyoruz. Burada UI kararlarini basit DOM referanslari ve state ile kontrol etmek bilincli bir sadelik.",
}, (slide) => {
  node(slide, "state", 190, 420, 280, 130, C.gold, "mode, ui, settings, score");
  arrow(slide, 505, 458, 110, 50, C.gold);
  node(slide, "dom map", 650, 420, 300, 130, C.cyan, "querySelector referanslari");
  arrow(slide, 985, 458, 110, 50, C.cyan);
  node(slide, "class toggle", 1130, 420, 330, 130, C.green, ".is-visible, .is-active");
  arrow(slide, 1490, 458, 110, 50, C.green);
  node(slide, "styles.css", 1630, 420, 220, 130, C.coral, "responsive UI");
  bulletList(slide, [
    "Avantaj: az bagimlilik, hizli debug, tasarim tokenlari CSS custom properties ile.",
    "Risk: main.js buyudukce event handler ve state degisimlerini disiplinli okumak gerekir.",
  ], 250, 665, 1400, { size: 29, gap: 70, color: C.gold });
});

makeSlide({
  section: "Egitim Verisi",
  title: "letterCatalog.js oyunun ders icerigi katmani",
  subtitle: "Arap harfleri, ornek kelime, hareke varyantlari, siniflandirma ve gorsel uretim yardimcilari burada.",
  notes: "Bu dosya oyundaki pedagojik veri kaynagi gibi dusunulmeli. Render veya physics degil, ne ogretildigini tanimlar.",
}, (slide) => {
  codeBlock(slide, `letterCatalog = [
  {
    id: 1,
    symbol: "...",
    name: "...",
    forms: [...],
    vowels: [...],
    example: { word, transliteration, meaning }
  }
]`, 120, 338, 760, 360, "Veri modeli");
  miniCard(slide, "30 PNG", "assets/arabic_huruf altindaki harf gorselleri runtime texture olarak kullanilir.", 970, 345, 360, 210, C.gold);
  miniCard(slide, "Dil katmani", "Turkce arayuz metni, Arapca icerik ve transliteration ayni deneyimde birlesir.", 1390, 345, 360, 210, C.cyan);
  miniCard(slide, "TTS", "Web Speech API ile Arapca telaffuz deneyimi desteklenir.", 970, 615, 360, 210, C.green);
  miniCard(slide, "Kural", "Gunes/ay harfleri ve agir harfler gibi ders notlari oyun kartina tasinir.", 1390, 615, 360, 210, C.coral);
});

makeSlide({
  section: "Render Hatti",
  title: "3D sahne, asset ve texture hatti birlikte calisir",
  subtitle: "Three.js sadece canvas'a cizmez; loader, decoder, materyal, animasyon ve performans kararlarini tasir.",
  notes: "Render hattini modul zinciri gibi anlat: GLTFLoader model getirir, Meshopt sikistirilmis veriyi acar, KTX2Loader texture optimizasyonunu kullanir, renderer backend'i cizer.",
}, (slide) => {
  node(slide, "GLB / GLTF", 150, 400, 250, 130, C.gold, "Kaykit paketleri");
  arrow(slide, 435, 442, 90, 46, C.gold);
  node(slide, "sync-public-assets", 560, 400, 330, 130, C.cyan, "meshopt + public");
  arrow(slide, 925, 442, 90, 46, C.cyan);
  node(slide, "GLTFLoader", 1050, 400, 260, 130, C.green, "Model parse");
  arrow(slide, 1345, 442, 90, 46, C.green);
  node(slide, "Scene Graph", 1470, 400, 280, 130, C.coral, "Mesh, light, camera");
  bulletList(slide, [
    "MeshoptDecoder, GLB dosya boyutunu ve indirme maliyetini dusurur.",
    "KTX2Loader varsa harf texture'lari icin basis transcoder yolunu kullanir.",
    "Kalite profili pixel ratio, shadow ve tone mapping gibi kararlar verir.",
  ], 260, 665, 1420, { size: 28, gap: 66, color: C.gold });
});

makeSlide({
  section: "Renderer",
  title: "renderer.js: once WebGPU denenir, gerekirse WebGL'e dusulur",
  subtitle: "Bu dosya cihaz farklarini oyunun geri kalanindan izole eden kucuk ama kritik katmandir.",
  notes: "Bu slaytta fallback mantigini vurgula. Hedef her cihazda calismak; WebGPU varsa daha modern backend, yoksa klasik WebGL.",
}, (slide) => {
  codeBlock(slide, `createGameRenderer({ canvas, qualityProfile })
  -> WebGPU.isAvailable()
  -> new WebGPURenderer()
  -> await renderer.init()
  -> configureRenderer()
  -> fallback: new THREE.WebGLRenderer()`, 120, 335, 820, 405, "src/runtime/renderer.js");
  node(slide, "Neden ayri dosya?", 1040, 355, 610, 150, C.gold, "Renderer secimi tek yerde kalir; main.js sadece sonuc backend'i kullanir.");
  node(slide, "Risk yonetimi", 1040, 560, 610, 150, C.cyan, "Device lost ve WebGPU bootstrap hatalari oyunu tamamen durdurmaz.");
  node(slide, "Performans profili", 1040, 765, 610, 115, C.green, "Pixel ratio cap, shadow ve tone mapping kaliteye gore ayarlanir.");
});

makeSlide({
  section: "Fizik",
  title: "Rapier3D worker icinde calisir: ana thread rahat kalir",
  subtitle: "simulation.worker.js carpismayi, karakter hareketini ve nearest collectible hesaplarini off-main-thread yapar.",
  notes: "Web Worker dersinin kilit noktasi: render ve UI ana thread'de akarken fizik hesaplari worker tarafinda adimlanir. Mesaj protokolu net olursa sistem okunabilir kalir.",
}, (slide) => {
  node(slide, "main.js", 170, 400, 300, 145, C.gold, "desiredTranslation");
  arrow(slide, 505, 448, 110, 48, C.gold);
  node(slide, "postMessage", 650, 400, 300, 145, C.cyan, "configure, step, reset");
  arrow(slide, 985, 448, 110, 48, C.cyan);
  node(slide, "Rapier World", 1130, 400, 310, 145, C.green, "controller + collider");
  arrow(slide, 1475, 448, 110, 48, C.green);
  node(slide, "snapshot", 1610, 400, 210, 145, C.coral, "position + nearest");
  codeBlock(slide, `worker messages:
configure -> configured
step      -> stepResult
reset     -> resetAck
collectibleState / chestState -> ack`, 360, 650, 1200, 205, "Worker protokolu");
});

makeSlide({
  section: "Game Loop",
  title: "Bir karede veri akisi: input, fizik, oyun kurali, render",
  subtitle: "Gercek zamanli oyun akisi her frame kucuk kararlarin sirali uygulanmasidir.",
  notes: "Bu slayt dersin runtime omurgasi: input vector uretilir, worker adimlar, state guncellenir, UI ve multiplayer snapshot senkronlanir, renderer cizer.",
}, (slide) => {
  const labels = [
    ["Input", "Klavye / touch / joystick", C.gold],
    ["Physics", "Worker stepResult", C.cyan],
    ["Rules", "Collectible, chest, portal", C.green],
    ["Sync", "UI + WebSocket snapshot", C.coral],
    ["Render", "camera + scene draw", C.blue],
  ];
  labels.forEach(([a, b, color], i) => {
    const x = 110 + i * 355;
    node(slide, a, x, 395, 260, 145, color, b);
    if (i < labels.length - 1) arrow(slide, x + 275, 445, 66, 42, color);
  });
  addShape(slide, "arc", 520, 620, 880, 190, C.gold, C.gold, { lineWidth: 5 });
  addText(slide, "requestAnimationFrame / renderer animation loop", 560, 745, 800, 42, {
    size: 30,
    bold: true,
    color: C.cream,
    bg: C.ink,
    align: "center",
  });
});

makeSlide({
  section: "Multiplayer",
  title: "Multiplayer iki kanalli: REST durum, WebSocket canli olay",
  subtitle: "Admin paneli HTTP endpoint'lerine konusur; oyuncular oyun sirasinda WebSocket ile snapshot yollar.",
  notes: "REST ve WebSocket ayrimini temiz anlat. REST kontrol ve durum sorgusu icin, WebSocket dusuk gecikmeli canli oyun olaylari icin.",
}, (slide) => {
  node(slide, "Oyuncu tarayicisi", 120, 365, 340, 135, C.gold, "index.html + main.js");
  node(slide, "Vite proxy", 570, 365, 260, 135, C.cyan, "/api, /health, /multiplayer");
  node(slide, "Node server", 940, 365, 320, 135, C.green, "multiplayer-server.mjs");
  node(slide, "Admin panel", 1370, 365, 360, 135, C.coral, "host.html + admin.js");
  arrow(slide, 485, 412, 70, 40, C.gold);
  arrow(slide, 855, 412, 70, 40, C.cyan);
  arrow(slide, 1285, 412, 70, 40, C.green);
  codeBlock(slide, `WebSocket: /multiplayer
REST:
  GET  /health
  GET  /api/state
  POST /api/admin/login
  POST /api/admin/start
  POST /api/admin/reset`, 320, 640, 1280, 245, "Backend yuzeyi");
});

makeSlide({
  section: "Server",
  title: "multiplayer-server.mjs lobby'nin otoritesi",
  subtitle: "Oyuncu kaydi, round durumu, finish order, QR link ve admin session burada tutulur.",
  notes: "Server state memory-based. Bu ders icin iyi: basit ve okunabilir. Uretim icin kalici veritabani ve auth sertlestirme gerekebilir.",
}, (slide) => {
  miniCard(slide, "CONFIG", "host, port, adminCode, totalLetters, appOrigin, TTL.", 130, 345, 360, 210, C.gold);
  miniCard(slide, "state.match", "lobby/running/finished, roundId, startedAt, finishOrder.", 545, 345, 360, 210, C.cyan);
  miniCard(slide, "players", "Map icinde ad, karakter, map, skor, pozisyon, allowedRoundId.", 960, 345, 360, 210, C.green);
  miniCard(slide, "broadcast", "roster coalescing ile snapshot patlamalari yavaslatilir.", 1375, 345, 360, 210, C.coral);
  codeBlock(slide, `Admin kodu varsayilan:
MULTIPLAYER_ADMIN_CODE || "sun-court-admin"

Degistirmek icin environment variable kullanilir.`, 335, 640, 1250, 190, "Guvenlik notu");
});

makeSlide({
  section: "Admin Panel",
  title: "Admin panel oyunu baslatan kontrol odasi",
  subtitle: "QR, roster, leaderboard, duyuru, start/reset ve kick islemleri tek ekrandan yonetilir.",
  notes: "Burada admin panelin oyuncu deneyiminden farkini anlat: bu sayfa oyunu oynamaz, turun durumunu kontrol eder.",
}, (slide) => {
  addImage(slide, assets.hostAfter, 110, 335, 980, 610, "cover", "Admin host paneli");
  bulletList(slide, [
    "`src/admin.js` backend origin'i query/localStorage ile cozer.",
    "Login sonrasi token sessionStorage'da tutulur.",
    "2 saniyede bir `/health` ve admin state yenilenir.",
    "QR link `/api/state` veya `/api/admin/state` ile uretilir.",
  ], 1165, 360, 640, { size: 24, gap: 72, color: C.cyan });
});

makeSlide({
  section: "Join Akisi",
  title: "QR link oyuncuya dogru backend bilgisini tasir",
  subtitle: "Yerel veya public tunnel fark etmeksizin oyuncu `server` parametresiyle lobby sunucusuna baglanabilir.",
  notes: "QR mantigini basitlestir: admin panel joinUrl uretir, oyuncu o linkten acilir, main.js server origin'i saklar, WebSocket URL'si olusturur.",
}, (slide) => {
  node(slide, "Admin /api/state", 140, 380, 310, 130, C.gold, "joinUrl + QR");
  arrow(slide, 480, 423, 90, 45, C.gold);
  node(slide, "Oyuncu linki", 600, 380, 300, 130, C.cyan, "/?server=...");
  arrow(slide, 930, 423, 90, 45, C.cyan);
  node(slide, "main.js", 1050, 380, 290, 130, C.green, "origin kaydi");
  arrow(slide, 1370, 423, 90, 45, C.green);
  node(slide, "WebSocket", 1490, 380, 300, 130, C.coral, "ws(s)://.../multiplayer");
  codeBlock(slide, `resolveJoinUrl(req)
  -> appOrigin belirlenir
  -> URLSearchParams.set("server", backendOrigin)
  -> QRCode.toDataURL(joinUrl)`, 370, 650, 1180, 195, "Server tarafinda QR uretimi");
});

makeSlide({
  section: "Asset Pipeline",
  title: "Kaynak asset ile runtime asset ayni sey degil",
  subtitle: "`assets/` ham kaynaklari tutar; `scripts/sync-public-assets.mjs` sadece gerekenleri optimize edip `public/assets/` altina yazar.",
  notes: "Bu proje icin en onemli build dersi: public klasoru elle doldurulan bir cop kutusu degil, script kontrollu runtime varlik alani.",
}, (slide) => {
  node(slide, "assets/", 140, 395, 280, 130, C.gold, "PNG, GLB, GLTF kaynak");
  arrow(slide, 455, 440, 110, 45, C.gold);
  node(slide, "scan refs", 600, 395, 280, 130, C.cyan, "src/html/css/js");
  arrow(slide, 915, 440, 110, 45, C.cyan);
  node(slide, "meshopt", 1060, 395, 280, 130, C.green, "sikistirme");
  arrow(slide, 1375, 440, 110, 45, C.green);
  node(slide, "public/assets", 1520, 395, 280, 130, C.coral, "runtime servis");
  bulletList(slide, [
    "GLTF icindeki buffer ve image referanslari gerekirse data URI olarak gomulur.",
    "Basis transcoder dosyalari public runtime klasorune kopyalanir.",
    "toktx varsa harf PNG'leri icin KTX2 manifest uretilir.",
  ], 270, 665, 1360, { size: 28, gap: 62, color: C.gold });
});

makeSlide({
  section: "Build Sistemi",
  title: "Vite bu projede dev server, bundler ve proxy gorevi goruyor",
  subtitle: "ES module import'lari hizli dev modunda cozulur; build asamasinda Rollup ciktisi olusur.",
  notes: "Vite'ı sadece 'npm run dev' olarak anlatma. Burada proxy ayari multiplayer'i frontend portuyla birlestirdigi icin mimari rolu var.",
}, (slide) => {
  codeBlock(slide, `scripts:
  predev      -> node scripts/sync-public-assets.mjs
  dev         -> vite --host 127.0.0.1 --port 4173
  prebuild    -> asset sync
  build       -> vite build
  preview     -> vite preview
  server      -> node server/multiplayer-server.mjs`, 120, 330, 850, 415, "package.json");
  node(slide, "Proxy", 1070, 360, 560, 145, C.cyan, "/api, /health ve /multiplayer istekleri 2567'ye yonlenir.");
  node(slide, "Rollup input", 1070, 570, 560, 145, C.gold, "index, admin, host, bot HTML girisleri build ciktisina dahil edilir.");
  node(slide, "assetsInclude", 1070, 780, 560, 105, C.green, "GLB/GLTF/FBX/OBJ dosyalari module graph icinde taninir.");
});

makeSlide({
  section: "Calistirma",
  title: "Yerelde tam oyun iki servisle baslar",
  subtitle: "Frontend 4173, multiplayer backend 2567. Tam yayin/paylasim akisi ek olarak tunnel uretir.",
  notes: "Bu slaytta pratik komutlari anlat. start:full alias'i share:auto'yu kolay bulunur hale getiriyor.",
}, (slide) => {
  codeBlock(slide, `# Sadece oyun frontend
npm run dev

# Sadece multiplayer backend
npm run server

# Ikisini birlikte, development
npm run dev:all

# Full share/tunnel akisi
npm run start:full`, 150, 330, 760, 470, "Komutlar");
  miniCard(slide, "Frontend", "http://127.0.0.1:4173", 1010, 360, 520, 115, C.gold);
  miniCard(slide, "Backend", "http://127.0.0.1:2567/health", 1010, 510, 520, 115, C.cyan);
  miniCard(slide, "Admin", "http://127.0.0.1:4173/host.html", 1010, 660, 520, 115, C.green);
  miniCard(slide, "Admin kodu", "sun-court-admin", 1010, 800, 520, 125, C.coral);
});

makeSlide({
  section: "Test",
  title: "Dogrulama iki hatta ayrilir: oyun davranisi ve sunucu yuk dayanimi",
  subtitle: "Playwright browser akisini test eder; Node testleri asset ve server mantigini kontrol eder.",
  notes: "Test slaydinda riskleri esle: fizik/harf/portal gibi oyun akislari E2E, coalescing ve 50 oyuncu gibi backend davranislari Node test.",
}, (slide) => {
  node(slide, "Playwright E2E", 170, 360, 470, 170, C.gold, "letter collection, physics interactions, portal transition, phase1 stabilization");
  node(slide, "Node tests", 725, 360, 470, 170, C.cyan, "asset allowlist, server coalescing, 50-player load");
  node(slide, "Browser harness", 1280, 360, 470, 170, C.green, "bot.html istemcileriyle coklu oyuncu simülasyonu");
  codeBlock(slide, `npm run test:e2e:smoke
npm run test:e2e:letters
npm run test:e2e:physics
npm run test:server:50players
npm run load:browser:50`, 360, 650, 1200, 210, "Hedefli test komutlari");
});

makeSlide({
  section: "Performans",
  title: "Performans kararlari oyunun tasarimina gomulu",
  subtitle: "3D oyunlarda performans sadece FPS degil; asset boyutu, network sikligi ve cihaz fallback'i de ayni derecede onemlidir.",
  notes: "Bu slaytta optimizasyonu tek bir sihirli ayar gibi anlatma. Proje, cesitli kucuk kararlarin toplamiyla stabil hale geliyor.",
}, (slide) => {
  miniCard(slide, "Renderer fallback", "WebGPU basaramazsa WebGLRenderer ile devam.", 135, 340, 390, 190, C.gold);
  miniCard(slide, "Asset compression", "Meshopt GLB ve runtime allowlist ile gereksiz dosya yok.", 565, 340, 390, 190, C.cyan);
  miniCard(slide, "Texture path", "Basis/KTX2 manifest opsiyonel texture sikistirma saglar.", 995, 340, 390, 190, C.green);
  miniCard(slide, "Roster coalescing", "Snapshot patlamalari interval ile birlestirilir.", 1425, 340, 390, 190, C.coral);
  bulletList(slide, [
    "Remote oyuncular icin LOD ve daha hafif fallback asset yaklasimi var.",
    "Mobilde FPS chip ve UI yogunlugu sade tutulur.",
    "Worker fizik, render thread'ini gereksiz carpismadan korur.",
  ], 250, 650, 1420, { size: 29, gap: 64, color: C.gold });
});

makeSlide({
  section: "Birlikte Calisma",
  title: "Dosyalar birbirleriyle acik protokoller uzerinden konusuyor",
  subtitle: "Import, postMessage, HTTP, WebSocket ve localStorage projedeki ana iletisim bicimleri.",
  notes: "Bu slayt dosyalar arasi iletisimi tek tabloda toplar. Ogrencinin bug ararken hangi hat uzerinde oldugunu anlamasi onemli.",
}, (slide) => {
  const rows = [
    ["main.js -> renderer.js", "import", "Renderer backend secimi"],
    ["main.js -> simulation.worker.js", "postMessage", "Fizik configure/step/reset"],
    ["main.js -> multiplayer-server", "WebSocket", "join, profile, snapshot"],
    ["admin.js -> multiplayer-server", "fetch REST", "login, state, start, reset"],
    ["sync-public-assets -> public/assets", "filesystem", "runtime asset uretimi"],
  ];
  rows.forEach((row, i) => {
    const y = 340 + i * 98;
    addText(slide, row[0], 160, y, 500, 42, { size: 25, bold: true, color: C.cream, bg: C.ink });
    addChip(slide, row[1], 710, y - 4, 250, i % 2 ? C.cyan : C.gold);
    addText(slide, row[2], 1030, y, 680, 42, { size: 25, color: C.muted, bg: C.ink });
    addShape(slide, "rect", 150, y + 62, 1580, 2, C.darkLine, null);
  });
});

makeSlide({
  section: "Veri Akisi",
  title: "Bir oyuncu oyuna girdiginde olanlar",
  subtitle: "Bu akisi bilmek, multiplayer bug'larini hizli ayirmayi saglar.",
  notes: "Bu slayti adim adim oku. Her adim farkli bir dosya ya da protokol demek.",
}, (slide) => {
  const steps = [
    ["1", "index.html", "src/main.js'i yukler"],
    ["2", "Oyuncu isim yazar", "localStorage ile saklanir"],
    ["3", "Baslat", "ensureMultiplayerReady() calisir"],
    ["4", "WebSocket", "join/profile mesaji gider"],
    ["5", "Server", "player kaydi ve matchstate doner"],
    ["6", "Frame loop", "snapshot ve roster surekli akar"],
  ];
  steps.forEach(([n, a, b], i) => {
    const x = 120 + (i % 3) * 580;
    const y = 360 + Math.floor(i / 3) * 250;
    addShape(slide, "ellipse", x, y, 70, 70, i % 2 ? C.cyan : C.gold, null);
    addText(slide, n, x, y + 13, 70, 42, { size: 29, bold: true, color: C.ink, bg: i % 2 ? C.cyan : C.gold, align: "center" });
    node(slide, a, x + 95, y - 8, 390, 110, i % 2 ? C.cyan : C.gold, b);
  });
});

makeSlide({
  section: "Kod Kalitesi",
  title: "Monolitik yapida degisim disiplini gerekir",
  subtitle: "main.js buyuk oldugu icin yeni ozellikler mevcut bolge ve desenlere saygili eklenmeli.",
  notes: "Bunu elestiri gibi degil, bakim stratejisi gibi anlat. Proje calisiyor; amac bilincli hareket etmek.",
}, (slide) => {
  miniCard(slide, "Guclu taraf", "Tek dosyada oyun akisini takip etmek mumkun; prototipleme hizi yuksek.", 150, 340, 480, 210, C.green);
  miniCard(slide, "Zayif taraf", "Event, UI, render ve network ayni dosyada buyudukce yan etki takibi zorlasir.", 720, 340, 480, 210, C.coral);
  miniCard(slide, "Dogru hamle", "Yeni feature icin once mevcut fonksiyon bolgesini bul, sonra kucuk ve testlenebilir ekle.", 1290, 340, 480, 210, C.gold);
  codeBlock(slide, `Pratik okuma sirasi:
1. STATE.md
2. package.json scripts
3. vite.config.js proxy/input
4. src/main.js state + runtime setup
5. server/multiplayer-server.mjs endpoints`, 300, 650, 1320, 210, "Projeye yeni girenin rotasi");
});

makeSlide({
  section: "Ne Degil",
  title: "Bu proje ne degil?",
  subtitle: "Yanlis beklentileri ayirmak, dogru mimari kararlarini daha kolay gormemizi saglar.",
  notes: "Kapanis bolumune gecis. Burada olumsuz liste teknik netlik icin kullaniliyor.",
}, (slide) => {
  bulletList(slide, [
    "Bir game engine projesi degil: ana runtime Bevy/Unity degil, tarayici ve Three.js.",
    "Bir React/Vue uygulamasi degil: UI state dogrudan DOM ve CSS class'lariyla yonetiliyor.",
    "Sadece single-player demo degil: backend, lobby, QR, admin ve roster var.",
    "Sadece asset gosterici degil: icerik, fizik, skor, portal ve tur mantigi birlikte calisiyor.",
    "Tam uretim auth sistemi degil: admin kodu env ile degistirilebilir ama temel seviyede.",
  ], 180, 350, 1500, { size: 30, gap: 84, color: C.coral });
});

makeSlide({
  section: "Neden",
  title: "Peki neden bu sekilde yapildi?",
  subtitle: "Secimler gereksinimlerden geriye dogru okununca anlam kazaniyor.",
  notes: "Bu slayt dersin 'neden' cevabi. Teknolojileri tek tek savunmak yerine gereksinim-eslesme kur.",
}, (slide) => {
  node(slide, "Three.js", 170, 345, 390, 140, C.gold, "Tarayicida 3D sahne icin dogrudan, guclu ve yaygin.");
  node(slide, "Worker + Rapier", 610, 345, 390, 140, C.cyan, "Fizik hesaplari render/UI akisini kilitlemesin diye.");
  node(slide, "Vanilla JS", 1050, 345, 390, 140, C.green, "Oyun prototipinde framework yerine runtime kontrolu one alinsin diye.");
  node(slide, "Node/ws", 1490, 345, 300, 140, C.coral, "Lobby ve realtime mesaj icin hafif backend yeterli oldugu icin.");
  node(slide, "Vite", 300, 615, 390, 140, C.gold, "ES module dev deneyimi, build ve proxy tek aracla gelsin diye.");
  node(slide, "Asset sync", 760, 615, 390, 140, C.cyan, "Ham asset ile yayinlanan asset ayrilsin diye.");
  node(slide, "Playwright", 1220, 615, 390, 140, C.green, "Oyun davranisi gercek tarayicida dogrulansin diye.");
});

makeSlide({
  section: "Ders Kapanisi",
  title: "Projeyi okuyabilmek icin dort soru yeter",
  subtitle: "Yeni bir dosya veya bug gordugunde bu sirayla dusun.",
  notes: "Son slaytta ogrenciye uygulanabilir bir zihinsel model ver. Bundan sonra projeyi acip baglantilari takip edebilir.",
}, (slide) => {
  const qs = [
    ["1", "Bu dosya hangi rolde?", "entry, runtime, server, asset, test"],
    ["2", "Kiminle konusuyor?", "import, fetch, WebSocket, postMessage"],
    ["3", "Ne zaman calisiyor?", "dev, build, preview, runtime, test"],
    ["4", "Neden burada?", "performans, sadelik, uyumluluk, paylasim"],
  ];
  qs.forEach(([n, q, a], i) => {
    const y = 345 + i * 140;
    addShape(slide, "ellipse", 210, y, 74, 74, i % 2 ? C.cyan : C.gold, null);
    addText(slide, n, 210, y + 14, 74, 42, { size: 30, bold: true, color: C.ink, bg: i % 2 ? C.cyan : C.gold, align: "center" });
    addText(slide, q, 320, y - 4, 620, 45, { size: 32, bold: true, color: C.cream, bg: C.ink });
    addText(slide, a, 980, y + 4, 640, 40, { size: 25, color: C.muted, bg: C.ink });
  });
  addText(slide, "Ana fikir: proje klasoru bir dosya listesi degil, calisan bir iletisim agidir.", 300, 920, 1320, 52, {
    size: 34,
    bold: true,
    color: C.gold,
    bg: C.ink,
    align: "center",
  });
});

function hydrateImages() {
  const requests = presentation.getPendingImageHydrationRequests?.() ?? [];
  if (!requests.length) return;
  const payloads = requests.map((request) => ({
    ...request,
    data: readFileSync(request.uri),
  }));
  presentation.hydrateImageAssets(payloads);
}

async function exportDeck() {
  rmSync(renderDir, { recursive: true, force: true });
  mkdirSync(renderDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  hydrateImages();

  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await pptxBlob.save(finalDeckPath);

  for (let i = 0; i < slides.length; i += 1) {
    const pngBlob = await slides[i].export({ format: "png", scale: 1 });
    const buffer = Buffer.from(await pngBlob.arrayBuffer());
    writeFileSync(join(renderDir, `slide-${String(i + 1).padStart(2, "0")}.png`), buffer);
  }

  const manifest = {
    exportedDeck: finalDeckPath,
    slideCount: slides.length,
    renders: renderDir,
    sourceProject: projectRoot,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(scratchDir, "deck-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

await exportDeck();
