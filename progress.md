Original prompt: hexagon haritasinda duvarlara pencere koy dışarıyı görebileyim . karakter ve nesne büyüklük oranlarında uyum olmalı , arapça harfleri  3 haritaya dağıt , orta  ekranın üstünde arapça alfabe olsun assetimdeki harfleri kullan , topladığım harfler parlak olsun henüz toplamadıklarım sönük olsun.

- MCP kontrol edildi: paylasilmis resource yok, mevcut MCP/Playwright ile dogrulama planlandi.
- Skill kullanimi: develop-web-game ve 2d-games okundu; progress dosyasi olusturuldu.
- Incelenen alanlar: `src/main.js`, `src/letterCatalog.js`, `src/styles.css`, `index.html`, Playwright testleri.
- Plan:
  - Harfleri 3 haritaya daha dengeli dagit.
  - Ust orta alfabe HUD ekle; asset img kullansin, toplananlar parlak olsun.
  - Global toplanan harf takibi ekle ve reset/transition akisina bagla.
  - Hexagon village duvarlarinda daha fazla pencere ve dis mekani hissettiren bosluk/manzara gorunurlugu sagla.
  - Karakter / collectible / cevre oranlarini daha uyumlu hale getir.
  - Vite + Playwright ile screenshot ve state dogrulamasi yap.

- Tamamlanan degisiklikler:
  - Harf havuzu 3 haritaya esite yakin sekilde bolundu (30 harf -> 10 / 10 / 10 mantigi).
  - Stage collectible hedefi, kullanici `letterDensity` ayari dusuk olsa bile stage havuzundaki tum harfleri kullanacak sekilde sabitlendi.
  - `index.html` + `src/styles.css` icine ust orta alfabe HUD eklendi.
  - HUD asset png'leri kullaniyor; toplanan harf parlak, aktif stage harfleri hafif vurgulu, digerleri sönuk.
  - Ust HUD icindeki toplanmis harfler artik tiklanabiliyor; tiklandiginda ayni harfin bilgi karti yeniden aciliyor.
  - `src/main.js` icinde global `collectedLetterIds` takibi eklendi; reset ve collect akisina baglandi.
  - `render_game_to_text` icine `alphabet`, `collectedCount`, `totalCollectibles` alanlari eklendi.
  - Hexagon Village yerlesiminde bina/agaç ölcekleri daha tutarli hale getirildi.
  - Hexagon duvarlari icin pencere paterni arttirildi; arka planda agac/rock halka ile dis mekan gorunurlugu guclendirildi.
  - Karakter hedef boyu ve collectible geometri boyutlari yeniden dengelendi.

- Dogrulama:
  - `npm run build` basarili.
  - Playwright istemcisi (`.codex-temp/web_game_playwright_client.js`) calistirildi; map karti selector'u erken yukleme yuzunden timeout verdi ama screenshot/state artefakti olustu.
  - HUD click ozelligi icin ayni Playwright istemcisi yerel kopya ile tekrar kosuldu; `output/web-game-hud-card/shot-0.png` ve `state-0.json` uretildi.
  - MCP Playwright ile Hexagon Village acildi, oyuncu yan duvara tasinip kamera cevrildi.
  - Son duzeltme sonrasi canli state dogrulandi: `letterDensity=40` iken bile `totalCollectibles: 30` kaldi.
  - Hexagon Village icin canli state dogrulandi: `currentStageLetterIds` `[21..30]`, collect sonrasi `collectedLetterIds: [22]`, `collectedCount: 1`.
  - Ust HUD MCP snapshot'inda dogrulandi: `Kef · ك toplandi`, ayni stage icindeki diger harfler `bu bolgede bekliyor`, diger stage harfleri `henuz toplanmadi` olarak gorunuyor.
  - Ek HUD click dogrulamasi: Sun Court'ta `Ha · ح` toplandi, kart kapatildi, ust HUD'daki `Ha · ح toplandi, kartini ac` butonuna tiklaninca `activeLetterCard.id: 6` ve `letterCardVisible: true` olarak geri acildi.
  - Kaydedilen gorseller:
    - `output/hex-live-page.png`
    - `output/hex-window-side.png`
    - `output/hex-alphabet-glow.png`

