# Arabic Letter Hunt 3D

3D Arapça harf öğrenme oyunu. Harfleri topla, seviye atla, skorunu artır.

**Oyna:** https://qpvale34.github.io/arabic-hunt-3d/

---

## Oyun Modları

| Mod | Açıklama |
|-----|----------|
| **Tek Oyuncu** | Sunucu gerektirmez. GitHub Pages'de doğrudan çalışır. |
| **Çok Oyuncu** | WebSocket sunucusu gerektirir. Yerel ağ veya tunnel ile oynanır. |

---

## Özellikler

- 3D dünya (Three.js + WebGPU, WebGL fallback)
- Fizik motoru (Rapier3D, Web Worker)
- 3 aşamalı harf toplama: Sun Court → Halloween Hollows → Hexagon Village
- 28 Arapça harf, her biri eşsiz görsel ve ses efektleriyle
- Karakter seçimi (Knight, Archer, Mage)
- Dokunmatik ekran desteği (mobil)
- E2E test altyapısı (Playwright)

---

## Yerel Geliştirme

### Gereksinimler

- Node.js 18+
- npm

### Kurulum

```bash
# Depoyu klonla
git clone https://github.com/qpvale34/arabic-hunt-3d.git
cd arabic-hunt-3d

# Bağımlılıkları yükle
npm install
```

### Geliştirme Sunucusu

```bash
# Vite dev sunucusu (tek oyuncu modu çalışır)
npm run dev
```

Tarayıcıda `http://127.0.0.1:4173` adresini aç.

### Multiplayer ile Geliştirme

```bash
# Hem oyun sunucusu hem istemci aynı anda
npm run dev:all
```

Bu komut iki paralel süreç başlatır:
- `npm run server` — WebSocket multiplayer sunucusu (port 2567)
- `npm run dev` — Vite dev sunucusu (port 4173)

Çok oyunculu mod için `host.html` üzerinden admin paneline eriş.

---

## Yapı

```
├── index.html              # Ana oyun sayfası
├── host.html               # Multiplayer admin paneli
├── admin.html              # Admin dashboard
├── src/
│   ├── main.js             # Oyun mantığı (Three.js sahne, fizik, UI)
│   ├── letterCatalog.js    # Arapça harf verileri
│   ├── admin.js            # Admin panel mantığı
│   ├── bot.js              # Bot oyuncu
│   ├── styles.css          # Stil dosyası
│   └── network/
│       └── multiplayerClient.js  # WebSocket istemci
├── server/
│   ├── multiplayer-server.mjs    # Multiplayer sunucu (ws)
│   └── admin.html                # Sunucu admin paneli
├── assets/
│   └── arabic_huruf/       # 28 Arapça harf PNG dosyaları
├── public/                 # Statik varlıklar (build'te kopyalanır)
├── tests/
│   ├── letter-collection.spec.js
│   ├── physics-interactions.spec.js
│   ├── portal-transition.spec.js
│   └── phase1-stabilization.spec.js
└── scripts/
    ├── sync-public-assets.mjs    # Public klasörü senkronizasyonu
    └── share-public.ps1          # Yerel ağ paylaşımı
```

---

## Test

```bash
# Tüm E2E testleri
npm run test:e2e

# Smoke testler (hızlı doğrulama)
npm run test:e2e:smoke

# Harf toplama testleri
npm run test:e2e:letters

# Fizik testleri
npm run test:e2e:physics

# Portal geçiş testleri
npm run test:e2e:portals

# Headless modda (CI uyumlu)
npm run test:e2e:headless

# Görsel debug (tarayıcı açık)
npm run test:e2e:debug
```

### Sunucu Testleri

```bash
# 50 oyuncu yük testi
npm run test:server:50players

# Roster birleştirme testi
npm run test:server:coalescing

# Asset allowlist testi
npm run test:assets:allowlist
```

---

## Build & Deploy

```bash
# Production build
npm run build

# Build sonucu önizleme
npm run preview
```

GitHub Pages otomatik deploy: `main` branch'e push edildiğinde `.github/workflows/deploy.yml` tetiklenir.

---

## Teknoloji Yığını

| Teknoloji | Kullanım |
|-----------|----------|
| Three.js 0.184 | 3D render |
| Rapier3D 0.19 | Fizik motoru (Web Worker) |
| Vite 7 | Build tool & dev server |
| ws 8 | WebSocket sunucu |
| Playwright | E2E test |
| Vanilla JS | Framework yok, kütüphane yok |

---

## Multiplayer Mimarisi

```
┌─────────────┐     WebSocket      ┌─────────────────────┐
│  İstemci    │ ◄─────────────────► │  multiplayer-server │
│  (Tarayıcı) │     /multiplayer    │  (Node.js + ws)     │
└─────────────┘                     └─────────────────────┘
     │                                     │
     │ Harf pozisyonları,                  │ Match state,
     │ fizik, skor — hepsi local           │ roster, lobby
     ▼                                     ▼
  Three.js + Rapier                    Koordinasyon
```

Sunucu oyun mantığı çalıştırmaz. Sadece lobi koordinasyonu ve oyuncu senkronizasyonu yapar.

---

## Lisans

Bu proje eğitim amaçlı geliştirilmiştir.
