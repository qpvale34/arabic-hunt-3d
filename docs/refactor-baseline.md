# main.js Modularization Baseline

Tarih: 2026-04-30T01:48:32+03:00

Kapsam: `docs/main-js-comprehensive-modularization-plan.md` uygulamasinin ilk dalgasi.

## Uygulanan Ilk Dilim

- `src/main.js` icindeki yerel `MultiplayerClient` sinifi kaldirildi.
- `src/network/multiplayerClient.js` tek multiplayer client kaynagi oldu.
- Multiplayer isim temizleme davranisi eski `main.js` davranisiyla uyumlandi.
- `VITE_MULTIPLAYER_WS_URL` / `VITE_MULTIPLAYER_URL` WebSocket URL destegi shared client icinde korundu.
- Debug global kayitlari `src/debug/gameDebugApi.js` modulune tasindi.
- Debug API dev modda veya `VITE_ENABLE_DEBUG_API=1` ile acilacak sekilde gate altina alindi.
- `playwright` ve `@playwright/test` surumleri `1.59.1` uzerinde hizalandi.

## Olcumler

| Alan | Once | Sonra |
|---|---:|---:|
| `src/main.js` satir sayisi | 8650 | 7430 |
| `src/network/multiplayerClient.js` satir sayisi | 320 civari | 346 |
| `src/debug/gameDebugApi.js` satir sayisi | yok | 77 |

## Dogrulama Sonuclari

| Komut | Sonuc | Not |
|---|---|---|
| `npm run build` | PASS | Ilk deneme sure sinirina takildi; tek basina uzun timeout ile gecti. Vite buyuk chunk uyarisi devam ediyor. |
| `npm run test:server:coalescing` | PASS | 1 test gecti. |
| `npm run test:server:50players` | PASS | 50 WebSocket client yuk testi gecti. |
| `npm run test:e2e:smoke` | PASS | Paket surumleri hizalandiktan ve asset sync tamamlandiktan sonra 3 test gecti. |
| `npm run test:e2e:phase1` | PASS | 7 test gecti. Once tek bir Playwright context yarisi goruldu, tekrar kosuda temizlendi. |
| `npm run test:assets:allowlist` | PASS | 1 test gecti; asset sync yaklasik 150 sn surdu. |

## Yakalanan Dogrulama Notlari

- `npm run dev` Playwright webServer icinde `predev` asset sync calistirdigi icin 60 sn timeout'a takilabiliyor.
- Dev server `predev` atlanarak elle acilirsa `public/assets/runtime-fallback` ve embedded fallback dosyalari eksik kalabiliyor; testten once `node scripts/sync-public-assets.mjs` calismali.
- Eski durumda `playwright` 1.59.1 ve `@playwright/test` 1.58.2 uyumsuzdu; `npm run test:e2e:*` komutlari runner cakismasi verebiliyordu.

## Sonraki Guvenli Adim

Bir sonraki atomik is:

```text
R2-01: renderGameToText serializer cikarma
```

Bu adimda `renderGameToText` davranisi degistirilmeden `src/debug/gameStateSerializer.js` altina alinmali. Mevcut `registerGameDebugApi` facade'i bu tasima icin hazir bir sinir olusturuyor.