- Not:
  - Test oturumunda kullanici ayarlari localStorage'dan `quality=low`, `characterScale=80`, `letterScale=150`, `letterDensity=40` olarak geldi. Buna ragmen yeni HUD ve collect state dogrulandi.
  - HUD chip'leri ilk denemede `pointer-events: none` altinda kaldigi icin canvas tiklamayi blokluyordu; grid/chip seviyesinde `pointer-events: auto` verilerek cozuldu.

Update 2026-03-27:

- Yeni talep:
  - Karakter yurumede takilma sorunu bul ve coz.
  - Harf kartindaki ornek kelime gorseli / yazi cakismasini duzelt.
  - Ayarlar, ana overlay panelleri ve harf kartlarini desktop + mobile icin yeniden duzenle.
  - Mobil joystick ve aksiyon butonlarini daha ergonomik hale getir.
  - Harf toplandiktan sonra karti 0.5 saniye gecikmeyle ac.
  - Ses talebi icin projedeki yerel dosyalari kullanarak arka plan muzik entegrasyonu ekle.

- Tespit:
  - Canli Playwright denemesinde `W` basili tutulurken oyuncu konumu saniyede tekil adimlar halinde ilerledi; `advanceTime()` ile ayni hareket akici oldugu icin asenkron worker tabanli hareket gorsel stutter kaynagi olarak ayrildi.
  - Repoda dogrudan Metin2 muzik / karakter sesi asset'i bulunmadi. Yalnizca `bevy/assets/sounds/*.ogg` altinda genel muzik dosyalari vardi.
  - Mobil skill butonlari CSS'te `--skill-index` secicilerine dayaniyordu; JS bu degiskeni hic vermediginden yerlesim kismi kirik kalmis durumdaydi.

- Uygulanan degisiklikler:
  - Oyuncu hareketi tekrar ana thread uzerinden yerel collision cozumune alindi; worker snapshot'lari artik gameplay sirasinda oyuncu pozisyonunu geri sarmiyor.
  - En yakin harf / sandik mesafeleri yerelde hesaplanmaya baslandi.
  - Harf karti artik collect aninda degil, `500ms` gecikmeyle aciliyor; stage reset/transition durumlarinda bekleyen kart acilisi temizleniyor.
  - Harf karti ornek bolumu gorsel + metin olarak iki kolonlu yeni yerlesime alindi; Arapca kelime, transliterasyon ve anlam ayri okunur alanlara tasindi.
  - Ayarlar paneli desktopta iki kolonlu, mobile'da tek kolonlu daha rahat kaydirilabilir bir duzene cekildi.
  - Mobil touch UI icin joystick capi buyutuldu, safe-area uyumlu konumlar verildi, skill butonlari gercek orbit slotlariyla tekrar yerlestirildi.
  - Yerel `Epic orchestra music.ogg` dosyasi arka plan muzik track'i olarak baglandi; sentetik muzik fallback'i korundu.
  - SFX tarafina daha tok savasci benzeri sentetik ses cue'lari eklendi.

Update 2026-03-27 / duzeltme:

- Kullanici geri bildirimi sonrasi harf kartindaki iki kolonlu ornek-kelime cozumunden vazgecildi.
- `index.html`, `src/main.js`, `src/styles.css` uzerinde ornek kelimeyi ayri DOM metin bloklarina tasiyan degisiklik geri alindi.
- Asil cozum `src/letterCatalog.js` icindeki `buildExampleIllustrationDataUrl()` fonksiyonunda yapildi; ornek gorselin ic cizimi asagi kaydirilarak ustteki kelime/altta resim hiyerarsisi korundu.
- Mobil touch UI'ye gercek bir `Kos` butonu eklendi; buton basili tutulurken `shift` hareketi tetikleniyor.

Update 2026-03-27 / mobil HUD sikistirma:

- Mobil ust alfabe HUD'u tek satirli yatay seride yeniden duzenlendi; baslik kismi tek satira indirildi, harfler yatay kayar bant oldu.
- Mobil joystick kutusu tekrar buyutulup sola biraz iceri alindi; artik viewport disina tasacak kadar kucuk kalmiyor.
- Mobil aksiyon kumesinde `ATK` butonu buyutuldu, `Kos` butonu daha yukariya tasindi, skill/orbit tabani buna gore biraz kaydirildi.
- `npm run build` tekrar gecti.
- MCP Playwright ile mobil emulasyonda hem portre hem yatay olcumler alindi:
  - Portre: HUD yuksekligi ~`32.75px`, joystick `left=15.18 right=155.18` ile tam ekran icinde, `ATK` `71.18px`, `Kos` `42.39px`.
  - Yatay: HUD yuksekligi ~`25.89px`, joystick `left=9.59 right=143.98` ile tam ekran icinde, `ATK` `64px`, `Kos` `35.18px`.
  - Kayitli gorseller: `output/mobile-landscape-hud-controls-tight.png`, `output/mobile-portrait-hud-controls-tight.png`.

