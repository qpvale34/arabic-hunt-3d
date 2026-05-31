# main.js Kapsamlı Modüleştirme ve Refactor Master Planı

Tarih: 2026-04-30  
Kaynak rapor: `docs/main-js-review-and-refactor-plan.md`  
Hedef dosya: `src/main.js`  
Kapsam: gereksiz/tekrarlı kodların kaldırılması, eksik mimari sınırların eklenmesi, kod bölme, modüleştirme, davranış koruyan refactor, test ve doğrulama planı

## Durum Notu

Bu planın ChatGPT 5.5 Pro / extra thinking modeliyle tarayıcı üzerinden üretilmesi istendi. `browser-use` ile `chatgpt.com` sekmesi seçildi ve URL doğrulandı; ancak Browser eklentisinin sayfa etkileşim kanalı `failed to start codex app-server: Sistem belirtilen yolu bulamıyor. (os error 3)` hatası verdi. Bu nedenle ChatGPT.com'a mesaj gönderilemedi ve proje içeriği harici servise aktarılmadı.

Aşağıdaki plan, mevcut rapor ve yerel proje incelemesiyle hazırlanmış Codex master planıdır. ChatGPT tarayıcı akışı düzeldiğinde aynı plan, bağımsız ikinci görüş için kolayca ChatGPT'ye gönderilebilir.

## Hedef

`src/main.js` dosyasını tek seferde parçalamak değil, çalışan oyunu bozmadan sorumlulukları net modüllere ayırmak.

Başarı tanımı:

- `main.js` oyun orkestratörü olarak kalır, detay uygulamaları modüllere taşınır.
- Multiplayer client tek kaynak olur.
- Debug API üretim yüzeyinden ayrılır.
- UI render helper'ları, audio/speech, world builder, settings, simulation adapter ayrı sınır kazanır.
- Refactor sonrası mevcut E2E ve server testleri geçer.
- Yeni testler kritik modül sınırlarını güvenceye alır.

## Mevcut Sorunların Kısa Özeti

| Alan | Mevcut Durum | Risk | Plan |
|---|---|---|---|
| `main.js` boyutu | Yaklaşık 8.650 satır | Yan etki riski, bakım zorluğu | Dalga dalga modül çıkarımı |
| Multiplayer client | `main.js` içinde ve `src/network/multiplayerClient.js` içinde iki gerçeklik | Bug fix drift, reconnect farkları | Tek kaynak: `src/network/multiplayerClient.js` |
| Simulation | Rapier worker var ama ana hareket local AABB ile çözülüyor | Mimari belirsizlik | Adapter + karar testi |
| Debug globals | Public runtime'da açık | Demo/public share riski | Debug gate ve serializer modülü |
| UI üretimi | HTML string + event + state aynı yerde | UI değişikliği gameplay'i etkileyebilir | `src/ui/*` modülleri |
| Audio/speech | Gameplay dosyasında | Tarayıcı policy ve state karmaşası | `src/audio/*` modülleri |
| World builder | Stage, asset, collectible, chest aynı dosyada | Yeni harita ekleme maliyeti yüksek | `src/world/*` modülleri |
| Settings | Storage, form, apply logic iç içe | UI ve runtime ayarı karışıyor | `src/settings/*` |

## Korunacak Davranışlar

Refactor sırasında aşağıdakiler değişmemeli:

- Oyuncu önce lobby'ye bağlanır, admin başlatınca oyuna girer.
- Varsayılan müzik kapalı kalır.
- 50 oyuncu roster testinde render cap korunur.
- Letter card telaffuz ve glyph butonları çalışır.
- Harf toplama, chest açma ve portal geçiş testleri geçer.
- WebGPU başarısız olursa WebGL fallback çalışır.
- `render_game_to_text` testlerde kullanılabilir kalır.
- `npm run start:full` full-stack başlatma yolu olarak kalır.

## Nihai Hedef Dosya Yapısı

Plan tamamlandığında önerilen yapı:

