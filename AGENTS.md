# AGENTS.md — GSD-Powered Workflow

> Based on [Get Shit Done](https://github.com/gsd-build/get-shit-done) principles.
> Context engineering, multi-agent orchestration, atomic execution.

## Core Philosophy

**The complexity is in the system, not in your workflow.**

No enterprise theater. No story points. No sprint ceremonies. Just structured, parallel, verified execution.

## Workflow Model

### Phase Flow
```
RESEARCH → PLAN → EXECUTE → VERIFY → SHIP
   ↓         ↓        ↓         ↓        ↓
Paralel    XML      Dalga    Auto     Atomic
Agentler  Görevler  Tabanlı  Test    Commit
```

### 1. Research (Parallel Agents)
- Her büyük görevde `explore` agent'ları paralel çalıştır
- Kod tabanı analizi, UI pattern keşfi, asset envanteri — aynı anda
- Sonuçları tek bir context'te birleştir

### 2. Plan (Goal-Backward)
- Hedefi tanımla, geriye doğru plan çıkar
- Her adım atomik ve doğrulanabilir olmalı
- `todowrite` ile görev listesi oluştur

### 3. Execute (Wave-Based)
```
WAVE 1 (paralel): Bağımsız görevler aynı anda
WAVE 2 (sıralı):  Bağımlı görevler sırayla
WAVE 3:           Entegrasyon + Doğrulama
```

### 4. Verify
- Her görev sonunda doğrulama yap
- Hata varsa otomatik düzelt
- Sadece kritik kararlar için kullanıcıya sor

### 5. Ship
- Değişiklikleri atomik birimler halinde uygula
- Gereksiz soru sorma, yap

## Agent Hierarchy

| Agent Type | Use Case | When |
|------------|----------|------|
| `explore` | Kod araştırmayı, pattern bulma, dosya keşfi | Araştırma fazında |
| `general` | Implementasyon, çok adımlı görevler, dosya yazma | Execution fazında |
| `task` (inline) | Hızlı, tek-adım işlemler | Quick mode |

## Context Engineering Rules

1. **STATE.md** — Her oturum başında oku, güncelle. Oturumlar arası hafıza.
2. **Fresh Context** — Bağımsız görevler için yeni agent spawn et, birikip bozulan bağlamdan kaçın.
3. **Atomic Units** — Her görev küçük, izole, geri alınabilir olmalı.
4. **No Accumulation** — Gereksiz bilgi biriktirme, sadece gerekli bağlamı aktar.

## Project-Specific Conventions

### Stack Awareness
- Three.js + WebGPU (WebGL fallback)
- Rapier3D physics (Web Worker)
- Vanilla JS — no framework, no component library
- Turkish UI, Arabic content

### Code Patterns
- DOM state machine via CSS classes (.is-visible, .is-active)
- Centralized `dom` reference map in main.js
- CSS Custom Properties for design tokens
- Settings persistence via localStorage

### Monolithic main.js (6659 lines)
- Respect the existing structure
- New features extend main.js unless explicitly modularizing
- letterCatalog.js for Arabic data, renderer.js for rendering

### Asset Management
- `scripts/sync-public-assets.mjs` mirrors assets to public/
- GLTF files embed binary as base64 data URIs
- Arabic letter PNGs in `assets/arabic_huruf/`

## Anti-Patterns (Yapma)

- Tek bir sohbette her şeyi yapmaya çalışma — context rot olur
- Soru sormak için soru sorma — araştır, sonra yap
- Gereksiz dosya okuma — sadece gerekli olanı oku
- Monolitik düşünme — paralel agent'ları kullan
- Enterprise ceremony — story point, sprint, retrospective yok

## Quick Reference

```
Kullanıcı: "X özelliğini ekle"
  1. todowrite → görev listesi oluştur
  2. explore agent → kod tabanını araştır (paralel)
  3. Plan → atomik adımlara böl
  4. Execute → wave tabanlı paralel uygula
  5. Verify → çalıştığını doğrula
  6. Bitti. Soru sorma.
```

## Lint & Typecheck

Komutlar projeye göre belirlenir. Uygulama sonrası çalıştır.

---

*GSD prensibi: Karmaşıklık sistemde, iş akışında değil.*