Update 2026-03-27 / mobil HUD 2 serit + harf karti okuma:

- Kullanici talebi:
  - Mobil ust HUD tekrar 2 serit olsun ve tum 30 harf ayni anda gorunsun.
  - Mobilde ayri bir `Etkilesim` butonu olsun.
  - `ATK` biraz daha buyusun, sagdaki butonlar biraz daha iceri gelsin.
  - `Kos` butonu sag orta hatta biraz daha buyuk konumlansin.
  - Beceri butonlari biraz daha buyusun.
  - Toplanan harf kartinda toplanan harf en solda dursun; yaninda harekeli okunuşlar ve yazilis bicimleri olsun.
  - Harf kartindaki buyuk toplanan harfe basildiginda harf sesi tekrar calinsin.

- Uygulanan degisiklikler:
  - Mobil `alphabet-hud` kayar tek satirdan cikartilip 2 seritli sabit grid'e alindi; 30 harfin tamami ayni anda gorunur hale geldi.
  - Touch aksiyon katmanina yeni `Etkilesim` butonu eklendi; portal/chest etkilesimini tek tikla tetikliyor.
  - Mobil portrait ve landscape icin `ATK`, `Kos`, `Etkilesim` ve skill buton boyut/konumlari yeniden ayarlandi; sag taraf kontrolleri biraz daha iceri cekildi.
  - Harf karti hero duzeni yeniden kuruldu: buyuk harf solda buton haline getirildi, sag kolonda ses + form/pronunciation alanlari toplandi, ozet asagi alindi.
  - Buyuk harf alani tiklanabilir yapildi ve `playActiveLetterGlyph()` ile aktif harfin okunuşunu tekrar seslendiriyor.

- Dogrulama:
  - `npm run build` basarili.
  - MCP Playwright ile mobil portrait ve landscape olcumleri alindi:
    - Her iki gorunumde de `alphabet-grid count=30` ve `allVisible=true`.
    - `touchActionCount=7` ile joystick + ATK + Kos + Etkilesim + 4 skill butonu gorundu.
    - Joystick viewport icinde kaldi.
  - MCP Playwright ile `Etkilesim` butonuna tiklaninca en yakin sandik acildi (`opened=true`).
  - Harf toplama ve 500ms gecikmeli kart acilisindan sonra buyuk harf butonunun `aria-label` degeri `\"Te harfini dinle\"` olarak dogrulandi; tiklama sonrasi kart acik kaldi ve hata olusmadi.

Update 2026-03-27 / mobil HUD tek satir + mini harita solda:

- Kullanici talebi:
  - Mini harita butonu sol kenarda, quest butonunun ustunde olsun.
  - Ust alfabe HUD mobilde tek satir, ekranin bastan basa uzasin.
  - Harf imgeleri kendi kutularina daha iyi otursun.
  - Alt combat HUD iki satirli daha kompakt yerlesime insin.
  - `Kos` daha da yukari cikmasin; onun yerine `Etkilesim` daha yukari tasinsin.
  - `ATK` biraz daha buyuyup ekran icine gelsin.

- Uygulanan degisiklikler:
  - Mobil portrait + landscape icin alfabe HUD tek satirli 30 kolon banda donusturuldu; harf imgeleri mobilde daha buyuk ama daha kisik glow ile kutu icine oturacak sekilde ayarlandi.
  - Mini harita shell/toggle mobilde sol tarafa cekildi; quest ve ayarlar tablari buna gore daha asagidaki dikey kolona alindi.
  - Alt combat HUD mobilde iki satirli sikisik grid duzenine gecirildi.
  - Mobil touch aksiyon kolonu tekrar dengelendi: `Etkilesim` sprintten daha yukariya tasindi, `ATK` buyutulup biraz daha iceri alindi.
  - Skill orbit slotlari saga degil sola acilan blok duzene kaydirildi; atak/interact kolonu ile cakisma azaltildi.