```text
src/
  main.js
  app/
    createAppState.js
    domRefs.js
    bootstrapGame.js
    gameLoop.js
    lifecycle.js
  network/
    multiplayerClient.js
    multiplayerSession.js
    multiplayerSnapshot.js
    remotePlayers.js
  simulation/
    simulationAdapter.js
    simulationMessages.js
    localCollision.js
  ui/
    mapSelection.js
    characterSelection.js
    letterCard.js
    alphabetHud.js
    skillDock.js
    settingsPanel.js
    mobileControls.js
    overlays.js
  world/
    stages.js
    stageRegistry.js
    sunCourt.js
    halloweenHollows.js
    hexagonVillage.js
    templates.js
    collectibles.js
    chests.js
    portal.js
  audio/
    audioEngine.js
    speech.js
  settings/
    settingsStorage.js
    qualityProfile.js
    applySettings.js
  debug/
    gameStateSerializer.js
    gameDebugApi.js
  runtime/
    renderer.js
  workers/
    simulation.worker.js
  letterCatalog.js
  bot.js
  admin.js
  admin.css
  styles.css
```

## main.js'in Hedef Rolü

`main.js` sonunda şu işleri yapmalı:

1. CSS ve temel dependency importlarını yükler.
2. DOM referanslarını oluşturur.
3. App state'i oluşturur.
4. Renderer, simulation adapter, multiplayer session, audio engine ve UI controller'ları başlatır.
5. Bootstrap akışını çalıştırır.
6. Game loop'u başlatır.

`main.js` şu işleri yapmamalı:

- WebSocket sınıfı tanımlamamalı.
- HTML stringleri üretmemeli.
- Stage detaylarını kendisi kurmamalı.
- Speech synthesis ve audio oscillator detaylarını taşımamalı.
- Debug global fonksiyonlarını doğrudan kaydetmemeli.
- Server/admin güvenlik kararlarını bilmemeli.

## Kaldırılacak veya Taşınacak Gereksiz Bölümler

### 1. main.js içindeki yerel `MultiplayerClient`

Karar:

- Kaldırılacak.
- `src/network/multiplayerClient.js` tek kaynak olacak.

Taşınacak/uyumlanacak parçalar:

- `sanitizePlayerName`
- `loadStoredPlayerName`
- `storePlayerName`
- `normalizeMultiplayerOrigin`
- `loadStoredServerOrigin`
- `storeServerOrigin`

Eksik eklenecekler:

- `multiplayerClient.js` event payload uyumluluk testi
- connect timeout testi
- reconnect davranışı smoke testi

### 2. Public debug globals

Karar:

- Doğrudan `main.js` içinde kaydedilmeyecek.
- `src/debug/gameDebugApi.js` içine taşınacak.
- Dev/test bayrağıyla gate edilecek.

Kaldırılacak doğrudan global kayıtlar:

- `window.render_game_to_text`
- `window.debug_set_player_position`
- `window.debug_interact_nearest`
- `window.debug_collect_nearest_letter`
- `window.debug_teleport_stage`
- `window.debug_use_skill`
- `window.debug_get_skill_effects`
- `window.debug_reset_skill_state`
- `window.debug_set_multiplayer_roster`

Eksik eklenecekler:

- `VITE_ENABLE_DEBUG_API=1`
- Playwright webServer env içinde debug açık ayarı
- Public preview'da debug kapalı doğrulaması

### 3. Duplicate veya belirsiz simulation sorumluluğu

Karar:

- İlk etapta kaldırılmayacak.
- `src/simulation/simulationAdapter.js` ile main.js'ten ayrılacak.
- Sonra "authoritative movement" kararı verilecek.

Kısa vadede taşınacaklar:

- `setupRuntime` içindeki worker oluşturma bölümü
- `buildSimulationWorldPayload`
- `configureSimulationWorld`
- `requestSimulationReset`
- `dispatchSimulationStep`
- `queueSimulationStep`
- `refreshSimulationQuery`
- `flushSimulation`
- `syncCollectibleToSimulation`
- `syncChestToSimulation`

Eksik eklenecekler:

- Worker message schema dokümantasyonu
- "local movement vs worker movement" karar testi
- Worker crash fallback testi

### 4. UI HTML stringleri

Karar:

- Büyük HTML üretimleri `src/ui/*` altına taşınacak.
- Statik katalog verisiyle üretilen HTML korunabilir.
- Kullanıcı kaynaklı veri için `textContent` kullanılacak.

Öncelik:

1. `buildMapSelectionUI`
2. `buildCharacterSelectionUi`
3. `renderLetterCardUi`
4. `buildSkillUi`
5. `buildAlphabetHud`
6. `settingsPanel`
7. `mobileControls`

Eksik eklenecekler:

- UI module contract: input data + callbacks
- DOM fixture testleri veya minimum pure function testleri
- XSS guard notu: user-provided fields HTML stringe girmemeli

### 5. Audio ve speech detayları

Karar:

- Web Audio API ve SpeechSynthesis uygulaması `src/audio/*` içine taşınacak.

Taşınacaklar:

- `ensureAudioContext`
- `createNoiseBuffer`
- `ensureMusicTrack`
- `syncMusicTrackPlayback`
- `applyAudioSettings`
- `unlockAudio`
- `playTone`
- `playNoiseBurst`
- `playWarriorVoiceCue`
- `playAttackSound`
- `playSkillSound`
- `playCollectibleSound`
- `playLevelUpSound`
- `playFootstepSound`
- `playChestOpenSound`
- `playCoinCollectSound`
- `playMusicPulse`
- `updateAudio`
- `ensureSpeechSynthesisSetup`
- `primeSpeechSynthesis`
- `speakSpeechLine`
- `speakLetterCardPronunciation`

Eksik eklenecekler:

- Browser audio unlock policy notları
- Mock speech unit/smoke test
- Audio engine dispose/reset API

## Eklenecek Eksik Mimari Sınırlar

### App Context

Yeni bir context nesnesi kullanılmalı:

```js
const app = {
  dom,
  state,
  scene,
  camera,
  renderer,
  simulation,
  multiplayer,
  audio,
  ui,
};
```

Amaç:

- Her modül global import yerine ihtiyaç duyduğu parçayı alır.
- Döngüsel import riski azalır.
- Testte mock nesne vermek kolaylaşır.

### Event veya Command Sınırı

Öneri:

- Büyük bir event bus şart değil.
- Ancak gameplay olayları için küçük command helper'ları eklenmeli.

Örnek:

```js
collectLetter(id)
openChest(id)
startRoundFromMatchState(match)
resetToLobby()
applyPlayerSnapshot(snapshot)
```

Amaç:

- UI event handler doğrudan state mutasyonunun içine girmesin.
- Test senaryoları bu komutları çağırabilsin.

### Snapshot Schema

`buildMultiplayerSnapshot` ve server snapshot alanları için küçük schema doğrulaması eklenmeli.

Önerilen dosyalar:

```text
src/network/multiplayerSnapshot.js
tests/multiplayer-snapshot.test.mjs
```

Kontrol edilecek alanlar:

- `mode`
- `roundId`
- `characterId`
- `currentMap`
- `stageKey`
- `player.x`
- `player.z`
- `player.heading`
- `stats.collectedCount`

### Environment Guard

Public share için güvenlik guardları:

- `MULTIPLAYER_ADMIN_CODE` public tunnel modunda zorunlu olmalı.
- `MULTIPLAYER_CORS_ORIGIN="*"` local dışında uyarı vermeli.
- Admin code loglama sadece local modda yapılmalı.

Bu konu server tarafında ama main.js refactor planının "eksik güvenlik sınırı" olarak takip edilmeli.

## Uygulama Dalgaları

### Wave 0: Baseline ve Ölçüm

Amaç:

Refactor öncesi çalışan davranışı dondurmak.

Adımlar:

1. `npm run test:assets:allowlist`
2. `npm run test:server:coalescing`
3. `npm run test:server:50players`
4. `npm run test:e2e:smoke`
5. `npm run test:e2e:phase1`
6. `npm run build`
7. `npm run start:full` ile manuel admin/lobby/QR smoke

Çıktılar:

- `docs/refactor-baseline.md`
- Test komutları ve sonuçları
- Bilinen flaky test notları

Kabul kriteri:

- Refactor başlamadan bilinen çalışan baseline kayıtlı olur.

### Wave 1: Multiplayer Tekilleştirme

Amaç:

En net gereksizliği kaldırmak: çift MultiplayerClient.

Dosyalar:

```text
src/main.js
src/network/multiplayerClient.js
tests/server-roster-coalescing.test.mjs
tests/server-50-player-load.test.mjs
```

Adımlar:

1. `src/network/multiplayerClient.js` event payloadlarını main.js beklentisiyle karşılaştır.
2. Eksik eventleri uyumla: `statuschange`, `welcome`, `roster`, `matchstate`, `announcement`, `finish`, `disconnect`, `kicked`.
3. `main.js` içindeki local class'ı kaldır.
4. `import { MultiplayerClient } from "./network/multiplayerClient.js";` ekle.
5. Storage helper importlarını ekle veya main.js'te geçici adapter olarak bırak.
6. `ensureMultiplayerReady`, `attachMultiplayerEvents`, `buildMultiplayerSnapshot` davranışını değiştirme.

Kabul kriteri:

- Lobby connect çalışır.
- Admin start/reset çalışır.
- Roster count güncellenir.
- Remote player render cap korunur.

Test:

```powershell
npm run test:server:coalescing
npm run test:server:50players
npm run test:e2e:smoke
```

Rollback:

- Sadece network import ve local class kaldırma geri alınır.

### Wave 2: Debug API ve Serializer Ayrımı

Amaç:

Test kancalarını koru ama public runtime yüzeyini azalt.

Dosyalar:

```text
src/debug/gameStateSerializer.js
src/debug/gameDebugApi.js
src/main.js
playwright.config.js
tests/helpers/gameState.js
```

Adımlar:

1. `renderGameToText` saf serializer olarak `gameStateSerializer.js` içine taşınır.
2. Debug fonksiyonları `registerGameDebugApi(app)` içinde toplanır.
3. `main.js` bootstrap sonunda sadece `registerGameDebugApi(app)` çağırır.
4. `registerGameDebugApi` şu koşulla çalışır: `import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_API === "1"`.
5. Playwright webServer env içine `VITE_ENABLE_DEBUG_API=1` eklenir.
6. Public build'de debug kapalı smoke kontrolü eklenir.

Kabul kriteri:

- Testlerde `window.render_game_to_text` çalışır.
- Normal build'de debug API istenirse kapatılabilir.
- Serializer output alanları değişmez.

Test:

```powershell
npm run test:e2e:letters
npm run test:e2e:physics
npm run test:e2e:phase1
```

### Wave 3: Settings ve Quality Ayrımı

Amaç:

Runtime ayarlarını UI formundan ve gameplay loop'tan ayırmak.

Dosyalar:

```text
src/settings/settingsStorage.js
src/settings/qualityProfile.js
src/settings/applySettings.js
src/ui/settingsPanel.js
src/main.js
```

Adımlar:

1. `detectQualityProfile` kalite modülüne taşınır.
2. `loadStoredSettings`, `saveSettings`, `normalizeSettings` storage modülüne taşınır.
3. `populateSettingsForm`, `readSettingsForm`, `updateSettingsValueLabels` UI modülüne taşınır.
4. `applyQualitySettings`, `applyUiSettings`, `applyAudioSettings` orchestration olarak ayrılır.
5. Settings form callbackleri main.js'te sadece command çağırır.

Kabul kriteri:

- Varsayılan müzik kapalı kalır.
- FPS göstergesi mobile compact testini geçer.
- Quality low/high renderer config değişmez.

Test:

```powershell
npm run test:e2e:phase1
npm run build
```

### Wave 4: UI Modülleri

Amaç:

DOM üretimi ve event bağlamayı daha küçük, testlenebilir parçalara ayırmak.

Dosyalar:

```text
src/ui/mapSelection.js
src/ui/characterSelection.js
src/ui/letterCard.js
src/ui/alphabetHud.js
src/ui/skillDock.js
src/ui/mobileControls.js
src/main.js
```

Adımlar:

1. Map selection render fonksiyonunu taşı.
2. Character selection render fonksiyonunu taşı.
3. Letter card render ve speech callbacklerini ayır.
4. Skill dock render fonksiyonunu taşı.
5. Touch controls render fonksiyonunu taşı.
6. UI modülleri global state import etmesin; data ve callbacks alsın.

Kabul kriteri:

- Harita seçimi çalışır.
- Karakter seçimi multiplayer profile update gönderir.
- Letter card açılır, kapanır, audio butonları çalışır.
- Skill butonları cooldown ve mana durumunu gösterir.
- Touch joystick ve mobile immersive prompt çalışır.

Test:

```powershell
npm run test:e2e:smoke
npm run test:e2e:phase1
```

### Wave 5: Audio ve Speech Modülleri

Amaç:

Tarayıcı audio policy, Web Audio oscillator ve SpeechSynthesis detaylarını main.js'ten çıkarmak.

Dosyalar:

```text
src/audio/audioEngine.js
src/audio/speech.js
src/main.js
tests/phase1-stabilization.spec.js
```

Adımlar:

1. `createAudioEngine(settings)` API'si oluştur.
2. Sound effect fonksiyonlarını engine methodları yap.
3. Music track state'i engine içine al.
4. Speech setup ve Arabic voice seçimlerini `speech.js` içine al.
5. Letter card UI sadece `speech.speakLetter(...)` çağırır.
6. Mock speech testini koru.

Kabul kriteri:

- İlk kullanıcı etkileşiminde audio unlock çalışır.
- Music default off testi geçer.
- Glyph pronunciation testi geçer.
- Audio ayarları localStorage ile korunur.

Test:

```powershell
npm run test:e2e:phase1
```

### Wave 6: Simulation Adapter

Amaç:

Worker iletişimini main.js'ten ayırmak ve fizik otoritesi kararını görünür yapmak.

Dosyalar:

```text
src/simulation/simulationAdapter.js
src/simulation/simulationMessages.js
src/simulation/localCollision.js
src/workers/simulation.worker.js
src/main.js
tests/physics-interactions.spec.js
```

Adımlar:

1. Worker lifecycle adapter içine taşınır.
2. Message type sabitleri eklenir.
3. `buildSimulationWorldPayload` adapter API'sine alınır.
4. `resolvePlayerBounds` geçici olarak `localCollision.js` içine taşınır.
5. Adapter `configure`, `reset`, `step`, `query`, `syncCollectible`, `syncChest` methodları sunar.
6. Hareket otoritesi için karar dokümanı yazılır.

Karar noktası:

- Kısa vadede local movement korunur.
- Worker sadece query/proximity + gelecekte authoritative option olarak kalır.
- Authoritative movement ayrı büyük değişiklik olarak planlanır.

Kabul kriteri:

- Harf toplama mesafesi değişmez.
- Chest interaction değişmez.
- Portal transition değişmez.
- Worker crash durumunda oyun tamamen kilitlenmez.

Test:

```powershell
npm run test:e2e:physics
npm run test:e2e:letters
npm run test:e2e:portals
```

### Wave 7: World ve Stage Builder Ayrımı

Amaç:

Harita/stage üretimini main.js'ten çıkarmak.

Dosyalar:

```text
src/world/stageRegistry.js
src/world/stages.js
src/world/sunCourt.js
src/world/halloweenHollows.js
src/world/hexagonVillage.js
src/world/templates.js
src/world/collectibles.js
src/world/chests.js
src/world/portal.js
src/main.js
```

Adımlar:

1. Stage metadata registry oluştur.
2. `buildSunCourt`, `buildHalloweenHollows`, `buildHexagonVillage` ayrı dosyalara taşınır.
3. Template hazırlama ve placement helper'ları `templates.js` içine alınır.
4. Collectible/chest üretimi ayrı modüllere taşınır.
5. Portal creation/update ayrı modüle alınır.
6. `buildWorldStage(stageKey)` orkestratör olarak kalır veya `stages.js` içine taşınır.

Kabul kriteri:

- Sun Court başlangıç haritası aynı görünür.
- Halloween ve Hexagon stage geçişleri çalışır.
- Collectible sayıları değişmez.
- Chest loot davranışı değişmez.

Test:

```powershell
npm run test:e2e:smoke
npm run test:e2e:portals
npm run build
```

### Wave 8: Game Loop ve Input Ayrımı

Amaç:

Frame update sırası açık bir pipeline olsun.

Dosyalar:

```text
src/app/gameLoop.js
src/input/inputController.js
src/player/playerController.js
src/player/playerAnimation.js
src/camera/cameraController.js
src/main.js
```

Adımlar:

1. `animate` ve `update` gameLoop içine taşınır.
2. `updateInputVector` input controller içine alınır.
3. `updatePlayer` player controller içine taşınır.
4. `updateCharacterAnimation` animation modülüne alınır.
5. `updateCamera`, `resolveCameraPosition`, `snapCameraToPlayer` camera modülüne alınır.
6. Main.js loop'u sadece `gameLoop.start()` çağırır.

Kabul kriteri:

- W/A/S/D, arrow, touch joystick çalışır.
- Click-to-move davranışı çalışır.
- Auto attack ve skill hareket ilişkisi bozulmaz.
- Camera collision ve mobile look davranışı korunur.

Test:

```powershell
npm run test:e2e:phase1
npm run test:e2e:physics
```

### Wave 9: Server/Admin Güvenlik Eksikleri

Amaç:

Refactor ile birlikte public demo güvenliğini artırmak.

Dosyalar:

```text
server/multiplayer-server.mjs
scripts/share-public.ps1
docs/multiplayer-admin-security.md
```

Adımlar:

1. Public tunnel modunda default admin code engellenir.
2. Local modda admin code loglanabilir, public modda maskelenir.
3. CORS origin public modda daraltılır.
4. Admin login rate limit basit counter ile eklenir.
5. Security dokümanı yazılır.

Kabul kriteri:

- Local geliştirme kolaylığı bozulmaz.
- Public share yanlışlıkla default admin code ile açılmaz.

Test:

```powershell
npm run test:server:coalescing
npm run test:server:50players
```

## Atomik Görev Listesi

| ID | Görev | Yazma Alanı | Risk | Doğrulama |
|---|---|---|---|---|
| R0-01 | Baseline test sonuçlarını kaydet | `docs/refactor-baseline.md` | Düşük | Test komutları |
| R1-01 | `multiplayerClient.js` event uyumluluğunu kontrol et | `src/network/multiplayerClient.js` | Orta | server + smoke |
| R1-02 | main.js local MultiplayerClient kaldır | `src/main.js` | Orta | lobby connect |
| R2-01 | `gameStateSerializer.js` oluştur | `src/debug/*` | Düşük | E2E helpers |
| R2-02 | Debug API gate ekle | `src/debug/*`, `playwright.config.js` | Orta | phase1 |
| R3-01 | Settings storage modülü çıkar | `src/settings/*` | Düşük | phase1 |
| R4-01 | Map UI modülü çıkar | `src/ui/mapSelection.js` | Orta | smoke |
| R4-02 | Character UI modülü çıkar | `src/ui/characterSelection.js` | Orta | smoke |
| R4-03 | Letter card modülü çıkar | `src/ui/letterCard.js` | Orta | phase1 |
| R5-01 | Audio engine çıkar | `src/audio/audioEngine.js` | Orta | phase1 |
| R5-02 | Speech module çıkar | `src/audio/speech.js` | Orta | TTS test |
| R6-01 | Simulation adapter çıkar | `src/simulation/*` | Orta | physics |
| R6-02 | Simulation authority karar dokümanı | `docs/simulation-authority-decision.md` | Düşük | review |
| R7-01 | Stage registry oluştur | `src/world/stageRegistry.js` | Düşük | build |
| R7-02 | Sun Court builder çıkar | `src/world/sunCourt.js` | Yüksek | smoke |
| R7-03 | Halloween builder çıkar | `src/world/halloweenHollows.js` | Yüksek | portals |
| R7-04 | Hexagon builder çıkar | `src/world/hexagonVillage.js` | Yüksek | portals |
| R8-01 | Game loop modülü çıkar | `src/app/gameLoop.js` | Yüksek | phase1 |
| R8-02 | Input controller çıkar | `src/input/inputController.js` | Orta | movement |
| R9-01 | Admin code public guard | `server/*`, `scripts/*` | Orta | server tests |

## Önerilen Commit Sırası

1. `docs: record main.js refactor baseline`
2. `refactor: use shared multiplayer client`
3. `refactor: move game debug api behind env gate`
4. `refactor: extract settings storage and quality profile`
5. `refactor: extract map and character selection ui`
6. `refactor: extract letter card and alphabet hud ui`
7. `refactor: extract audio engine and speech helpers`
8. `refactor: introduce simulation adapter`
9. `refactor: extract stage registry and world builders`
10. `refactor: extract game loop and input controller`
11. `security: require explicit admin code for public share`

Her commit tek davranış alanına dokunmalı. Büyük dünya/stage taşımaları tek committe değil, stage başına ayrı committe yapılmalı.

## Test Matrisi

| Değişiklik | Minimum Test | Ek Test |
|---|---|---|
| Multiplayer client | `test:server:coalescing`, `test:server:50players` | `test:e2e:smoke` |
| Debug API | `test:e2e:phase1` | public build debug kapalı kontrolü |
| Settings | `test:e2e:phase1` | `npm run build` |
| UI modules | `test:e2e:smoke` | `test:e2e:phase1` |
| Audio/speech | `test:e2e:phase1` | manual audio unlock |
| Simulation | `test:e2e:physics` | `letters`, `portals` |
| World builders | `test:e2e:smoke`, `portals` | visual smoke |
| Game loop/input | `test:e2e:phase1`, `physics` | manual mobile touch |
| Server security | `test:server:*` | public tunnel dry run |