- Dogrulama:
  - `npm run build` tekrar basarili.
  - Shell tabanli Playwright mobil landscape olcumu:
    - `hudFullWidth=true`
    - `grid.count=30`, `allVisible=true`, `imagesFit=true`
    - `minimapAboveQuest=true`
    - `combatStacked=true`
    - `ATK=74.39px`, `Kos=45.10px`, `Etkilesim=43.51px`, `interactAboveSprint=true`
  - Portre emulasyonda oyun tasarimi geregi `telefonu yatay cevir` overlay'i girdigi icin layout olcumu tarayici emulasyonunda gercek cihaz kadar temsil gucune sahip degil; asil gameplay dizilimi landscape hedefi uzerinden dogrulandi.

Update 2026-03-27 / mobil HUD sadeleştirme:

- Kullanici geri bildirimi:
  - Alt HUD mobilde cok genis ve kalin; joystick ve sag butonlarin arkasina gecmemeli.
  - Alt HUD daha sade ve ortali olmali.
  - Ust alfabe HUD'da harf kutulari biraz daha asagi uzayip harfleri tam gostermeli.

- Uygulanan degisiklikler:
  - Mobil alt combat HUD portrait ve landscape icin tekrar daraltildi; ortali kompakt kart yapisina alindi.
  - Mobil alt HUD'da portrait badge, altin satiri ve bazi mikro basliklar gizlenerek goruntu sadeleştirildi.
  - XP ve kaynak alanlari daha ince satir yuksekliklerine cekildi.
  - Portrait'te alt HUD kontrol kumesinin ustune tasinacak sekilde daha yukariya alindi.
  - Ust alfabe chip'lerinin oranlari uzatildi; harf gorselleri de scale ile kutu icine tam oturacak sekilde yeniden ayarlandi.

- Dogrulama:
  - `npm run build` basarili.
  - Shell Playwright mobil landscape:
    - `imageFits=true`
    - `combatOverlapsStick=false`
    - `combatOverlapsActions=false`
    - `interactAboveSprint=true`
    - `ATK=74.39px`
- Shell Playwright mobil portrait:
  - `imageFits=true`
  - `combatOverlapsStick=false`
  - `combatOverlapsActions=false`

Update 2026-03-28 / desktop sadeleştirme + collect TTS + performans:

- Kullanici talebi:
  - Desktop HUD daha sade ve daha az alan kaplasin.
  - Ust alfabe HUD tek satira yayilsin, harf kutulari daha uzun olsun.
  - Alt combat HUD daha ince ve daha kompakt, Metin2 benzeri his versin.
  - Harf toplanir toplanmaz ilgili harf `X harfini buldun` diye TTS okusun.
  - Mobilde `Kos` + `Etkilesim` daha yukariya tasinsin, aralari acilsin; `ATK` buyusun ve biraz daha iceri gelsin.
  - Sol kolon butonlari ust HUD ile cakismasin.
  - Harf toplarken hissedilen donma azaltılsin ve genel UI performansi iyilessin.

- Uygulanan degisiklikler:
  - `src/styles.css` desktop taban HUD stilleri sadeleştirildi:
    - minimap daha kucuk ve daha asagi alindi,
    - quest / settings butonlari daha asagi cekildi,
    - FPS etiketi sag ust koseye tasindi,
    - ust alfabe HUD tek satir tam-genis banda cevrildi,
    - harf chip oranlari uzatildi ve gorseller tam sigacak sekilde buyutuldu,
    - alt combat HUD pad/gap/bileşen boyutlari kucultuldu.
  - Mobil coarse + landscape touch UI bloklarinda:
    - `ATK` buyutuldu ve iceri tasindi,
    - `Kos` ve `Etkilesim` yukari alinip birbirinden ayrildi,
    - sol kolon HUD butonlari daha asagi cekildi.
  - `src/main.js` tarafinda:
    - toplama aninda aninda TTS duyurusu eklendi (`Ha harfini buldun` gibi),
    - alfabe HUD sync'i dirty-flag ile sinirlandi,
    - XP hucre guncellemesi degismeyince tekrar yazmiyor,
    - overlay ve minimap guncellemesi high-spec'te de kontrollu interval'e cekildi,
    - collect akisi icindeki ekstra `refreshSimulationQuery()` cagrisi kaldirildi.
  - `src/letterCatalog.js` icinde ornek kelime gorsel data URL uretimi cache'lendi; kart acilisindaki tekrar encode maliyeti azaltildi.

- Dogrulama:
  - `npm run build` basarili.
  - MCP Playwright masaustu olcumu:
    - alfabet HUD `width=1281px`, `height=57.12px`, `gridColumns=30`, `imageFits=true`
    - combat HUD `height=149.36px`
    - quest `top=76.8px`, settings `top=128px`, minimap `top=73.59px`; hepsi ust HUD altina indi.
  - MCP Playwright collect/TTS olcumu:
    - `debug_collect_nearest_letter()` sonrasi `collectedCount: 0 -> 1`
    - yakalanan utterance: `Ha harfini buldun`
    - `650ms` sonra `letterCardVisible=true`, `activeLetterCard.id=6`
  - MCP Playwright mobil landscape touch olcumu:
    - `touchCount=7`
    - `ATK=79.35px`, `Kos=48px`, `Etkilesim=46.4px`
    - `interactAboveSprint=true`
    - `sprintAboveAttack=true`
    - `actionsOverlapStick=false`
    - `leftColumnBelowHud=true`

- Not:
  - Konsolda yeni fonksiyonel hata gorulmedi; sadece mevcut `favicon.ico` 404 kaydi devam ediyor.

Update 2026-03-29 / TTS guvenilirligi + HUD slot fit + mouse cift tus:

- Kullanici talebi:
  - Telefonda harf sesi ve `X harfini buldun` duyurusu duyulmuyor.
  - Mobilde mini harita saga tasinsin; quest/settings ust HUD ile cakismasin.
  - Masaustunde mini harita / yan butonlar biraz daha asagi insin.
  - Sol ve sag mouse tusu ayni anda kullanilabilsin.
  - Ust alfabe HUD harf slotlari asagi dogru biraz daha uzasin; harfler tam gorunsun.

- Uygulanan degisiklikler:
  - `speakSpeechLine()` kullanici aktivasyonu altinda senkron calisacak sekilde guncellendi; mobil tarayicilardaki gecikmeli `setTimeout` TTS kilidine dusme riski azaltildi.
  - Harf kartindaki buyuk harf ve ornek kelime butonlari `immediate` speech yolunu kullanacak sekilde duzeltildi.
  - Ust alfabe HUD chip oranlari desktop + mobile icin uzatildi; harf imgeleri yeniden scale edilip daha rahat sigacak hale getirildi.
  - Desktop minimap/FPS/quest/settings kolonu ust HUD buyudugu icin biraz daha asagi cekildi.
  - Mouse icin `state.mouseButtons` takibi eklendi; sol tik hedef ve sag tik kamera surukleme artik ayni anda korunuyor, sag tus kalkmadan drag dusmuyor.

- Dogrulama:
  - `npm run build` basarili.
  - MCP Playwright desktop screenshot alindi: `output/desktop-hud-reference-pass.png`.
  - Shell Playwright + speech mock ile desktop test:
    - collect sonrasi `collectedCount: 0 -> 1`
    - yakalanan speech: `Ha harfini buldun`
    - buyuk harfe tik sonrasi son speech: `ح`
    - kart acik kaldi (`glyphCardVisible=true`)
    - sol+sag mouse testinde `yaw 3.142 -> 2.494` ve `moveTarget { x: -1.77, z: 31.34 }`
  - Shell Playwright mobile landscape test:
    - minimap sag kenara tasindi (`minimapRightGap ≈ 7px`)
    - minimap ve sol kolon butonlari ust HUD altinda kaldi
    - `ATK` sprintten buyuk, `Etkilesim` sprintin ustunde
    - ekran goruntusu: `output/mobile-right-edge-layout-check.png`

Update 2026-03-29 / XP bar alta alma + harf karti sesi geri donusu:

- Kullanici geri bildirimi:
  - Desktopta XP bar skill alanina gore fazla yer kapliyor; skill dock altina inmeli.
  - Harf kartindaki harf/okunus sesleri son iki prompttan sonra bozuldu; onceki calisan akis geri gelmeli.

- Uygulanan degisiklikler:
  - `combat-hud__core` desktopta dikey istife alindi; skill dock uste, `Battle Memory` ve XP cubukleri skill dock altina tasindi.
  - Harf karti ses akisinda son eklenen `immediate` branch geri alindi; karttaki buyuk harf, ornek kelime ve harekeli okunus butonlari yeniden onceki `prime + delay` speech yoluna baglandi.