## Kabul Kriterleri

Refactor projesi tamamlanmış sayılmak için:

- `main.js` hedefte 2.000-3.000 satır bandına inmeli veya en az yüzde 50 küçülmeli.
- Local `MultiplayerClient` duplication tamamen kalkmalı.
- Debug API gate altında olmalı.
- UI HTML üretiminin çoğu `src/ui/*` altında olmalı.
- Audio/speech kodu `src/audio/*` altında olmalı.
- Simulation worker iletişimi `src/simulation/*` altında olmalı.
- Stage builder kodu `src/world/*` altında olmalı.
- Test matrisi yeşil olmalı.
- `docs/simulation-authority-decision.md` yazılmış olmalı.

## Riskler ve Önlemler

| Risk | Önlem |
|---|---|
| Refactor sırasında oyun davranışı değişir | Her wave sonunda targeted E2E |
| Circular import oluşur | App context ve dependency injection |
| UI modülü state'e gizlice bağımlı olur | UI contract: data + callbacks |
| Worker hareket kararı yanlış anlaşılır | Simulation decision doc |
| Public debug API açık kalır | Env gate + public smoke |
| Stage extraction görsel fark yaratır | Stage başına screenshot/manual smoke |
| Çok büyük PR oluşur | Atomik commit sırası |

## Hemen Başlanacak İlk İş

İlk uygulanabilir iş:

```text
R1-01 + R1-02: shared multiplayer client migration
```

Neden:

- En net gereksiz kod burada.
- Zaten ayrı modül mevcut.
- main.js'i küçültür.
- Multiplayer davranışının test altyapısı var.

İlk işin mini planı:

1. `src/network/multiplayerClient.js` ile `main.js` local class event payloadları karşılaştırılır.
2. Eksik event/detail alanları network modülüne eklenir.
3. `main.js` local class silinir.
4. Import kullanılır.
5. Server ve smoke testleri çalıştırılır.

## ChatGPT'ye Gönderilecek Prompt

Browser-use sorunu çözülürse ChatGPT 5.5 Pro extra thinking için şu prompt kullanılabilir:

```text
Bu proje Three.js + Rapier3D + Vite + Vanilla JS ile yazılmış 3D browser eğitim oyunu. Ana dosya src/main.js yaklaşık 8650 satır ve render, UI, input, audio, speech, world builder, multiplayer, simulation worker bridge ve debug API sorumluluklarını birlikte taşıyor.

Elimde şu rapor var: docs/main-js-review-and-refactor-plan.md. Bu rapora göre main.js dosyasından gereksiz/tekrarlı bölümlerin kaldırılması, eksik mimari sınırların eklenmesi, kod bölme, modüleştirme ve davranış koruyan refactor için kapsamlı ve uygulanabilir bir master plan üret.

Plan şunları içersin:

1. Hangi bölümler kaldırılmalı veya taşınmalı?
2. Hangi eksik modüller eklenmeli?
3. Hedef klasör/dosya yapısı ne olmalı?
4. Dalgalar halinde uygulama sırası ne olmalı?
5. Her dalga için risk, kabul kriteri ve test komutları ne olmalı?
6. İlk atomik commit ne olmalı?
7. Ne yapılmamalı?
8. Refactor sonunda main.js'in rolü ne olmalı?

Türkçe yaz. Markdown formatında üret. Kod yazma; uygulanabilir plan yaz.
```

## Sonuç

Bu refactorun amacı "main.js'i küçük göstermek" değil, oyunun çalışma güvenini artırmak. Şu anki yapı prototip için başarılı; ancak multiplayer, UI, audio, simulation ve world builder sorumlulukları büyüdüğü için artık modül sınırı gerekiyor.

En güvenli rota:

1. Baseline al.
2. Multiplayer duplication kaldır.
3. Debug API'yi gate altına al.
4. Settings/UI/audio gibi yan sistemleri çıkar.
5. Simulation rolünü netleştir.
6. Stage/world builder'ı böl.
7. En son game loop/input/player controller ayrımına gir.