- Dogrulama:
  - `npm run build` basarili.
  - MCP Playwright desktop screenshot: `output/desktop-xp-below-skills.png`.
  - Shell Playwright speech mock testi:
    - collect sonrasi `Ha harfini buldun`
    - buyuk harfe tik sonrasi `ح`
    - ilk okunus butonuna tik sonrasi `حَ`
    - kart acik kalmaya devam etti

Update 2026-03-29 / Kelime karti TTS mobil jest yolu:

- Kullanici geri bildirimi:
  - Kelime kartlarinda ses hala cikmiyor; ozellikle kart uzerinden tiklanan harf ve kelime butonlari sessiz kaliyor.

- Uygulanan degisiklikler:
  - `primeSpeechSynthesis()` icindeki voice setup parcasi `ensureSpeechSynthesisSetup()` olarak ayrildi.
  - Harf kartindaki buyuk harf, ornek kelime ve harekeli okunus butonlari `unlockAudio({ primeSpeech: false })` + `immediate` speech yoluna alindi; artik `setTimeout` beklemeden tik aninda `speechSynthesis.speak()` cagiriyorlar.
  - Arapca ses bulunmayan cihazlar icin, kart sesi `immediate` modda dogrudan Latin/Turkce fallback metne donuyor; boylece mobil jest penceresi kacmadan ses yine cikiyor.

- Dogrulama:
  - `npm run build` basarili.
  - MCP Playwright jest-kisitli TTS simulasyonu:
    - collect speech jest disinda kaldigi icin bilerek bloklandi
    - karttaki ornek kelime butonu tikinda `halib`
    - karttaki buyuk harf butonu tikinda `Ha`
    - bu iki kart sesi `blocked` listesine dusmedi; dogrudan tik jesti icinde konustu

Update 2026-03-29 / Kart sesi cizirti ayiklama:

- Kullanici geri bildirimi:
  - Harf ve ornek kelime tikinda TTS yerine cizirti geliyor.

- Uygulanan degisiklikler:
  - Harf karti tiklarindan `unlockAudio()` cagrisi cikartildi; kart sesi artik WebAudio context acma yoluna hic girmiyor.
  - `stopLetterCardSpeech()` ve speech primer akisi idle durumda gereksiz `cancel()` / `resume()` atmayacak sekilde sertlestirildi.
  - Karttaki buyuk harf, ornek kelime ve harekeli okunus butonlari yalnizca `ensureSpeechSynthesisSetup()` + dogrudan TTS cagrisi kullaniyor.

- Dogrulama:
  - `npm run build` basarili.
  - MCP Playwright bos voice listesi simulasyonu:
    - karttaki ornek kelime butonu tikinda `halib`
    - karttaki buyuk harf butonu tikinda `Ha`
    - kart tiklari sirasinda `cancelCount: 0`, `resumeCount: 0`
    - yani kart sesi artik gereksiz TTS reseti ve WebAudio cizirtisi uretmiyor

Update 2026-03-30 / Vite asset fix & Git sync:

- Tespit:
  - Vite .glb dosyalarini JavaScript olarak parse etmeye calistigi icin "Internal server error" ve "Failed to parse source for import analysis" hatalari olusuyordu.

- Uygulanan degisiklikler:
  - vite.config.js dosyasina assetsInclude: ['**/*.glb'] eklendi.
  - Gereksiz yorum satirlari temizlendi.
  - Degisiklikler Git'e commitlendi.

- Dogrulama:
  - npm run build basarili (Exit code: 0).
  - Vite import analysis hatalari giderildi.

Update 2026-04-06 / test flow repair:

- Kullanici geri bildirimi: projede son degisikliklerden sonra calismayan kisim kontrol edildi.
- Tespit:
  - Uygulama build aliyor ve oyun aciliyor, ancak Playwright testleri eski tek-overlay akisini varsaydigi icin map select overlay `#start-btn` tiklamasini blokluyordu.
  - `tests/physics-interactions.spec.js` ve `tests/portal-transition.spec.js` mevcut debug/state yuzeyiyle uyumsuz, eski alan adlarini (`destructibles`, `puzzles`, `heightZones`, `stageCollected`) bekliyordu.
- Uygulanan degisiklikler:
  - `tests/helpers/startGame.js` eklendi; testler artik once harita seciyor sonra oyunu baslatiyor.
  - `tests/helpers/gameState.js` eklendi; state okuma, stage teleport, mevcut stage harflerini toplama, chest acma ve aktif portal kullanma ortak yardimcilari tanimlandi.
  - `tests/letter-collection.spec.js` mevcut HUD/card davranisiyla uyumlu hale getirildi.
  - `tests/physics-interactions.spec.js` tamamen mevcut oyun yuzeyine gore yeniden yazildi (chest, barrier, stage metadata, portal acilisi, portal gecisi).
  - `tests/portal-transition.spec.js` mevcut stage/portal akisina gore yeniden yazildi ve timeout arttirildi.
- Dogrulama:
  - `npm run build` basarili.
  - `npx playwright test tests/letter-collection.spec.js --reporter=line --max-failures=1` -> 5/5 passed.
  - `npx playwright test tests/physics-interactions.spec.js --reporter=line --max-failures=1` -> 6/6 passed.
  - `npx playwright test tests/portal-transition.spec.js --reporter=line --max-failures=1` -> 3/3 passed.

Update 2026-04-06 / playwright config speed-up:

- `playwright.config.js` hizlandirildi:
  - varsayilan `slowMo` kaldirildi (`0`)
  - varsayilan mod tekrar stabil `headed` birakildi
  - `PLAYWRIGHT_HEADLESS=1` ile opsiyonel headless calisma eklendi
  - `PLAYWRIGHT_DEBUG` ve `PLAYWRIGHT_SLOWMO` override'lari korundu
  - `webServer.timeout` `60000` yapildi
- `package.json` scriptleri eklendi:
  - `npm run test:e2e`
  - `npm run test:e2e:headless`
  - `npm run test:e2e:headed`
  - `npm run test:e2e:debug`
- `tests/helpers/startGame.js` headless/headed farklarina daha dayanikli hale getirildi; map secimi DOM click ile tetikleniyor ve UI hazirligi bekleniyor.
- Dogrulama:
  - `npx playwright test tests/letter-collection.spec.js --reporter=line --max-failures=1` -> 5/5 passed (`ELAPSED_SECONDS=68.1`)
  - `npx playwright test tests/portal-transition.spec.js --reporter=line --max-failures=1` -> 3/3 passed (`ELAPSED_SECONDS=81.8`)

Update 2026-04-06 / multiplayer-admin restore:

- Kullanici talebi: son multiplayer/admin calisan surume olabildigince don; join-lobby startup geri gelsin; map select kalksin; varsayilan kalite low olsun; eski alt HUD geri gelsin.
- Uygulanan degisiklikler:
  - `index.html`, `src/main.js`, `src/styles.css` artifact tabanli lobby-first startup ve eski HUD yapisina geri cekildi.
  - `package.json` icine `server` ve `dev:all` dahil multiplayer scriptleri geri eklendi.
  - `vite.config.js` tekrar multiplayer proxy + `admin.html` / `host.html` coklu entry akisina alindi.
  - `admin.html` ve `host.html` geri eklendi.
  - `src/admin.js` yeniden olusturuldu; admin login, durum polling, start/reset/announce/kick, QR/link ve roster/liderlik gorunumu calisiyor.
  - `src/network/multiplayerClient.js` geri eklendi.
  - `server/multiplayer-server.mjs` geri eklendi; `/health`, `/api/admin/*`, `/api/state`, `WS /multiplayer` ile lobby/running/finished akisi, finisher sirasi ve kick geri geldi.
  - Aktif oyun client'i `?server=` parametresini artik onemsiyor; admin QR/share linkiyle gelen oyuncu dogru backend'e baglanabiliyor.
  - Inline multiplayer client `kicked` / `disconnect` eventleriyle server kontratina uyarlandi.
- Dogrulama:
  - `npm run build` PASS
  - `node --check src/main.js` PASS
  - `node --check src/admin.js` PASS
  - `node --check src/network/multiplayerClient.js` PASS
  - `node --check server/multiplayer-server.mjs` PASS
  - HTTP smoke: `GET http://127.0.0.1:2567/health` PASS, `/admin` PASS, `/host` PASS
  - Browser smoke: `/?server=http://127.0.0.1:2567` uzerinden lobby baglantisi PASS (`connected=true`, `status=lobby`, `playerName=Emir`)
  - Backend smoke: admin login/start/reset/kick + finisher tracking PASS
  - Final verification agent verdict: PASS
