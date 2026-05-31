import "./styles.css";
import * as THREE from "three";
import nipplejs from "nipplejs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createGameRenderer, configureRenderer } from "./runtime/renderer.js";
import { registerGameDebugApi } from "./debug/gameDebugApi.js";
import {
  MultiplayerClient,
  loadStoredPlayerName,
  sanitizePlayerName,
  storePlayerName,
} from "./network/multiplayerClient.js";
import {
  buildExampleIllustrationDataUrl,
  getJoinRuleText,
  getLetterCatalogEntry,
} from "./letterCatalog.js";

function assetPath(relativePath) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${relativePath.startsWith("/") ? relativePath.slice(1) : relativePath}`;
}

const runtimeTextureManifestUrl = assetPath("assets/runtime/texture-manifest.json");

const backgroundMusicUrl = new URL("../bevy/assets/sounds/Epic orchestra music.ogg", import.meta.url).href;

const letterModules = import.meta.glob("../assets/arabic_huruf/*.png", {
  eager: true,
  import: "default",
});

const letterAssets = Object.entries(letterModules)
  .map(([path, href]) => {
    const match = path.match(/(\d+)\.png$/);
    const id = Number(match?.[1] ?? 0);
    const meta = getLetterCatalogEntry(id);
    return {
      id,
      label: meta ? `${meta.nameTr} · ${meta.symbol}` : `Harf ${String(match?.[1] ?? "0").padStart(2, "0")}`,
      href,
      meta,
    };
  })
  .sort((left, right) => left.id - right.id);

const totalLetterCount = letterAssets.length;
const letterIndexById = new Map(letterAssets.map((asset, index) => [asset.id, index]));

const compressedRuntimeAssetBase = assetPath("assets/runtime");
const fallbackRuntimeAssetBase = assetPath("assets/runtime-fallback");

function shouldUseCompressedAssets() {
  return state.performance.rendererBackend === "webgpu";
}

const compressedDungeonAssetUrls = {
  floor: `${compressedRuntimeAssetBase}/dungeon/floor_tile_large.glb`,
  floorRocks: `${compressedRuntimeAssetBase}/dungeon/floor_tile_large_rocks.glb`,
  wall: `${compressedRuntimeAssetBase}/dungeon/wall.glb`,
  wallWindow: `${compressedRuntimeAssetBase}/dungeon/wall_window_open.glb`,
  wallCorner: `${compressedRuntimeAssetBase}/dungeon/wall_corner.glb`,
  pillar: `${compressedRuntimeAssetBase}/dungeon/pillar_decorated.glb`,
  column: `${compressedRuntimeAssetBase}/dungeon/column.glb`,
  torch: `${compressedRuntimeAssetBase}/dungeon/torch_lit.glb`,
  banner: `${compressedRuntimeAssetBase}/dungeon/banner_shield_red.glb`,
  chest: `${compressedRuntimeAssetBase}/dungeon/chest_gold.glb`,
  barrel: `${compressedRuntimeAssetBase}/dungeon/barrel_large_decorated.glb`,
  table: `${compressedRuntimeAssetBase}/dungeon/table_long_decorated_A.glb`,
  trunk: `${compressedRuntimeAssetBase}/dungeon/trunk_large_A.glb`,
};
const fallbackDungeonAssetUrls = {
  floor: `${fallbackRuntimeAssetBase}/dungeon/floor_tile_large.glb`,
  floorRocks: `${fallbackRuntimeAssetBase}/dungeon/floor_tile_large_rocks.glb`,
  wall: `${fallbackRuntimeAssetBase}/dungeon/wall.glb`,
  wallWindow: `${fallbackRuntimeAssetBase}/dungeon/wall_window_open.glb`,
  wallCorner: `${fallbackRuntimeAssetBase}/dungeon/wall_corner.glb`,
  pillar: `${fallbackRuntimeAssetBase}/dungeon/pillar_decorated.glb`,
  column: `${fallbackRuntimeAssetBase}/dungeon/column.glb`,
  torch: `${fallbackRuntimeAssetBase}/dungeon/torch_lit.glb`,
  banner: `${fallbackRuntimeAssetBase}/dungeon/banner_shield_red.glb`,
  chest: `${fallbackRuntimeAssetBase}/dungeon/chest_gold.glb`,
  barrel: `${fallbackRuntimeAssetBase}/dungeon/barrel_large_decorated.glb`,
  table: `${fallbackRuntimeAssetBase}/dungeon/table_long_decorated_A.glb`,
  trunk: `${fallbackRuntimeAssetBase}/dungeon/trunk_large_A.glb`,
};

function getDungeonAssetUrls() {
  return shouldUseCompressedAssets() ? compressedDungeonAssetUrls : fallbackDungeonAssetUrls;
}

const halloweenAssetUrls = {
  halloweenArchGate: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/arch_gate.glb"),
  halloweenArch: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/arch.glb"),
  halloweenBench: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/bench_decorated.glb"),
  halloweenCoffin: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/coffin_decorated.glb"),
  halloweenCrypt: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/crypt.glb"),
  halloweenFence: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/fence.glb"),
  halloweenFenceBroken: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/fence_broken.glb"),
  halloweenFenceGate: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/fence_gate.glb"),
  halloweenFencePillar: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/fence_pillar.glb"),
  halloweenFloorDirt: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/floor_dirt.glb"),
  halloweenFloorGrave: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/floor_dirt_grave.glb"),
  halloweenGraveA: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/grave_A.glb"),
  halloweenGraveB: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/grave_B.glb"),
  halloweenGravestone: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/gravestone.glb"),
  halloweenLantern: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/lantern_standing.glb"),
  halloweenPathA: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/path_A.glb"),
  halloweenPathB: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/path_B.glb"),
  halloweenPathC: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/path_C.glb"),
  halloweenPathD: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/path_D.glb"),
  halloweenPlaqueCandles: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/plaque_candles.glb"),
  halloweenPostLantern: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/post_lantern.glb"),
  halloweenPostSkull: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/post_skull.glb"),
  halloweenPumpkinOrange: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/pumpkin_orange_jackolantern.glb"),
  halloweenPumpkinYellow: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/pumpkin_yellow_jackolantern.glb"),
  halloweenShrine: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/shrine_candles.glb"),
  halloweenSkullCandle: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/skull_candle.glb"),
  halloweenTreeDeadLarge: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/tree_dead_large_decorated.glb"),
  halloweenTreeDeadMedium: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/tree_dead_medium.glb"),
  halloweenTreeDeadSmall: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/tree_dead_small.glb"),
  halloweenTreePineOrangeLarge: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/tree_pine_orange_large.glb"),
  halloweenTreePineOrangeMedium: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/tree_pine_orange_medium.glb"),
  halloweenTreePineYellowLarge: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/tree_pine_yellow_large.glb"),
  halloweenTreePineYellowMedium: assetPath("assets/kaykit_halloween_bits/Assets/gltf_embedded/tree_pine_yellow_medium.glb"),
};

const hexagonAssetUrls = {
  hexGrass: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/tiles/base/hex_grass.glb"),
  hexWater: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/tiles/base/hex_water.glb"),
  hexRoadA: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/tiles/roads/hex_road_A.glb"),
  hexCastle: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/buildings/blue/building_castle_blue.glb"),
  hexHouseA: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/buildings/blue/building_home_A_blue.glb"),
  hexHouseB: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/buildings/blue/building_home_B_blue.glb"),
  hexChurch: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/buildings/blue/building_church_blue.glb"),
  hexTavern: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/buildings/blue/building_tavern_blue.glb"),
  hexTreeA: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/decoration/nature/trees_A_large.glb"),
  hexTreeB: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/decoration/nature/trees_B_large.glb"),
  hexTower: assetPath("assets/kaykit_medieval_hexagon_pack/Assets/gltf_embedded/buildings/blue/building_tower_A_blue.glb"),
};

function resolveEnvironmentAssetUrls(assetUrls) {
  if (shouldUseCompressedAssets()) {
    return assetUrls;
  }
  return Object.fromEntries(
    Object.entries(assetUrls).map(([key, value]) => [key, value.replace(/\.glb$/i, ".gltf")]),
  );
}

const stageOrder = ["sunCourt", "halloweenHollows", "hexagonVillage"];
const stageChunkSize = Math.ceil(totalLetterCount / stageOrder.length);
const stageLetterRanges = stageOrder.reduce((ranges, stageKey, index) => {
  const start = index * stageChunkSize;
  const end = index === stageOrder.length - 1
    ? totalLetterCount
    : Math.min(totalLetterCount, start + stageChunkSize);
  ranges[stageKey] = [start, end];
  return ranges;
}, {});

const characterDefinitions = {
  barbarian: {
    id: "barbarian",
    label: "Barbarian",
    role: "On Saf",
    icon: "🪓",
    desc: "Agir darbelerle alan acan vahsi savasci.",
    assetUrl: `${compressedRuntimeAssetBase}/characters/Barbarian.glb`,
    fallbackAssetUrl: `${fallbackRuntimeAssetBase}/characters/Barbarian.glb`,
    movementClips: {
      idle: "Idle",
      walk: "Walking_A",
      run: "Running_A",
      crouch: "PickUp",
      charge: "Dodge_Forward",
      victory: "Cheer",
    },
    skills: [
      { id: "barb-cleave", effectType: "slash", animation: "1H_Melee_Attack_Slice_Diagonal", key: "3", title: "Cleave", short: "CL", glyph: "A", colorA: "#ff9f68", colorB: "#7a2411", cost: 16, cooldown: 6 },
      { id: "barb-crash", effectType: "bash", animation: "Block_Attack", key: "4", title: "Crash", short: "CR", glyph: "B", colorA: "#ffd27a", colorB: "#8b5417", cost: 18, cooldown: 9 },
      { id: "barb-whirl", effectType: "whirlwind", animation: "2H_Melee_Attack_Spinning", key: "Q", title: "Whirl", short: "WH", glyph: "W", colorA: "#ff7d5a", colorB: "#6f1515", cost: 22, cooldown: 11 },
      { id: "barb-roar", effectType: "warcry", animation: "Cheer", key: "R", title: "Roar", short: "RR", glyph: "R", colorA: "#ffcf72", colorB: "#865e14", cost: 24, cooldown: 16 },
    ],
  },
  knight: {
    id: "knight",
    label: "Knight",
    role: "Dengeli",
    icon: "🛡️",
    desc: "Dengeli savasci. Kontrol ve dayanıklılık odaklı.",
    assetUrl: `${compressedRuntimeAssetBase}/characters/Knight.glb`,
    fallbackAssetUrl: `${fallbackRuntimeAssetBase}/characters/Knight.glb`,
    movementClips: {
      idle: "Idle",
      walk: "Walking_A",
      run: "Running_A",
      crouch: "PickUp",
      charge: "Dodge_Forward",
      victory: "Cheer",
    },
    skills: [
      { id: "knight-guard", effectType: "bash", animation: "Block_Attack", key: "3", title: "Guard", short: "GD", glyph: "G", colorA: "#ffe38f", colorB: "#966315", cost: 16, cooldown: 8 },
      { id: "knight-rush", effectType: "charge", animation: "Dodge_Forward", key: "4", title: "Rush", short: "RU", glyph: "C", colorA: "#7bc7ff", colorB: "#26499c", cost: 18, cooldown: 9 },
      { id: "knight-banner", effectType: "banner", animation: "Spellcast_Raise", key: "Q", title: "Banner", short: "BN", glyph: "R", colorA: "#f48db1", colorB: "#7f1a3c", cost: 24, cooldown: 16 },
      { id: "knight-cry", effectType: "warcry", animation: "Cheer", key: "R", title: "Cry", short: "CR", glyph: "Q", colorA: "#ffd676", colorB: "#8c5a18", cost: 20, cooldown: 12 },
    ],
  },
  mage: {
    id: "mage",
    label: "Mage",
    role: "Menzil",
    icon: "🪄",
    desc: "Buyu odakli, aura ve patlama gucu yuksek.",
    assetUrl: `${compressedRuntimeAssetBase}/characters/Mage.glb`,
    fallbackAssetUrl: `${fallbackRuntimeAssetBase}/characters/Mage.glb`,
    movementClips: {
      idle: "Idle",
      walk: "Walking_A",
      run: "Running_A",
      crouch: "PickUp",
      charge: "Dodge_Forward",
      victory: "Spellcast_Raise",
    },
    skills: [
      { id: "mage-flare", effectType: "slash", animation: "Spellcast_Raise", key: "3", title: "Flare", short: "FL", glyph: "F", colorA: "#ffb07c", colorB: "#8f2a24", cost: 15, cooldown: 6 },
      { id: "mage-veil", effectType: "banner", animation: "Spellcast_Raise", key: "4", title: "Veil", short: "VL", glyph: "V", colorA: "#d79bff", colorB: "#4d287f", cost: 18, cooldown: 10 },
      { id: "mage-blink", effectType: "charge", animation: "Dodge_Forward", key: "Q", title: "Blink", short: "BL", glyph: "B", colorA: "#82d9ff", colorB: "#245c92", cost: 14, cooldown: 7 },
      { id: "mage-chant", effectType: "warcry", animation: "Cheer", key: "R", title: "Chant", short: "CH", glyph: "C", colorA: "#ffe59c", colorB: "#8a6626", cost: 22, cooldown: 14 },
    ],
  },
  rogue: {
    id: "rogue",
    label: "Rogue",
    role: "Suikast",
    icon: "🗡️",
    desc: "Hizli hamle ve darbelerle oynayan cevik sinif.",
    assetUrl: `${compressedRuntimeAssetBase}/characters/Rogue.glb`,
    fallbackAssetUrl: `${fallbackRuntimeAssetBase}/characters/Rogue.glb`,
    movementClips: {
      idle: "Idle",
      walk: "Walking_A",
      run: "Running_A",
      crouch: "PickUp",
      charge: "Dodge_Forward",
      victory: "Cheer",
    },
    skills: [
      { id: "rogue-cut", effectType: "slash", animation: "1H_Melee_Attack_Slice_Horizontal", key: "3", title: "Cut", short: "CT", glyph: "C", colorA: "#ff9e8d", colorB: "#7a2232", cost: 12, cooldown: 5 },
      { id: "rogue-lunge", effectType: "charge", animation: "1H_Melee_Attack_Stab", key: "4", title: "Lunge", short: "LG", glyph: "L", colorA: "#91d5ff", colorB: "#23578c", cost: 14, cooldown: 7 },
      { id: "rogue-spin", effectType: "whirlwind", animation: "2H_Melee_Attack_Spinning", key: "Q", title: "Spin", short: "SP", glyph: "S", colorA: "#ff7d9e", colorB: "#6a1531", cost: 18, cooldown: 9 },
      { id: "rogue-feint", effectType: "bash", animation: "Block_Attack", key: "R", title: "Feint", short: "FN", glyph: "F", colorA: "#ffd27f", colorB: "#7d5317", cost: 16, cooldown: 10 },
    ],
  },
  rogueHooded: {
    id: "rogueHooded",
    label: "Rogue Hooded",
    role: "Golge",
    icon: "🥷",
    desc: "Golgevari varyant; ani cikis ve destek baskisi kurar.",
    assetUrl: `${compressedRuntimeAssetBase}/characters/Rogue_Hooded.glb`,
    fallbackAssetUrl: `${fallbackRuntimeAssetBase}/characters/Rogue_Hooded.glb`,
    movementClips: {
      idle: "Idle",
      walk: "Walking_A",
      run: "Running_A",
      crouch: "PickUp",
      charge: "Dodge_Forward",
      victory: "Spellcast_Raise",
    },
    skills: [
      { id: "hood-shadow", effectType: "charge", animation: "Dodge_Forward", key: "3", title: "Shadow", short: "SH", glyph: "S", colorA: "#80bfff", colorB: "#1d3568", cost: 12, cooldown: 6 },
      { id: "hood-slice", effectType: "slash", animation: "1H_Melee_Attack_Slice_Diagonal", key: "4", title: "Slice", short: "SL", glyph: "D", colorA: "#ff9ca8", colorB: "#74243a", cost: 14, cooldown: 6 },
      { id: "hood-sigil", effectType: "banner", animation: "Spellcast_Raise", key: "Q", title: "Sigil", short: "SG", glyph: "G", colorA: "#d6a0ff", colorB: "#4a2679", cost: 20, cooldown: 13 },
      { id: "hood-omen", effectType: "warcry", animation: "Cheer", key: "R", title: "Omen", short: "OM", glyph: "O", colorA: "#ffe29d", colorB: "#8a5d1a", cost: 18, cooldown: 12 },
    ],
  },
};

const defaultCharacterId = "knight";

const treasureLootTable = [
  { name: "Sun Ruby", color: "#ff7360", value: 140 },
  { name: "Imperial Coin Cache", color: "#ffd873", value: 180 },
  { name: "Azure Relic", color: "#66b7ff", value: 165 },
  { name: "Royal Seal", color: "#d896ff", value: 155 },
  { name: "Phoenix Feather", color: "#ffb14d", value: 190 },
  { name: "Jade Scarab", color: "#66e2ad", value: 170 },
];

function getCharacterDefinition(characterId = defaultCharacterId) {
  return characterDefinitions[characterId] ?? characterDefinitions[defaultCharacterId];
}

function normalizeCharacterId(value) {
  const normalized = String(value ?? "").trim();
  return characterDefinitions[normalized] ? normalized : defaultCharacterId;
}

function loadStoredCharacterId(fallback = "") {
  const preferred = normalizeCharacterId(fallback);
  if (preferred !== defaultCharacterId || fallback) {
    return preferred;
  }

  try {
    return normalizeCharacterId(window.localStorage.getItem(characterStorageKey) ?? defaultCharacterId);
  } catch {
    return defaultCharacterId;
  }
}

function storeCharacterId(characterId) {
  const normalized = normalizeCharacterId(characterId);
  try {
    window.localStorage.setItem(characterStorageKey, normalized);
  } catch {
    // Ignore storage failures.
  }
  return normalized;
}

function createCharacterSkillState(characterId) {
  return getCharacterDefinition(characterId).skills.map((skill) => ({
    ...skill,
    cooldownLeft: 0,
  }));
}

function getActiveCharacterDefinition() {
  return getCharacterDefinition(state?.session?.selectedCharacterId || state?.player?.characterId || storedCharacterId);
}

function getCharacterMovementClips(characterId = state?.player?.characterId || state?.session?.selectedCharacterId || storedCharacterId) {
  return getCharacterDefinition(characterId).movementClips;
}

function refreshSkillKeyMap() {
  skillKeyMap.clear();
  state.skills.forEach((skill) => {
    skillKeyMap.set(String(skill.key).toLowerCase(), skill.id);
  });
}

const basicAttackCombo = [
  {
    clip: "1H_Melee_Attack_Slice_Diagonal",
    label: "Saga kesis",
    color: "#ffc166",
    radius: 3.9,
    width: 1.9,
    cooldown: 0.26,
    lock: 0.24,
    timeScale: 1.18,
    damage: 1,
  },
  {
    clip: "1H_Melee_Attack_Slice_Horizontal",
    label: "Sola kesis",
    color: "#ffe28e",
    radius: 4.3,
    width: 2.35,
    cooldown: 0.3,
    lock: 0.28,
    timeScale: 1.24,
    damage: 1,
  },
  {
    clip: "1H_Melee_Attack_Stab",
    label: "Merkez sapla",
    color: "#ffd873",
    radius: 4.9,
    width: 1.28,
    cooldown: 0.36,
    lock: 0.34,
    timeScale: 1.16,
    damage: 2,
  },
];

const dom = {
  canvas: document.querySelector("#game-canvas"),
  minimapShell: document.querySelector(".minimap-shell"),
  minimapToggle: document.querySelector("#minimap-toggle"),
  alphabetHud: document.querySelector("#alphabet-hud"),
  alphabetGrid: document.querySelector("#alphabet-grid"),
  alphabetProgress: document.querySelector("#alphabet-progress"),
  mapSelect: document.querySelector("#map-select"),
  mapGrid: document.querySelector("#map-grid"),
  menu: document.querySelector("#menu"),
  menuKicker: document.querySelector("#menu-kicker"),
  menuTitle: document.querySelector("#menu-title"),
  menuDesc: document.querySelector("#menu-desc"),
  winScreen: document.querySelector("#win-screen"),
  startBtn: document.querySelector("#start-btn"),
  restartBtn: document.querySelector("#restart-btn"),
  backToMaps: document.querySelector("#back-to-maps"),
  toast: document.querySelector("#toast"),
  questWindow: document.querySelector("#quest-window"),
  questTab: document.querySelector("#quest-tab"),
  settingsTab: document.querySelector("#settings-tab"),
  fpsMeter: document.querySelector("#fps-meter"),
  settingsPanel: document.querySelector("#settings-panel"),
  settingsForm: document.querySelector("#settings-form"),
  settingsApply: document.querySelector("#settings-apply"),
  settingsReset: document.querySelector("#settings-reset"),
  settingsClose: document.querySelector("#settings-close"),
  letterCardShell: document.querySelector("#letter-card-shell"),
  letterCardBackdrop: document.querySelector("#letter-card-backdrop"),
  letterCardClose: document.querySelector("#letter-card-close"),
  letterCardGlyphButton: document.querySelector("#letter-card-glyph-button"),
  letterCardImage: document.querySelector("#letter-card-image"),
  letterCardName: document.querySelector("#letter-card-name"),
  letterCardTitle: document.querySelector("#letter-card-title"),
  letterCardDescription: document.querySelector("#letter-card-description"),
  letterCardFacts: document.querySelector("#letter-card-facts"),
  letterCardAudioButtons: document.querySelector("#letter-card-audio-buttons"),
  letterCardFormsGrid: document.querySelector("#letter-card-forms-grid"),
  letterCardExampleAudio: document.querySelector("#letter-card-example-audio"),
  letterCardExampleButton: document.querySelector("#letter-card-example-button"),
  letterCardExampleImage: document.querySelector("#letter-card-example-image"),
  collectedCountLabel: document.querySelector("#collected-count"),
  targetLabel: document.querySelector("#target-label"),
  coordinateLabel: document.querySelector("#coordinate-label"),
  zoneLabel: document.querySelector("#zone-label"),
  messageLabel: document.querySelector("#message-label"),
  hpLabel: document.querySelector("#hp-label"),
  mpLabel: document.querySelector("#mp-label"),
  goldLabel: document.querySelector("#gold-label"),
  presenceLabel: document.querySelector("#presence-label"),
  xpLabel: document.querySelector("#xp-label"),
  hpFill: document.querySelector("#hp-fill"),
  mpFill: document.querySelector("#mp-fill"),
  xpRack: document.querySelector("#xp-rack"),
  levelLabel: document.querySelector("#level-label"),
  winCopy: document.querySelector("#win-copy"),
  playerName: document.querySelector("#player-name"),
  minimapCanvas: document.querySelector("#minimap-canvas"),
  skillDock: document.querySelector("#skill-dock"),
  touchUi: document.querySelector("#touch-ui"),
  touchStick: document.querySelector("#touch-stick"),
  touchActions: document.querySelector("#touch-actions"),
  mobileImmersive: document.querySelector("#mobile-immersive"),
  mobileImmersiveTitle: document.querySelector("#mobile-immersive-title"),
  mobileImmersiveCopy: document.querySelector("#mobile-immersive-copy"),
  mobileImmersiveAction: document.querySelector("#mobile-immersive-action"),
  playerNameInput: document.querySelector("#player-name-input"),
  characterGrid: document.querySelector("#character-grid"),
  characterTitle: document.querySelector("#character-title"),
  characterRole: document.querySelector("#character-role"),
  characterSummary: document.querySelector("#character-summary"),
  characterSelectionTitle: document.querySelector("#character-selection-title"),
  characterSelectionRole: document.querySelector("#character-selection-role"),
  characterSelectionDesc: document.querySelector("#character-selection-desc"),
  multiplayerStatus: document.querySelector("#multiplayer-status"),
  multiplayerCount: document.querySelector("#multiplayer-count"),
  multiplayerHelp: document.querySelector("#multiplayer-help"),
  realmHud: document.querySelector("#realm-hud"),
  realmStatus: document.querySelector("#realm-status"),
  realmMeta: document.querySelector("#realm-meta"),
  realmCount: document.querySelector("#realm-count"),
};

const qualityProfile = detectQualityProfile();
document.body.classList.toggle("quality-lite", qualityProfile.lowSpec);

const minimapContext = dom.minimapCanvas.getContext("2d");
const defaultStats = { level: 1, xp: 0, nextXp: 120, hp: 160, maxHp: 160, mp: 95, maxMp: 95, gold: 0 };
const defaultPlayerTitle = "Warrior of the Sun Court";
const characterStorageKey = "sun-court-character-v1";
const settingsStorageKey = "sun-court-settings-v2";
const settingsStorageVersion = 3;
const queryPlayerName = sanitizePlayerName(new URLSearchParams(window.location.search).get("name") ?? "");
const queryCharacterId = String(new URLSearchParams(window.location.search).get("character") ?? "").trim();
const storedPlayerName = queryPlayerName || loadStoredPlayerName();
const storedCharacterId = loadStoredCharacterId(queryCharacterId);
const defaultSettings = {
  quality: "low",
  letterDensity: 100,
  chestDensity: 100,
  characterScale: 100,
  letterScale: 100,
  masterVolume: 72,
  musicVolume: 34,
  sfxVolume: 68,
  musicEnabled: false,
  footstepsEnabled: true,
  minimapEnabled: true,
  showHints: true,
  reduceMotion: false,
  showFps: false,
  cameraSensitivity: 100,
  invertY: false,
  fullscreen: false,
};
const savedSettings = loadStoredSettings();
const movementKeys = new Set(["w", "a", "s", "d", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
const skillKeyMap = new Map();
const envScale = 3.15;
const playerTargetHeight = 5.85;
const collectibleVisualProfile = {
  glyphSize: 2.25,
  ringRadius: 1.02,
  ringTube: 0.07,
  shellRadius: 1.26,
  sealRadius: 1.08,
  shellHeight: 1.48,
};
const hexVillageScaleProfile = {
  landmark: 1.24,
  gate: 0.68,
  tower: 0.92,
  building: 0.84,
  church: 0.97,
  tree: 1.02,
  outerTree: 1.16,
  cottage: 0.76,
};
const xpCubeCount = 12;
const stageLabels = {
  sunCourt: "Sun Court",
  halloweenHollows: "Halloween Hallows",
  hexagonVillage: "Hexagon Village",
};

const mapDefinitions = {
  sunCourt: {
    key: "sunCourt",
    nameTr: "Sun Court",
    name: "Sun Court",
    desc: "Knight savascisini kendi animasyonlariyla kontrol et. Dungeon paketindeki kale parcaciklari arasina dagitilan Arapca harfleri topla.",
    difficulty: "Kolay",
    icon: "🏰",
  },
  halloweenHollows: {
    key: "halloweenHollows",
    nameTr: "Hollow Hallows",
    name: "Hollow Hallows",
    desc: "Halloween temali karanlik zindan. Lanetli mezarlik ve kasvetli korularda harfleri ara.",
    difficulty: "Orta",
    icon: "🎃",
  },
  hexagonVillage: {
    key: "hexagonVillage",
    nameTr: "Hexagon Village",
    name: "Hexagon Village",
    desc: "MMORPG tarzi altigen köy haritasi. Dünya haritasindaki gibi genis bir alan.",
    difficulty: "Zor",
    icon: "🏘️",
  },
};

// ============================================================
// MAP SELECTION UI
// ============================================================

function buildMapSelectionUI() {
  dom.mapGrid.innerHTML = "";
  Object.values(mapDefinitions).forEach((map) => {
    const card = document.createElement("div");
    card.className = "map-card";
    card.dataset.mapKey = map.key;
    card.innerHTML = `
      <div class="map-card__preview">
        <span class="map-card__preview-placeholder">${map.icon}</span>
      </div>
      <h3 class="map-card__name">${map.nameTr}</h3>
      <p class="map-card__desc">${map.desc}</p>
      <span class="map-card__difficulty">${map.difficulty}</span>
      <button class="map-card__select-btn" type="button">Sec</button>
    `;
    card.addEventListener("click", () => selectMap(map.key));
    dom.mapGrid.appendChild(card);
  });
}

function selectMap(mapKey) {
  const map = mapDefinitions[mapKey];
  if (!map) return;

  state.world.selectedMap = mapKey;

  document.querySelectorAll(".map-card").forEach((c) => {
    c.classList.toggle("is-selected", c.dataset.mapKey === mapKey);
  });

  dom.menuKicker.textContent = map.nameTr;
  dom.menuTitle.textContent = map.nameTr;
  dom.menuDesc.textContent = map.desc;
  dom.startBtn.textContent = `${map.nameTr}'de Basla`;

  showMenuForMap(mapKey);
  if (multiplayer.isConnected()) {
    multiplayer.send({
      type: "profile",
      name: state.session.playerName,
      mapKey,
      characterId: state.session.selectedCharacterId,
    });
  }
  syncMultiplayerSummary();
  syncStartButtonState();
}

function showMenuForMap(mapKey) {
  dom.mapSelect.classList.remove("is-visible");
  dom.menu.classList.add("is-visible");
  syncRemotePlayerRoster();
  syncStartButtonState();
}

function showMapSelect() {
  dom.menu.classList.remove("is-visible");
  dom.mapSelect.classList.add("is-visible");
  syncRemotePlayerRoster([]);
  syncMultiplayerSummary();
}

function getSelectedMap() {
  // Priority: URL param > stored selection > default
  const urlStage = new URLSearchParams(window.location.search).get("stage");
  if (urlStage && stageLabels[urlStage]) return urlStage;
  return state.world.selectedMap || "sunCourt";
}

function rebuildSkillState(characterId = state.player.characterId) {
  const definition = getCharacterDefinition(characterId);
  state.skills = definition.skills.map((skill) => ({ ...skill, cooldownLeft: 0 }));
  skillKeyMap.clear();
  state.skills.forEach((skill) => {
    skillKeyMap.set(String(skill.key).toLowerCase(), skill.id);
  });
  state.cooldownsDirty = true;
  buildSkillUi();
}

function syncCharacterSelectionUi() {
  const definition = getCharacterDefinition(state.session.selectedCharacterId || state.player.characterId);
  if (dom.characterTitle) {
    dom.characterTitle.textContent = definition.label;
  }
  if (dom.characterRole) {
    dom.characterRole.textContent = definition.role;
  }
  if (dom.characterSummary) {
    dom.characterSummary.textContent = definition.desc;
  }
  if (dom.characterSelectionTitle) {
    dom.characterSelectionTitle.textContent = definition.label;
  }
  if (dom.characterSelectionRole) {
    dom.characterSelectionRole.textContent = definition.role;
  }
  if (dom.characterSelectionDesc) {
    dom.characterSelectionDesc.textContent = definition.desc;
  }
  if (!dom.characterGrid) {
    return;
  }
  [...dom.characterGrid.children].forEach((card) => {
    const selected = card.dataset.characterId === definition.id;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
}

function buildCharacterSelectionUi() {
  if (!dom.characterGrid) {
    return;
  }

  dom.characterGrid.innerHTML = "";
  Object.values(characterDefinitions).forEach((definition) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "character-card";
    card.dataset.characterId = definition.id;
    card.innerHTML = `
      <div class="character-card__top">
        <span class="character-card__glyph">${definition.icon}</span>
        <div>
          <strong class="character-card__title">${definition.label}</strong>
          <span class="character-card__role">${definition.role}</span>
        </div>
      </div>
      <div class="character-card__skills">
        ${definition.skills.map((skill) => `<span>${skill.title}</span>`).join("")}
      </div>
    `;
    card.addEventListener("click", () => {
      void selectCharacter(definition.id);
    });
    dom.characterGrid.append(card);
  });

  syncCharacterSelectionUi();
}

function getMovementClip(clipKey) {
  const definition = getCharacterDefinition(state.player.characterId);
  return definition.movementClips?.[clipKey] ?? "Idle";
}

async function loadCharacterSource(characterId = state.player.characterId) {
  const normalized = normalizeCharacterId(characterId);
  if (characterSourceCache.has(normalized)) {
    return characterSourceCache.get(normalized);
  }

  const definition = getCharacterDefinition(normalized);
  const assetUrl = shouldUseCompressedAssets() ? definition.assetUrl : (definition.fallbackAssetUrl ?? definition.assetUrl);
  const source = await gltfLoader.loadAsync(assetUrl);
  characterSourceCache.set(normalized, source);
  return source;
}

function prepareCharacterRoot(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }
    node.castShadow = qualityProfile.enableShadows;
    node.receiveShadow = qualityProfile.enableShadows;
    if (node.material?.map) {
      node.material.map.colorSpace = THREE.SRGBColorSpace;
      node.material.map.flipY = false;
    }
    if (hiddenCharacterNodes.has(node.name)) {
      node.visible = false;
    }
  });

  helper.box.setFromObject(root);
  const size = helper.box.getSize(helper.size);
  const scale = playerTargetHeight / Math.max(0.001, size.y);
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  helper.box.setFromObject(root);
  helper.box.getCenter(helper.center);
  root.position.x -= helper.center.x;
  root.position.z -= helper.center.z;
  root.position.y -= helper.box.min.y;
  root.updateMatrixWorld(true);

  return {
    height: helper.box.getSize(helper.size).y,
    baseScale: root.scale.clone(),
  };
}

async function createCharacterInstance(characterId = state.player.characterId) {
  const normalized = normalizeCharacterId(characterId);
  const source = await loadCharacterSource(normalized);
  const root = cloneSkinned(source.scene);
  const { height, baseScale } = prepareCharacterRoot(root);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  source.animations.forEach((clip) => {
    actions.set(clip.name, mixer.clipAction(clip));
  });
  return {
    characterId: normalized,
    model: root,
    mixer,
    actions,
    height,
    baseScale,
  };
}

function flushPendingRoster() {
  if (state.transitioningStage || state.loadingCharacter) {
    return;
  }
  if (state.session.pendingRoster) {
    state.session.roster = state.session.pendingRoster;
    state.session.pendingRoster = null;
  }
  scheduleRemotePlayerRosterSync("pending-roster", { immediate: true });
  flushRemotePlayerRosterSync();
  syncMultiplayerSummary();
}

async function applyCharacterSelection(characterId, { silent = false } = {}) {
  const normalized = storeCharacterId(characterId);
  state.session.selectedCharacterId = normalized;
  state.player.characterId = normalized;
  rebuildSkillState(normalized);
  syncCharacterSelectionUi();

  if (!state.loaded || state.loadingCharacter) {
    return normalized;
  }

  state.loadingCharacter = true;
  try {
    const instance = await createCharacterInstance(normalized);
    if (state.player.model) {
      worldGroup.remove(state.player.model);
    }
    state.player.model = instance.model;
    state.player.mixer = instance.mixer;
    state.player.actions = instance.actions;
    state.player.height = instance.height;
    state.player.baseHeight = instance.height;
    state.player.baseScale.copy(instance.baseScale);
    state.player.currentClip = "";
    state.player.model.position.copy(state.player.position);
    state.player.model.rotation.y = state.player.heading;
    worldGroup.add(state.player.model);
    applyCharacterScale();
    playClip(getMovementClip("idle"), { loop: true, fade: 0.01 });
    if (!silent) {
      showToast(`${getCharacterDefinition(normalized).label} hazirlandi`);
    }
    sendMultiplayerSnapshot(true);
  } finally {
    state.loadingCharacter = false;
    flushPendingRoster();
  }

  return normalized;
}

async function selectCharacter(characterId) {
  const normalized = await applyCharacterSelection(characterId);
  if (multiplayer.isConnected()) {
    multiplayer.send({
      type: "profile",
      name: state.session.playerName || sanitizePlayerName(dom.playerNameInput?.value || ""),
      mapKey: getActiveMultiplayerMapKey(),
      characterId: normalized,
    });
  }
  syncStartButtonState();
  return normalized;
}

// ============================================================
// SCENE INITIALIZATION
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color("#9cd9ff");
scene.fog = new THREE.Fog("#d7eeff", 48, 132);

let renderer = null;

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 250);
const lightingRig = {
  hemisphere: null,
  sun: null,
};

const worldGroup = new THREE.Group();
const collectibleGroup = new THREE.Group();
const effectGroup = new THREE.Group();
const remotePlayerGroup = new THREE.Group();
scene.add(worldGroup);
scene.add(collectibleGroup);
scene.add(effectGroup);
scene.add(remotePlayerGroup);

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const ktx2Loader = new KTX2Loader();
let runtimeTextureManifestPromise = null;
const effectPools = {
  shockwaves: [],
  goldCoins: [],
};
const characterSourceCache = new Map();

/**
 * Texture cache for remote player labels to reduce GC pressure.
 * Reuses canvases and textures instead of creating new ones on each roster update.
 * Max cache size prevents memory bloat with large player counts.
 */
const remoteLabelTextureCache = new Map();
const REMOTE_LABEL_CACHE_MAX = 16;

function getCachedRemoteLabelTexture(playerId, name, score, accent) {
  const cacheKey = `${playerId}:${name}:${score}`;
  const cached = remoteLabelTextureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Evict oldest if at capacity
  if (remoteLabelTextureCache.size >= REMOTE_LABEL_CACHE_MAX) {
    const oldestKey = remoteLabelTextureCache.keys().next().value;
    const old = remoteLabelTextureCache.get(oldestKey);
    if (old) {
      old.canvas.width = 1;
      old.canvas.height = 1;
      old.texture.dispose();
    }
    remoteLabelTextureCache.delete(oldestKey);
  }

  // Create new canvas and texture
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  // Draw initial content
  drawRemoteLabelContent(context, name, score, accent);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const entry = { canvas, context, texture };
  remoteLabelTextureCache.set(cacheKey, entry);

  return entry;
}

function updateRemoteLabelTexture(entry, name, score, accent) {
  // Only redraw if content changed (name or score)
  const currentContent = entry.canvas.dataset.content;
  const newContent = `${name}:${score}`;
  if (currentContent === newContent) {
    return entry.texture;
  }

  entry.context.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
  drawRemoteLabelContent(entry.context, name, score, accent);
  entry.canvas.dataset.content = newContent;
  entry.texture.needsUpdate = true;

  return entry.texture;
}

function drawRemoteLabelContent(context, name, score, accent) {
  context.fillStyle = "rgba(13, 10, 8, 0.86)";
  context.strokeStyle = accent;
  context.lineWidth = 3;
  if (typeof context.roundRect === "function") {
    context.beginPath();
    context.roundRect(8, 8, 360, 112, 24);
    context.fill();
    context.stroke();
  } else {
    context.fillRect(8, 8, 360, 112);
    context.strokeRect(8, 8, 360, 112);
  }
  context.fillStyle = "#f7ebd2";
  context.font = "700 34px Bahnschrift";
  context.fillText(name, 24, 54);
  context.fillStyle = "#ffe39a";
  context.font = "600 24px Bahnschrift";
  context.fillText(`Skor ${score}`, 24, 92);
}
const clock = new THREE.Clock();
const hiddenCharacterNodes = new Set([
  "2H_Sword",
  "1H_Sword_Offhand",
  "Badge_Shield",
  "Rectangle_Shield",
  "Spike_Shield",
]);

const helper = {
  moveDirection: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  cameraTarget: new THREE.Vector3(),
  cameraPosition: new THREE.Vector3(),
  cameraPositionResolved: new THREE.Vector3(),
  cameraDirection: new THREE.Vector3(),
  tempVector: new THREE.Vector3(),
  tempVectorB: new THREE.Vector3(),
  planeIntersection: new THREE.Vector3(),
  pointerVector: new THREE.Vector2(),
  groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  raycaster: new THREE.Raycaster(),
  cameraRaycaster: new THREE.Raycaster(),
  box: new THREE.Box3(),
  size: new THREE.Vector3(),
  center: new THREE.Vector3(),
};

const audioState = {
  context: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  musicUnlocked: false,
  nextMusicAt: 0,
  musicStep: 0,
  nextFootstepAt: 0,
  nextCoinAt: 0,
  nextVoiceAt: 0,
  noiseBuffer: null,
  musicElement: null,
  musicTrackFailed: false,
  speechPrimed: false,
  speechPrimerTimeoutId: 0,
  speechPendingTimeoutId: 0,
  speechFallbackTimeoutId: 0,
  speechVoices: [],
  speechVoicesBound: false,
  speechRestartIntervalId: 0,
  speechRestartTimerStarted: false,
  speechRestartStallCount: 0,
  _arabicVoiceWarningShown: false,
};

const simulationState = {
  worker: null,
  ready: false,
  readyPromise: null,
  configureDeferred: null,
  resetDeferred: null,
  stepResolvers: new Map(),
  inFlightStepId: 0,
  inFlightStepPromise: null,
  queuedStepPayload: null,
  backend: "booting",
  usingWebGPU: false,
  webgpuSupported: false,
  rapierVersion: "",
};

const state = {
  mode: "loading",
  loaded: false,
  transitioningStage: false,
  loadingCharacter: false,
  elapsed: 0,
  keys: new Set(),
  skillUi: new Map(),
  cooldownsDirty: true,
  message: "Yukleniyor",
  zone: "Sun Court",
  ui: {
    questVisible: false,
    settingsVisible: false,
    letterCardVisible: false,
    activeLetterCard: null,
    pendingLetterCardTimeoutId: 0,
    mobileImmersivePromptVisible: false,
    mobileLandscape: true,
    mobileFullscreen: false,
    mobileImmersiveRequested: false,
    mobileMinimapCollapsed: window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ?? false,
    xpCells: [],
    alphabetEntries: new Map(),
    alphabetDirty: true,
    alphabetStageKey: "",
    alphabetProgressLabel: "",
    lastXpProgress: -1,
  },
  settings: {
    ...defaultSettings,
    ...savedSettings,
    fullscreen: false,
  },
  performance: {
    profile: qualityProfile,
    uiTimer: 0,
    minimapTimer: 0,
    fpsTimer: 0,
    fpsFrames: 0,
    fpsValue: 60,
    rendererBackend: "booting",
    webgpuSupported: false,
    physicsBackend: "legacy",
    ktx2Enabled: false,
  },
  toastTimeoutId: 0,
  touchJoystickManager: null,
  touchJoystickSize: 0,
  joystickVector: new THREE.Vector2(),
  inputVector: new THREE.Vector2(),
  mouseButtons: 0,
  autoAttackEnabled: false,
  moveTarget: null,
  camera: {
    yaw: Math.PI,
    pitch: 0.54,
    distance: 15.2,
    actualDistance: 15.2,
    minDistance: 8.5,
    maxDistance: 30,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    collisionMeshes: [],
  },
  world: {
    tileSize: 8,
    radius: 40,
    bounds: { minX: -28, maxX: 28, minZ: -28, maxZ: 28 },
    floorTop: 0,
    structureOffset: { x: 0, z: 0 },
    templateSize: new THREE.Vector3(56, 12, 56),
    heightZones: [],
    sections: [],
    collectibleAnchors: [],
    chestAnchors: [],
    stageKey: "sunCourt",
    currentMap: "sunCourt",
    phase: 1,
    spawn: { x: 0, z: 28 },
    portalAnchor: null,
    stageCollectibleTotal: 0,
  },
  player: {
    characterId: storedCharacterId,
    position: new THREE.Vector3(0, 0, 0),
    heading: Math.PI,
    speed: 7.2,
    sprintMultiplier: 1.85,
    crouchMultiplier: 0.44,
    attackPulse: 0,
    whirlwindTime: 0,
    chargeTime: 0,
    chargeDirection: new THREE.Vector3(0, 0, -1),
    revealUntil: 0,
    actionLock: 0,
    basicAttackCooldown: 0,
    attackHeld: false,
    crouchHeld: false,
    crouchAmount: 0,
    comboIndex: 0,
    comboExpiresAt: 0,
    lastComboHit: 0,
    lastBasicAttackClip: "",
    motionAmount: 0,
    height: 5.4,
    baseHeight: 5.4,
    baseScale: new THREE.Vector3(1, 1, 1),
    model: null,
    mixer: null,
    actions: new Map(),
    currentClip: "",
  },
  stats: { ...defaultStats },
  skills: createCharacterSkillState(storedCharacterId),
  templates: {},
  blockers: [],
  collectibles: [],
  letterTextures: [],
  totalCollectibles: totalLetterCount,
  collectedCount: 0,
  collectedLetterIds: new Set(),
  nearestId: null,
  nearestDistance: null,
  shockwaves: [],
  bannerAura: null,
  chests: [],
  lootBursts: [],
  portal: null,
  nearestChestId: null,
  nearestChestDistance: null,
  nearestPortalDistance: null,
  interactionHint: "",
  session: {
    playerName: storedPlayerName,
    selectedCharacterId: storedCharacterId,
    playerId: "",
    connectionStatus: "idle",
    connectionDetail: "",
    roster: [],
    pendingRoster: null,
    remotePlayers: new Map(),
    snapshotTimer: 0,
    remoteVisualSync: {
      pending: false,
      dueAt: 0,
      lastFlushAt: 0,
      lastReason: "bootstrap",
      rosterEventCount: 0,
      flushCount: 0,
      coalescedEventCount: 0,
      summaryIterationCount: 0,
      minimapRemoteIterationCount: 0,
    },
    match: {
      status: "lobby",
      roundId: 0,
      totalLetters: totalLetterCount,
      finishOrder: [],
      allowedRoundId: 0,
      activeRoundId: 0,
      finishPlace: 0,
    },
  },
};

const multiplayer = new MultiplayerClient({ characterId: storedCharacterId });

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function getActiveMultiplayerMapKey() {
  return state.mode === "menu"
    ? (state.world.selectedMap || getSelectedMap())
    : (state.world.currentMap || state.world.stageKey || getSelectedMap());
}

function isLowSpecRemoteClient() {
  return qualityProfile.lowSpec || shouldUseTouchJoystick();
}

function getRemoteRenderBudget() {
  const lowSpec = isLowSpecRemoteClient();
  const rosterSize = state.session.roster.length;
  return {
    lowSpec,
    visibleCap: lowSpec ? 6 : 12,
    labelCap: lowSpec ? 1 : 3,
    minimapMarkerCap: lowSpec ? 6 : 12,
    nearRadius: 28,
    visualSyncIntervalMs: lowSpec ? 180 : 100,
    snapshotIntervalMs: lowSpec || rosterSize >= 18 ? 300 : 200,
  };
}

function getNormalizedRemoteMapKey(player) {
  return String(player?.currentMap ?? player?.stageKey ?? player?.mapKey ?? "").trim();
}

function getRemotePlayerDistance(player) {
  if (!player?.position) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(
    Number(player.position.x ?? 0) - state.player.position.x,
    Number(player.position.z ?? 0) - state.player.position.z,
  );
}

function compareRemoteRosterPlayers(left, right, budget = getRemoteRenderBudget()) {
  const leftDistance = getRemotePlayerDistance(left);
  const rightDistance = getRemotePlayerDistance(right);
  const leftNear = leftDistance <= budget.nearRadius ? 1 : 0;
  const rightNear = rightDistance <= budget.nearRadius ? 1 : 0;
  if (leftNear !== rightNear) {
    return rightNear - leftNear;
  }

  const leftImportant = Number(Boolean(left?.finishPlace)) + Number((left?.score?.collectedCount ?? 0) > 0);
  const rightImportant = Number(Boolean(right?.finishPlace)) + Number((right?.score?.collectedCount ?? 0) > 0);
  if (leftImportant !== rightImportant) {
    return rightImportant - leftImportant;
  }

  const leftScore = Number(left?.score?.total ?? 0);
  const rightScore = Number(right?.score?.total ?? 0);
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return leftDistance - rightDistance;
}

function getSameMapRemoteRoster(players = state.session.roster) {
  const activeMapKey = getActiveMultiplayerMapKey();
  return players.filter((player) => (
    player
    && player.id !== state.session.playerId
    && getNormalizedRemoteMapKey(player) === activeMapKey
  ));
}

function getVisibleRemoteRosterPlayers(players = state.session.roster, budget = getRemoteRenderBudget()) {
  return getSameMapRemoteRoster(players)
    .sort((left, right) => compareRemoteRosterPlayers(left, right, budget))
    .slice(0, budget.visibleCap);
}

function getSnapshotIntervalSeconds() {
  return getRemoteRenderBudget().snapshotIntervalMs / 1000;
}

function scheduleRemotePlayerRosterSync(reason = "roster", options = {}) {
  const sync = state.session.remoteVisualSync;
  if (options.countEvent) {
    sync.rosterEventCount += 1;
  }

  sync.lastReason = reason;
  const intervalSeconds = getRemoteRenderBudget().visualSyncIntervalMs / 1000;
  const blocked = state.transitioningStage || state.loadingCharacter || state.mode === "loading";

  if (!options.immediate && sync.pending) {
    sync.coalescedEventCount += 1;
    return false;
  }

  if (!options.immediate && !blocked && state.elapsed - sync.lastFlushAt >= intervalSeconds) {
    sync.pending = false;
    sync.dueAt = 0;
    sync.lastFlushAt = state.elapsed;
    sync.flushCount += 1;
    syncRemotePlayerRoster();
    return true;
  }

  sync.pending = true;
  sync.dueAt = options.immediate || blocked
    ? state.elapsed
    : Math.max(sync.lastFlushAt + intervalSeconds, state.elapsed + 0.001);
  return false;
}

function flushRemotePlayerRosterSync() {
  const sync = state.session.remoteVisualSync;
  if (
    !sync.pending
    || state.transitioningStage
    || state.loadingCharacter
    || state.mode === "loading"
    || state.elapsed < sync.dueAt
  ) {
    return false;
  }

  sync.pending = false;
  sync.dueAt = 0;
  sync.lastFlushAt = state.elapsed;
  sync.flushCount += 1;
  syncRemotePlayerRoster();
  return true;
}

function syncStartButtonState() {
  if (!dom.startBtn) {
    return;
  }

  if (!state.loaded) {
    dom.startBtn.disabled = true;
    dom.startBtn.textContent = "Varliklar Yukleniyor...";
    return;
  }

  if (multiplayer.status === "connecting" || state.transitioningStage) {
    dom.startBtn.disabled = true;
    dom.startBtn.textContent = "Baglaniyor...";
    return;
  }

  if (state.loadingCharacter) {
    dom.startBtn.disabled = true;
    dom.startBtn.textContent = "Karakter Yukleniyor...";
    return;
  }

  const playerName = sanitizePlayerName(dom.playerNameInput?.value || state.session.playerName);
  if (!playerName) {
    dom.startBtn.disabled = true;
    dom.startBtn.textContent = "Isim Gir";
    return;
  }

  if (!multiplayer.isConnected()) {
    dom.startBtn.disabled = false;
    dom.startBtn.textContent = "Lobiye Gir";
    return;
  }

  const { status, roundId, allowedRoundId } = state.session.match;
  dom.startBtn.disabled = true;
  if (status === "running") {
    dom.startBtn.textContent = allowedRoundId === roundId ? "Tur Basliyor" : "Tur Suruyor";
    return;
  }
  if (status === "finished") {
    dom.startBtn.textContent = "Reset Bekleniyor";
    return;
  }
  dom.startBtn.textContent = "Lobidesin";
}

function syncMultiplayerSummary() {
  const activeMapKey = getActiveMultiplayerMapKey();
  const totalPlayers = state.session.roster.length;
  const livePlayers = [...state.session.roster].sort((left, right) => {
    const leftPlace = Number(left.finishPlace || 0);
    const rightPlace = Number(right.finishPlace || 0);
    if (leftPlace && rightPlace) {
      return leftPlace - rightPlace;
    }
    if (leftPlace || rightPlace) {
      return leftPlace ? -1 : 1;
    }
    return (right.score?.total ?? 0) - (left.score?.total ?? 0);
  });
  state.session.remoteVisualSync.summaryIterationCount = livePlayers.length;
  const finisherCount = state.session.match.finishOrder.length;
  const finishPlace = state.session.match.finishPlace;

  if (dom.multiplayerCount) {
    dom.multiplayerCount.textContent = String(totalPlayers);
  }
  if (dom.realmCount) {
    dom.realmCount.textContent = String(totalPlayers);
  }
  if (dom.presenceLabel) {
    dom.presenceLabel.textContent = String(totalPlayers);
  }
  if (dom.realmStatus) {
    if (!multiplayer.isConnected()) {
      dom.realmStatus.textContent = "Bagli degil";
    } else if (state.session.match.status === "running") {
      dom.realmStatus.textContent = "Tur Canli";
    } else if (state.session.match.status === "finished") {
      dom.realmStatus.textContent = "Tur Bitti";
    } else {
      dom.realmStatus.textContent = `${stageLabels[activeMapKey] ?? activeMapKey} lobisi`;
    }
  }
  if (dom.realmMeta) {
    if (!multiplayer.isConnected()) {
      dom.realmMeta.textContent = "Ismini yazip lobbye baglan.";
    } else if (state.session.match.status === "running") {
      const leadName = livePlayers[0]?.name || "Oyuncular";
      dom.realmMeta.textContent = `${finisherCount} bitiren · lider ${leadName}`;
    } else if (state.session.match.status === "finished") {
      dom.realmMeta.textContent = `${finisherCount} oyuncu bitirdi · reset bekleniyor`;
    } else if (finishPlace > 0) {
      dom.realmMeta.textContent = `Son turda ${finishPlace}. oldun · yeni turu bekle`;
    } else {
      dom.realmMeta.textContent = `${totalPlayers} oyuncu lobbyde`;
    }
  }
  if (dom.multiplayerHelp) {
    if (!multiplayer.isConnected()) {
      dom.multiplayerHelp.textContent = "Ismini yaz, lobbye baglan ve adminin turu baslatmasini bekle.";
    } else if (state.session.match.status === "running") {
      dom.multiplayerHelp.textContent = state.session.match.allowedRoundId === state.session.match.roundId
        ? "Tur canli. Tum harfleri ilk toplayan 1. olur."
        : "Tur basladi. Bu roundu kacirdin; sonraki resetten sonra katilabilirsin.";
    } else if (state.session.match.status === "finished") {
      dom.multiplayerHelp.textContent = "Tur bitti. Admin resetleyince isim degistirip yeniden hazirlanabilirsin.";
    } else {
      dom.multiplayerHelp.textContent = "Lobbye baglandin. Admin baslatinca herkes ayni anda Sun Court'a girer.";
    }
  }
}

function syncMultiplayerStatusLabel(label, detail = "") {
  if (dom.multiplayerStatus) {
    dom.multiplayerStatus.textContent = label;
  }
  if (dom.multiplayerHelp) {
    dom.multiplayerHelp.textContent = detail || "Ismini yaz, baglanti kurulunca ayni sunucudaki oyunculari gorebilirsin.";
  }
}

/**
 * @deprecated Use getCachedRemoteLabelTexture and updateRemoteLabelTexture instead.
 * This function creates new textures each call, causing GC pressure.
 */
function buildRemotePlayerTexture(name, totalScore, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  drawRemoteLabelContent(context, name, totalScore, accent);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function getRemoteAccent(id) {
  let hash = 0;
  for (const char of String(id)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }

  const hue = Math.abs(hash) % 360;
  return new THREE.Color(`hsl(${hue} 78% 66%)`);
}

function createRemotePlayerVisual(player) {
  const accent = getRemoteAccent(player.id);
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.42, 1.8, 12),
    new THREE.MeshStandardMaterial({
      color: accent.clone().lerp(new THREE.Color("#ffffff"), 0.16),
      emissive: accent.clone().multiplyScalar(0.18),
      emissiveIntensity: 1.1,
      roughness: 0.52,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92,
    }),
  );
  body.position.y = 1.48;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 18, 14),
    new THREE.MeshStandardMaterial({
      color: "#ffe2c1",
      roughness: 0.72,
      metalness: 0.02,
    }),
  );
  head.position.y = 2.72;

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.08, 10, 28),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.78,
    }),
  );
  halo.position.y = 0.12;
  halo.rotation.x = Math.PI / 2;

  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.54, 12),
    new THREE.MeshBasicMaterial({
      color: accent.clone().lerp(new THREE.Color("#ffffff"), 0.25),
      transparent: true,
      opacity: 0.92,
    }),
  );
  beacon.position.y = 3.45;

  group.add(body, head, halo, beacon);
  group.position.set(player.position.x, getStageFloorHeight(player.position.x, player.position.z), player.position.z);
  group.rotation.y = player.position.heading;
  group.userData.labelKey = "";
  group.userData.label = null;
  group.userData.halo = halo;
  group.userData.beacon = beacon;
  group.userData.texture = null;
  group.userData.targetPosition = new THREE.Vector3(player.position.x, group.position.y, player.position.z);
  group.userData.targetHeading = player.position.heading;
  remotePlayerGroup.add(group);

  return group;
}

function disposeRemotePlayerLabel(visual) {
  const label = visual?.userData?.label;
  if (!label) {
    visual.userData.labelKey = "";
    visual.userData.textureEntry = null;
    return;
  }

  // Note: We don't dispose the cached texture here because it's shared
  // and managed by remoteLabelTextureCache. The cache handles eviction.
  label.material?.dispose?.();
  visual.remove(label);
  visual.userData.label = null;
  visual.userData.labelKey = "";
  visual.userData.textureEntry = null;
}

function syncRemotePlayerLabel(visual, player, visible = true) {
  if (!visual) {
    return;
  }

  if (!visible) {
    disposeRemotePlayerLabel(visual);
    return;
  }

  const score = player.score?.total ?? 0;
  const labelKey = `${player.name}:${score}`;
  const accent = getRemoteAccent(player.id).getStyle();

  if (!visual.userData.label) {
    // Use cached texture to reduce GC pressure
    const entry = getCachedRemoteLabelTexture(player.id, player.name, score, accent);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: entry.texture,
      transparent: true,
      depthWrite: false,
    }));
    label.position.y = 4.4;
    label.scale.set(4.4, 1.46, 1);
    visual.userData.label = label;
    visual.userData.labelKey = labelKey;
    visual.userData.textureEntry = entry;
    visual.add(label);
    return;
  }

  if (visual.userData.labelKey !== labelKey) {
    // Update existing cached texture instead of creating new one
    const entry = visual.userData.textureEntry;
    if (entry) {
      updateRemoteLabelTexture(entry, player.name, score, accent);
    } else {
      // Fallback: get from cache
      const newEntry = getCachedRemoteLabelTexture(player.id, player.name, score, accent);
      visual.userData.label.material.map = newEntry.texture;
      visual.userData.label.material.needsUpdate = true;
      visual.userData.textureEntry = newEntry;
    }
    visual.userData.labelKey = labelKey;
  }
}

function removeRemotePlayerVisual(playerId) {
  const visual = state.session.remotePlayers.get(playerId);
  if (!visual) {
    return;
  }

  // Skip label texture disposal - it's cached and managed by remoteLabelTextureCache
  visual.traverse((node) => {
    if (node.isSprite) {
      // Don't dispose cached label textures - let the cache handle them
      node.material?.dispose?.();
    } else {
      // Dispose geometry and material for body, head, halo, beacon
      if (node.material?.map) {
        node.material.map.dispose?.();
      }
      node.material?.dispose?.();
      node.geometry?.dispose?.();
    }
  });
  remotePlayerGroup.remove(visual);
  state.session.remotePlayers.delete(playerId);
}

function syncRemotePlayerRoster(players = state.session.roster) {
  const budget = getRemoteRenderBudget();
  const prioritizedPlayers = getVisibleRemoteRosterPlayers(players, budget);
  const visibleIds = new Set();

  prioritizedPlayers.forEach((player, index) => {
    visibleIds.add(player.id);
    let visual = state.session.remotePlayers.get(player.id);
    if (!visual) {
      visual = createRemotePlayerVisual(player);
      state.session.remotePlayers.set(player.id, visual);
    }

    const floor = getStageFloorHeight(player.position.x, player.position.z);
    visual.userData.targetPosition.set(player.position.x, floor, player.position.z);
    visual.userData.targetHeading = player.position.heading;
    syncRemotePlayerLabel(visual, player, index < budget.labelCap);
  });

  [...state.session.remotePlayers.keys()].forEach((playerId) => {
    if (!visibleIds.has(playerId)) {
      removeRemotePlayerVisual(playerId);
    }
  });
}

function updateRemotePlayers(delta) {
  state.session.remotePlayers.forEach((visual) => {
    const targetPosition = visual.userData.targetPosition;
    const halo = visual.userData.halo;
    const beacon = visual.userData.beacon;
    visual.position.lerp(targetPosition, 1 - Math.exp(-delta * 8));
    visual.rotation.y = THREE.MathUtils.lerp(
      visual.rotation.y,
      visual.userData.targetHeading,
      1 - Math.exp(-delta * 10),
    );
    if (halo) {
      halo.rotation.z += delta * 0.9;
    }
    if (beacon) {
      beacon.position.y = 3.45 + Math.sin(state.elapsed * 3.4) * 0.12;
    }
  });
}

function buildMultiplayerSnapshot() {
  return {
    mode: state.mode,
    roundId: state.session.match.roundId,
    characterId: state.session.selectedCharacterId,
    currentMap: getActiveMultiplayerMapKey(),
    stageKey: state.world.stageKey,
    player: {
      characterId: state.player.characterId,
      x: Number(state.player.position.x.toFixed(2)),
      z: Number(state.player.position.z.toFixed(2)),
      heading: Number(state.player.heading.toFixed(3)),
    },
    stats: {
      level: state.stats.level,
      xp: Math.round(state.stats.xp),
      gold: Math.round(state.stats.gold),
      collectedCount: state.collectedCount,
    },
    collectedCount: state.collectedCount,
  };
}

function sendMultiplayerSnapshot(force = false) {
  if (!multiplayer.isConnected()) {
    return;
  }

  if (!force && state.session.snapshotTimer < getSnapshotIntervalSeconds()) {
    return;
  }

  state.session.snapshotTimer = 0;
  multiplayer.sendSnapshot(buildMultiplayerSnapshot());
}

async function ensureMultiplayerReady() {
  const playerName = sanitizePlayerName(dom.playerNameInput?.value || state.session.playerName);
  if (!playerName) {
    throw new Error("Karakter adi girmelisin.");
  }

  state.session.playerName = storePlayerName(playerName);
  if (dom.playerNameInput) {
    dom.playerNameInput.value = state.session.playerName;
  }

  const connection = await multiplayer.connect({
    name: state.session.playerName,
    mapKey: state.world.selectedMap || getSelectedMap(),
    characterId: state.session.selectedCharacterId,
  });
  state.session.playerId = connection.playerId || multiplayer.playerId || "";
  sendMultiplayerSnapshot(true);
}

function syncWinPlacement(place) {
  state.session.match.finishPlace = place > 0 ? place : 0;
  if (!dom.winCopy) {
    return;
  }

  dom.winCopy.textContent = place > 0
    ? `${state.totalCollectibles} harfin tamami toplandi. ${place}. oldun. Admin resetleyince yeni tura doneceksin.`
    : `${state.totalCollectibles} harfin tamami toplandi. Siralama hesaplaniyor.`;
}

async function handleMatchState(detail = {}) {
  const previousRoundId = state.session.match.roundId;
  const previousStatus = state.session.match.status;
  const activeRoundId = state.session.match.activeRoundId;
  const nextRoundId = Number(detail.roundId ?? 0) || 0;

  state.session.match = {
    ...state.session.match,
    status: String(detail.status ?? state.session.match.status ?? "lobby"),
    roundId: nextRoundId,
    totalLetters: Number(detail.totalLetters ?? state.session.match.totalLetters ?? totalLetterCount) || totalLetterCount,
    finishOrder: Array.isArray(detail.finishOrder) ? detail.finishOrder : [],
    allowedRoundId: Number(detail.allowedRoundId ?? state.session.match.allowedRoundId ?? 0) || 0,
    finishPlace: nextRoundId !== previousRoundId ? 0 : state.session.match.finishPlace,
  };

  syncMultiplayerSummary();
  syncStartButtonState();

  if (state.session.match.status === "lobby") {
    state.session.match.activeRoundId = 0;
    if (state.mode !== "menu" || previousStatus !== "lobby") {
      await resetGame(true);
      showToast("Tur lobbye dondu. Ismini degistirip tekrar hazirlanabilirsin.", 10000);
    }
    return;
  }

  if (
    state.session.match.status === "running"
    && state.session.match.allowedRoundId === state.session.match.roundId
    && state.session.match.roundId !== activeRoundId
  ) {
    state.session.match.activeRoundId = state.session.match.roundId;
    state.session.match.finishPlace = 0;
    unlockAudio();
    void requestMobileImmersiveMode({ toast: false });
    await resetGame(false);
    showToast("Admin turu baslatti. Harfleri toplamaya basla.", 10000);
    sendMultiplayerSnapshot(true);
  }
}

function attachMultiplayerEvents() {
  multiplayer.addEventListener("statuschange", (event) => {
    const { status, detail, label } = event.detail;
    state.session.connectionStatus = status;
    state.session.connectionDetail = detail;
    syncMultiplayerStatusLabel(label, detail);
    syncMultiplayerSummary();
    syncStartButtonState();
  });

  multiplayer.addEventListener("welcome", (event) => {
    state.session.playerId = event.detail.playerId || multiplayer.playerId || "";
    syncMultiplayerSummary();
  });

  multiplayer.addEventListener("roster", (event) => {
    const roster = event.detail.players ?? [];
    if (state.transitioningStage || state.loadingCharacter || state.mode === "loading") {
      state.session.pendingRoster = roster;
      syncMultiplayerSummary();
      return;
    }
    state.session.roster = roster;
    state.session.pendingRoster = null;
    syncMultiplayerSummary();
    scheduleRemotePlayerRosterSync("roster-event", { countEvent: true });
  });

  multiplayer.addEventListener("announcement", (event) => {
    if (event.detail.message) {
      state.message = event.detail.message;
      showToast(event.detail.message, event.detail.durationMs || 10000);
    }
  });

  multiplayer.addEventListener("matchstate", (event) => {
    void handleMatchState(event.detail);
  });

  multiplayer.addEventListener("finish", (event) => {
    if (event.detail.playerId === state.session.playerId) {
      syncWinPlacement(Number(event.detail.place ?? 0) || 0);
      showToast(`Butun harfleri topladin. ${event.detail.place}. oldun.`, 10000);
    }
  });

  multiplayer.addEventListener("disconnect", (event) => {
    state.session.playerId = "";
    state.session.roster = [];
    state.session.pendingRoster = null;
    state.session.match = {
      ...state.session.match,
      status: "lobby",
      roundId: 0,
      finishOrder: [],
      allowedRoundId: 0,
      activeRoundId: 0,
      finishPlace: 0,
    };
    syncRemotePlayerRoster([]);
    syncMultiplayerSummary();
    if (event.detail.wasConnected && event.detail.reason) {
      state.message = event.detail.reason;
      showToast(event.detail.reason);
    }
  });

  multiplayer.addEventListener("kicked", async (event) => {
    state.session.playerId = "";
    state.session.roster = [];
    state.session.pendingRoster = null;
    state.session.match = {
      ...state.session.match,
      status: "lobby",
      roundId: 0,
      finishOrder: [],
      allowedRoundId: 0,
      activeRoundId: 0,
      finishPlace: 0,
    };
    syncRemotePlayerRoster([]);
    syncMultiplayerSummary();
    syncMultiplayerStatusLabel("Cikarildin", event.detail.reason);
    showToast(event.detail.reason, 10000);
    await resetGame(true);
  });
}

function getStageKey(stageKey = state.world.stageKey) {
  return stageLetterRanges[stageKey] ? stageKey : "sunCourt";
}

function getNextStage(stageKey = state.world.stageKey) {
  const resolvedStage = getStageKey(stageKey);
  const index = stageOrder.indexOf(resolvedStage);
  return index >= 0 ? stageOrder[index + 1] ?? null : null;
}

function getStageLetterPool(stageKey = state.world.stageKey) {
  const [start, end] = stageLetterRanges[getStageKey(stageKey)] ?? [0, letterAssets.length];
  const source = state.letterTextures.length ? state.letterTextures : letterAssets;
  return source.slice(start, end);
}

function getTargetCollectibleCount(stageKey = state.world.stageKey) {
  const pool = getStageLetterPool(stageKey);
  return pool.length;
}

function getOverallTargetCollectibleCount() {
  return stageOrder.reduce((sum, stageKey) => sum + getTargetCollectibleCount(stageKey), 0);
}

function getRemainingCollectibleCount() {
  return state.collectibles.reduce((sum, collectible) => sum + (collectible.collected ? 0 : 1), 0);
}

function clampPointToWorldBounds(x, z) {
  return {
    x: THREE.MathUtils.clamp(x, state.world.bounds.minX, state.world.bounds.maxX),
    z: THREE.MathUtils.clamp(z, state.world.bounds.minZ, state.world.bounds.maxZ),
  };
}

function getHeightZoneValue(zone, x, z) {
  if (zone.type !== "ramp") {
    return zone.height;
  }

  const range = zone.axis === "x"
    ? Math.max(zone.maxX - zone.minX, 0.001)
    : Math.max(zone.maxZ - zone.minZ, 0.001);
  const rawProgress = zone.axis === "x"
    ? (x - zone.minX) / range
    : (z - zone.minZ) / range;
  const progress = THREE.MathUtils.clamp(zone.reverse ? 1 - rawProgress : rawProgress, 0, 1);
  return THREE.MathUtils.lerp(zone.fromHeight, zone.toHeight, progress);
}

function getStageFloorHeight(x, z) {
  let floorHeight = state.world.floorTop;
  let bestPriority = -Infinity;

  state.world.heightZones.forEach((zone) => {
    if (x < zone.minX || x > zone.maxX || z < zone.minZ || z > zone.maxZ) {
      return;
    }

    if (zone.priority < bestPriority) {
      return;
    }

    floorHeight = getHeightZoneValue(zone, x, z);
    bestPriority = zone.priority;
  });

  return floorHeight;
}

function applyPlayerFloorHeight() {
  state.player.position.y = getStageFloorHeight(state.player.position.x, state.player.position.z);
}

function clearMoveTarget() {
  state.moveTarget = null;
}

function setMoveTarget(x, z, options = {}) {
  const clamped = clampPointToWorldBounds(x, z);
  state.moveTarget = {
    x: clamped.x,
    z: clamped.z,
    source: options.source ?? "click",
  };

  if (options.silent) {
    return true;
  }

  state.message = options.message ?? "Hedef nokta secildi";
  return true;
}

function setMoveTargetFromPointer(event) {
  const rect = dom.canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  helper.pointerVector.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  );
  helper.raycaster.setFromCamera(helper.pointerVector, camera);
  helper.groundPlane.constant = -state.player.position.y;

  if (!helper.raycaster.ray.intersectPlane(helper.groundPlane, helper.planeIntersection)) {
    return false;
  }

  return setMoveTarget(helper.planeIntersection.x, helper.planeIntersection.z, {
    source: "click",
    message: "Sol tik hedefi ayarlandi",
  });
}

function getMouseButtonMask(button) {
  if (button === 0) {
    return 1;
  }
  if (button === 1) {
    return 4;
  }
  if (button === 2) {
    return 2;
  }
  return 0;
}

function toggleAutoAttack(force) {
  const nextValue = typeof force === "boolean" ? force : !state.autoAttackEnabled;
  state.autoAttackEnabled = nextValue;
  state.message = nextValue ? "Otomatik saldiri acildi" : "Otomatik saldiri kapatildi";
  showToast(nextValue ? "Oto saldiri acik" : "Oto saldiri kapali");
  return nextValue;
}

function isGameplayInputBlocked() {
  return state.mode !== "playing"
    || state.ui.settingsVisible
    || state.ui.letterCardVisible
    || (state.ui.mobileImmersivePromptVisible && !state.ui.mobileLandscape);
}

function stopLetterCardSpeech() {
  if (audioState.speechPendingTimeoutId) {
    window.clearTimeout(audioState.speechPendingTimeoutId);
    audioState.speechPendingTimeoutId = 0;
  }

  if (audioState.speechFallbackTimeoutId) {
    window.clearTimeout(audioState.speechFallbackTimeoutId);
    audioState.speechFallbackTimeoutId = 0;
  }

  const speech = getSpeechApi();
  if (!speech) {
    setLetterCardSpeakingIndicator(false);
    return;
  }

  if (speech.speaking || speech.pending || speech.paused) {
    speech.cancel();
  }
  setLetterCardSpeakingIndicator(false);
}

function refreshSpeechVoices() {
  const speech = getSpeechApi();
  if (!speech?.getVoices) {
    audioState.speechVoices = [];
    return audioState.speechVoices;
  }

  audioState.speechVoices = speech.getVoices();
  return audioState.speechVoices;
}

function getSpeechApi() {
  return window.speechSynthesis ?? globalThis.speechSynthesis ?? null;
}

function getSpeechUtteranceCtor() {
  return window.SpeechSynthesisUtterance ?? globalThis.SpeechSynthesisUtterance ?? null;
}

function ensureSpeechSynthesisSetup() {
  const speech = getSpeechApi();
  if (!speech || !getSpeechUtteranceCtor()) {
    return false;
  }

  if (!audioState.speechVoicesBound && speech.addEventListener) {
    speech.addEventListener("voiceschanged", () => {
      refreshSpeechVoices();
      audioState.speechPrimed = true;
    });
    audioState.speechVoicesBound = true;
  }

  refreshSpeechVoices();

  if (!audioState.speechVoices.length) {
    window.setTimeout(() => {
      audioState.speechVoices = speech.getVoices?.() ?? [];
    }, 300);
  }

  return true;
}

function primeSpeechSynthesis() {
  if (!ensureSpeechSynthesisSetup()) {
    return false;
  }

  if (audioState.speechPrimed || audioState.speechPrimerTimeoutId) {
    return true;
  }

  audioState.speechPrimerTimeoutId = window.setTimeout(() => {
    audioState.speechPrimed = true;
    audioState.speechPrimerTimeoutId = 0;
  }, 180);

  try {
    const SpeechUtterance = getSpeechUtteranceCtor();
    const speech = getSpeechApi();
    if (!SpeechUtterance || !speech) {
      throw new Error("speech-unavailable");
    }
    const primer = new SpeechUtterance(".");
    primer.volume = 0.01;
    primer.rate = 1;
    primer.pitch = 1;
    primer.lang = "tr-TR";
    const finalize = () => {
      if (audioState.speechPrimerTimeoutId) {
        window.clearTimeout(audioState.speechPrimerTimeoutId);
        audioState.speechPrimerTimeoutId = 0;
      }
      audioState.speechPrimed = true;
      startSpeechRestartTimer();
    };
    primer.onend = finalize;
    primer.onerror = finalize;
    if (speech.speaking || speech.pending || speech.paused) {
      speech.cancel();
    }
    if (speech.paused) {
      speech.resume?.();
    }
    speech.speak(primer);
  } catch {
    if (audioState.speechPrimerTimeoutId) {
      window.clearTimeout(audioState.speechPrimerTimeoutId);
      audioState.speechPrimerTimeoutId = 0;
    }
    audioState.speechPrimed = true;
  }

  return true;
}

function startSpeechRestartTimer() {
  if (audioState.speechRestartTimerStarted) {
    return;
  }
  audioState.speechRestartTimerStarted = true;
  audioState.speechRestartStallCount = 0;

  audioState.speechRestartIntervalId = window.setInterval(() => {
    const speech = getSpeechApi();
    if (!speech) {
      stopSpeechRestartTimer();
      return;
    }

    if (speech.paused) {
      speech.resume?.();
      audioState.speechRestartStallCount = 0;
      return;
    }

    if (speech.speaking) {
      audioState.speechRestartStallCount = 0;
      return;
    }

    audioState.speechRestartStallCount += 1;
    if (audioState.speechRestartStallCount > 10) {
      stopSpeechRestartTimer();
    }
  }, 7000);
}

function stopSpeechRestartTimer() {
  if (audioState.speechRestartIntervalId) {
    window.clearInterval(audioState.speechRestartIntervalId);
    audioState.speechRestartIntervalId = 0;
  }
  audioState.speechRestartTimerStarted = false;
  audioState.speechRestartStallCount = 0;
}

function setLetterCardSpeakingIndicator(active) {
  if (!dom) {
    return;
  }
  const cardShell = dom.letterCardShell;
  if (!cardShell) {
    return;
  }
  if (active) {
    cardShell.classList.add("is-speaking");
  } else {
    cardShell.classList.remove("is-speaking");
  }
}

function isArabicVoiceAvailable() {
  const voice = getArabicSpeechVoice();
  return !!voice;
}

function getSpeechVoice(prefixes = []) {
  if (!getSpeechApi()?.getVoices) {
    return null;
  }

  const voices = audioState.speechVoices.length ? audioState.speechVoices : refreshSpeechVoices();
  const normalizedPrefixes = prefixes
    .map((prefix) => String(prefix ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (!normalizedPrefixes.length) {
    return voices[0] ?? null;
  }
  return voices.find((voice) => normalizedPrefixes.some((prefix) => voice.lang?.toLowerCase().startsWith(prefix))) ?? null;
}

function getArabicSpeechVoice() {
  return getSpeechVoice(["ar"]);
}

const arabicHarakaSpeechLabels = {
  Fetha: "فَتْحَة",
  Kesra: "كَسْرَة",
  Damma: "ضَمَّة",
};

function getArabicSpeechText(sample) {
  const explicit = String(sample?.spokenArabic ?? "").trim();
  if (explicit) {
    return explicit;
  }

  const arabicText = String(sample?.arabic ?? sample?.word ?? sample?.text ?? "").trim();
  if (!arabicText) {
    return "";
  }

  const letterNameAr = String(sample?.letterNameAr ?? sample?.nameAr ?? "").trim();
  const harakaLabel = arabicHarakaSpeechLabels[String(sample?.label ?? "").trim()] ?? "";

  if (String(sample?.label ?? "").trim() === "Harf" && letterNameAr) {
    return letterNameAr;
  }

  if (harakaLabel && letterNameAr) {
    return `${letterNameAr} ${harakaLabel} ${arabicText}`;
  }

  if (letterNameAr && arabicText.length <= 2) {
    return `${letterNameAr} ${arabicText}`;
  }

  return arabicText;
}

function speakSpeechLine(text, options = {}) {
  if (!text) {
    return false;
  }

  const speech = getSpeechApi();
  const SpeechUtterance = getSpeechUtteranceCtor();
  if (!speech || !SpeechUtterance) {
    if (options.warnOnUnsupported) {
      showToast("Tarayici sesli okunusu desteklemiyor");
    }
    return false;
  }

  if (options.cancelExisting !== false) {
    stopLetterCardSpeech();
  }

  if (options.message) {
    state.message = options.message;
  }

  const candidates = [
    {
      text,
      voice: options.voice ?? null,
      voicePrefixes: options.voice ? [] : (options.voicePrefixes ?? []),
      lang: options.lang,
      rate: options.rate ?? 0.76,
      pitch: options.pitch ?? 1,
      volume: options.volume ?? 1,
      stallMs: options.immediate ? Math.min(options.stallMs ?? 220, 220) : (options.stallMs ?? 520),
    },
    ...((options.fallbacks ?? []).map((candidate) => {
      if (!candidate?.text) {
        return null;
      }
      return {
        text: candidate.text,
        voice: candidate.voice ?? null,
        voicePrefixes: candidate.voice ? [] : (candidate.voicePrefixes ?? []),
        lang: candidate.lang ?? options.lang,
        rate: candidate.rate ?? options.rate ?? 0.76,
        pitch: candidate.pitch ?? options.pitch ?? 1,
        volume: candidate.volume ?? options.volume ?? 1,
        stallMs: candidate.stallMs ?? 0,
      };
    }).filter(Boolean)),
  ];

  const speakCandidate = (index) => {
    if (index >= candidates.length) {
      return false;
    }

    const candidate = candidates[index];
    const utterance = new SpeechUtterance(candidate.text);
    const voice = candidate.voice
      ?? ((candidate.voicePrefixes?.length ?? 0) > 0 ? getSpeechVoice(candidate.voicePrefixes) : null);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else if (candidate.lang) {
      utterance.lang = candidate.lang;
    }
    utterance.rate = candidate.rate;
    utterance.pitch = candidate.pitch;
    utterance.volume = candidate.volume;
    let started = false;
    const clearFallbackTimer = () => {
      if (audioState.speechFallbackTimeoutId) {
        window.clearTimeout(audioState.speechFallbackTimeoutId);
        audioState.speechFallbackTimeoutId = 0;
      }
    };
    utterance.onstart = () => {
      started = true;
      clearFallbackTimer();
      audioState.speechPrimed = true;
      setLetterCardSpeakingIndicator(true);
    };
    utterance.onend = () => {
      clearFallbackTimer();
      setLetterCardSpeakingIndicator(false);
    };
    utterance.onerror = () => {
      clearFallbackTimer();
      setLetterCardSpeakingIndicator(false);
      if (!started) {
        speakCandidate(index + 1);
      }
    };
    if (candidate.stallMs > 0 && index + 1 < candidates.length) {
      audioState.speechFallbackTimeoutId = window.setTimeout(() => {
        audioState.speechFallbackTimeoutId = 0;
        if (started) {
          return;
        }
        speech.cancel();
        speakCandidate(index + 1);
      }, candidate.stallMs);
    }
    if (speech.paused) {
      speech.resume?.();
    }
    speech.speak(utterance);
    return true;
  };

  if (options.immediate) {
    ensureSpeechSynthesisSetup();
    audioState.speechPrimed = true;
    setLetterCardSpeakingIndicator(true);
    const started = speakCandidate(0);
    if (!started) {
      setLetterCardSpeakingIndicator(false);
    }
    return started;
  }

  primeSpeechSynthesis();
  const delay = options.delay ?? (audioState.speechPrimed ? 42 : 190);
  audioState.speechPendingTimeoutId = window.setTimeout(() => {
    audioState.speechPendingTimeoutId = 0;
    speakCandidate(0);
  }, delay);
  return true;
}

function speakLetterCardPronunciation(sample, options = {}) {
  const arabicText = getArabicSpeechText(sample);
  if (!arabicText) {
    return false;
  }

  const detail = sample.latin ?? sample.transliteration ?? sample.meaning ?? "";
  const latinFallback = String(detail || "")
    .split("·")[0]
    .trim();
  const arabicVoice = getArabicSpeechVoice();

  if (!arabicVoice && !audioState._arabicVoiceWarningShown) {
    audioState._arabicVoiceWarningShown = true;
    showToast("Arapca ses bulunamadi, tarayici varsayilani deneniyor");
  }

  return speakSpeechLine(arabicText, {
    voice: arabicVoice,
    lang: "ar-SA",
    rate: 0.76,
    pitch: 1,
    warnOnUnsupported: true,
    immediate: options.immediate ?? false,
    message: detail ? `${sample.label} okunusu: ${detail}` : `${sample.label} okunusu`,
    fallbacks: latinFallback
      ? [
        {
          text: latinFallback,
          voicePrefixes: ["tr", "en"],
          lang: "tr-TR",
          rate: 0.9,
          pitch: 1.02,
          stallMs: 0,
        },
      ]
      : [],
  });
}

function announceCollectedLetter(collectible) {
  const letterName = collectible?.meta?.nameTr ?? collectible?.label;
  if (!letterName) {
    return false;
  }

  unlockAudio();
  return speakSpeechLine(`${letterName} harfini buldun`, {
    voicePrefixes: ["tr"],
    lang: "tr-TR",
    rate: 0.94,
    pitch: 1.02,
  });
}

function playActiveLetterExampleWord() {
  const card = state.ui.activeLetterCard;
  const example = card?.example;
  if (!card || !example?.word) {
    return false;
  }

  ensureSpeechSynthesisSetup();
  return speakLetterCardPronunciation({
    label: "Ornek kelime",
    arabic: example.word,
    spokenArabic: example.word,
    latin: `${example.transliteration} · ${example.meaning}`,
  }, { immediate: true });
}

function playActiveLetterGlyph() {
  const card = state.ui.activeLetterCard;
  if (!card) {
    return false;
  }

  ensureSpeechSynthesisSetup();
  return speakLetterCardPronunciation({
    label: "Harf",
    arabic: card.nameAr || card.forms?.isolated || card.symbol,
    spokenArabic: card.nameAr || card.forms?.isolated || card.symbol,
    nameAr: card.nameAr,
    latin: `${card.nameTr} · ${card.latinName}`,
  }, { immediate: true });
}

function clearPendingLetterCardReveal() {
  if (state.ui.pendingLetterCardTimeoutId) {
    window.clearTimeout(state.ui.pendingLetterCardTimeoutId);
    state.ui.pendingLetterCardTimeoutId = 0;
  }
}

function scheduleLetterCardReveal(meta, imageHref, delay = 500) {
  if (!meta) {
    return false;
  }

  clearPendingLetterCardReveal();
  state.ui.pendingLetterCardTimeoutId = window.setTimeout(() => {
    state.ui.pendingLetterCardTimeoutId = 0;
    openLetterCard(meta, imageHref);
  }, delay);
  return true;
}

function renderLetterCardUi() {
  const card = state.ui.activeLetterCard;
  const visible = Boolean(state.ui.letterCardVisible && card);
  dom.letterCardShell.classList.toggle("is-open", visible);
  dom.letterCardShell.setAttribute("aria-hidden", visible ? "false" : "true");

  if (!visible) {
    return;
  }

  ensureSpeechSynthesisSetup();
  dom.letterCardImage.src = card.imageHref;
  dom.letterCardImage.alt = `${card.nameTr} harf gorseli`;
  dom.letterCardGlyphButton?.setAttribute("aria-label", `${card.nameTr} harfini dinle`);
  dom.letterCardName.textContent = `${card.nameAr} · ${card.nameTr}`;
  dom.letterCardTitle.textContent = card.nameTr;
  dom.letterCardDescription.textContent = card.description;
  dom.letterCardExampleImage.src = card.exampleImage;
  dom.letterCardExampleImage.alt = `${card.example.meaning} gorseli`;
  dom.letterCardExampleButton.setAttribute("aria-label", `${card.example.word} kelimesini dinle`);
  dom.letterCardExampleAudio.setAttribute("aria-label", `${card.example.word} kelimesini dinle`);

  const facts = [
    { label: "Baglanma", value: card.joinRule },
    { label: "Latin", value: card.latinName },
    { label: "Semsi / Kameri", value: card.sunMoon?.label ?? "Belirsiz", note: card.sunMoon?.note ?? "" },
    { label: "Ince / Kalin", value: card.thickness?.label ?? "Belirsiz", note: card.thickness?.note ?? "" },
  ];
  dom.letterCardFacts.replaceChildren();
  facts.forEach((fact) => {
    const cell = document.createElement("div");
    cell.className = "letter-card__fact";
    cell.innerHTML = `
      <span>${fact.label}</span>
      <strong>${fact.value}</strong>
      ${fact.note ? `<small>${fact.note}</small>` : ""}
    `;
    dom.letterCardFacts.append(cell);
  });

  dom.letterCardAudioButtons.replaceChildren();
  card.pronunciations.forEach((sample) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <span class="letter-card__speaker-icon" aria-hidden="true">🔊</span>
      <span class="letter-card__audio-title">${sample.label}</span>
      <strong>${sample.arabic}</strong>
      <span class="letter-card__audio-latin">${sample.latin}</span>
    `;
    button.addEventListener("click", () => {
      ensureSpeechSynthesisSetup();
      speakLetterCardPronunciation({
        ...sample,
        letterNameAr: card.nameAr,
      }, { immediate: true });
    });
    dom.letterCardAudioButtons.append(button);
  });

  const formEntries = [
    ["Tek Basina", card.forms.isolated],
    ["Basta", card.forms.initial],
    ["Ortada", card.forms.medial],
    ["Sonda", card.forms.final],
  ];

  dom.letterCardFormsGrid.replaceChildren();
  formEntries.forEach(([label, value]) => {
    const cell = document.createElement("div");
    cell.className = "letter-card__form-cell";
    const renderedValue = value ?? "Baglanmaz";
    cell.innerHTML = `
      <span>${label}</span>
      <strong class="${value ? "" : "is-muted"}">${renderedValue}</strong>
    `;
    dom.letterCardFormsGrid.append(cell);
  });

  const cardPanel = dom.letterCardShell?.querySelector(".letter-card");
  cardPanel?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  if (cardPanel) {
    cardPanel.scrollTop = 0;
  }
  dom.letterCardClose?.focus?.({ preventScroll: true });
}

function openLetterCard(meta, imageHref) {
  if (!meta) {
    return false;
  }

  clearPendingLetterCardReveal();
  clearMoveTarget();
  state.keys.clear();
  state.player.attackHeld = false;
  state.player.crouchHeld = false;
  state.ui.activeLetterCard = {
    ...meta,
    imageHref,
    joinRule: getJoinRuleText(meta),
    exampleImage: buildExampleIllustrationDataUrl(meta),
  };
  state.ui.letterCardVisible = true;
  state.message = `${meta.nameTr} karti acildi`;
  renderLetterCardUi();
  return true;
}

function closeLetterCard(options = {}) {
  const hadPendingReveal = state.ui.pendingLetterCardTimeoutId !== 0;
  if (!state.ui.letterCardVisible && !hadPendingReveal) {
    return false;
  }

  clearPendingLetterCardReveal();
  stopLetterCardSpeech();
  state.ui.letterCardVisible = false;
  state.ui.activeLetterCard = null;
  renderLetterCardUi();

  if (!options.silent) {
    state.message = "Harf karti kapatildi";
  }

  return true;
}

function applySimulationSnapshot(snapshot, options = {}) {
  if (!snapshot) {
    return;
  }

  const applyPosition = options.applyPosition ?? true;
  const applyMotionAmount = options.applyMotionAmount ?? applyPosition;
  const applyTargets = options.applyTargets ?? true;

  if (applyPosition) {
    state.player.position.set(snapshot.position.x, state.player.position.y, snapshot.position.z);
    applyPlayerFloorHeight();
  }
  if (applyMotionAmount && typeof snapshot.motionAmount === "number") {
    state.player.motionAmount = THREE.MathUtils.clamp(snapshot.motionAmount / Math.max(state.player.speed, 0.001), 0, 1);
  }
  if (applyTargets) {
    state.nearestId = snapshot.nearestCollectibleId ?? null;
    state.nearestDistance = Number.isFinite(snapshot.nearestCollectibleDistance) ? snapshot.nearestCollectibleDistance : null;
    state.nearestChestId = snapshot.nearestChestId ?? null;
    state.nearestChestDistance = Number.isFinite(snapshot.nearestChestDistance) ? snapshot.nearestChestDistance : null;
  }

  if (applyPosition && state.player.model) {
    state.player.model.position.copy(state.player.position);
  }
}

function updateInteractionTargets() {
  let nearestCollectible = null;
  let nearestCollectibleDistance = Infinity;
  state.collectibles.forEach((collectible) => {
    if (collectible.collected) {
      return;
    }
    const distance = Math.hypot(collectible.x - state.player.position.x, collectible.z - state.player.position.z);
    if (distance < nearestCollectibleDistance) {
      nearestCollectibleDistance = distance;
      nearestCollectible = collectible;
    }
  });

  state.nearestId = nearestCollectible?.id ?? null;
  state.nearestDistance = nearestCollectible ? nearestCollectibleDistance : null;

  let nearestChest = null;
  let nearestChestDistance = Infinity;
  state.chests.forEach((chest) => {
    if (chest.opened) {
      return;
    }
    const distance = Math.hypot(chest.x - state.player.position.x, chest.z - state.player.position.z);
    if (distance < nearestChestDistance) {
      nearestChestDistance = distance;
      nearestChest = chest;
    }
  });

  state.nearestChestId = nearestChest?.id ?? null;
  state.nearestChestDistance = nearestChest ? nearestChestDistance : null;
}

async function debugSetPlayerPosition(x, z, heading = state.player.heading) {
  const clamped = clampPointToWorldBounds(x, z);
  state.player.position.set(clamped.x, state.world.floorTop, clamped.z);
  applyPlayerFloorHeight();
  state.player.heading = heading;

  if (state.player.model) {
    state.player.model.position.copy(state.player.position);
    state.player.model.rotation.y = state.player.heading;
  }

  updateInteractionTargets();
  updateZoneLabel();
  updateTreasureChests(0);
  snapCameraToPlayer();

  if (simulationState.ready) {
    await requestSimulationReset(state.player.position);
    await refreshSimulationQuery();
  }

  updateTreasureChests(0);
  updateOverlays(0, true);
  return JSON.parse(renderGameToText());
}

async function debugInteractNearest() {
  interactWithNearestChest();

  if (simulationState.ready) {
    await flushSimulation();
    await refreshSimulationQuery();
  }

  updateInteractionTargets();
  updateZoneLabel();
  updateTreasureChests(0);
  updateOverlays(0, true);
  return JSON.parse(renderGameToText());
}

async function debugCollectNearestLetter() {
  const collectible = state.collectibles.find((entry) => entry.id === state.nearestId && !entry.collected)
    ?? state.collectibles
      .filter((entry) => !entry.collected)
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.x - state.player.position.x, left.z - state.player.position.z);
        const rightDistance = Math.hypot(right.x - state.player.position.x, right.z - state.player.position.z);
        return leftDistance - rightDistance;
      })[0];

  if (!collectible) {
    return JSON.parse(renderGameToText());
  }

  collectible.barrierHp = 0;
  collectible.breakFlashUntil = state.elapsed + 0.32;
  applyCollectibleBarrierVisuals(collectible);
  collectOne(collectible, "#ffd873");

  if (simulationState.ready) {
    await flushSimulation();
    await refreshSimulationQuery();
  }

  updateInteractionTargets();
  updateZoneLabel();
  updateOverlays(0, true);
  return JSON.parse(renderGameToText());
}

function handleSimulationMessage(event) {
  const payload = event.data;

  switch (payload.type) {
    case "ready":
      simulationState.ready = true;
      simulationState.rapierVersion = payload.version ?? "";
      state.performance.physicsBackend = "rapier-worker";
      break;
    case "configured":
      applySimulationSnapshot(payload.snapshot);
      simulationState.configureDeferred?.resolve(payload.snapshot);
      simulationState.configureDeferred = null;
      break;
    case "resetAck":
      applySimulationSnapshot(payload.snapshot);
      simulationState.resetDeferred?.resolve(payload.snapshot);
      simulationState.resetDeferred = null;
      break;
    case "collectibleAck":
    case "chestAck":
      applySimulationSnapshot(payload.snapshot, { applyPosition: false, applyMotionAmount: false, applyTargets: false });
      break;
    case "stepResult": {
      applySimulationSnapshot(payload.snapshot, { applyPosition: false, applyMotionAmount: false, applyTargets: false });
      const resolver = simulationState.stepResolvers.get(payload.id);
      if (resolver) {
        resolver(payload.snapshot);
        simulationState.stepResolvers.delete(payload.id);
      }
      simulationState.inFlightStepId = 0;
      simulationState.inFlightStepPromise = null;

      if (simulationState.queuedStepPayload) {
        const nextPayload = simulationState.queuedStepPayload;
        simulationState.queuedStepPayload = null;
        void dispatchSimulationStep(nextPayload);
      }
      break;
    }
    case "error":
      console.error("Simulation worker error:", payload.message, payload.stack ?? "");
      simulationState.configureDeferred?.reject?.(new Error(payload.message));
      simulationState.configureDeferred = null;
      simulationState.resetDeferred?.reject?.(new Error(payload.message));
      simulationState.resetDeferred = null;
      if (simulationState.inFlightStepId) {
        const resolver = simulationState.stepResolvers.get(simulationState.inFlightStepId);
        resolver?.(null);
        simulationState.stepResolvers.delete(simulationState.inFlightStepId);
        simulationState.inFlightStepId = 0;
        simulationState.inFlightStepPromise = null;
      }
      break;
    default:
      break;
  }
}

async function setupRuntime() {
  if (!renderer) {
    const rendererConfig = await createGameRenderer({
      canvas: dom.canvas,
      qualityProfile,
    });

    renderer = rendererConfig.renderer;
    simulationState.backend = rendererConfig.backend;
    simulationState.usingWebGPU = rendererConfig.usingWebGPU;
    simulationState.webgpuSupported = rendererConfig.webgpuSupported;
    state.performance.rendererBackend = rendererConfig.backend;
    state.performance.webgpuSupported = rendererConfig.webgpuSupported;
    try {
      ktx2Loader.setTranscoderPath(assetPath("assets/runtime/basis/"));
      ktx2Loader.detectSupport(renderer);
      state.performance.ktx2Enabled = true;
    } catch {
      state.performance.ktx2Enabled = false;
    }
    applyQualitySettings();
  }

  if (!simulationState.worker) {
    simulationState.worker = new Worker(new URL("./workers/simulation.worker.js", import.meta.url), { type: "module" });
    simulationState.worker.addEventListener("message", handleSimulationMessage);
    simulationState.worker.addEventListener("error", (error) => {
      console.error("Simulation worker crashed:", error);
      state.performance.physicsBackend = "legacy";
    });
    simulationState.readyPromise = new Promise((resolve) => {
      const onReady = (event) => {
        if (event.data?.type === "ready") {
          simulationState.worker.removeEventListener("message", onReady);
          resolve();
        }
      };
      simulationState.worker.addEventListener("message", onReady);
    });
  }

  await simulationState.readyPromise;
}

function buildSimulationWorldPayload() {
  return {
    type: "configure",
    timestep: 1 / 60,
    floorTop: state.world.floorTop,
    playerY: state.world.floorTop + 1.18,
    playerRadius: 0.82,
    playerStart: {
      x: state.player.position.x,
      z: state.player.position.z,
    },
    bounds: state.world.bounds,
    blockers: state.blockers.map((blocker) => ({
      x: blocker.x,
      z: blocker.z,
      halfX: blocker.halfX,
      halfY: 2.6,
      halfZ: blocker.halfZ,
      skin: 0.02,
    })),
    collectibles: state.collectibles.map((collectible) => ({
      id: collectible.id,
      x: collectible.x,
      z: collectible.z,
      collected: collectible.collected,
    })),
    chests: state.chests.map((chest) => ({
      id: chest.id,
      x: chest.x,
      z: chest.z,
      opened: chest.opened,
    })),
  };
}

async function configureSimulationWorld() {
  await setupRuntime();

  const deferred = createDeferred();
  simulationState.configureDeferred = deferred;
  simulationState.worker.postMessage(buildSimulationWorldPayload());
  return deferred.promise;
}

async function requestSimulationReset(position = state.player.position) {
  if (!simulationState.ready || !simulationState.worker) {
    return null;
  }

  const deferred = createDeferred();
  simulationState.resetDeferred = deferred;
  simulationState.worker.postMessage({
    type: "reset",
    position: {
      x: position.x,
      z: position.z,
    },
  });
  return deferred.promise;
}

function dispatchSimulationStep(payload) {
  if (!simulationState.ready || !simulationState.worker) {
    return Promise.resolve(null);
  }

  const stepId = ++simulationState.inFlightStepId;
  const deferred = createDeferred();
  simulationState.stepResolvers.set(stepId, deferred.resolve);
  simulationState.inFlightStepPromise = deferred.promise;
  simulationState.worker.postMessage({
    type: "step",
    id: stepId,
    delta: payload.delta,
    desiredTranslation: payload.desiredTranslation,
  });
  return deferred.promise;
}

function queueSimulationStep(payload) {
  if (!simulationState.ready || !simulationState.worker) {
    return Promise.resolve(null);
  }

  if (simulationState.inFlightStepPromise) {
    simulationState.queuedStepPayload = payload;
    return simulationState.inFlightStepPromise;
  }

  return dispatchSimulationStep(payload);
}

function refreshSimulationQuery() {
  return queueSimulationStep({
    delta: 1 / 60,
    desiredTranslation: { x: 0, y: 0, z: 0 },
  });
}

function flushSimulation() {
  return simulationState.inFlightStepPromise ?? Promise.resolve(null);
}

function syncCollectibleToSimulation(id, collected) {
  if (!simulationState.ready || !simulationState.worker) {
    return;
  }

  simulationState.worker.postMessage({
    type: "collectibleState",
    id,
    collected,
  });
}

function syncChestToSimulation(id, opened) {
  if (!simulationState.ready || !simulationState.worker) {
    return;
  }

  simulationState.worker.postMessage({
    type: "chestState",
    id,
    opened,
  });
}

const materials = {
  sand: new THREE.MeshStandardMaterial({ color: "#d2a25f", roughness: 1 }),
  sandDark: new THREE.MeshStandardMaterial({ color: "#9b6936", roughness: 1 }),
  rock: new THREE.MeshStandardMaterial({ color: "#826042", roughness: 1, flatShading: true }),
  hauntedStone: new THREE.MeshStandardMaterial({ color: "#60657a", roughness: 0.98 }),
  hauntedStoneDark: new THREE.MeshStandardMaterial({ color: "#34384a", roughness: 1, flatShading: true }),
  hauntedMist: new THREE.MeshBasicMaterial({
    color: "#b7d8ff",
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  meadow: new THREE.MeshStandardMaterial({ color: "#7ca561", roughness: 0.98 }),
  tropicalSand: new THREE.MeshStandardMaterial({ color: "#d3c07b", roughness: 0.92 }),
  lagoon: new THREE.MeshStandardMaterial({ color: "#2b8aa4", roughness: 0.28, metalness: 0.08 }),
  wood: new THREE.MeshStandardMaterial({ color: "#7a4e2b", roughness: 0.72, metalness: 0.08 }),
  woodTrim: new THREE.MeshStandardMaterial({ color: "#b88a55", roughness: 0.48, metalness: 0.14 }),
  portal: new THREE.MeshBasicMaterial({ color: "#69e5ff", transparent: true, opacity: 0.78, side: THREE.DoubleSide }),
  aura: new THREE.MeshBasicMaterial({ color: "#ffd873" }),
};

setupLights();
buildSky();
buildCharacterSelectionUi();
buildSkillUi();
buildXpRack();
toggleQuestWindow(false);
attachMultiplayerEvents();
attachEvents();
populateSettingsForm(state.settings);
updateSettingsValueLabels();
applyUiSettings();
applyAudioSettings();
updateMobileImmersivePrompt();
if (dom.playerNameInput) {
  dom.playerNameInput.value = state.session.playerName;
}
syncMultiplayerSummary();
syncMultiplayerStatusLabel("Hazir");
syncStartButtonState();

registerGameDebugApi({
  state,
  characterDefinitions,
  totalLetterCount,
  renderGameToText,
  update,
  flushSimulation,
  render,
  resetGame,
  debugSetPlayerPosition,
  debugInteractNearest,
  debugCollectNearestLetter,
  transitionToStage,
  useSkill,
  getActiveMultiplayerMapKey,
  syncMultiplayerSummary,
  scheduleRemotePlayerRosterSync,
  flushRemotePlayerRosterSync,
  updateOverlays,
});

void bootstrap();
animate();

async function bootstrap() {
  syncStartButtonState();
  dom.messageLabel.textContent = "Dungeon paketleri yukleniyor";

  try {
    await setupRuntime();

    const [textures, templates, warrior] = await Promise.all([
      loadLetterTextures(),
      loadEnvironmentTemplates(),
      createCharacterInstance(state.player.characterId),
    ]);

    state.templates = { ...templates };
    state.letterTextures = textures;
    buildAlphabetHud(textures);
    state.player.model = warrior.model;
    state.player.mixer = warrior.mixer;
    state.player.actions = warrior.actions;
    state.player.height = warrior.height;
    state.player.baseHeight = warrior.height;
    state.player.baseScale.copy(warrior.baseScale);

    worldGroup.add(state.player.model);
    applyCharacterScale();
    buildCharacterSelectionUi();
    refreshSkillKeyMap();

    state.loaded = true;
    state.world.selectedMap = getSelectedMap();
    dom.mapSelect.classList.remove("is-visible");
    dom.menu.classList.add("is-visible");
    dom.winScreen.classList.remove("is-visible");

    await buildWorldStage(state.world.selectedMap);

    state.message = "Lobby acik. Ismini yazip adminin oyunu baslatmasini bekle.";
    state.mode = "menu";
    syncStartButtonState();
    syncRemotePlayerRoster();
    updateMobileImmersivePrompt();
    updateOverlays(0, true);
    render();
  } catch (error) {
    console.error(error);
    state.message = "Varliklar yuklenemedi";
    dom.startBtn.textContent = "Yukleme Hatasi";
    dom.messageLabel.textContent = "Yukleme hatasi";
    syncUi();
  }
}

async function loadLetterTextures() {
  const textureLoader = new THREE.TextureLoader();
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy
    ? renderer.capabilities.getMaxAnisotropy()
    : 4;
  const anisotropy = Math.min(
    maxAnisotropy,
    qualityProfile.lowSpec ? 2 : 8,
  );
  const textureManifest = await loadRuntimeTextureManifest();
  return Promise.all(
    letterAssets.map(async (asset) => {
      const compressedHref = state.performance.ktx2Enabled
        ? (textureManifest?.letterKtx2?.[String(asset.id)] ?? null)
        : null;
      const texture = compressedHref
        ? await ktx2Loader.loadAsync(compressedHref)
        : await textureLoader.loadAsync(asset.href);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = anisotropy;
      return { ...asset, texture };
    }),
  );
}

async function loadRuntimeTextureManifest() {
  if (runtimeTextureManifestPromise) {
    return runtimeTextureManifestPromise;
  }

  runtimeTextureManifestPromise = fetch(runtimeTextureManifestUrl, { cache: "force-cache" })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);

  return runtimeTextureManifestPromise;
}

async function loadEnvironmentTemplates() {
  const assetUrls = {
    ...getDungeonAssetUrls(),
    ...resolveEnvironmentAssetUrls(halloweenAssetUrls),
    ...resolveEnvironmentAssetUrls(hexagonAssetUrls),
  };
  const entries = await Promise.all(
    Object.entries(assetUrls).map(async ([key, url]) => {
      if (!url) {
        return [key, null];
      }

      try {
        const gltf = await gltfLoader.loadAsync(url);
        return [key, prepareStaticTemplate(gltf.scene, envScale)];
      } catch {
        return [key, null];
      }
    }),
  );

  return Object.fromEntries(entries);
}

function computeFilteredBounds(root, predicate = null) {
  root.updateMatrixWorld(true);

  const aggregateBox = new THREE.Box3();
  const meshBox = new THREE.Box3();
  let hasMatch = false;

  root.traverse((node) => {
    if (!node.isMesh || !node.geometry) {
      return;
    }
    if (predicate && !predicate(node)) {
      return;
    }
    if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox();
    }
    if (!node.geometry.boundingBox) {
      return;
    }

    meshBox.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
    if (!hasMatch) {
      aggregateBox.copy(meshBox);
      hasMatch = true;
      return;
    }
    aggregateBox.union(meshBox);
  });

  return hasMatch ? aggregateBox.clone() : null;
}

function prepareStaticTemplate(sceneRoot, scale, options = {}) {
  const root = sceneRoot.clone(true);

  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }
    node.castShadow = qualityProfile.enableShadows;
    node.receiveShadow = qualityProfile.enableShadows;
    if (node.material?.map) {
      node.material.map.colorSpace = THREE.SRGBColorSpace;
      node.material.map.flipY = false;
    }
  });

  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  const focusBox = computeFilteredBounds(root, options.focusMatcher) ?? computeFilteredBounds(root);
  if (focusBox) {
    focusBox.getCenter(helper.center);
    root.position.x -= helper.center.x;
    root.position.z -= helper.center.z;
    root.position.y -= focusBox.min.y;
  }
  root.updateMatrixWorld(true);

  const sizeBox = computeFilteredBounds(root, options.sizeMatcher) ?? computeFilteredBounds(root);
  root.userData.size = sizeBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(12, 12, 12);
  return root;
}

function setupLights() {
  lightingRig.hemisphere = new THREE.HemisphereLight("#f7fcff", "#e2a35a", 1.65);
  scene.add(lightingRig.hemisphere);

  const sunLight = new THREE.DirectionalLight("#fff3c7", 2.8);
  sunLight.position.set(-22, 34, 18);
  sunLight.castShadow = qualityProfile.enableShadows;
  sunLight.shadow.mapSize.set(qualityProfile.lowSpec ? 1024 : 2048, qualityProfile.lowSpec ? 1024 : 2048);
  sunLight.shadow.camera.left = -80;
  sunLight.shadow.camera.right = 80;
  sunLight.shadow.camera.top = 80;
  sunLight.shadow.camera.bottom = -80;
  sunLight.shadow.bias = -0.00012;
  lightingRig.sun = sunLight;
  scene.add(lightingRig.sun);
  scene.add(lightingRig.sun.target);
}

function applySceneTheme(stageKey) {
  if (!lightingRig.hemisphere || !lightingRig.sun || !scene.fog) {
    return;
  }

  if (stageKey === "halloweenHollows") {
    scene.background = new THREE.Color("#07101b");
    scene.fog.color.set("#0d1420");
    scene.fog.near = 34;
    scene.fog.far = 122;
    lightingRig.hemisphere.color.set("#7fa2d1");
    lightingRig.hemisphere.groundColor.set("#0e0d11");
    lightingRig.hemisphere.intensity = 0.94;
    lightingRig.sun.color.set("#9dc9ff");
    lightingRig.sun.intensity = 1.24;
    lightingRig.sun.position.set(-34, 42, 18);
    lightingRig.sun.target.position.set(0, 0, -12);
    return;
  }

  scene.background = new THREE.Color("#9cd9ff");
  scene.fog.color.set("#d7eeff");
  scene.fog.near = 48;
  scene.fog.far = 132;
  lightingRig.hemisphere.color.set("#f7fcff");
  lightingRig.hemisphere.groundColor.set("#e2a35a");
  lightingRig.hemisphere.intensity = 1.65;
  lightingRig.sun.color.set("#fff3c7");
  lightingRig.sun.intensity = 2.8;
  lightingRig.sun.position.set(-22, 34, 18);
  lightingRig.sun.target.position.set(0, 0, 0);
}

function buildSky() {
  const skyGeometry = new THREE.SphereGeometry(
    180,
    qualityProfile.lowSpec ? 22 : 36,
    qualityProfile.lowSpec ? 14 : 22,
  );
  const top = new THREE.Color("#63c6ff");
  const middle = new THREE.Color("#b4e9ff");
  const bottom = new THREE.Color("#fef0d4");
  const colors = [];
  const positionAttribute = skyGeometry.getAttribute("position");

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const y = positionAttribute.getY(index);
    const normalized = THREE.MathUtils.clamp((y + 90) / 180, 0, 1);
    const color = normalized > 0.42
      ? middle.clone().lerp(top, (normalized - 0.42) / 0.58)
      : bottom.clone().lerp(middle, normalized / 0.42);
    colors.push(color.r, color.g, color.b);
  }

  skyGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    skyGeometry,
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, vertexColors: true }),
  );
  freezeStaticObject(sky);
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, qualityProfile.lowSpec ? 14 : 24, qualityProfile.lowSpec ? 14 : 24),
    new THREE.MeshBasicMaterial({ color: "#fff0b5" }),
  );
  sun.position.set(-38, 54, 26);
  freezeStaticObject(sun);
  scene.add(sun);
}

function buildBackdrop(stageKey = state.world.stageKey) {
  applySceneTheme(stageKey);
  const stageRadius = Math.max(state.world.radius || 40, 18);
  const backdropGroup = new THREE.Group();
  const groundMaterial = stageKey === "halloweenHollows"
    ? materials.hauntedStoneDark
    : stageKey === "hexagonVillage"
      ? materials.meadow
      : materials.sand;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(stageRadius * 7.2, stageRadius * 7.2),
    groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = qualityProfile.enableShadows;
  backdropGroup.add(ground);

  if (stageKey === "halloweenHollows") {
    const mountainCount = qualityProfile.lowSpec ? 8 : 12;
    for (let index = 0; index < mountainCount; index += 1) {
      const angle = (index / mountainCount) * Math.PI * 2;
      const radius = stageRadius * 2.2 + pseudoRandom(index + 77) * stageRadius * 0.5;
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(5 + pseudoRandom(index + 113) * 7, 12 + pseudoRandom(index + 149) * 14, 5),
        materials.hauntedStone,
      );
      mountain.castShadow = false;
      mountain.receiveShadow = qualityProfile.enableShadows;
      mountain.position.set(Math.cos(angle) * radius, 6, Math.sin(angle) * radius);
      mountain.rotation.y = pseudoRandom(index + 201) * Math.PI;
      backdropGroup.add(mountain);
    }

    const treeCount = qualityProfile.lowSpec ? 12 : 18;
    for (let index = 0; index < treeCount; index += 1) {
      const angle = (index / treeCount) * Math.PI * 2;
      const radius = stageRadius * (1.1 + pseudoRandom(index + 451) * 0.3);
      const tree = new THREE.Mesh(
        new THREE.ConeGeometry(2 + pseudoRandom(index + 487) * 2.5, 10 + pseudoRandom(index + 503) * 7, 6),
        materials.hauntedStoneDark,
      );
      tree.position.set(Math.cos(angle) * radius, 4.5, Math.sin(angle) * radius);
      tree.rotation.y = pseudoRandom(index + 547) * Math.PI;
      backdropGroup.add(tree);
    }
  } else if (stageKey === "hexagonVillage") {
    const treeCount = qualityProfile.lowSpec ? 10 : 16;
    for (let index = 0; index < treeCount; index += 1) {
      const templateKey = index % 2 === 0 ? "hexTreeA" : "hexTreeB";
      const template = state.templates[templateKey] ?? state.templates.hexTreeA ?? state.templates.hexTreeB;
      if (!template) {
        continue;
      }

      const tree = template.clone(true);
      const angle = (index / treeCount) * Math.PI * 2;
      const radius = stageRadius * (1.24 + pseudoRandom(index + 601) * 0.26);
      tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      tree.rotation.y = pseudoRandom(index + 644) * Math.PI * 2;
      tree.scale.multiplyScalar(0.82 + pseudoRandom(index + 693) * 0.18);
      backdropGroup.add(tree);
    }

    const rockCount = qualityProfile.lowSpec ? 8 : 12;
    for (let index = 0; index < rockCount; index += 1) {
      const angle = (index / rockCount) * Math.PI * 2 + 0.2;
      const radius = stageRadius * (1.52 + pseudoRandom(index + 717) * 0.24);
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(3 + pseudoRandom(index + 761) * 2.2, 0),
        index % 2 === 0 ? materials.rock : materials.sandDark,
      );
      rock.castShadow = qualityProfile.enableShadows;
      rock.receiveShadow = qualityProfile.enableShadows;
      rock.position.set(Math.cos(angle) * radius, 1.7, Math.sin(angle) * radius);
      rock.rotation.set(
        pseudoRandom(index + 804) * Math.PI,
        pseudoRandom(index + 847) * Math.PI,
        pseudoRandom(index + 889) * Math.PI,
      );
      backdropGroup.add(rock);
    }
  } else {
    const rockCount = qualityProfile.lowSpec ? 12 : 24;
    for (let index = 0; index < rockCount; index += 1) {
      const angle = (index / rockCount) * Math.PI * 2;
      const radius = 142 + pseudoRandom(index + 9) * 34;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(3.5 + pseudoRandom(index + 16) * 3.2, 0),
        index % 2 === 0 ? materials.rock : materials.sandDark,
      );
      rock.castShadow = qualityProfile.enableShadows;
      rock.receiveShadow = qualityProfile.enableShadows;
      rock.position.set(Math.cos(angle) * radius, 1.9, Math.sin(angle) * radius);
      rock.rotation.set(
        pseudoRandom(index + 30) * Math.PI,
        pseudoRandom(index + 44) * Math.PI,
        pseudoRandom(index + 57) * Math.PI,
      );
      backdropGroup.add(rock);
    }
  }

  applyNodeUserDataFlag(backdropGroup, "cameraIgnore");
  freezeStaticObject(backdropGroup);
  worldGroup.add(backdropGroup);
}

function clearWorldSceneObjects() {
  const keep = new Set();
  if (state.player.model) {
    keep.add(state.player.model);
  }

  [...worldGroup.children].forEach((child) => {
    if (!keep.has(child)) {
      worldGroup.remove(child);
    }
  });
  state.camera.collisionMeshes = [];
}

function isNodeWithin(node, root) {
  let current = node;
  while (current) {
    if (current === root) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function applyNodeUserDataFlag(root, key, value = true) {
  root.traverse((node) => {
    node.userData = node.userData ?? {};
    node.userData[key] = value;
  });
}

function rebuildCameraCollisionMeshes() {
  state.camera.collisionMeshes = [];

  worldGroup.traverse((node) => {
    if (!node.isMesh || !node.visible || !node.material) {
      return;
    }
    if (state.player.model && isNodeWithin(node, state.player.model)) {
      return;
    }
    if (node.userData?.cameraIgnore) {
      return;
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.every((material) => material?.transparent && (material.opacity ?? 1) <= 0.35)) {
      return;
    }
    state.camera.collisionMeshes.push(node);
  });
}

function clearPortal() {
  if (state.portal) {
    worldGroup.remove(state.portal.group);
  }
  state.portal = null;
  state.nearestPortalDistance = null;
}

function createStagePortal(targetStage) {
  if (state.portal || !targetStage) {
    return null;
  }

  const anchor = state.world.portalAnchor ?? {
    x: 0,
    z: 0,
    y: state.world.floorTop,
    label: "Buyuk Gecit",
  };
  const ringRadius = state.world.stageKey === "sunCourt" ? 2.8 : 2.15;
  const columnRadius = state.world.stageKey === "sunCourt" ? 1.9 : 1.48;
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ringRadius, 0.24, qualityProfile.lowSpec ? 10 : 18, qualityProfile.lowSpec ? 24 : 40),
    new THREE.MeshStandardMaterial({
      color: "#86f3ff",
      emissive: "#46d9ff",
      emissiveIntensity: 1.1,
      roughness: 0.18,
      metalness: 0.42,
    }),
  );
  ring.position.y = 2.6;

  const veil = new THREE.Mesh(
    new THREE.CylinderGeometry(columnRadius, columnRadius, 3.9, qualityProfile.lowSpec ? 16 : 28, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#79efff",
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  veil.position.y = 2.6;

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(columnRadius * 1.9, 3.8),
    new THREE.MeshBasicMaterial({
      color: "#d8ffff",
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  core.position.y = 2.6;

  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(columnRadius * 0.94, ringRadius + 0.12, qualityProfile.lowSpec ? 18 : 34),
    new THREE.MeshBasicMaterial({
      color: "#8cf3ff",
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.04;

  group.add(ring);
  group.add(veil);
  group.add(core);
  group.add(groundRing);
  group.position.set(anchor.x, anchor.y ?? state.world.floorTop, anchor.z);
  worldGroup.add(group);

  state.portal = {
    x: anchor.x,
    z: anchor.z,
    group,
    ring,
    veil,
    core,
    groundRing,
    targetStage,
    label: anchor.label ?? "Buyuk Gecit",
  };
  state.nearestPortalDistance = Math.hypot(anchor.x - state.player.position.x, anchor.z - state.player.position.z);
  state.message = `${anchor.label ?? "Buyuk Gecit"} acildi`;
  showToast(`${getStageLabel(targetStage)} gecidi acildi`);
  return state.portal;
}

function updatePortal(delta) {
  if (!state.portal) {
    state.nearestPortalDistance = null;
    return;
  }

  const pulse = Math.sin(state.elapsed * 4.2) * 0.5 + 0.5;
  state.portal.ring.rotation.z += delta * 0.7;
  state.portal.veil.rotation.y += delta * 0.55;
  state.portal.core.quaternion.copy(camera.quaternion);
  state.portal.core.material.opacity = 0.44 + pulse * 0.18;
  state.portal.veil.material.opacity = 0.18 + pulse * 0.12;
  state.portal.groundRing.scale.setScalar(1 + pulse * 0.12);
  state.portal.groundRing.material.opacity = 0.28 + pulse * 0.2;
  state.portal.group.position.y = state.world.floorTop + Math.sin(state.elapsed * 1.9) * 0.08;
  state.nearestPortalDistance = Math.hypot(state.portal.x - state.player.position.x, state.portal.z - state.player.position.z);
}

async function transitionToStage(stageKey) {
  const targetStage = getStageKey(stageKey);
  if (state.transitioningStage) {
    return false;
  }

  state.transitioningStage = true;
  try {
    clearMoveTarget();
    clearPendingLetterCardReveal();
    state.keys.clear();
    state.player.attackHeld = false;
    state.player.crouchHeld = false;
    closeLetterCard({ silent: true });
    state.mode = "loading";
    state.message = `${getStageLabel(targetStage)} yukleniyor`;
    dom.winScreen.classList.remove("is-visible");
    await buildWorldStage(targetStage);
    state.mode = "playing";
    state.message = `${getStageLabel(targetStage)} acildi`;
    showToast(`${getStageLabel(targetStage)} acildi`);
    updateMobileImmersivePrompt();
    updateOverlays(0, true);
    render();
    return true;
  } finally {
    state.transitioningStage = false;
    flushPendingRoster();
  }
}

function tryUseStagePortal() {
  if (
    state.mode !== "playing"
    || !state.portal
    || state.transitioningStage
    || state.nearestPortalDistance === null
    || state.nearestPortalDistance > 3
  ) {
    return false;
  }

  void transitionToStage(state.portal.targetStage);
  return true;
}

function clearStageContent() {
  clearBannerAura();
  clearShockwaves();
  clearLootBursts();
  clearCollectibles();
  clearTreasureChests();
  clearPortal();
  clearWorldSceneObjects();
  state.blockers = [];
  state.nearestId = null;
  state.nearestDistance = null;
  state.nearestChestId = null;
  state.nearestChestDistance = null;
  state.nearestPortalDistance = null;
  state.interactionHint = "";
  state.moveTarget = null;
  state.world.heightZones = [];
  state.world.collectibleAnchors = [];
  state.world.chestAnchors = [];
  state.world.portalAnchor = null;
  state.world.stageCollectibleTotal = 0;
  syncRemotePlayerRoster([]);
}

async function buildWorldStage(stageKey) {
  const resolvedStage = getStageKey(stageKey);
  clearStageContent();
  state.world.stageKey = resolvedStage;
  state.world.currentMap = resolvedStage;

  if (resolvedStage === "halloweenHollows") {
    buildHalloweenHollows();
  } else if (resolvedStage === "hexagonVillage") {
    buildHexagonVillage();
  } else {
    buildSunCourt();
  }

  buildBackdrop(resolvedStage);

  state.totalCollectibles = getOverallTargetCollectibleCount();
  state.world.stageCollectibleTotal = getTargetCollectibleCount(resolvedStage);
  createCollectibles(getStageLetterPool(resolvedStage), state.world.stageCollectibleTotal);
  buildTreasureChests(state.world.tileSize);
  updateZoneLabel();
  rebuildCameraCollisionMeshes();

  if (state.player.model) {
    state.player.model.position.copy(state.player.position);
    state.player.model.rotation.y = state.player.heading;
  }

  snapCameraToPlayer();
  if (simulationState.ready) {
    await configureSimulationWorld();
    await requestSimulationReset(state.player.position);
    await refreshSimulationQuery();
  }

  updateInteractionTargets();
  updateTreasureChests(0);
  updatePortal(0);
  flushPendingRoster();
  updateOverlays(0, true);
  sendMultiplayerSnapshot(true);
  render();
}

function buildSunCourt() {
  const floorTemplate = state.templates.floor;
  const rockFloorTemplate = state.templates.floorRocks || floorTemplate;
  const tileSize = floorTemplate?.userData.size?.x ?? 8;
  const gridRadius = 3;
  const sideLength = gridRadius * 2 + 1;
  const worldHalf = (sideLength * tileSize) / 2;
  const wallOffset = tileSize / 2;
  const wallDepth = (state.templates.wall?.userData.size?.z ?? 1.4) / 2;
  const hallBounds = {
    minX: -worldHalf + tileSize * 0.32,
    maxX: worldHalf - tileSize * 0.32,
    minZ: -worldHalf + tileSize * 0.32,
    maxZ: worldHalf - tileSize * 0.32,
  };
  const wallLineZ = gridRadius * tileSize + wallOffset + wallDepth - 0.25;

  state.world.tileSize = tileSize;
  state.world.radius = worldHalf + tileSize * 1.8;
  state.world.phase = 1;
  state.world.stageKey = "sunCourt";
  state.world.currentMap = "sunCourt";
  state.world.floorTop = 0;
  state.world.structureOffset = { x: 0, z: 0 };
  state.world.templateSize.set(worldHalf * 2, 10, worldHalf * 2);
  state.world.heightZones = [];
  state.world.bounds = hallBounds;
  state.world.spawn = {
    x: 0,
    z: hallBounds.maxZ - tileSize * 0.88,
  };
  state.world.portalAnchor = {
    x: 0,
    z: hallBounds.minZ + tileSize * 1.36,
    y: 0,
    label: "Buyuk Gecit",
  };
  state.world.sections = [
    createWorldSection("sunCourt", "sunCourt", "Sun Court", hallBounds),
  ];

  for (let gx = -gridRadius; gx <= gridRadius; gx += 1) {
    for (let gz = -gridRadius; gz <= gridRadius; gz += 1) {
      const template = (Math.abs(gx) === gridRadius && Math.abs(gz) === gridRadius)
        || (Math.abs(gx) + Math.abs(gz) > 4 && (gx + gz) % 2 === 0)
        ? rockFloorTemplate
        : floorTemplate;
      placeTemplate(template, gx * tileSize, 0, gz * tileSize);
    }
  }

  buildWallRun({
    axis: "x",
    fixed: -wallLineZ,
    span: gridRadius,
    reverse: false,
  });
  buildWallRun({
    axis: "x",
    fixed: wallLineZ,
    span: gridRadius,
    reverse: true,
  });
  buildWallRun({
    axis: "z",
    fixed: -wallLineZ,
    span: gridRadius,
    reverse: true,
  });
  buildWallRun({
    axis: "z",
    fixed: wallLineZ,
    span: gridRadius,
    reverse: false,
  });

  const cornerDistance = wallLineZ;
  [
    [-cornerDistance, -cornerDistance, 0],
    [cornerDistance, -cornerDistance, Math.PI / 2],
    [cornerDistance, cornerDistance, Math.PI],
    [-cornerDistance, cornerDistance, -Math.PI / 2],
  ].forEach(([x, z, yaw]) => {
    placeTemplate(state.templates.wallCorner, x, 0, z, { rotationY: yaw });
  });

  [
    [-tileSize * 2.2, 0, -tileSize * 2.15, 0.2],
    [tileSize * 2.2, 0, -tileSize * 2.15, -0.2],
    [-tileSize * 2.2, 0, tileSize * 2.15, Math.PI * 0.65],
    [tileSize * 2.2, 0, tileSize * 2.15, -Math.PI * 0.65],
  ].forEach(([x, y, z, yaw]) => {
    placeTemplate(state.templates.pillar, x, y, z, {
      rotationY: yaw,
      blockerScale: 0.62,
    });
  });

  placeTemplate(state.templates.banner, -tileSize * 0.92, 0, hallBounds.minZ + tileSize * 0.28, { rotationY: 0.18 });
  placeTemplate(state.templates.banner, tileSize * 0.92, 0, hallBounds.minZ + tileSize * 0.28, { rotationY: -0.18 });
  placeTemplate(state.templates.torch, -tileSize * 1.7, 0, hallBounds.minZ + tileSize * 0.22, { rotationY: 0.15 });
  placeTemplate(state.templates.torch, tileSize * 1.7, 0, hallBounds.minZ + tileSize * 0.22, { rotationY: -0.15 });
  placeTemplate(state.templates.torch, -tileSize * 1.7, 0, hallBounds.maxZ - tileSize * 0.22, { rotationY: Math.PI - 0.15 });
  placeTemplate(state.templates.torch, tileSize * 1.7, 0, hallBounds.maxZ - tileSize * 0.22, { rotationY: Math.PI + 0.15 });
  placeTemplate(state.templates.column, 0, 0, -tileSize * 1.85, {
    rotationY: Math.PI / 2,
    scale: 1.08,
    blockerScale: 0.48,
  });
  placeTemplate(state.templates.halloweenArchGate, state.world.portalAnchor.x, 0, state.world.portalAnchor.z, {
    rotationY: Math.PI,
    scale: 1.42,
  });
  placeTemplate(state.templates.halloweenPostLantern, -tileSize * 1.28, 0, state.world.portalAnchor.z + tileSize * 0.18, {
    rotationY: Math.PI * 0.08,
    scale: 1.06,
    blockerScale: 0.24,
  });
  placeTemplate(state.templates.halloweenPostLantern, tileSize * 1.28, 0, state.world.portalAnchor.z + tileSize * 0.18, {
    rotationY: -Math.PI * 0.08,
    scale: 1.06,
    blockerScale: 0.24,
  });
  placeTemplate(state.templates.table, -tileSize * 1.82, 0, tileSize * 0.95, {
    rotationY: 0.34,
    blockerScale: 0.6,
  });
  placeTemplate(state.templates.barrel, -tileSize * 2.55, 0, tileSize * 1.62, {
    rotationY: -0.25,
    blockerScale: 0.42,
  });
  placeTemplate(state.templates.trunk, -tileSize * 1.04, 0, tileSize * 1.7, {
    rotationY: 0.7,
    blockerScale: 0.48,
  });
  placeTemplate(state.templates.table, tileSize * 1.86, 0, tileSize * 0.86, {
    rotationY: -0.34,
    blockerScale: 0.6,
  });
  placeTemplate(state.templates.barrel, tileSize * 2.6, 0, tileSize * 1.54, {
    rotationY: 0.3,
    blockerScale: 0.42,
  });
  placeTemplate(state.templates.trunk, tileSize * 1.02, 0, tileSize * 1.82, {
    rotationY: -0.72,
    blockerScale: 0.48,
  });
  placeTemplate(state.templates.column, -tileSize * 2.45, 0, -tileSize * 0.95, {
    rotationY: Math.PI * 0.18,
    blockerScale: 0.45,
  });
  placeTemplate(state.templates.column, tileSize * 2.45, 0, -tileSize * 0.95, {
    rotationY: -Math.PI * 0.18,
    blockerScale: 0.45,
  });

  state.player.position.set(state.world.spawn.x, state.world.floorTop, state.world.spawn.z);
  applyPlayerFloorHeight();
  state.player.heading = Math.PI;
  state.camera.yaw = Math.PI;
  state.camera.pitch = 0.54;
}

function createWorldSection(stageKey, key, label, bounds) {
  return {
    key,
    stageKey,
    label,
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerZ: (bounds.minZ + bounds.maxZ) / 2,
    bounds,
  };
}

function placeHalloweenPathSegment(x, z, seed, options = {}) {
  const keys = ["halloweenPathA", "halloweenPathB", "halloweenPathC", "halloweenPathD"];
  const key = keys[Math.floor(pseudoRandom(seed) * keys.length)] ?? keys[0];
  const template = state.templates[key];
  if (!template) {
    return null;
  }
  return placeTemplate(template, x, 0, z, {
    rotationY: options.rotationY ?? 0,
    scale: options.scale ?? 1.08,
    cameraIgnore: options.cameraIgnore ?? false,
  });
}

function placePumpkinCluster(x, z, seed, spread = 2.2) {
  const pumpkinKeys = ["halloweenPumpkinOrange", "halloweenPumpkinYellow"];
  const count = 4 + Math.floor(pseudoRandom(seed + 1.7) * 3);
  for (let index = 0; index < count; index += 1) {
    const key = pumpkinKeys[Math.floor(pseudoRandom(seed + index * 4.1) * pumpkinKeys.length)];
    const template = state.templates[key];
    if (!template) {
      continue;
    }
    const angle = pseudoRandom(seed + index * 5.3) * Math.PI * 2;
    const radius = 0.36 + pseudoRandom(seed + index * 7.1) * spread;
    placeTemplate(template, x + Math.cos(angle) * radius, 0, z + Math.sin(angle) * radius, {
      rotationY: pseudoRandom(seed + index * 9.4) * Math.PI * 2,
      scale: 0.82 + pseudoRandom(seed + index * 10.6) * 0.42,
    });
  }
}

function buildHalloweenFenceRun(axis, fixed, start, end, options = {}) {
  const template = state.templates[options.key ?? "halloweenFence"] || state.templates.halloweenFenceBroken;
  if (!template) {
    return;
  }

  const segmentLength = Math.max(
    2.8,
    axis === "x"
      ? (template.userData.size?.x ?? state.world.tileSize * 0.7)
      : (template.userData.size?.z ?? state.world.tileSize * 0.7),
  );
  const step = segmentLength * (options.spacing ?? 0.84);

  for (let position = start; position <= end + 0.001; position += step) {
    const gap = options.gap;
    if (gap && position >= gap.min && position <= gap.max) {
      continue;
    }

    if (axis === "x") {
      placeTemplate(template, position, 0, fixed, {
        rotationY: options.rotationY ?? 0,
        scale: options.scale ?? 0.96,
        blockerScale: options.blockerScale ?? 0.48,
      });
    } else {
      placeTemplate(template, fixed, 0, position, {
        rotationY: options.rotationY ?? Math.PI / 2,
        scale: options.scale ?? 0.96,
        blockerScale: options.blockerScale ?? 0.48,
      });
    }
  }
}

function buildHalloweenFenceRectangle(bounds, options = {}) {
  buildHalloweenFenceRun("x", bounds.minZ, bounds.minX, bounds.maxX, {
    rotationY: 0,
    gap: options.southGap,
  });
  buildHalloweenFenceRun("x", bounds.maxZ, bounds.minX, bounds.maxX, {
    rotationY: Math.PI,
  });
  buildHalloweenFenceRun("z", bounds.minX, bounds.minZ, bounds.maxZ, {
    rotationY: Math.PI / 2,
  });
  buildHalloweenFenceRun("z", bounds.maxX, bounds.minZ, bounds.maxZ, {
    rotationY: -Math.PI / 2,
  });

  [
    [bounds.minX, bounds.minZ],
    [bounds.maxX, bounds.minZ],
    [bounds.maxX, bounds.maxZ],
    [bounds.minX, bounds.maxZ],
  ].forEach(([x, z], index) => {
    placeTemplate(state.templates.halloweenFencePillar, x, 0, z, {
      rotationY: index * Math.PI * 0.5,
      scale: 0.96,
      blockerScale: 0.28,
    });
  });

  if (options.southGap) {
    const centerX = (options.southGap.min + options.southGap.max) / 2;
    placeTemplate(state.templates.halloweenFenceGate, centerX, 0, bounds.minZ, {
      rotationY: 0,
      scale: 0.98,
    });
  }
}

function scatterHalloweenTrees(bounds, count, seedOffset = 0, exclusion = null) {
  const treeKeys = [
    "halloweenTreeDeadLarge",
    "halloweenTreeDeadMedium",
    "halloweenTreeDeadSmall",
    "halloweenTreePineOrangeLarge",
    "halloweenTreePineOrangeMedium",
    "halloweenTreePineYellowLarge",
    "halloweenTreePineYellowMedium",
  ];

  for (let index = 0; index < count; index += 1) {
    const x = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, pseudoRandom(seedOffset + index * 13.7));
    const z = THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, pseudoRandom(seedOffset + index * 21.1 + 4));

    if (
      exclusion
      && x > exclusion.minX
      && x < exclusion.maxX
      && z > exclusion.minZ
      && z < exclusion.maxZ
    ) {
      continue;
    }

    const key = treeKeys[Math.floor(pseudoRandom(seedOffset + index * 9.1 + 7) * treeKeys.length)];
    const template = state.templates[key];
    if (!template) {
      continue;
    }

    placeTemplate(template, x, 0, z, {
      rotationY: pseudoRandom(seedOffset + index * 5.3 + 11) * Math.PI * 2,
      scale: 0.9 + pseudoRandom(seedOffset + index * 6.7 + 14) * 0.35,
      blockerScale: 0.38,
    });
  }
}

function buildHalloweenHollows() {
  const floorTemplate = state.templates.halloweenFloorDirt || state.templates.floor;
  const tileSize = floorTemplate?.userData.size?.x ?? 8;
  const tileStep = tileSize * 0.85;
  
  const mapWidth = 6;
  const mapDepth = 6;
  const worldHalfX = mapWidth * tileStep;
  const worldHalfZ = mapDepth * tileStep;
  const wallHeight = 8;
  const wallOffset = tileSize / 2;
  
  const bounds = {
    minX: -worldHalfX,
    maxX: worldHalfX,
    minZ: -worldHalfZ,
    maxZ: worldHalfZ,
  };

  state.world.tileSize = tileSize;
  state.world.radius = Math.max(worldHalfX, worldHalfZ) + tileSize * 3;
  state.world.phase = 2;
  state.world.stageKey = "halloweenHollows";
  state.world.currentMap = "halloweenHollows";
  state.world.floorTop = 0;
  state.world.structureOffset = { x: 0, z: 0 };
  state.world.templateSize.set(worldHalfX * 2, 14, worldHalfZ * 2);
  state.world.heightZones = [];
  state.world.bounds = bounds;
  state.world.spawn = { x: 0, z: bounds.maxZ - tileSize * 1.5 };
  state.world.portalAnchor = {
    x: 0, z: bounds.minZ + tileSize * 1.5, y: 0, label: "Karanlik Gecit"
  };
  
  state.world.sections = [
    createWorldSection("halloweenHollows", "courtyard", "Avlu", bounds),
  ];

  for (let gx = -mapWidth; gx <= mapWidth; gx++) {
    for (let gz = -mapDepth; gz <= mapDepth; gz++) {
      placeTemplate(floorTemplate, gx * tileStep, 0, gz * tileStep, { scale: 1.0 });
    }
  }

  const pathPositions = [
    [0, bounds.maxZ - tileSize],
    [0, bounds.maxZ - tileSize * 2.5],
    [0, 0],
    [0, bounds.minZ + tileSize * 2.5],
    [0, bounds.minZ + tileSize],
  ];
  pathPositions.forEach(([px, pz]) => {
    placeTemplate(state.templates.halloweenPathA, px, 0, pz, { rotationY: 0, scale: 1.1 });
  });

  const wallLineX = worldHalfX + wallOffset;
  const wallLineZ = worldHalfZ + wallOffset;
  const wallSpan = mapWidth;

  buildWallRun({
    axis: "x",
    fixed: wallLineZ,
    span: wallSpan,
    reverse: true,
  });
  buildWallRun({
    axis: "x",
    fixed: -wallLineZ,
    span: wallSpan,
    reverse: false,
  });
  buildWallRun({
    axis: "z",
    fixed: wallLineX,
    span: wallSpan,
    reverse: false,
  });
  buildWallRun({
    axis: "z",
    fixed: -wallLineX,
    span: wallSpan,
    reverse: true,
  });

  const cornerDistance = wallLineZ;
  [
    [-cornerDistance, -cornerDistance, 0],
    [cornerDistance, -cornerDistance, Math.PI / 2],
    [cornerDistance, cornerDistance, Math.PI],
    [-cornerDistance, cornerDistance, -Math.PI / 2],
  ].forEach(([x, z, yaw]) => {
    placeTemplate(state.templates.wallCorner, x, 0, z, { rotationY: yaw });
  });

  placeTemplate(state.templates.halloweenShrine, 0, 0, 0, {
    rotationY: 0, scale: 1.4, blockerScale: 0.6
  });

  const lanternSpots = [
    [tileSize * 2.5, tileSize * 2.5], [-tileSize * 2.5, tileSize * 2.5],
    [tileSize * 2.5, -tileSize * 2.5], [-tileSize * 2.5, -tileSize * 2.5],
    [tileSize * 2.5, 0], [-tileSize * 2.5, 0],
    [0, tileSize * 2.5], [0, -tileSize * 2.5],
    [tileSize * 2, bounds.maxZ - tileSize], [-tileSize * 2, bounds.maxZ - tileSize],
    [tileSize * 2, bounds.minZ + tileSize], [-tileSize * 2, bounds.minZ + tileSize],
  ];
  lanternSpots.forEach(([lx, lz], i) => {
    const lantern = i % 3 === 0 ? state.templates.halloweenPostLantern : state.templates.halloweenLantern;
    placeTemplate(lantern, lx, 0, lz, {
      rotationY: Math.random() * 0.3 - 0.15, scale: 1.3, blockerScale: 0.25
    });
  });

  const graveSpots = [
    [tileSize * 1.8, tileSize * 1.2, "halloweenGraveA", 0.1],
    [-tileSize * 1.5, tileSize * 1.8, "halloweenGraveB", -0.2],
    [tileSize * 1.5, -tileSize * 1.5, "halloweenGravestone", 0.15],
    [-tileSize * 1.8, -tileSize * 1.2, "halloweenGravemarker_A", -0.1],
  ];
  graveSpots.forEach(([gx, gz, key, yaw]) => {
    placeTemplate(state.templates[key], gx, 0, gz, { rotationY: yaw, scale: 1.1, blockerScale: 0.3 });
  });

  placeTemplate(state.templates.halloweenBench, tileSize * 1.5, 0, tileSize * 3, {
    rotationY: 0, scale: 1.0, blockerScale: 0.35
  });
  placeTemplate(state.templates.halloweenBench, -tileSize * 1.5, 0, tileSize * 3, {
    rotationY: Math.PI, scale: 1.0, blockerScale: 0.35
  });

  placeTemplate(state.templates.halloweenArch, tileSize * 3, 0, 0, {
    rotationY: Math.PI / 2, scale: 1.2
  });
  placeTemplate(state.templates.halloweenArch, -tileSize * 3, 0, 0, {
    rotationY: -Math.PI / 2, scale: 1.2
  });

  placeTemplate(state.templates.candle_triple, tileSize * 0.8, 0, tileSize * 2.2, {
    rotationY: 0.2, scale: 1.2
  });
  placeTemplate(state.templates.candle_triple, -tileSize * 0.8, 0, tileSize * 2.2, {
    rotationY: -0.2, scale: 1.2
  });

  placeTemplate(state.templates.ribcage, tileSize * 2.8, 0, -tileSize * 2.5, {
    rotationY: 0.4, scale: 1.0
  });
  placeTemplate(state.templates.ribcage, -tileSize * 2.8, 0, -tileSize * 2.5, {
    rotationY: -0.3, scale: 1.0
  });

  state.world.collectibleAnchors = [
    { x: 0, z: bounds.maxZ - tileSize, score: 10 },
    { x: tileSize * 2, z: 0, score: 9 },
    { x: -tileSize * 2, z: 0, score: 9 },
    { x: 0, z: 0, score: 11 },
    { x: tileSize * 1.5, z: tileSize * 1.5, score: 8.5 },
    { x: -tileSize * 1.5, z: tileSize * 1.5, score: 8.5 },
    { x: 0, z: bounds.minZ + tileSize, score: 9 },
    { x: tileSize * 2, z: -tileSize * 2, score: 8 },
    { x: -tileSize * 2, z: -tileSize * 2, score: 8 },
  ];
  
  state.world.chestAnchors = [
    [tileSize * 1.5, 0, 0, { rotationY: Math.PI / 4, scale: 1.1, blockerScale: 0.4 }],
    [-tileSize * 1.5, 0, 0, { rotationY: -Math.PI / 4, scale: 1.1, blockerScale: 0.4 }],
    [0, 0, bounds.minZ + tileSize * 2, { rotationY: Math.PI, scale: 1.2, blockerScale: 0.45 }],
  ];

  state.player.position.set(state.world.spawn.x, state.world.floorTop, state.world.spawn.z);
  applyPlayerFloorHeight();
  state.player.heading = Math.PI;
  state.camera.yaw = Math.PI;
  state.camera.pitch = 0.4;
}

function buildHexagonVillage() {
  const tileSize = state.templates.hexGrass?.userData?.size?.x ?? 8;
  const tileRowHeight = tileSize * 0.866;
  
  const width = 10;
  const depth = 11;
  const bounds = {
    minX: -width * tileSize,
    maxX: width * tileSize,
    minZ: -depth * tileRowHeight,
    maxZ: depth * tileRowHeight,
  };

  const wallLineX = bounds.maxX + tileSize * 0.5;
  const wallLineZ = bounds.maxZ + tileSize * 0.5;

  state.world.tileSize = tileSize;
  state.world.radius = 95;
  state.world.phase = 3;
  state.world.stageKey = "hexagonVillage";
  state.world.currentMap = "hexagonVillage";
  state.world.floorTop = 0;
  state.world.structureOffset = { x: 0, z: 0 };
  state.world.templateSize.set(180, 10, 180);
  state.world.heightZones = [];
  state.world.bounds = bounds;
  state.world.spawn = { x: 0, z: bounds.maxZ - tileSize * 2 };
  state.world.portalAnchor = null;
  state.world.sections = [
    createWorldSection("hexagonVillage", "villageCenter", "Koy Merkezi", { minX: -tileSize * 4, maxX: tileSize * 4, minZ: -tileSize * 2, maxZ: tileSize * 4 }),
    createWorldSection("hexagonVillage", "marketSquare", "Market Meydani", { minX: -tileSize * 3, maxX: tileSize * 3, minZ: tileSize * 2, maxZ: bounds.maxZ }),
    createWorldSection("hexagonVillage", "nobleQuarter", "Asilzadeler Mahallesi", { minX: tileSize * 3, maxX: wallLineX, minZ: -tileSize * 2, maxZ: tileSize * 3 }),
    createWorldSection("hexagonVillage", "churchDistrict", "Kilise Bolgesi", { minX: -tileSize * 5, maxX: -tileSize * 2, minZ: -tileSize * 3, maxZ: tileSize * 1 }),
  ];
  const villageWindowPattern = (index, span) => {
    const distance = Math.abs(index);
    if (distance <= 1 || distance >= span) {
      return false;
    }
    return distance >= span - 2 || distance % 2 === 0;
  };

  for (let z = -depth; z <= depth; z++) {
    for (let x = -width; x <= width; x++) {
      const px = x * tileSize + (Math.abs(z) % 2 === 1 ? tileSize / 2 : 0);
      const pz = z * tileRowHeight;
      const dToCenter = Math.hypot(px, pz);

      if (dToCenter > bounds.maxX - tileSize) {
        if (state.templates.hexWater) {
          placeTemplate(state.templates.hexWater, px, -0.4, pz, { scale: 1.0 });
        }
        continue;
      }
      
      if (state.templates.hexGrass) {
        placeTemplate(state.templates.hexGrass, px, 0, pz, { scale: 1.02 });
      }
    }
  }

  // Castle in center
  if (state.templates.hexCastle) {
    placeTemplate(state.templates.hexCastle, 0, 0, -tileSize * 2, {
      rotationY: 0,
      scale: hexVillageScaleProfile.landmark,
      blockerScale: 0.65,
    });
  }
  if (state.templates.hexTower) {
    placeTemplate(state.templates.hexTower, tileSize * 2.5, 0, -tileSize * 0.5, {
      rotationY: Math.PI / 4,
      scale: hexVillageScaleProfile.tower,
      blockerScale: 0.4,
    });
    placeTemplate(state.templates.hexTower, -tileSize * 2.5, 0, -tileSize * 3, {
      rotationY: -Math.PI / 4,
      scale: hexVillageScaleProfile.tower,
      blockerScale: 0.4,
    });
  }

  // Market area - taverns, houses scattered
  const marketSpots = [
    [tileSize * 0.5, tileSize * 3.5], [-tileSize * 1.5, tileSize * 4],
    [tileSize * 2, tileSize * 5], [-tileSize * 2.5, tileSize * 3],
    [tileSize * 1, tileSize * 6], [-tileSize * 0.5, tileSize * 5.5],
  ];
  marketSpots.forEach(([mx, mz], i) => {
    const roll = Math.random();
    if (roll < 0.35 && state.templates.hexTavern) {
      placeTemplate(state.templates.hexTavern, mx, 0, mz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.building,
        blockerScale: 0.45,
      });
    } else if (roll < 0.7 && state.templates.hexHouseA) {
      placeTemplate(state.templates.hexHouseA, mx, 0, mz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.building,
        blockerScale: 0.4,
      });
    } else if (roll < 0.9 && state.templates.hexHouseB) {
      placeTemplate(state.templates.hexHouseB, mx, 0, mz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.building,
        blockerScale: 0.4,
      });
    } else if (state.templates.hexTreeA) {
      placeTemplate(state.templates.hexTreeA, mx, 0, mz, {
        rotationY: Math.random() * 0.5,
        scale: hexVillageScaleProfile.tree,
        blockerScale: 0.25,
      });
    }
  });

  // Noble quarter - larger houses scattered
  for (let i = 0; i < 8; i++) {
    const nx = tileSize * (4 + Math.random() * 4);
    const nz = (Math.random() - 0.5) * tileSize * 6;
    const roll = Math.random();
    if (roll < 0.4 && state.templates.hexHouseB) {
      placeTemplate(state.templates.hexHouseB, nx, 0, nz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.building,
        blockerScale: 0.45,
      });
    } else if (roll < 0.7 && state.templates.hexHouseA) {
      placeTemplate(state.templates.hexHouseA, nx, 0, nz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.building,
        blockerScale: 0.4,
      });
    } else if (roll < 0.85 && state.templates.hexTower) {
      placeTemplate(state.templates.hexTower, nx, 0, nz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.tower,
        blockerScale: 0.4,
      });
    }
    if (Math.random() < 0.5 && state.templates.hexTreeA) {
      placeTemplate(state.templates.hexTreeA, nx + tileSize * 0.8, 0, nz, {
        scale: hexVillageScaleProfile.tree,
        blockerScale: 0.3,
      });
    }
  }
  for (let i = 0; i < 8; i++) {
    const nx = -tileSize * (4 + Math.random() * 4);
    const nz = (Math.random() - 0.5) * tileSize * 6;
    const roll = Math.random();
    if (roll < 0.4 && state.templates.hexHouseB) {
      placeTemplate(state.templates.hexHouseB, nx, 0, nz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.building,
        blockerScale: 0.45,
      });
    } else if (roll < 0.7 && state.templates.hexHouseA) {
      placeTemplate(state.templates.hexHouseA, nx, 0, nz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.building,
        blockerScale: 0.4,
      });
    } else if (roll < 0.85 && state.templates.hexTower) {
      placeTemplate(state.templates.hexTower, nx, 0, nz, {
        rotationY: Math.random() * Math.PI * 2,
        scale: hexVillageScaleProfile.tower,
        blockerScale: 0.4,
      });
    }
    if (Math.random() < 0.5 && state.templates.hexTreeA) {
      placeTemplate(state.templates.hexTreeA, nx - tileSize * 0.8, 0, nz, {
        scale: hexVillageScaleProfile.tree,
        blockerScale: 0.3,
      });
    }
  }

  // Church area with church and graveyard trees
  if (state.templates.hexChurch) {
    placeTemplate(state.templates.hexChurch, -tileSize * 3.5, 0, -tileSize, {
      rotationY: Math.PI / 6,
      scale: hexVillageScaleProfile.church,
      blockerScale: 0.5,
    });
  }
  const churchTrees = [
    [-tileSize * 2.5, -tileSize * 0.5], [-tileSize * 4, 0], [-tileSize * 3, tileSize * 0.5],
    [-tileSize * 2, -tileSize * 1.5], [-tileSize * 4.5, -tileSize],
  ];
  churchTrees.forEach(([cx, cz]) => {
    if (Math.random() < 0.6 && state.templates.hexTreeA) {
      placeTemplate(state.templates.hexTreeA, cx, 0, cz, {
        scale: hexVillageScaleProfile.tree,
        blockerScale: 0.35,
      });
    } else if (state.templates.hexTreeB) {
      placeTemplate(state.templates.hexTreeB, cx, 0, cz, {
        scale: hexVillageScaleProfile.tree * 0.98,
        blockerScale: 0.3,
      });
    }
  });

  // Outer ring - scattered houses and lots of trees
  for (let z = -depth + 2; z <= depth - 2; z++) {
    for (let x = -width + 2; x <= width - 2; x++) {
      const px = x * tileSize + (Math.abs(z) % 2 === 1 ? tileSize / 2 : 0);
      const pz = z * tileRowHeight;
      const dToCenter = Math.hypot(px, pz);
      
      if (dToCenter < 25 || (dToCenter > 30 && dToCenter < 50)) continue;
      
      if (Math.random() < 0.25) {
        const roll = Math.random();
        if (roll < 0.5 && state.templates.hexHouseA) {
          placeTemplate(state.templates.hexHouseA, px, 0, pz, {
            rotationY: Math.random() * Math.PI * 2,
            scale: hexVillageScaleProfile.cottage,
            blockerScale: 0.35,
          });
        } else if (roll < 0.8 && state.templates.hexHouseB) {
          placeTemplate(state.templates.hexHouseB, px, 0, pz, {
            rotationY: Math.random() * Math.PI * 2,
            scale: hexVillageScaleProfile.cottage,
            blockerScale: 0.35,
          });
        } else if (state.templates.hexTreeA) {
          placeTemplate(state.templates.hexTreeA, px, 0, pz, {
            scale: hexVillageScaleProfile.outerTree + Math.random() * 0.22,
            blockerScale: 0.35,
          });
        }
      } else if (Math.random() < 0.6 && state.templates.hexTreeA) {
        placeTemplate(state.templates.hexTreeA, px, 0, pz, {
          scale: hexVillageScaleProfile.outerTree + Math.random() * 0.24,
          blockerScale: 0.3,
        });
        if (Math.random() < 0.4 && state.templates.hexTreeB) {
          placeTemplate(state.templates.hexTreeB, px - tileSize * 0.4, 0, pz + tileSize * 0.3, {
            scale: hexVillageScaleProfile.tree * 0.92,
            blockerScale: 0.25,
          });
        }
      }
    }
  }

  // Village walls
  const wallSpan = width;
  buildWallRun({ axis: "x", fixed: wallLineZ, span: wallSpan, reverse: true, windowPattern: villageWindowPattern });
  buildWallRun({ axis: "x", fixed: -wallLineZ, span: wallSpan, reverse: false, windowPattern: villageWindowPattern });
  buildWallRun({ axis: "z", fixed: wallLineX, span: wallSpan, reverse: false, windowPattern: villageWindowPattern });
  buildWallRun({ axis: "z", fixed: -wallLineX, span: wallSpan, reverse: true, windowPattern: villageWindowPattern });

  // Corner towers
  const cornerSpots = [
    [wallLineX, wallLineZ, Math.PI], [-wallLineX, wallLineZ, Math.PI / 2],
    [wallLineX, -wallLineZ, -Math.PI / 2], [-wallLineX, -wallLineZ, 0]
  ];
  cornerSpots.forEach(([cx, cz, yaw]) => {
    if (state.templates.hexTower) {
      placeTemplate(state.templates.hexTower, cx, 0, cz, {
        rotationY: yaw,
        scale: hexVillageScaleProfile.tower * 1.04,
        blockerScale: 0.5,
      });
    }
  });

  // Gate at south entrance
  if (state.templates.hexCastle) {
    placeTemplate(state.templates.hexCastle, 0, 0, wallLineZ - tileSize * 0.5, {
      rotationY: Math.PI,
      scale: hexVillageScaleProfile.gate,
      blockerScale: 0.35,
    });
  }

  state.world.collectibleAnchors = [
    { x: 0, z: bounds.maxZ - tileSize * 1.2, score: 10.6 },
    { x: -tileSize * 2.8, z: tileSize * 3.6, score: 10.1 },
    { x: tileSize * 2.9, z: tileSize * 4.2, score: 10.05 },
    { x: -tileSize * 4.2, z: -tileSize * 0.8, score: 9.7 },
    { x: tileSize * 4.4, z: -tileSize * 0.2, score: 9.65 },
    { x: 0, z: -tileSize * 2.75, score: 10.9 },
    { x: -tileSize * 5.7, z: tileSize * 1.45, score: 9.25 },
    { x: tileSize * 5.9, z: tileSize * 1.05, score: 9.2 },
    { x: -tileSize * 1.15, z: -tileSize * 5.3, score: 8.95 },
    { x: tileSize * 1.55, z: tileSize * 6.1, score: 8.9 },
    { x: tileSize * 6.2, z: -tileSize * 4.4, score: 8.6 },
    { x: -tileSize * 6.1, z: tileSize * 5.05, score: 8.55 },
  ];
  
  state.world.chestAnchors = [
    [tileSize * 1.5, 0, tileSize * 4, { rotationY: Math.PI / 4, scale: 1.1, blockerScale: 0.4 }],
    [-tileSize * 2, 0, tileSize * 3, { rotationY: -Math.PI / 4, scale: 1.1, blockerScale: 0.4 }],
    [0, 0, -tileSize * 4, { rotationY: Math.PI, scale: 1.2, blockerScale: 0.45 }],
  ];

  state.player.position.set(state.world.spawn.x, state.world.floorTop, state.world.spawn.z);
  applyPlayerFloorHeight();
  state.player.heading = Math.PI;
  state.camera.yaw = Math.PI;
  state.camera.pitch = 0.5;
}

function buildWallRun({ axis, fixed, span, reverse, windowPattern = null }) {
  for (let index = -span; index <= span; index += 1) {
    const isWindow = typeof windowPattern === "function"
      ? windowPattern(index, span, axis)
      : Math.abs(index) === span - 1;
    const template = isWindow
      ? state.templates.wallWindow || state.templates.wall
      : state.templates.wall;

    if (!template) {
      continue;
    }

    if (axis === "x") {
      placeTemplate(template, index * state.world.tileSize, 0, fixed, {
        rotationY: reverse ? Math.PI : 0,
      });
    } else {
      placeTemplate(template, fixed, 0, index * state.world.tileSize, {
        rotationY: reverse ? -Math.PI / 2 : Math.PI / 2,
      });
    }
  }
}

function placeTemplate(template, x, y, z, options = {}) {
  if (!template) {
    return null;
  }

  const instance = template.clone(true);
  if (options.cameraIgnore) {
    applyNodeUserDataFlag(instance, "cameraIgnore");
  }
  if (options.scale) {
    instance.scale.multiplyScalar(options.scale);
  }
  instance.position.set(x, y, z);
  instance.rotation.y = options.rotationY ?? 0;
  freezeStaticObject(instance);
  worldGroup.add(instance);

  if (options.blockerScale) {
    const size = template.userData.size ?? { x: 1.5, z: 1.5 };
    state.blockers.push({
      kind: options.blockerKind ?? "static",
      x,
      z,
      halfX: (size.x * (options.scale ?? 1) * options.blockerScale) / 2,
      halfZ: (size.z * (options.scale ?? 1) * options.blockerScale) / 2,
    });
  }

  return instance;
}

function createTreasureChest(x, y, z, options = {}) {
  if (!state.templates.chest) {
    return null;
  }

  const root = new THREE.Group();
  const hoverGroup = new THREE.Group();
  const chest = state.templates.chest.clone(true);

  if (options.scale) {
    chest.scale.multiplyScalar(options.scale);
  }
  chest.rotation.y = options.rotationY ?? 0;
  chest.position.y = 0.78;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 1.66, qualityProfile.lowSpec ? 24 : 48),
    new THREE.MeshBasicMaterial({
      color: "#ffd873",
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;

  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, qualityProfile.lowSpec ? 14 : 24, qualityProfile.lowSpec ? 10 : 16),
    new THREE.MeshBasicMaterial({
      color: "#ffe09d",
      transparent: true,
      opacity: 0.22,
    }),
  );
  aura.position.y = 1;
  aura.scale.set(1.5, 0.82, 1.5);

  const light = qualityProfile.enableChestLights
    ? new THREE.PointLight("#ffcf77", 2.2, 11, 2)
    : null;
  light?.position.set(0, 1.55, 0);

  hoverGroup.add(chest);
  root.add(ring);
  root.add(aura);
  if (light) {
    root.add(light);
  }
  root.add(hoverGroup);
  root.position.set(x, y, z);
  worldGroup.add(root);

  if (options.blockerScale) {
    const size = state.templates.chest.userData.size ?? { x: 1.8, z: 1.8 };
    state.blockers.push({
      kind: "chest",
      x,
      z,
      halfX: (size.x * (options.scale ?? 1) * options.blockerScale) / 2,
      halfZ: (size.z * (options.scale ?? 1) * options.blockerScale) / 2,
    });
  }

  const id = state.chests.length + 1;
  state.chests.push({
    id,
    label: `Hazine Sandigi ${id}`,
    x,
    z,
    baseY: y,
    phase: pseudoRandom(id * 17.7) * Math.PI * 2,
    root,
    hoverGroup,
    chest,
    ring,
    aura,
    light,
    opened: false,
    openProgress: 0,
    loot: rollTreasureLoot(id * 21.3 + x * 0.8 + z * 0.45),
  });

  return root;
}

function rollTreasureLoot(seed) {
  const count = 2 + Math.floor(pseudoRandom(seed + 4.2) * 2);
  const picks = [];

  for (let index = 0; index < count; index += 1) {
    const tableIndex = Math.floor(pseudoRandom(seed + index * 7.13) * treasureLootTable.length);
    const base = treasureLootTable[tableIndex];
    picks.push({
      ...base,
      value: base.value + Math.round(pseudoRandom(seed + index * 11.7) * 55),
    });
  }

  return picks;
}

function getCollectibleBarrierHealth(seed) {
  return 2 + Math.floor(pseudoRandom(seed * 5.73) * 2);
}

function applyCollectibleBarrierVisuals(collectible) {
  const intact = collectible.barrierHp > 0;
  const barrierRatio = intact ? collectible.barrierHp / collectible.barrierMaxHp : 0;

  collectible.barrierBroken = !intact;
  collectible.shell.visible = intact;
  collectible.sealRing.visible = intact;
  collectible.plane.material.opacity = intact ? 0.84 : 1;
  collectible.shellOpacityBase = intact ? 0.14 + barrierRatio * 0.15 : 0;
  collectible.sealRingOpacityBase = intact ? 0.22 + barrierRatio * 0.2 : 0;

  collectible.ringMaterial.color?.set(intact ? "#8ee8ff" : "#ffe38a");
  collectible.shellMaterial.color?.set(intact ? (barrierRatio > 0.5 ? "#98eeff" : "#ffbe88") : "#ffe38a");
  collectible.sealRingMaterial.color?.set(intact ? (barrierRatio > 0.5 ? "#d8ffff" : "#ffd3b0") : "#ffe38a");

  if (collectible.ringMaterial.emissive?.set) {
    collectible.ringMaterial.emissive.set(intact ? "#3da7d8" : "#efb042");
    collectible.ringMaterial.emissiveIntensity = intact ? 0.78 + barrierRatio * 0.54 : 0.95;
  }

  if (collectible.shellMaterial.emissive?.set) {
    collectible.shellMaterial.emissive.set(intact ? (barrierRatio > 0.5 ? "#5bcfff" : "#ff9962") : "#ffd873");
    collectible.shellMaterial.emissiveIntensity = intact ? 0.42 + barrierRatio * 0.62 : 0;
  }
}

function damageCollectibleBarrier(collectible, color, damage = 1) {
  if (collectible.collected) {
    return false;
  }

  if (collectible.barrierHp <= 0) {
    collectOne(collectible, color);
    return true;
  }

  collectible.barrierHp = Math.max(0, collectible.barrierHp - damage);
  collectible.hitFlashUntil = state.elapsed + 0.22;
  applyCollectibleBarrierVisuals(collectible);
  spawnShockwave(collectible.group.position, color, 2.4 + damage * 0.36, 0.16);

  if (collectible.barrierHp <= 0) {
    collectible.breakFlashUntil = state.elapsed + 0.48;
    collectible.ring.scale.setScalar(1.18);
    spawnShockwave(collectible.group.position, "#c4f6ff", 4.2, 0.24);
    state.message = `${collectible.label} muhafazasi kirildi`;
    return false;
  }

  state.message = `${collectible.label} muhafaza ${collectible.barrierHp}/${collectible.barrierMaxHp}`;
  return false;
}

function getCollectibleAnchors() {
  const anchors = [];
  const bounds = state.world.bounds;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const columns = 7;
  const rows = 7;
  const insetX = width * 0.08;
  const insetZ = depth * 0.08;

  if (state.world.collectibleAnchors.length) {
    state.world.collectibleAnchors.forEach((anchor, index) => {
      anchors.push({
        x: anchor.x,
        z: anchor.z,
        y: anchor.y ?? 0,
        score: anchor.score ?? (7 + index * 0.02),
      });
    });
  }

  for (let gx = 0; gx < columns; gx += 1) {
    for (let gz = 0; gz < rows; gz += 1) {
      const progressX = columns === 1 ? 0.5 : gx / (columns - 1);
      const progressZ = rows === 1 ? 0.5 : gz / (rows - 1);
      const x = THREE.MathUtils.lerp(bounds.minX + insetX, bounds.maxX - insetX, progressX);
      const z = THREE.MathUtils.lerp(bounds.minZ + insetZ, bounds.maxZ - insetZ, progressZ);
      const jitterX = (pseudoRandom(gx * 17.1 + gz * 7.2 + state.world.phase * 11.3) - 0.5) * (width / columns) * 0.42;
      const jitterZ = (pseudoRandom(gx * 5.9 + gz * 19.4 + state.world.phase * 17.8) - 0.5) * (depth / rows) * 0.42;
      const candidateX = x + jitterX;
      const candidateZ = z + jitterZ;

      if (Math.hypot(candidateX, candidateZ) < state.world.tileSize * 0.9 && state.world.currentMap === "sunCourt") {
        continue;
      }
      if (Math.abs(candidateX - state.world.spawn.x) < state.world.tileSize * 0.6 && Math.abs(candidateZ - state.world.spawn.z) < state.world.tileSize * 0.9) {
        continue;
      }

      anchors.push({
        x: candidateX,
        z: candidateZ,
        score: pseudoRandom((gx + 4) * 37 + (gz + 9) * 29 + state.world.phase * 61)
          + Math.abs(progressX - 0.5) * 0.25
          + Math.abs(progressZ - 0.5) * 0.18,
      });
    }
  }

  return anchors;
}

function createCollectibles(textures, targetCount = textures.length) {
  const availableTextures = textures.filter((asset) => !state.collectedLetterIds.has(asset.id));
  const spawnCount = Math.min(targetCount, availableTextures.length);
  if (!spawnCount) {
    return 0;
  }

  getCollectibleAnchors()
    .sort((left, right) => right.score - left.score)
    .slice(0, spawnCount)
    .forEach((anchor, index) => {
      const asset = availableTextures[index];
      const group = new THREE.Group();
      const letterScale = state.settings.letterScale / 100;
      const barrierMaxHp = getCollectibleBarrierHealth(asset.id + index * 0.37);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(
          collectibleVisualProfile.glyphSize * letterScale,
          collectibleVisualProfile.glyphSize * letterScale,
        ),
        new THREE.MeshBasicMaterial({
          map: asset.texture,
          transparent: true,
          alphaTest: 0.25,
          opacity: 0.84,
          side: THREE.DoubleSide,
        }),
      );
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: "#8ee8ff",
        emissive: "#3da7d8",
        emissiveIntensity: 0.9,
        metalness: 0.18,
        roughness: 0.45,
      });
      const lowSpecRingMaterial = new THREE.MeshBasicMaterial({
        color: "#8ee8ff",
        transparent: true,
        opacity: 0.92,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          collectibleVisualProfile.ringRadius * letterScale,
          collectibleVisualProfile.ringTube * letterScale,
          12,
          40,
        ),
        qualityProfile.lowSpec ? lowSpecRingMaterial : ringMaterial,
      );
      const shellMaterial = qualityProfile.lowSpec
        ? new THREE.MeshBasicMaterial({
          color: "#9fe9ff",
          transparent: true,
          opacity: 0.26,
        })
        : new THREE.MeshStandardMaterial({
          color: "#9fe9ff",
          emissive: "#5bcfff",
          emissiveIntensity: 1,
          transparent: true,
          opacity: 0.26,
          metalness: 0.05,
          roughness: 0.12,
        });
      const sealRingMaterial = new THREE.MeshBasicMaterial({
        color: "#d8ffff",
        transparent: true,
        opacity: 0.36,
      });
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(
          collectibleVisualProfile.shellRadius * letterScale,
          qualityProfile.lowSpec ? 0 : 1,
        ),
        shellMaterial,
      );
      const sealRing = new THREE.Mesh(
        new THREE.TorusGeometry(
          collectibleVisualProfile.sealRadius * letterScale,
          0.036 * letterScale,
          10,
          34,
        ),
        sealRingMaterial,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12;
      shell.position.y = collectibleVisualProfile.shellHeight * letterScale;
      shell.scale.set(1, 1.16, 1);
      sealRing.rotation.x = Math.PI / 2;
      sealRing.position.y = shell.position.y;

      plane.castShadow = qualityProfile.enableShadows;
      plane.position.y = collectibleVisualProfile.shellHeight * letterScale;
      const anchorFloorHeight = getStageFloorHeight(anchor.x, anchor.z) + (anchor.y ?? 0);
      group.add(ring);
      group.add(shell);
      group.add(sealRing);
      group.add(plane);
      group.position.set(anchor.x, anchorFloorHeight + 0.04, anchor.z);
      collectibleGroup.add(group);

      const collectible = {
        id: asset.id,
        label: asset.label,
        meta: asset.meta,
        imageHref: asset.href,
        x: anchor.x,
        z: anchor.z,
        baseY: plane.position.y,
        scale: letterScale,
        barrierHp: barrierMaxHp,
        barrierMaxHp,
        barrierBroken: false,
        hitFlashUntil: 0,
        breakFlashUntil: 0,
        collected: false,
        group,
        plane,
        ring,
        shell,
        sealRing,
        ringMaterial: qualityProfile.lowSpec ? lowSpecRingMaterial : ringMaterial,
        shellMaterial,
        sealRingMaterial,
        shellBaseScale: shell.scale.clone(),
        sealRingBaseScale: sealRing.scale.clone(),
        shellOpacityBase: 0.26,
        sealRingOpacityBase: 0.36,
      };

      applyCollectibleBarrierVisuals(collectible);
      state.collectibles.push(collectible);
    });

  return spawnCount;
}

function getChestAnchors(tileSize) {
  if (state.world.chestAnchors.length) {
    return state.world.chestAnchors;
  }

  return [
    [0, 0, -tileSize * 1.08, { rotationY: Math.PI, scale: 1.06, blockerScale: 0.4 }],
    [-tileSize * 2.36, 0, -tileSize * 1.24, { rotationY: Math.PI * 0.14, scale: 0.98, blockerScale: 0.38 }],
    [tileSize * 2.32, 0, -tileSize * 1.18, { rotationY: -Math.PI * 0.14, scale: 0.98, blockerScale: 0.38 }],
    [-tileSize * 1.9, 0, tileSize * 1.96, { rotationY: Math.PI * 0.48, scale: 0.96, blockerScale: 0.34 }],
    [tileSize * 1.9, 0, tileSize * 2.02, { rotationY: -Math.PI * 0.48, scale: 0.96, blockerScale: 0.34 }],
  ];
}

function buildTreasureChests(tileSize) {
  const anchors = getChestAnchors(tileSize);
  const density = state.settings.chestDensity / 100;
  const targetCount = THREE.MathUtils.clamp(Math.round(anchors.length * density), 1, anchors.length);

  anchors.slice(0, targetCount).forEach(([x, y, z, options]) => {
    const floorHeight = getStageFloorHeight(x, z) + (y ?? 0);
    createTreasureChest(x, floorHeight, z, options);
  });
}

function clearTreasureChests() {
  state.chests.forEach((chest) => {
    worldGroup.remove(chest.root);
  });
  state.chests = [];
  state.blockers = state.blockers.filter((blocker) => blocker.kind !== "chest");
}

function clearCollectibles() {
  state.collectibles.forEach((collectible) => {
    collectibleGroup.remove(collectible.group);
  });
  state.collectibles = [];
}

function buildSkillUi() {
  dom.skillDock.innerHTML = "";
  dom.touchActions.innerHTML = "";
  state.skillUi.clear();
  refreshSkillKeyMap();

  const desktopUtilityActions = [
    {
      short: "ETK",
      key: "E",
      glyph: "✦",
      colorA: "#c7ef85",
      colorB: "#5d9724",
      onClick: () => {
        unlockAudio();
        if (!tryUseStagePortal()) {
          interactWithNearestChest();
        }
      },
    },
  ];

  const attackButton = document.createElement("button");
  attackButton.className = "touch-action-button touch-action-button--attack";
  attackButton.type = "button";
  attackButton.setAttribute("aria-label", "Normal atak");
  attackButton.innerHTML = `
    <span class="touch-action-button__glyph">ATK</span>
    <span class="touch-action-button__label">Vur</span>
  `;
  const releaseAttack = (event) => {
    event?.stopPropagation();
    state.player.attackHeld = false;
    attackButton.classList.remove("is-pressed");
  };
  attackButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    unlockAudio();
    clearMoveTarget();
    state.player.attackHeld = true;
    attackButton.classList.add("is-pressed");
    performBasicAttack();
  });
  ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach((eventName) => {
    attackButton.addEventListener(eventName, releaseAttack);
  });
  dom.touchActions.append(attackButton);

  const sprintButton = document.createElement("button");
  sprintButton.className = "touch-action-button touch-action-button--sprint";
  sprintButton.type = "button";
  sprintButton.setAttribute("aria-label", "Kos");
  sprintButton.innerHTML = `
    <span class="touch-action-button__glyph">KOS</span>
    <span class="touch-action-button__label">Kos</span>
  `;
  const releaseSprint = (event) => {
    event?.stopPropagation();
    state.keys.delete("shift");
    sprintButton.classList.remove("is-pressed");
  };
  sprintButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    unlockAudio();
    state.keys.add("shift");
    sprintButton.classList.add("is-pressed");
  });
  ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach((eventName) => {
    sprintButton.addEventListener(eventName, releaseSprint);
  });
  dom.touchActions.append(sprintButton);

  const interactButton = document.createElement("button");
  interactButton.className = "touch-action-button touch-action-button--interact";
  interactButton.type = "button";
  interactButton.setAttribute("aria-label", "Etkilesim");
  interactButton.innerHTML = `
    <span class="touch-action-button__glyph">E</span>
    <span class="touch-action-button__label">Ac</span>
  `;
  const releaseInteract = (event) => {
    event?.stopPropagation();
    interactButton.classList.remove("is-pressed");
  };
  interactButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    interactButton.classList.add("is-pressed");
  });
  ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach((eventName) => {
    interactButton.addEventListener(eventName, releaseInteract);
  });
  interactButton.addEventListener("click", () => {
    unlockAudio();
    if (!tryUseStagePortal()) {
      interactWithNearestChest();
    }
  });
  dom.touchActions.append(interactButton);

  desktopUtilityActions.forEach((action) => {
    const button = document.createElement("button");
    button.className = "skill-button skill-button--utility";
    button.type = "button";
    button.style.setProperty("--accent-a", action.colorA);
    button.style.setProperty("--accent-b", action.colorB);
    button.setAttribute("aria-label", `${action.short} ${action.key}`);
    button.innerHTML = `
      <span class="skill-button__icon"></span>
      <span class="skill-button__glyph">${action.glyph}</span>
      <span class="skill-button__meta">
        <span class="skill-button__name">${action.short}</span>
        <span class="skill-button__key">${action.key}</span>
      </span>
    `;
    button.addEventListener("click", action.onClick);
    dom.skillDock.append(button);
  });

  state.skills.forEach((skill, index) => {
    const button = document.createElement("button");
    button.className = "skill-button";
    button.type = "button";
    button.style.setProperty("--accent-a", skill.colorA);
    button.style.setProperty("--accent-b", skill.colorB);
    button.innerHTML = `
      <span class="skill-button__icon"></span>
      <span class="skill-button__glyph">${skill.glyph}</span>
      <span class="skill-button__meta">
        <span class="skill-button__name">${skill.short}</span>
        <span class="skill-button__key">${skill.key}</span>
      </span>
      <span class="skill-button__cooldown">0.0</span>
    `;
    button.addEventListener("click", () => useSkill(skill.id));

    const cooldownLabel = button.querySelector(".skill-button__cooldown");
    dom.skillDock.append(button);

    const touchSkillSlots = shouldUseTouchJoystick()
      ? (window.innerWidth <= 640
        ? [
          { x: -3.45, y: -2.45 },
          { x: -3.55, y: -5.7 },
          { x: -6.75, y: -4.95 },
          { x: -6.9, y: -1.75 },
        ]
        : [
          { x: -3.1, y: -2.2 },
          { x: -3.2, y: -4.9 },
          { x: -5.85, y: -4.35 },
          { x: -5.95, y: -1.55 },
        ])
      : [
        { x: -2.8, y: -2.9 },
        { x: -0.5, y: -5.1 },
        { x: -5.3, y: -5.2 },
        { x: -5.45, y: -1.2 },
      ];
    const slot = touchSkillSlots[index] ?? touchSkillSlots[touchSkillSlots.length - 1] ?? { x: -2.6, y: -2.6 };
    const touchButton = document.createElement("button");
    touchButton.className = "touch-action-button touch-action-button--skill";
    touchButton.type = "button";
    touchButton.style.setProperty("--accent-a", skill.colorA);
    touchButton.style.setProperty("--accent-b", skill.colorB);
    touchButton.style.setProperty("--orbit-x", `${slot.x.toFixed(2)}rem`);
    touchButton.style.setProperty("--orbit-y", `${slot.y.toFixed(2)}rem`);
    touchButton.innerHTML = `
      <span class="touch-action-button__glyph">${skill.glyph}</span>
      <span class="touch-action-button__label">${skill.short}</span>
      <span class="touch-action-button__key">${skill.key}</span>
      <span class="touch-action-button__cooldown">0.0</span>
    `;
    touchButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    touchButton.addEventListener("click", () => useSkill(skill.id));
    dom.touchActions.append(touchButton);

    state.skillUi.set(skill.id, {
      button,
      cooldownLabel,
      touchButton,
      touchCooldownLabel: touchButton.querySelector(".touch-action-button__cooldown"),
    });
  });
}

function buildXpRack() {
  dom.xpRack.innerHTML = "";
  state.ui.xpCells = [];

  for (let index = 0; index < xpCubeCount; index += 1) {
    const cell = document.createElement("span");
    cell.className = "xp-cube";

    const fill = document.createElement("span");
    fill.className = "xp-cube__fill";
    cell.append(fill);
    dom.xpRack.append(cell);

    state.ui.xpCells.push({ cell, fill });
  }
}

function isLetterAssignedToStage(letterId, stageKey = state.world.stageKey) {
  const letterIndex = letterIndexById.get(letterId);
  if (letterIndex === undefined) {
    return false;
  }

  const [start, end] = stageLetterRanges[getStageKey(stageKey)] ?? [0, totalLetterCount];
  return letterIndex >= start && letterIndex < end;
}

function getLetterAssetById(letterId) {
  const letterIndex = letterIndexById.get(letterId);
  if (letterIndex === undefined) {
    return null;
  }

  return state.letterTextures[letterIndex] ?? letterAssets[letterIndex] ?? null;
}

function openCollectedAlphabetLetterCard(letterId) {
  if (!state.collectedLetterIds.has(letterId)) {
    return false;
  }

  const asset = getLetterAssetById(letterId);
  if (!asset?.meta) {
    return false;
  }

  toggleQuestWindow(false);
  toggleSettingsPanel(false);
  return openLetterCard(asset.meta, asset.href);
}

function buildAlphabetHud(assets = state.letterTextures.length ? state.letterTextures : letterAssets) {
  if (!dom.alphabetGrid) {
    return;
  }

  dom.alphabetGrid.innerHTML = "";
  state.ui.alphabetEntries.clear();
  state.ui.alphabetDirty = true;

  assets.forEach((asset) => {
    const slot = document.createElement("div");
    slot.className = "alphabet-chip-slot";
    slot.setAttribute("role", "listitem");

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "alphabet-chip";
    chip.dataset.letterId = String(asset.id);
    chip.title = asset.label;
    chip.setAttribute("aria-haspopup", "dialog");
    chip.innerHTML = `
      <span class="alphabet-chip__glow" aria-hidden="true"></span>
      <img class="alphabet-chip__image" src="${asset.href}" alt="" loading="lazy" decoding="async" />
    `;
    chip.addEventListener("click", () => {
      openCollectedAlphabetLetterCard(asset.id);
    });
    slot.append(chip);
    dom.alphabetGrid.append(slot);
    state.ui.alphabetEntries.set(asset.id, { slot, chip });
  });

  syncAlphabetHud(true);
}

function syncAlphabetHud(force = false) {
  if (!dom.alphabetProgress || !state.ui.alphabetEntries.size) {
    return;
  }

  const progressLabel = `${state.collectedLetterIds.size} / ${totalLetterCount}`;
  if (state.ui.alphabetProgressLabel !== progressLabel) {
    dom.alphabetProgress.textContent = progressLabel;
    state.ui.alphabetProgressLabel = progressLabel;
  }

  const stageKeyChanged = state.ui.alphabetStageKey !== state.world.stageKey;
  if (!force && !state.ui.alphabetDirty && !stageKeyChanged) {
    return;
  }

  state.ui.alphabetStageKey = state.world.stageKey;
  state.ui.alphabetEntries.forEach((entry, letterId) => {
    const chip = entry?.chip ?? entry;
    const collected = state.collectedLetterIds.has(letterId);
    const activeStageLetter = isLetterAssignedToStage(letterId);
    const asset = getLetterAssetById(letterId);
    const canOpenCard = Boolean(collected && asset?.meta);

    chip.classList.toggle("is-collected", collected);
    chip.classList.toggle("is-stage-active", !collected && activeStageLetter);
    chip.classList.toggle("is-interactive", canOpenCard);
    chip.tabIndex = canOpenCard ? 0 : -1;
    chip.setAttribute("aria-disabled", String(!canOpenCard));
    chip.title = canOpenCard
      ? `${asset?.label ?? `Harf ${letterId}`} kartini ac`
      : asset?.label ?? `Harf ${letterId}`;
    chip.setAttribute(
      "aria-label",
      `${asset?.label ?? `Harf ${letterId}`} ${canOpenCard ? "toplandi, kartini ac" : collected ? "toplandi" : activeStageLetter ? "bu bolgede bekliyor" : "henuz toplanmadi"}`,
    );
  });
  state.ui.alphabetDirty = false;
}

function loadStoredSettings() {
  try {
    const raw = window.localStorage.getItem(settingsStorageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const next = { ...parsed };
    const version = Number(next.settingsVersion ?? 0) || 0;
    delete next.settingsVersion;

    if (!next.quality || next.quality === "auto") {
      next.quality = "low";
    }

    if (version < settingsStorageVersion) {

      if (
        typeof next.musicEnabled !== "boolean"
        || (next.musicEnabled === true && Number(next.musicVolume ?? defaultSettings.musicVolume) === defaultSettings.musicVolume)
      ) {
        next.musicEnabled = false;
      }
    }

    return next;
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify({
      ...state.settings,
      settingsVersion: settingsStorageVersion,
      fullscreen: false,
    }));
  } catch {
    // Ignore storage failures.
  }
}

function readNumericSetting(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeSettings(partial) {
  return {
    quality: ["auto", "low", "medium", "high"].includes(partial.quality) ? partial.quality : defaultSettings.quality,
    letterDensity: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.letterDensity, defaultSettings.letterDensity)), 40, 150),
    chestDensity: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.chestDensity, defaultSettings.chestDensity)), 50, 180),
    characterScale: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.characterScale, defaultSettings.characterScale)), 80, 130),
    letterScale: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.letterScale, defaultSettings.letterScale)), 70, 150),
    masterVolume: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.masterVolume, defaultSettings.masterVolume)), 0, 100),
    musicVolume: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.musicVolume, defaultSettings.musicVolume)), 0, 100),
    sfxVolume: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.sfxVolume, defaultSettings.sfxVolume)), 0, 100),
    musicEnabled: Boolean(partial.musicEnabled),
    footstepsEnabled: Boolean(partial.footstepsEnabled),
    minimapEnabled: Boolean(partial.minimapEnabled),
    showHints: Boolean(partial.showHints),
    reduceMotion: Boolean(partial.reduceMotion),
    showFps: Boolean(partial.showFps),
    cameraSensitivity: THREE.MathUtils.clamp(Math.round(readNumericSetting(partial.cameraSensitivity, defaultSettings.cameraSensitivity)), 50, 180),
    invertY: Boolean(partial.invertY),
    fullscreen: Boolean(partial.fullscreen),
  };
}

function populateSettingsForm(settings) {
  dom.settingsForm.elements.quality.value = settings.quality;
  dom.settingsForm.elements.letterDensity.value = String(settings.letterDensity);
  dom.settingsForm.elements.chestDensity.value = String(settings.chestDensity);
  dom.settingsForm.elements.characterScale.value = String(settings.characterScale);
  dom.settingsForm.elements.letterScale.value = String(settings.letterScale);
  dom.settingsForm.elements.masterVolume.value = String(settings.masterVolume);
  dom.settingsForm.elements.musicVolume.value = String(settings.musicVolume);
  dom.settingsForm.elements.sfxVolume.value = String(settings.sfxVolume);
  dom.settingsForm.elements.musicEnabled.checked = settings.musicEnabled;
  dom.settingsForm.elements.footstepsEnabled.checked = settings.footstepsEnabled;
  dom.settingsForm.elements.minimapEnabled.checked = settings.minimapEnabled;
  dom.settingsForm.elements.showHints.checked = settings.showHints;
  dom.settingsForm.elements.reduceMotion.checked = settings.reduceMotion;
  dom.settingsForm.elements.showFps.checked = settings.showFps;
  dom.settingsForm.elements.cameraSensitivity.value = String(settings.cameraSensitivity);
  dom.settingsForm.elements.invertY.checked = settings.invertY;
  dom.settingsForm.elements.fullscreen.checked = document.fullscreenElement !== null;
}

function readSettingsForm() {
  return normalizeSettings({
    quality: dom.settingsForm.elements.quality.value,
    letterDensity: dom.settingsForm.elements.letterDensity.value,
    chestDensity: dom.settingsForm.elements.chestDensity.value,
    characterScale: dom.settingsForm.elements.characterScale.value,
    letterScale: dom.settingsForm.elements.letterScale.value,
    masterVolume: dom.settingsForm.elements.masterVolume.value,
    musicVolume: dom.settingsForm.elements.musicVolume.value,
    sfxVolume: dom.settingsForm.elements.sfxVolume.value,
    musicEnabled: dom.settingsForm.elements.musicEnabled.checked,
    footstepsEnabled: dom.settingsForm.elements.footstepsEnabled.checked,
    minimapEnabled: dom.settingsForm.elements.minimapEnabled.checked,
    showHints: dom.settingsForm.elements.showHints.checked,
    reduceMotion: dom.settingsForm.elements.reduceMotion.checked,
    showFps: dom.settingsForm.elements.showFps.checked,
    cameraSensitivity: dom.settingsForm.elements.cameraSensitivity.value,
    invertY: dom.settingsForm.elements.invertY.checked,
    fullscreen: dom.settingsForm.elements.fullscreen.checked,
  });
}

function updateSettingsValueLabels() {
  document.querySelectorAll("[data-value-for]").forEach((label) => {
    const input = document.getElementById(label.dataset.valueFor);
    if (!input) {
      return;
    }
    if (input.type === "range") {
      label.textContent = `${input.value}%`;
    }
  });
}

function toggleSettingsPanel(force) {
  const nextVisible = typeof force === "boolean" ? force : !state.ui.settingsVisible;
  if (nextVisible && state.ui.letterCardVisible) {
    closeLetterCard({ silent: true });
  }
  state.ui.settingsVisible = nextVisible;
  dom.settingsPanel.classList.toggle("is-open", nextVisible);
  dom.settingsPanel.setAttribute("aria-hidden", String(!nextVisible));
  dom.settingsTab.classList.toggle("is-active", nextVisible);
  dom.settingsTab.setAttribute("aria-expanded", String(nextVisible));
  if (nextVisible) {
    populateSettingsForm({
      ...state.settings,
      fullscreen: document.fullscreenElement !== null,
    });
    updateSettingsValueLabels();
  }
}

function applyCharacterScale() {
  if (!state.player.model) {
    return;
  }

  const scaleFactor = state.settings.characterScale / 100;
  const crouchFactor = THREE.MathUtils.lerp(1, 0.76, state.player.crouchAmount);
  state.player.model.scale.set(
    state.player.baseScale.x * scaleFactor,
    state.player.baseScale.y * scaleFactor * crouchFactor,
    state.player.baseScale.z * scaleFactor,
  );
  state.player.height = state.player.baseHeight * scaleFactor * crouchFactor;
}

function rebuildConfiguredContent() {
  if (!state.loaded) {
    state.totalCollectibles = getOverallTargetCollectibleCount();
    return;
  }

  clearBannerAura();
  clearShockwaves();
  clearLootBursts();
  clearTreasureChests();
  buildTreasureChests(state.world.tileSize);
  clearCollectibles();
  state.totalCollectibles = getOverallTargetCollectibleCount();
  state.world.stageCollectibleTotal = getTargetCollectibleCount(state.world.stageKey);
  createCollectibles(getStageLetterPool(state.world.stageKey), state.world.stageCollectibleTotal);
  void configureSimulationWorld();
}

function getEffectiveQualityConfig() {
  const autoLowSpec = qualityProfile.autoLowSpec ?? qualityProfile.lowSpec;
  switch (state.settings.quality) {
    case "low":
      return { lowSpec: true, pixelRatioCap: 1, shadows: false, chestLights: false, minimapSize: 164 };
    case "medium":
      return { lowSpec: false, pixelRatioCap: 1.25, shadows: true, chestLights: true, minimapSize: 196 };
    case "high":
      return { lowSpec: false, pixelRatioCap: 1.75, shadows: true, chestLights: true, minimapSize: 220 };
    default:
      return {
        lowSpec: autoLowSpec,
        pixelRatioCap: autoLowSpec ? 1 : 1.75,
        shadows: !autoLowSpec,
        chestLights: !autoLowSpec,
        minimapSize: autoLowSpec ? 164 : 220,
      };
  }
}

function applyQualitySettings() {
  const config = getEffectiveQualityConfig();
  qualityProfile.lowSpec = config.lowSpec;
  qualityProfile.pixelRatioCap = config.pixelRatioCap;
  qualityProfile.enableShadows = config.shadows;
  qualityProfile.enableChestLights = config.chestLights;
  qualityProfile.uiInterval = config.lowSpec ? 0.08 : 1 / 30;
  qualityProfile.minimapInterval = config.lowSpec ? 0.12 : 1 / 15;

  document.body.classList.toggle("quality-lite", config.lowSpec);
  if (renderer) {
    configureRenderer(renderer, qualityProfile);
  }

  dom.minimapCanvas.width = config.minimapSize;
  dom.minimapCanvas.height = config.minimapSize;

  scene.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = config.shadows;
      node.receiveShadow = config.shadows;
    }
    if (node.isPointLight) {
      node.visible = config.chestLights;
    }
    if (node.isDirectionalLight) {
      node.castShadow = config.shadows;
    }
  });
}

function applyUiSettings() {
  dom.minimapShell.style.display = state.settings.minimapEnabled ? "" : "none";
  if (!shouldUseTouchJoystick()) {
    state.ui.mobileMinimapCollapsed = false;
  }
  toggleMobileMinimap(state.ui.mobileMinimapCollapsed);
  dom.fpsMeter.textContent = shouldUseTouchJoystick()
    ? `${state.performance.fpsValue}`
    : `FPS ${state.performance.fpsValue}`;
  dom.fpsMeter.classList.toggle("is-visible", state.settings.showFps);
  dom.fpsMeter.setAttribute("aria-hidden", String(!state.settings.showFps));
}

function toggleMobileMinimap(force) {
  const mobile = shouldUseTouchJoystick();
  const canCollapse = mobile && state.settings.minimapEnabled;
  const nextCollapsed = canCollapse
    ? (typeof force === "boolean" ? force : !state.ui.mobileMinimapCollapsed)
    : false;
  state.ui.mobileMinimapCollapsed = nextCollapsed;
  dom.minimapShell.classList.toggle("is-collapsed", canCollapse && nextCollapsed);

  if (!dom.minimapToggle) {
    return;
  }

  dom.minimapToggle.hidden = !canCollapse;
  dom.minimapToggle.textContent = nextCollapsed ? "+" : "-";
  dom.minimapToggle.setAttribute("aria-pressed", String(!nextCollapsed));
  dom.minimapToggle.setAttribute("aria-label", nextCollapsed ? "Mini haritayi ac" : "Mini haritayi gizle");
}

function applySettings(nextSettings) {
  const previous = { ...state.settings };
  state.settings = normalizeSettings(nextSettings);
  applyQualitySettings();
  applyUiSettings();
  applyAudioSettings();
  applyCharacterScale();
  saveSettings();
  populateSettingsForm({
    ...state.settings,
    fullscreen: document.fullscreenElement !== null,
  });
  updateSettingsValueLabels();

  const rebuildNeeded = previous.letterDensity !== state.settings.letterDensity
    || previous.chestDensity !== state.settings.chestDensity
    || previous.letterScale !== state.settings.letterScale;
  if (rebuildNeeded) {
    void resetGame(state.mode === "menu");
  } else {
    void requestSimulationReset(state.player.position);
    updateOverlays(0, true);
    render();
  }

  if (state.player.model) {
    state.player.model.position.copy(state.player.position);
  }

  if (state.settings.fullscreen !== (document.fullscreenElement !== null)) {
    void toggleFullscreen();
  }

  showToast("Ayarlar uygulandi");
}

function ensureAudioContext() {
  if (audioState.context) {
    return audioState.context;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  const context = new AudioContextClass();
  const masterGain = context.createGain();
  const musicGain = context.createGain();
  const sfxGain = context.createGain();

  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(context.destination);

  audioState.context = context;
  audioState.masterGain = masterGain;
  audioState.musicGain = musicGain;
  audioState.sfxGain = sfxGain;
  audioState.noiseBuffer = createNoiseBuffer(context);
  return context;
}

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.12), context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function ensureMusicTrack() {
  if (audioState.musicElement) {
    return audioState.musicElement;
  }

  const track = new Audio(backgroundMusicUrl);
  track.loop = true;
  track.preload = "auto";
  track.crossOrigin = "anonymous";
  track.volume = 1;
  track.setAttribute("playsinline", "true");
  track.addEventListener("error", () => {
    audioState.musicTrackFailed = true;
  });

  audioState.musicElement = track;
  return track;
}

function syncMusicTrackPlayback() {
  const track = ensureMusicTrack();
  if (!track) {
    return;
  }

  const shouldPlay = audioState.musicUnlocked
    && !audioState.musicTrackFailed
    && state.settings.musicEnabled
    && state.settings.masterVolume > 0
    && state.settings.musicVolume > 0
    && state.mode !== "loading";

  if (!shouldPlay) {
    track.pause();
    return;
  }

  const playPromise = track.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {});
  }
}

function applyAudioSettings() {
  if (audioState.context && audioState.masterGain) {
    audioState.masterGain.gain.value = state.settings.masterVolume / 100;
    audioState.musicGain.gain.value = state.settings.musicEnabled ? (state.settings.musicVolume / 100) * 0.24 : 0;
    audioState.sfxGain.gain.value = (state.settings.sfxVolume / 100) * 0.48;
  }

  if (audioState.musicElement) {
    audioState.musicElement.volume = (state.settings.masterVolume / 100) * (state.settings.musicVolume / 100);
    audioState.musicElement.muted = !state.settings.musicEnabled || state.settings.masterVolume <= 0 || state.settings.musicVolume <= 0;
  }

  syncMusicTrackPlayback();
}

function unlockAudio(options = {}) {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }
  if (context.state === "suspended") {
    void context.resume();
  }
  audioState.musicUnlocked = true;
  if (!audioState.nextMusicAt) {
    audioState.nextMusicAt = state.elapsed + 0.12;
  }
  if (options.primeSpeech !== false) {
    primeSpeechSynthesis();
  } else {
    ensureSpeechSynthesisSetup();
  }
  applyAudioSettings();
  syncMusicTrackPlayback();
}

function playTone({ frequency, duration = 0.12, gain = 0.02, type = "triangle", target = "sfx", startOffset = 0, glideTo = null }) {
  const context = ensureAudioContext();
  if (!context || !audioState.musicUnlocked || context.state !== "running") {
    return;
  }

  const destination = target === "music" ? audioState.musicGain : audioState.sfxGain;
  const now = context.currentTime + startOffset;
  const oscillator = context.createOscillator();
  const amp = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(glideTo, now + duration);
  }
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(amp);
  amp.connect(destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playNoiseBurst({ gain = 0.012, duration = 0.07, frequency = 220 }) {
  const context = ensureAudioContext();
  if (!context || !audioState.musicUnlocked || context.state !== "running" || !audioState.noiseBuffer) {
    return;
  }

  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = audioState.noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(frequency, now);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(audioState.sfxGain);
  source.start(now);
  source.stop(now + duration + 0.02);
}

function playWarriorVoiceCue(type = "attack") {
  const context = ensureAudioContext();
  if (
    !context
    || !audioState.musicUnlocked
    || context.state !== "running"
    || !audioState.noiseBuffer
    || state.settings.sfxVolume <= 0
    || state.settings.masterVolume <= 0
    || state.elapsed < audioState.nextVoiceAt
  ) {
    return;
  }

  audioState.nextVoiceAt = state.elapsed + (type === "warcry" ? 0.82 : type === "charge" ? 0.46 : 0.28);
  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = audioState.noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = type === "warcry" ? 1.2 : 1.8;
  filter.frequency.setValueAtTime(type === "warcry" ? 260 : type === "charge" ? 210 : 320, now);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(type === "warcry" ? 0.026 : 0.018, now + 0.018);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + (type === "warcry" ? 0.3 : 0.16));
  source.connect(filter);
  filter.connect(amp);
  amp.connect(audioState.sfxGain);
  source.start(now);
  source.stop(now + (type === "warcry" ? 0.32 : 0.18));

  playTone({
    frequency: type === "warcry" ? 156 : type === "charge" ? 138 : 184,
    glideTo: type === "warcry" ? 124 : 112,
    duration: type === "warcry" ? 0.24 : 0.12,
    gain: type === "warcry" ? 0.012 : 0.008,
    type: "sawtooth",
  });
}

function playAttackSound(step) {
  const attackFrequencies = [430, 510, 620];
  const freq = attackFrequencies[(step - 1 + attackFrequencies.length) % attackFrequencies.length];
  playNoiseBurst({ gain: 0.014 + step * 0.003, duration: 0.08, frequency: 320 + step * 40 });
  playTone({ frequency: freq, glideTo: freq * 0.66, duration: 0.12, gain: 0.028 + step * 0.004, type: "triangle" });
  playWarriorVoiceCue(step >= 3 ? "warcry" : "attack");
}

function playSkillSound(effectType) {
  switch (effectType) {
    case "slash":
      playAttackSound(2);
      break;
    case "bash":
      playNoiseBurst({ gain: 0.02, duration: 0.08, frequency: 180 });
      playTone({ frequency: 152, glideTo: 110, duration: 0.14, gain: 0.026, type: "triangle" });
      playWarriorVoiceCue("attack");
      break;
    case "whirlwind":
      playNoiseBurst({ gain: 0.018, duration: 0.12, frequency: 360 });
      playTone({ frequency: 392, glideTo: 466, duration: 0.16, gain: 0.02, type: "sawtooth" });
      playTone({ frequency: 523, glideTo: 330, duration: 0.18, gain: 0.015, type: "triangle", startOffset: 0.05 });
      playWarriorVoiceCue("warcry");
      break;
    case "charge":
      playTone({ frequency: 210, glideTo: 420, duration: 0.18, gain: 0.024, type: "sawtooth" });
      playNoiseBurst({ gain: 0.014, duration: 0.07, frequency: 280 });
      playWarriorVoiceCue("charge");
      break;
    case "warcry":
      playTone({ frequency: 220, duration: 0.24, gain: 0.022, type: "triangle" });
      playTone({ frequency: 330, glideTo: 440, duration: 0.28, gain: 0.018, type: "sine", startOffset: 0.04 });
      playWarriorVoiceCue("warcry");
      break;
    case "banner":
      playTone({ frequency: 392, duration: 0.22, gain: 0.018, type: "triangle" });
      playTone({ frequency: 523.25, duration: 0.24, gain: 0.014, type: "sine", startOffset: 0.06 });
      playTone({ frequency: 659.25, duration: 0.26, gain: 0.012, type: "sine", startOffset: 0.12 });
      break;
    default:
      break;
  }
}

function playCollectibleSound() {
  playTone({ frequency: 698.46, glideTo: 987.77, duration: 0.09, gain: 0.014, type: "sine" });
}

function playLevelUpSound() {
  playTone({ frequency: 523.25, duration: 0.18, gain: 0.02, type: "triangle" });
  playTone({ frequency: 659.25, duration: 0.22, gain: 0.018, type: "triangle", startOffset: 0.05 });
  playTone({ frequency: 783.99, duration: 0.28, gain: 0.02, type: "sine", startOffset: 0.1 });
}

function playFootstepSound(sprinting, crouching) {
  const thud = crouching ? 78 : sprinting ? 118 : 96;
  playNoiseBurst({ gain: sprinting ? 0.018 : 0.013, duration: sprinting ? 0.06 : 0.08, frequency: sprinting ? 240 : 180 });
  playTone({ frequency: thud, glideTo: thud * 0.86, duration: 0.08, gain: crouching ? 0.01 : 0.016, type: "sine" });
}

function playChestOpenSound() {
  playTone({ frequency: 523.25, duration: 0.18, gain: 0.025, type: "triangle" });
  playTone({ frequency: 659.25, duration: 0.22, gain: 0.02, type: "sine", startOffset: 0.05 });
  playTone({ frequency: 783.99, duration: 0.26, gain: 0.018, type: "sine", startOffset: 0.1 });
}

function playCoinCollectSound() {
  if (state.elapsed < audioState.nextCoinAt) {
    return;
  }
  audioState.nextCoinAt = state.elapsed + 0.06;
  playTone({ frequency: 880, duration: 0.09, gain: 0.012, type: "sine" });
}

function playMusicPulse(step) {
  const melody = [293.66, 329.63, 392, 440, 392, 329.63, 349.23, 261.63];
  const bass = [146.83, 164.81, 196, 220];
  const note = melody[step % melody.length];
  const bassNote = bass[step % bass.length];
  playTone({ frequency: note, duration: 0.5, gain: 0.018, type: "triangle", target: "music" });
  playTone({ frequency: bassNote, duration: 0.62, gain: 0.012, type: "sine", target: "music", startOffset: 0.03 });
}

function updateAudio() {
  const context = audioState.context;
  if (!context || !audioState.musicUnlocked || context.state !== "running") {
    return;
  }

  syncMusicTrackPlayback();

  const useGeneratedMusic = audioState.musicTrackFailed || !audioState.musicElement;
  if (useGeneratedMusic && state.settings.musicEnabled && state.settings.masterVolume > 0 && state.settings.musicVolume > 0 && state.mode !== "loading") {
    while (state.elapsed >= audioState.nextMusicAt) {
      playMusicPulse(audioState.musicStep);
      audioState.musicStep += 1;
      audioState.nextMusicAt += 0.72;
    }
  } else if (useGeneratedMusic) {
    audioState.nextMusicAt = state.elapsed + 0.12;
  }

  const moving = state.mode === "playing" && state.player.motionAmount > 0.08 && state.player.chargeTime <= 0;
  if (!moving || !state.settings.footstepsEnabled || state.settings.sfxVolume <= 0 || state.settings.masterVolume <= 0) {
    audioState.nextFootstepAt = state.elapsed + 0.05;
    return;
  }

  const sprinting = state.keys.has("shift") && state.player.crouchAmount < 0.2;
  const crouching = state.player.crouchAmount > 0.25;
  if (state.elapsed >= audioState.nextFootstepAt) {
    playFootstepSound(sprinting, crouching);
    audioState.nextFootstepAt = state.elapsed + (crouching ? 0.46 : sprinting ? 0.24 : 0.34);
  }
}

function updatePerformanceMeter(delta) {
  state.performance.fpsTimer += delta;
  state.performance.fpsFrames += 1;
  if (state.performance.fpsTimer >= 0.45) {
    state.performance.fpsValue = Math.round(state.performance.fpsFrames / state.performance.fpsTimer);
    state.performance.fpsFrames = 0;
    state.performance.fpsTimer = 0;
    if (state.settings.showFps) {
      dom.fpsMeter.textContent = shouldUseTouchJoystick()
        ? `${state.performance.fpsValue}`
        : `FPS ${state.performance.fpsValue}`;
    }
  }
}

function toggleQuestWindow(force) {
  const nextVisible = typeof force === "boolean" ? force : !state.ui.questVisible;
  state.ui.questVisible = nextVisible;
  dom.questWindow.classList.toggle("is-open", nextVisible);
  dom.questWindow.setAttribute("aria-hidden", String(!nextVisible));
  dom.questTab.classList.toggle("is-active", nextVisible);
  dom.questTab.setAttribute("aria-expanded", String(nextVisible));
}

function attachEvents() {
  dom.startBtn.addEventListener("click", async () => {
    if (!state.loaded) {
      return;
    }

    try {
      syncStartButtonState();
      await ensureMultiplayerReady();
      unlockAudio();
      showToast("Lobiye baglandin. Admin turu baslatinca herkes ayni anda oyuna girecek.", 10000);
    } catch (error) {
      syncMultiplayerStatusLabel(
        dom.multiplayerStatus?.textContent || "Baglanti hatasi",
        error.message,
      );
      showToast(error.message);
    } finally {
      syncStartButtonState();
    }
  });

  dom.restartBtn.addEventListener("click", () => {
    void resetGame(true);
  });

  dom.playerNameInput?.addEventListener("input", () => {
    state.session.playerName = sanitizePlayerName(dom.playerNameInput.value) || dom.playerNameInput.value.trim();
    syncStartButtonState();
  });
  dom.playerNameInput?.addEventListener("change", () => {
    const sanitized = sanitizePlayerName(dom.playerNameInput.value);
    if (sanitized) {
      state.session.playerName = storePlayerName(sanitized);
      dom.playerNameInput.value = state.session.playerName;
      if (multiplayer.isConnected()) {
        multiplayer.send({
          type: "profile",
          name: state.session.playerName,
          mapKey: getActiveMultiplayerMapKey(),
          characterId: state.session.selectedCharacterId,
        });
      }
    }
    syncStartButtonState();
  });

  dom.questTab.addEventListener("click", () => toggleQuestWindow());
  dom.settingsTab.addEventListener("click", () => toggleSettingsPanel());
  dom.minimapToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMobileMinimap();
  });
  dom.settingsClose.addEventListener("click", () => toggleSettingsPanel(false));
  dom.settingsApply.addEventListener("click", () => {
    applySettings(readSettingsForm());
  });
  dom.settingsReset.addEventListener("click", () => {
    const resetSettings = { ...defaultSettings, fullscreen: document.fullscreenElement !== null };
    populateSettingsForm(resetSettings);
    updateSettingsValueLabels();
    applySettings(resetSettings);
  });
dom.settingsForm.addEventListener("input", () => updateSettingsValueLabels());
dom.letterCardClose.addEventListener("click", () => closeLetterCard());
dom.letterCardBackdrop.addEventListener("click", () => closeLetterCard());
dom.letterCardGlyphButton?.addEventListener("click", () => playActiveLetterGlyph());
dom.letterCardExampleAudio.addEventListener("click", () => playActiveLetterExampleWord());
dom.letterCardExampleButton.addEventListener("click", () => playActiveLetterExampleWord());
dom.mobileImmersiveAction.addEventListener("click", () => {
  unlockAudio();
  void requestMobileImmersiveMode({ toast: false });
  });
  document.addEventListener("fullscreenchange", () => {
    if (dom.settingsForm?.elements.fullscreen) {
      dom.settingsForm.elements.fullscreen.checked = document.fullscreenElement !== null;
    }
    updateMobileImmersivePrompt();
  });
  window.addEventListener("resize", onResize);
  window.addEventListener("beforeunload", () => {
    multiplayer.disconnect("page-unload");
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (state.ui.letterCardVisible) {
      if (key === "escape" || key === "enter") {
        event.preventDefault();
        closeLetterCard();
      }
      return;
    }

    if (event.code === "Space") {
      unlockAudio();
      state.player.attackHeld = true;
      if (!event.repeat) {
        performBasicAttack();
      }
      event.preventDefault();
      return;
    }

    if (key === "escape" && state.ui.settingsVisible) {
      event.preventDefault();
      toggleSettingsPanel(false);
      return;
    }

    if (movementKeys.has(key)) {
      state.keys.add(key);
      event.preventDefault();
      return;
    }

    if (key === "f") {
      event.preventDefault();
      void toggleFullscreen();
      return;
    }

    if (key === "j" && !event.repeat) {
      event.preventDefault();
      toggleQuestWindow();
      return;
    }

    if (key === "o" && !event.repeat) {
      event.preventDefault();
      toggleSettingsPanel();
      return;
    }

    if (key === "t" && !event.repeat) {
      event.preventDefault();
      toggleAutoAttack();
      return;
    }

    if (key === "e" && !event.repeat) {
      unlockAudio();
      event.preventDefault();
      if (!tryUseStagePortal()) {
        interactWithNearestChest();
      }
      return;
    }

    if ((event.code === "AltLeft" || event.code === "AltRight") && !event.repeat) {
      state.player.crouchHeld = true;
      event.preventDefault();
      return;
    }

    if (!event.repeat && skillKeyMap.has(key)) {
      unlockAudio();
      useSkill(skillKeyMap.get(key));
    }
  });

  window.addEventListener("keyup", (event) => {
    if (state.ui.letterCardVisible) {
      return;
    }

    if (event.code === "Space") {
      state.player.attackHeld = false;
      event.preventDefault();
      return;
    }

    const key = event.key.toLowerCase();
    if (movementKeys.has(key)) {
      state.keys.delete(key);
      event.preventDefault();
    }

    if (event.code === "AltLeft" || event.code === "AltRight") {
      state.player.crouchHeld = false;
      event.preventDefault();
    }
  });

  window.addEventListener("blur", () => {
    state.keys.clear();
    state.mouseButtons = 0;
    state.player.attackHeld = false;
    state.player.crouchHeld = false;
    state.camera.dragging = false;
    state.camera.pointerId = null;
    resetTouchJoystick();
    stopLetterCardSpeech();
  });

  dom.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  dom.canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      void requestMobileImmersiveMode({ toast: false });
      if (shouldStartTouchLook(event)) {
        event.preventDefault();
        beginCameraDrag(event.pointerId, event.clientX, event.clientY);
        dom.canvas.setPointerCapture(event.pointerId);
      }
      return;
    }
  });

  dom.canvas.addEventListener("mousedown", (event) => {
    if (state.ui.letterCardVisible) {
      return;
    }

    const nextMask = getMouseButtonMask(event.button);
    if (nextMask) {
      state.mouseButtons |= nextMask;
    }

    const activeButtons = (event.buttons ?? 0) | state.mouseButtons;
    if ((activeButtons & 2) === 2) {
      event.preventDefault();
      beginCameraDrag("mouse-secondary", event.clientX, event.clientY);
    }

    if ((activeButtons & 1) === 1 && event.button === 0 && state.mode === "playing" && setMoveTargetFromPointer(event)) {
      event.preventDefault();
    }
  });

  dom.canvas.addEventListener("pointermove", (event) => {
    if (!state.camera.dragging || state.camera.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    updateCameraDrag(event.clientX, event.clientY);
  });

  dom.canvas.addEventListener("mousemove", (event) => {
    if (!state.camera.dragging || state.camera.pointerId !== "mouse-secondary") {
      return;
    }

    const activeButtons = (event.buttons ?? 0) | state.mouseButtons;
    if ((activeButtons & 2) !== 2) {
      state.camera.dragging = false;
      state.camera.pointerId = null;
      return;
    }

    event.preventDefault();
    updateCameraDrag(event.clientX, event.clientY);
  });

  dom.canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.camera.distance = THREE.MathUtils.clamp(
        state.camera.distance + event.deltaY * 0.012,
        state.camera.minDistance,
        state.camera.maxDistance,
      );
    },
    { passive: false },
  );

  dom.canvas.addEventListener("pointerup", releaseCameraDrag);
  dom.canvas.addEventListener("pointercancel", releaseCameraDrag);
  dom.canvas.addEventListener("mouseup", (event) => {
    const releasedMask = getMouseButtonMask(event.button);
    if (releasedMask) {
      state.mouseButtons &= ~releasedMask;
    }
    if (state.camera.pointerId === "mouse-secondary" && (state.mouseButtons & 2) !== 2) {
      state.camera.dragging = false;
      state.camera.pointerId = null;
    }
  });
  window.addEventListener("mouseup", (event) => {
    const releasedMask = getMouseButtonMask(event.button);
    if (releasedMask) {
      state.mouseButtons &= ~releasedMask;
    }
    if (state.camera.pointerId === "mouse-secondary" && (state.mouseButtons & 2) !== 2) {
      state.camera.dragging = false;
      state.camera.pointerId = null;
    }
  });
  refreshTouchJoystick();
}

function releaseCameraDrag(event) {
  if (state.camera.pointerId !== event.pointerId) {
    return;
  }
  if (dom.canvas.hasPointerCapture?.(event.pointerId)) {
    dom.canvas.releasePointerCapture(event.pointerId);
  }
  state.camera.dragging = false;
  state.camera.pointerId = null;
}

function shouldUseTouchJoystick() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

function beginCameraDrag(pointerId, clientX, clientY) {
  state.camera.dragging = true;
  state.camera.pointerId = pointerId;
  state.camera.lastX = clientX;
  state.camera.lastY = clientY;
}

function updateCameraDrag(clientX, clientY) {
  const deltaX = clientX - state.camera.lastX;
  const deltaY = clientY - state.camera.lastY;
  const sensitivity = state.settings.cameraSensitivity / 100;
  const invert = state.settings.invertY ? -1 : 1;
  state.camera.lastX = clientX;
  state.camera.lastY = clientY;
  state.camera.yaw -= deltaX * 0.0054 * sensitivity;
  state.camera.pitch = THREE.MathUtils.clamp(
    state.camera.pitch + deltaY * 0.0038 * sensitivity * invert,
    0.24,
    0.88,
  );
}

function shouldStartTouchLook(event) {
  if (
    event.pointerType !== "touch"
    || !shouldUseTouchJoystick()
    || state.mode !== "playing"
    || state.ui.letterCardVisible
  ) {
    return false;
  }

  return event.clientX >= window.innerWidth * 0.36;
}

function isLandscapeViewport() {
  return window.matchMedia("(orientation: landscape)").matches || window.innerWidth >= window.innerHeight;
}

function isStandaloneDisplayMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isMobileFullscreenActive() {
  return document.fullscreenElement !== null || isStandaloneDisplayMode();
}

function canRequestFullscreen() {
  return typeof document.documentElement.requestFullscreen === "function";
}

function canLockLandscapeOrientation() {
  return typeof window.screen?.orientation?.lock === "function";
}

async function requestFullscreenPreferred() {
  if (isMobileFullscreenActive() || !canRequestFullscreen()) {
    return isMobileFullscreenActive();
  }

  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      return false;
    }
  }

  return document.fullscreenElement !== null;
}

async function requestLandscapeOrientationLock() {
  if (!canLockLandscapeOrientation()) {
    return isLandscapeViewport();
  }

  try {
    await window.screen.orientation.lock("landscape");
    return true;
  } catch {
    return isLandscapeViewport();
  }
}

function updateMobileImmersivePrompt() {
  const mobile = shouldUseTouchJoystick();
  const landscape = isLandscapeViewport();
  const fullscreen = isMobileFullscreenActive();
  const canPromptAction = canRequestFullscreen() || canLockLandscapeOrientation();
  const visible = mobile && state.mode === "playing" && !landscape;

  state.ui.mobileImmersivePromptVisible = visible;
  state.ui.mobileLandscape = landscape;
  state.ui.mobileFullscreen = fullscreen;

  if (!dom.mobileImmersive) {
    return;
  }

  dom.mobileImmersive.classList.toggle("is-visible", visible);
  dom.mobileImmersive.setAttribute("aria-hidden", visible ? "false" : "true");

  if (!visible) {
    return;
  }

  dom.mobileImmersiveTitle.textContent = fullscreen ? "Telefonu Yatay Cevir" : "Yatay Tam Ekran";
  dom.mobileImmersiveCopy.textContent = fullscreen
    ? "Oyun acik. Daha genis gorus, joystick ve skill tuslari icin telefonu yana cevir."
    : "Destekleyen tarayicilarda oyun yatay tam ekrana gececek. Olmazsa telefonu elle yana cevirip devam et.";
  dom.mobileImmersiveAction.hidden = !canPromptAction;
  dom.mobileImmersiveAction.textContent = fullscreen ? "Yine Dene" : "Tam Ekran Dene";
}

async function requestMobileImmersiveMode(options = {}) {
  if (!shouldUseTouchJoystick()) {
    return false;
  }

  state.ui.mobileImmersiveRequested = true;
  const fullscreen = await requestFullscreenPreferred();
  const orientationLocked = await requestLandscapeOrientationLock();

  updateMobileImmersivePrompt();

  if (!fullscreen && !orientationLocked && options.toast !== false) {
    showToast("Telefonu yatay cevir");
  }

  return fullscreen || orientationLocked;
}

function resetTouchJoystick() {
  state.joystickVector.set(0, 0);
}

function destroyTouchJoystick() {
  if (state.touchJoystickManager?.destroy) {
    state.touchJoystickManager.destroy();
  }
  state.touchJoystickManager = null;
  state.touchJoystickSize = 0;
  resetTouchJoystick();
}

function createTouchJoystick() {
  if (!dom.touchStick) {
    return;
  }

  const size = window.innerWidth <= 640 ? 120 : 138;
  const manager = nipplejs.create({
    zone: dom.touchStick,
    mode: "static",
    position: { left: "50%", top: "50%" },
    size,
    color: "#ffcf6d",
    fadeTime: 0,
    restOpacity: 0.32,
    dynamicPage: true,
  });

  manager.on("start", () => {
    clearMoveTarget();
  });

  manager.on("move", (_event, data) => {
    const vector = data?.vector;
    if (!vector) {
      return;
    }

    state.joystickVector.set(
      THREE.MathUtils.clamp(vector.x, -1, 1),
      THREE.MathUtils.clamp(-vector.y, -1, 1),
    );
  });

  manager.on("end destroyed", () => {
    resetTouchJoystick();
  });

  state.touchJoystickManager = manager;
  state.touchJoystickSize = size;
}

function refreshTouchJoystick() {
  const shouldEnable = shouldUseTouchJoystick();
  const nextSize = window.innerWidth <= 640 ? 120 : 138;

  if (!shouldEnable) {
    destroyTouchJoystick();
    return;
  }

  if (state.touchJoystickManager && state.touchJoystickSize === nextSize) {
    return;
  }

  destroyTouchJoystick();
  createTouchJoystick();
}

async function resetGame(showMenu) {
  if (!state.player.model || !state.loaded) {
    return;
  }

  state.transitioningStage = true;
  try {
    state.mode = "loading";
    state.elapsed = 0;
    state.zone = "Sun Court";
    state.message = showMenu ? "Lobby acik. Admin baslatinca tur ayni anda acilacak." : "Sun Court acildi";
    state.interactionHint = "";
    state.collectedLetterIds.clear();
    state.collectedCount = 0;
    state.session.snapshotTimer = 0;
    if (showMenu) {
      state.session.match.finishPlace = 0;
      state.session.match.activeRoundId = 0;
    }
    state.ui.alphabetDirty = true;
    state.ui.alphabetProgressLabel = "";
    state.ui.alphabetStageKey = "";
    state.ui.lastXpProgress = -1;
    clearPendingLetterCardReveal();
    state.stats = { ...defaultStats };
    state.keys.clear();
    state.joystickVector.set(0, 0);
    state.inputVector.set(0, 0);
    state.moveTarget = null;
    state.player.attackPulse = 0;
    state.player.whirlwindTime = 0;
    state.player.chargeTime = 0;
    state.player.revealUntil = 0;
    state.player.actionLock = 0;
    state.player.basicAttackCooldown = 0;
    state.player.attackHeld = false;
    state.player.crouchHeld = false;
    state.player.crouchAmount = 0;
    state.player.comboIndex = 0;
    state.player.comboExpiresAt = 0;
    state.player.lastComboHit = 0;
    state.player.lastBasicAttackClip = "";
    state.player.motionAmount = 0;
    state.player.chargeDirection.set(0, 0, -1);

    applyCharacterScale();
    playClip(getCharacterMovementClips(state.player.characterId).idle, { loop: true, fade: 0.01 });
    state.skills.forEach((skill) => {
      skill.cooldownLeft = 0;
    });
    state.cooldownsDirty = true;

    toggleQuestWindow(false);
    toggleSettingsPanel(false);
    closeLetterCard({ silent: true });
    resetTouchJoystick();
    
    const selectedMap = state.world.selectedMap || getSelectedMap();
    state.world.selectedMap = selectedMap;
    if (showMenu) {
      dom.mapSelect.classList.remove("is-visible");
      dom.menu.classList.remove("is-visible");
    } else {
      dom.mapSelect.classList.remove("is-visible");
      dom.menu.classList.remove("is-visible");
    }
    if (showMenu) {
      dom.menu.classList.add("is-visible");
    }
    dom.winScreen.classList.remove("is-visible");

    await buildWorldStage(selectedMap);
    state.mode = showMenu ? "menu" : "playing";
    state.message = showMenu
      ? "Lobby acik. Admin oyunu baslatinca herkes ayni anda sahaya girecek."
      : `${stageLabels[selectedMap]} acildi`;
    syncRemotePlayerRoster();
    syncMultiplayerSummary();
    sendMultiplayerSnapshot(true);
    updateMobileImmersivePrompt();
    updateOverlays(0, true);
    render();
  } finally {
    state.transitioningStage = false;
    flushPendingRoster();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  update(delta);
  render();
}

function update(delta) {
  state.elapsed += delta;
  state.session.snapshotTimer += delta;
  updatePerformanceMeter(delta);
  updateInputVector();
  updateCooldowns(delta);
  regenerateMana(delta);
  updateAudio(delta);
  updateShockwaves(delta);
  updateBannerAura(delta);
  updatePortal(delta);
  updateTreasureChests(delta);
  updateLootBursts(delta);
  flushRemotePlayerRosterSync();

  if (state.player.basicAttackCooldown > 0) {
    state.player.basicAttackCooldown = Math.max(0, state.player.basicAttackCooldown - delta);
  }

  if (state.player.mixer) {
    state.player.mixer.update(delta);
  }

  if (state.mode === "menu") {
    updateMenuCamera(delta);
    updateCharacterAnimation(delta);
    updateCollectiblesMotion();
    updateRemotePlayers(delta);
    sendMultiplayerSnapshot();
    updateOverlays(delta);
    return;
  }

  if (state.mode === "playing") {
    updatePlayer(delta);
    updateCollectiblesMotion();
    updateInteractionTargets();
    checkCollectiblesPassive(1.6);
    updateZoneLabel();
    updateRemotePlayers(delta);
    sendMultiplayerSnapshot();
    if (state.nearestPortalDistance !== null && state.nearestPortalDistance <= 1.9) {
      tryUseStagePortal();
    }
  } else if (state.mode === "victory") {
    updateCamera(delta);
    updateCharacterAnimation(delta);
    updateCollectiblesMotion();
    updateRemotePlayers(delta);
    sendMultiplayerSnapshot();
  }

  updateOverlays(delta);
}

function updateInputVector() {
  const vector = state.inputVector;
  vector.set(0, 0);

  if (isGameplayInputBlocked()) {
    return;
  }

  if (state.keys.has("w") || state.keys.has("arrowup")) {
    vector.y += 1;
  }
  if (state.keys.has("s") || state.keys.has("arrowdown")) {
    vector.y -= 1;
  }
  if (state.keys.has("a") || state.keys.has("arrowleft")) {
    vector.x -= 1;
  }
  if (state.keys.has("d") || state.keys.has("arrowright")) {
    vector.x += 1;
  }

  if (vector.lengthSq() > 0) {
    vector.normalize();
  }

  if (state.joystickVector.lengthSq() > 0.001) {
    vector.x = state.joystickVector.x;
    vector.y = -state.joystickVector.y;
  }
}

function tryAutoAttack(delta) {
  if (!state.autoAttackEnabled || isGameplayInputBlocked() || state.nearestId === null || state.nearestDistance === null) {
    return false;
  }

  const collectible = state.collectibles.find((entry) => entry.id === state.nearestId && !entry.collected);
  if (!collectible || collectible.barrierHp <= 0 || state.nearestDistance > 5.05) {
    return false;
  }

  const targetHeading = Math.atan2(
    collectible.x - state.player.position.x,
    collectible.z - state.player.position.z,
  );
  state.player.heading = THREE.MathUtils.lerp(
    state.player.heading,
    targetHeading,
    1 - Math.exp(-delta * 14),
  );
  clearMoveTarget();
  performBasicAttack();
  return true;
}

function updatePlayer(delta) {
  const player = state.player;
  const auraActive = state.bannerAura && state.bannerAura.expiresAt > state.elapsed;
  const manualInputActive = state.inputVector.lengthSq() > 0.001;
  const previousX = player.position.x;
  const previousZ = player.position.z;
  let desiredDistance = 0;

  if (player.attackPulse > 0) {
    player.attackPulse = Math.max(0, player.attackPulse - delta);
  }
  if (player.actionLock > 0) {
    player.actionLock = Math.max(0, player.actionLock - delta);
  }
  const crouchTarget = player.crouchHeld ? 1 : 0;
  player.crouchAmount = THREE.MathUtils.lerp(
    player.crouchAmount,
    crouchTarget,
    1 - Math.exp(-delta * 10),
  );
  applyCharacterScale();
  if (player.comboExpiresAt > 0 && state.elapsed > player.comboExpiresAt) {
    player.comboIndex = 0;
    player.lastComboHit = 0;
  }
  if (player.attackHeld) {
    performBasicAttack();
  }
  if (manualInputActive && state.moveTarget) {
    clearMoveTarget();
  }

  helper.moveDirection.set(0, 0, 0);

  if (player.chargeTime > 0) {
    player.chargeTime = Math.max(0, player.chargeTime - delta);
    helper.moveDirection.copy(player.chargeDirection);
    desiredDistance = 18 * delta;
    strikeCollectiblesInRadius(player.position, 3.5, "#7bc7ff", 2);
  } else {
    helper.forward.set(-Math.sin(state.camera.yaw), 0, -Math.cos(state.camera.yaw));
    helper.right.set(-helper.forward.z, 0, helper.forward.x);
    const crouching = player.crouchAmount > 0.25;
    const walkSpeed = player.speed
      * (crouching ? player.crouchMultiplier : 1)
      * (auraActive ? 1.18 : 1);

    if (manualInputActive) {
      helper.moveDirection
        .copy(helper.forward)
        .multiplyScalar(state.inputVector.y)
        .addScaledVector(helper.right, state.inputVector.x)
        .normalize();

      const sprinting = state.keys.has("shift") && player.crouchAmount < 0.2;
      const speed = walkSpeed * (sprinting ? player.sprintMultiplier : 1);

      desiredDistance = speed * delta;
      player.heading = THREE.MathUtils.lerp(
        player.heading,
        Math.atan2(helper.moveDirection.x, helper.moveDirection.z),
        1 - Math.exp(-delta * 10),
      );
    } else if (state.moveTarget) {
      helper.tempVector.set(
        state.moveTarget.x - player.position.x,
        0,
        state.moveTarget.z - player.position.z,
      );
      const remaining = helper.tempVector.length();

      if (remaining <= 0.42) {
        clearMoveTarget();
      } else {
        helper.moveDirection.copy(helper.tempVector).multiplyScalar(1 / Math.max(remaining, 0.001));
        desiredDistance = Math.min(walkSpeed * delta, remaining);
        player.heading = THREE.MathUtils.lerp(
          player.heading,
          Math.atan2(helper.moveDirection.x, helper.moveDirection.z),
          1 - Math.exp(-delta * 10),
        );
      }
    }
  }

  if (tryAutoAttack(delta)) {
    desiredDistance = 0;
    helper.moveDirection.set(0, 0, 0);
  }

  player.motionAmount = helper.moveDirection.length();

  if (desiredDistance > 0.0001) {
    player.position.addScaledVector(helper.moveDirection, desiredDistance);
  }
  resolvePlayerBounds(previousX, previousZ);
  applyPlayerFloorHeight();

  if (player.model) {
    player.model.position.copy(player.position);
    player.model.rotation.y = player.heading;
  }

  if (player.whirlwindTime > 0) {
    player.whirlwindTime = Math.max(0, player.whirlwindTime - delta);
    strikeCollectiblesInRadius(player.position, 5.4, "#ff8d66", 1);
  }

  updateCamera(delta);
  updateCharacterAnimation(delta);
}

function resolvePlayerBounds(previousX, previousZ) {
  const radius = 0.82;
  const originalX = state.player.position.x;
  const originalZ = state.player.position.z;
  let nextX = THREE.MathUtils.clamp(originalX, state.world.bounds.minX, state.world.bounds.maxX);
  let nextZ = THREE.MathUtils.clamp(originalZ, state.world.bounds.minZ, state.world.bounds.maxZ);

  state.blockers.forEach((blocker) => {
    if (Math.abs(nextX - blocker.x) < blocker.halfX + radius && Math.abs(previousZ - blocker.z) < blocker.halfZ + radius) {
      nextX = previousX;
    }
    if (Math.abs(nextX - blocker.x) < blocker.halfX + radius && Math.abs(nextZ - blocker.z) < blocker.halfZ + radius) {
      nextZ = previousZ;
    }
  });

  state.player.position.set(nextX, getStageFloorHeight(nextX, nextZ), nextZ);
}

function updateCharacterAnimation(delta) {
  const player = state.player;
  const clips = getCharacterMovementClips(player.characterId);
  if (!player.actions.size) {
    return;
  }

  if (state.mode === "victory") {
    if (player.actionLock <= 0) {
      playClip(clips.victory ?? clips.idle, { loop: false, fade: 0.14 });
      player.actionLock = 1.2;
    }
    return;
  }

  if (player.actionLock > 0) {
    return;
  }

  if (player.crouchAmount > 0.42 && player.motionAmount < 0.03) {
    playClip(clips.crouch, { loop: false, fade: 0.08, holdTime: 0.68, paused: true });
    return;
  }

  if (player.chargeTime > 0) {
    playClip(clips.charge, { loop: false, fade: 0.08, timeScale: 1.1 });
    return;
  }

  if (player.motionAmount > 0.08) {
    const sprinting = state.keys.has("shift") || player.motionAmount > 0.98;
    playClip(
      sprinting ? clips.run : clips.walk,
      { loop: true, fade: 0.12, timeScale: sprinting ? 1.22 : 1.06 + delta * 0.2 },
    );
    return;
  }

  playClip(clips.idle, { loop: true, fade: 0.18 });
}

function playClip(name, options = {}) {
  const action = state.player.actions.get(name);
  if (!action) {
    return;
  }

  action.enabled = true;
  action.timeScale = options.timeScale ?? 1;
  action.paused = false;
  action.setLoop(options.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, options.loop === false ? 1 : Infinity);
  action.clampWhenFinished = options.loop === false;

  if (state.player.currentClip === name) {
    if (options.holdTime !== undefined) {
      action.time = options.holdTime;
      action.paused = Boolean(options.paused);
    }
    if (!action.isRunning()) {
      action.play();
    }
    return;
  }

  const previous = state.player.actions.get(state.player.currentClip);
  if (previous && previous !== action) {
    previous.fadeOut(options.fade ?? 0.14);
  }

  action.reset();
  if (options.holdTime !== undefined) {
    action.time = options.holdTime;
    action.paused = Boolean(options.paused);
  }
  action.fadeIn(options.fade ?? 0.14);
  action.play();
  state.player.currentClip = name;
}

function updateMenuCamera(delta) {
  const orbit = state.elapsed * 0.18;
  helper.cameraPosition.set(Math.cos(orbit) * 24, 13, Math.sin(orbit) * 24);
  camera.position.lerp(helper.cameraPosition, 1 - Math.exp(-delta * 2.1));
  camera.lookAt(0, state.player.height * 0.42, 0);
}

function resolveCameraPosition() {
  helper.cameraDirection.copy(helper.cameraPosition).sub(helper.cameraTarget);
  const desiredDistance = helper.cameraDirection.length();
  if (desiredDistance <= 0.001 || !state.camera.collisionMeshes.length) {
    helper.cameraPositionResolved.copy(helper.cameraPosition);
    state.camera.actualDistance = desiredDistance;
    return helper.cameraPositionResolved;
  }

  helper.cameraDirection.multiplyScalar(1 / desiredDistance);
  helper.cameraRaycaster.set(helper.cameraTarget, helper.cameraDirection);
  helper.cameraRaycaster.near = 0.2;
  helper.cameraRaycaster.far = desiredDistance;

  const hit = helper.cameraRaycaster
    .intersectObjects(state.camera.collisionMeshes, false)
    .find((entry) => entry.distance > 0.2);

  if (!hit) {
    helper.cameraPositionResolved.copy(helper.cameraPosition);
    state.camera.actualDistance = desiredDistance;
    return helper.cameraPositionResolved;
  }

  const safeDistance = Math.max(state.camera.minDistance * 0.42, hit.distance - 0.55);
  helper.cameraPositionResolved.copy(helper.cameraTarget).addScaledVector(helper.cameraDirection, safeDistance);
  state.camera.actualDistance = safeDistance;
  return helper.cameraPositionResolved;
}

function updateCamera(delta) {
  helper.cameraTarget.set(
    state.player.position.x,
    state.player.position.y + state.player.height * 0.56,
    state.player.position.z,
  );
  helper.cameraPosition.set(
    helper.cameraTarget.x + Math.sin(state.camera.yaw) * state.camera.distance * Math.cos(state.camera.pitch),
    helper.cameraTarget.y + Math.sin(state.camera.pitch) * state.camera.distance,
    helper.cameraTarget.z + Math.cos(state.camera.yaw) * state.camera.distance * Math.cos(state.camera.pitch),
  );

  camera.position.lerp(resolveCameraPosition(), 1 - Math.exp(-delta * 8));
  camera.lookAt(helper.cameraTarget);
}

function snapCameraToPlayer() {
  helper.cameraTarget.set(
    state.player.position.x,
    state.player.position.y + state.player.height * 0.56,
    state.player.position.z,
  );
  helper.cameraPosition.set(
    helper.cameraTarget.x + Math.sin(state.camera.yaw) * state.camera.distance * Math.cos(state.camera.pitch),
    helper.cameraTarget.y + Math.sin(state.camera.pitch) * state.camera.distance,
    helper.cameraTarget.z + Math.cos(state.camera.yaw) * state.camera.distance * Math.cos(state.camera.pitch),
  );
  camera.position.copy(resolveCameraPosition());
  camera.lookAt(helper.cameraTarget);
}

function updateCooldowns(delta) {
  let dirty = false;
  state.skills.forEach((skill) => {
    if (skill.cooldownLeft > 0) {
      skill.cooldownLeft = Math.max(0, skill.cooldownLeft - delta);
      dirty = true;
    }
  });
  if (dirty) {
    state.cooldownsDirty = true;
  }
}

function regenerateMana(delta) {
  if (state.stats.mp >= state.stats.maxMp || state.mode === "loading") {
    return;
  }

  state.stats.mp = Math.min(state.stats.maxMp, state.stats.mp + delta * 5.2);
}

function updateCollectiblesMotion() {
  const revealActive = state.player.revealUntil > state.elapsed;
  const motionScale = state.settings.reduceMotion ? 0.38 : 1;

  state.collectibles.forEach((collectible) => {
    if (collectible.collected) {
      return;
    }

    collectible.plane.position.y = collectible.baseY + Math.sin(state.elapsed * 2.8 + collectible.id * 0.31) * 0.22 * motionScale;
    collectible.plane.quaternion.copy(camera.quaternion);
    collectible.shell.position.y = collectible.plane.position.y;
    collectible.sealRing.position.y = collectible.plane.position.y;

    const barrierRatio = collectible.barrierMaxHp > 0 ? collectible.barrierHp / collectible.barrierMaxHp : 0;
    const hitPulse = collectible.hitFlashUntil > state.elapsed ? 1 : 0;
    const breakPulse = collectible.breakFlashUntil > state.elapsed ? 1 : 0;
    const shellPulse = 1
      + hitPulse * 0.12
      + breakPulse * 0.18
      + Math.sin(state.elapsed * 2.1 + collectible.id * 0.21) * 0.04 * motionScale;
    collectible.shell.scale.copy(collectible.shellBaseScale).multiplyScalar(shellPulse);
    collectible.sealRing.scale.copy(collectible.sealRingBaseScale).multiplyScalar(1 + hitPulse * 0.08 + breakPulse * 0.16);
    collectible.sealRing.rotation.z = state.elapsed * 0.85 * (0.45 + motionScale * 0.55) + collectible.id * 0.17;
    collectible.ring.rotation.z = state.elapsed * 0.55 * (0.4 + motionScale * 0.6) + collectible.id * 0.12;

    if (collectible.barrierHp > 0) {
      collectible.shellMaterial.opacity = THREE.MathUtils.clamp(
        collectible.shellOpacityBase + hitPulse * 0.09 + barrierRatio * 0.04 + Math.sin(state.elapsed * 3.2 + collectible.id * 0.14) * 0.02 * motionScale,
        0.12,
        0.42,
      );
      collectible.sealRingMaterial.opacity = THREE.MathUtils.clamp(
        collectible.sealRingOpacityBase + hitPulse * 0.12 + Math.sin(state.elapsed * 4 + collectible.id * 0.28) * 0.05 * motionScale,
        0.16,
        0.58,
      );
    }

    const distance = revealActive
      ? Math.hypot(
        collectible.x - state.player.position.x,
        collectible.z - state.player.position.z,
      )
      : Number.POSITIVE_INFINITY;
    const isNearest = collectible.id === state.nearestId;
    const highlighted = revealActive && distance < 19;
    const ringScale = collectible.barrierHp > 0
      ? highlighted ? 1.14 : isNearest ? 1.08 : 1
      : highlighted ? 1.2 : isNearest ? 1.12 : 1.04;
    collectible.ring.scale.setScalar(ringScale);
    if (collectible.ringMaterial.emissiveIntensity !== undefined) {
      collectible.ringMaterial.emissiveIntensity = collectible.barrierHp > 0
        ? highlighted ? 1.5 : isNearest ? 1.12 : 0.88
        : highlighted ? 1.82 : isNearest ? 1.28 : 0.95;
    }
  });
}

function createShockwaveMesh() {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.84, 1.02, 40),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function acquireShockwaveMesh() {
  const mesh = effectPools.shockwaves.pop() ?? createShockwaveMesh();
  mesh.visible = true;
  return mesh;
}

function releaseShockwaveMesh(mesh) {
  effectGroup.remove(mesh);
  mesh.visible = false;
  effectPools.shockwaves.push(mesh);
}

function createGoldCoinNode() {
  const node = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.12, qualityProfile.lowSpec ? 12 : 22),
    qualityProfile.lowSpec
      ? new THREE.MeshBasicMaterial({
        color: "#ffd66d",
        transparent: true,
        opacity: 0.96,
      })
      : new THREE.MeshStandardMaterial({
        color: "#ffd66d",
        emissive: "#ffbf47",
        emissiveIntensity: 1.35,
        metalness: 0.65,
        roughness: 0.18,
        transparent: true,
        opacity: 0.98,
      }),
  );
  coin.castShadow = qualityProfile.enableShadows;
  coin.receiveShadow = qualityProfile.enableShadows;
  coin.rotation.x = Math.PI / 2;
  node.add(coin);
  return {
    node,
    coin,
    target: new THREE.Vector3(),
  };
}

function acquireGoldCoinItem() {
  const item = effectPools.goldCoins.pop() ?? createGoldCoinNode();
  item.collected = false;
  item.node.visible = true;
  item.node.scale.setScalar(1);
  item.node.position.set(0, 0, 0);
  item.coin.rotation.set(Math.PI / 2, 0, 0);
  if (item.coin.material.emissiveIntensity !== undefined) {
    item.coin.material.emissiveIntensity = 1.35;
  }
  if (item.coin.material.opacity !== undefined) {
    item.coin.material.opacity = 0.98;
  }
  return item;
}

function releaseGoldCoinItem(item) {
  item.node.removeFromParent();
  item.node.visible = false;
  effectPools.goldCoins.push(item);
}

function updateShockwaves(delta) {
  state.shockwaves = state.shockwaves.filter((wave) => {
    wave.life -= delta;
    if (wave.life <= 0) {
      releaseShockwaveMesh(wave.mesh);
      return false;
    }

    const progress = 1 - wave.life / wave.duration;
    wave.mesh.scale.setScalar(THREE.MathUtils.lerp(0.4, wave.radius, progress));
    wave.mesh.material.opacity = 0.62 * (1 - progress);
    return true;
  });
}

function clearShockwaves() {
  state.shockwaves.forEach((wave) => {
    releaseShockwaveMesh(wave.mesh);
  });
  state.shockwaves = [];
}

function updateBannerAura(delta) {
  if (!state.bannerAura) {
    return;
  }

  if (state.bannerAura.expiresAt <= state.elapsed) {
    clearBannerAura();
    return;
  }

  const motionScale = state.settings.reduceMotion ? 0.38 : 1;
  const pulse = Math.sin(state.elapsed * 5.2) * 0.09 * motionScale;
  state.bannerAura.ring.scale.setScalar(1 + pulse);
  state.bannerAura.ring.material.opacity = 0.28 + pulse * 0.7;
  state.bannerAura.marker.rotation.y += delta * 0.6;
}

function updateTreasureChests(delta) {
  const motionScale = state.settings.reduceMotion ? 0.38 : 1;

  state.chests.forEach((chest) => {
    chest.openProgress = THREE.MathUtils.lerp(
      chest.openProgress,
      chest.opened ? 1 : 0,
      1 - Math.exp(-delta * 7),
    );

    const pulse = Math.sin(state.elapsed * 4.4 + chest.phase) * 0.5 + 0.5;
    const hover = chest.opened
      ? 0.74 + Math.sin(state.elapsed * 2.1 + chest.phase) * 0.08 * motionScale
      : 1.08 + Math.sin(state.elapsed * 2.4 + chest.phase) * 0.22 * motionScale;

    chest.root.position.set(chest.x, chest.baseY + hover, chest.z);
    chest.hoverGroup.rotation.x = -0.58 * chest.openProgress;
    chest.hoverGroup.rotation.y += delta * (chest.opened ? 0.2 : 0.48) * (0.55 + motionScale * 0.45);
    chest.ring.rotation.z += delta * (chest.opened ? 0.75 : 1.5) * (0.5 + motionScale * 0.5);
    chest.ring.scale.setScalar(chest.opened ? 1.02 + pulse * 0.06 * motionScale : 1.16 + pulse * 0.12 * motionScale);
    chest.ring.material.opacity = chest.opened ? 0.22 + pulse * 0.06 * motionScale : 0.46 + pulse * 0.22 * motionScale;
    chest.aura.scale.set(1.52 + pulse * 0.2 * motionScale, 0.84 + pulse * 0.08 * motionScale, 1.52 + pulse * 0.2 * motionScale);
    chest.aura.material.opacity = chest.opened ? 0.14 + pulse * 0.04 * motionScale : 0.22 + pulse * 0.12 * motionScale;
    if (chest.light) {
      chest.light.intensity = chest.opened ? 1.05 + pulse * 0.3 * motionScale : 2.2 + pulse * 0.75 * motionScale;
    }

  });

  state.interactionHint = state.mode === "playing" && state.settings.showHints && state.portal && state.nearestPortalDistance !== null && state.nearestPortalDistance <= 4.4
    ? `${state.portal.label ?? "Buyuk Gecit"} aktif · esige gir veya E bas`
    : "";

  if (state.interactionHint) {
    return;
  }

  const nearestChest = state.chests.find((entry) => entry.id === state.nearestChestId && !entry.opened);
  state.interactionHint = state.mode === "playing" && state.settings.showHints && nearestChest && state.nearestChestDistance !== null && state.nearestChestDistance <= 4.4
    ? `E ile ${nearestChest.label} ac`
    : "";

  if (state.interactionHint) {
    return;
  }

  const nearestCollectible = state.collectibles.find((entry) => entry.id === state.nearestId && !entry.collected);
  state.interactionHint = state.mode === "playing" && state.settings.showHints && nearestCollectible && state.nearestDistance !== null
    ? nearestCollectible.barrierHp > 0 && state.nearestDistance <= 5.2
      ? `Space veya skill ile ${nearestCollectible.label} muhafazasini kir (${nearestCollectible.barrierHp}/${nearestCollectible.barrierMaxHp})`
      : nearestCollectible.barrierHp <= 0 && state.nearestDistance <= 1.8
        ? `${nearestCollectible.label} serbest · yaklas ve topla`
        : ""
    : "";

  if (!state.interactionHint && state.mode === "playing" && state.settings.showHints) {
    state.interactionHint = state.autoAttackEnabled
      ? "Sol tik ile git · T ile oto saldiri ac/kapat"
      : "Sol tik ile git · T ile oto saldiri ac";
  }
}

function updateLootBursts(delta) {
  state.lootBursts = state.lootBursts.filter((burst) => {
    burst.age += delta;

    const riseEnd = burst.riseDuration;
    const collectStart = burst.riseDuration + burst.hoverDuration;
    const riseT = THREE.MathUtils.clamp(burst.age / Math.max(riseEnd, 0.001), 0, 1);
    const easedRise = THREE.MathUtils.smootherstep(riseT, 0, 1);
    burst.group.position.set(
      burst.origin.x,
      burst.baseY + easedRise * burst.riseHeight,
      burst.origin.z,
    );

    burst.items.forEach((item, index) => {
      if (item.collected) {
        return;
      }

      if (burst.age < collectStart) {
        const sway = Math.sin(state.elapsed * 1.4 + item.phase) * 0.1;
        item.node.position.x = item.anchor.x + Math.cos(item.phase * 1.7) * sway;
        item.node.position.z = item.anchor.z + Math.sin(item.phase * 1.3) * sway;
        item.node.position.y = item.baseY
          + easedRise * item.lift
          + Math.sin(state.elapsed * item.wobbleSpeed + item.phase) * 0.24;
      } else {
        const target = item.target;
        const collectT = THREE.MathUtils.clamp(
          (burst.age - collectStart) / Math.max(burst.maxDuration - collectStart, 0.001),
          0,
          1,
        );
        target.set(
          state.player.position.x - burst.origin.x,
          state.player.position.y + state.player.height * 0.42 - burst.group.position.y,
          state.player.position.z - burst.origin.z,
        );
        item.node.position.lerp(target, 1 - Math.exp(-delta * (item.collectSpeed + collectT * 5.8)));

        if (item.node.position.distanceToSquared(target) < 0.2) {
          item.collected = true;
          item.node.visible = false;
          burst.collectedGold += item.goldValue;
          grantGold(item.goldValue);
        }
      }

      const homeT = burst.age < collectStart
        ? 0
        : THREE.MathUtils.clamp(
          (burst.age - collectStart) / Math.max(burst.maxDuration - collectStart, 0.001),
          0,
          1,
        );
      const sparkle = Math.sin(state.elapsed * 7.2 + item.phase) * 0.5 + 0.5;
      const scalePulse = item.scale * (1.04 + sparkle * 0.18 - homeT * 0.12);
      item.node.scale.setScalar(scalePulse);
      item.coin.rotation.y += delta * 3.4;
      item.coin.rotation.z = Math.sin(state.elapsed * 1.3 + index * 0.4) * 0.16;

      if (item.coin.material.emissiveIntensity !== undefined) {
        item.coin.material.emissiveIntensity = 1.2 + sparkle * 0.7;
      }
      if (item.coin.material.opacity !== undefined) {
        item.coin.material.opacity = 0.92 + sparkle * 0.06;
      }
    });

    if (burst.items.every((item) => item.collected)) {
      burst.items.forEach((item) => releaseGoldCoinItem(item));
      effectGroup.remove(burst.group);
      return false;
    }

    if (burst.age > burst.maxDuration) {
      const remaining = burst.items.filter((item) => !item.collected);
      remaining.forEach((item) => grantGold(item.goldValue));
      burst.items.forEach((item) => releaseGoldCoinItem(item));
      effectGroup.remove(burst.group);
      return false;
    }

    return true;
  });
}

function clearLootBursts() {
  state.lootBursts.forEach((burst) => {
    burst.items.forEach((item) => releaseGoldCoinItem(item));
    effectGroup.remove(burst.group);
  });
  state.lootBursts = [];
}

function performBasicAttack() {
  if (
    isGameplayInputBlocked()
    || state.player.basicAttackCooldown > 0
    || state.player.chargeTime > 0
    || state.player.actionLock > 0
  ) {
    return false;
  }

  if (state.elapsed > state.player.comboExpiresAt) {
    state.player.comboIndex = 0;
  }

  const comboStep = basicAttackCombo[state.player.comboIndex];
  state.player.basicAttackCooldown = comboStep.cooldown;
  state.player.attackPulse = 0.22 + state.player.comboIndex * 0.04;
  state.player.actionLock = comboStep.lock;
  state.player.comboExpiresAt = state.elapsed + 0.9;
  state.player.lastComboHit = state.player.comboIndex + 1;
  state.player.lastBasicAttackClip = comboStep.clip;
  state.player.comboIndex = (state.player.comboIndex + 1) % basicAttackCombo.length;

  playClip(comboStep.clip, { loop: false, fade: 0.08, timeScale: comboStep.timeScale });
  playAttackSound(state.player.lastComboHit);
  spawnShockwave(state.player.position, comboStep.color, 3.1 + state.player.lastComboHit * 0.42, 0.2);
  strikeCollectiblesInFront(comboStep.radius, comboStep.width, comboStep.color, comboStep.damage);
  state.message = `Kombo ${state.player.lastComboHit}/3 · ${comboStep.label}`;
  return true;
}

function interactWithNearestChest() {
  if (state.mode !== "playing") {
    return false;
  }

  const chest = state.chests.find((entry) => entry.id === state.nearestChestId && !entry.opened);

  if (!chest || state.nearestChestDistance === null || state.nearestChestDistance > 4.4) {
    state.message = "Yakinda acilacak sandik yok";
    showToast("Yakinda sandik yok");
    return false;
  }

  chest.opened = true;
  chest.openProgress = 0;
  syncChestToSimulation(chest.id, true);
  void refreshSimulationQuery();
  updateInteractionTargets();
  playChestOpenSound();
  grantXp(36);
  state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + 12);
  state.stats.mp = Math.min(state.stats.maxMp, state.stats.mp + 10);
  spawnShockwave(chest.root.position, "#ffd873", 4.6, 0.34);
  const goldReward = spawnTreasureLoot(chest);

  const lootSummary = chest.loot.map((item) => item.name).join(", ");
  state.message = `${chest.label} acildi: ${lootSummary} · +${goldReward} altin`;
  showToast(`${chest.label} acildi · +${goldReward} altin`);
  return true;
}

function spawnTreasureLoot(chest) {
  const totalGold = chest.loot.reduce((sum, entry) => sum + entry.value, 0);
  const coinValues = createCoinValueChunks(totalGold, Math.min(12, Math.max(7, chest.loot.length * 3 + 1)));
  const group = new THREE.Group();
  const items = coinValues.map((goldValue, index) => {
    const item = acquireGoldCoinItem();
    const { node, coin } = item;
    group.add(node);

    return {
      ...item,
      node,
      coin,
      goldValue,
      anchor: new THREE.Vector3(
        Math.cos(index * 1.73 + chest.id) * (0.7 + (index % 4) * 0.18),
        0,
        Math.sin(index * 1.43 + chest.id) * (0.7 + (index % 4) * 0.18),
      ),
      baseY: 1 + (index % 4) * 0.24,
      lift: 0.86 + (index % 3) * 0.22,
      wobbleSpeed: 2.4 + index * 0.14,
      collectSpeed: 7.8 + index * 0.18,
      scale: 1 + (index % 3) * 0.07,
      phase: pseudoRandom(chest.id * 13 + index * 7) * Math.PI * 2,
    };
  });

  const origin = new THREE.Vector3(chest.x, chest.baseY + 1.9, chest.z);
  group.position.copy(origin);
  effectGroup.add(group);
  state.lootBursts.push({
    group,
    origin,
    items,
    baseY: chest.baseY + 1.9,
    riseHeight: 2.8,
    age: 0,
    riseDuration: 0.8,
    hoverDuration: 0.58,
    maxDuration: 3.7,
    sourceChestId: chest.id,
    loot: chest.loot.map((entry) => ({ name: entry.name, value: entry.value })),
    totalGold,
    collectedGold: 0,
    coinScale: 1,
  });

  return totalGold;
}

function useSkill(id) {
  if (isGameplayInputBlocked()) {
    return false;
  }

  unlockAudio();
  const skill = state.skills.find((entry) => entry.id === id);
  if (!skill || skill.cooldownLeft > 0 || state.stats.mp < skill.cost) {
    return false;
  }

  skill.cooldownLeft = skill.cooldown;
  state.stats.mp = Math.max(0, state.stats.mp - skill.cost);
  state.cooldownsDirty = true;

  switch (skill.effectType) {
    case "slash":
      state.player.attackPulse = 0.36;
      state.player.actionLock = 0.48;
      playSkillSound(skill.effectType);
      playClip(skill.animation, { loop: false, fade: 0.1, timeScale: 1.14 });
      spawnShockwave(state.player.position, "#ffb24a", 4.2, 0.26);
      strikeCollectiblesInFront(5.4, 2.7, "#ffb24a", 2);
      state.message = skill.title;
      break;
    case "bash":
      state.player.attackPulse = 0.44;
      state.player.actionLock = 0.56;
      playSkillSound(skill.effectType);
      playClip(skill.animation, { loop: false, fade: 0.1, timeScale: 1.06 });
      spawnShockwave(state.player.position, "#ffe27b", 5.1, 0.34);
      strikeCollectiblesInFront(6.2, 3.5, "#ffe27b", 3);
      state.message = skill.title;
      break;
    case "whirlwind":
      state.player.whirlwindTime = 0.82;
      state.player.actionLock = 0.72;
      playSkillSound(skill.effectType);
      playClip(skill.animation, { loop: false, fade: 0.08, timeScale: 1.1 });
      spawnShockwave(state.player.position, "#ff8d66", 6.4, 0.75);
      state.message = skill.title;
      break;
    case "charge":
      state.player.chargeTime = 0.42;
      state.player.actionLock = 0.42;
      state.player.chargeDirection.set(
        Math.sin(state.player.heading),
        0,
        Math.cos(state.player.heading),
      );
      playSkillSound(skill.effectType);
      playClip(skill.animation, { loop: false, fade: 0.06, timeScale: 1.08 });
      spawnShockwave(state.player.position, "#7bc7ff", 5.8, 0.4);
      state.message = skill.title;
      break;
    case "warcry":
      state.player.revealUntil = state.elapsed + 8;
      state.player.actionLock = 0.9;
      playSkillSound(skill.effectType);
      playClip(skill.animation, { loop: false, fade: 0.1, timeScale: 1.02 });
      state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + 28);
      state.stats.mp = Math.min(state.stats.maxMp, state.stats.mp + 18);
      spawnShockwave(state.player.position, "#ffe38f", 8.2, 0.5);
      state.message = skill.title;
      break;
    case "banner":
      state.player.actionLock = 0.84;
      playSkillSound(skill.effectType);
      playClip(skill.animation, { loop: false, fade: 0.1, timeScale: 1 });
      createBannerAura();
      state.message = skill.title;
      break;
    default:
      break;
  }

  return true;
}

function createBannerAura() {
  clearBannerAura();

  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.2, 6.6, 48),
    new THREE.MeshBasicMaterial({
      color: "#f48db1",
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const marker = state.templates.banner
    ? state.templates.banner.clone(true)
    : new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.6, 8), materials.aura);
  marker.position.y = 0;
  group.add(marker);
  group.position.copy(state.player.position);
  worldGroup.add(group);

  state.bannerAura = {
    group,
    ring,
    marker,
    origin: state.player.position.clone(),
    expiresAt: state.elapsed + 12,
  };
}

function clearBannerAura() {
  if (!state.bannerAura) {
    return;
  }
  worldGroup.remove(state.bannerAura.group);
  state.bannerAura = null;
}

function spawnShockwave(position, color, radius, duration) {
  const mesh = acquireShockwaveMesh();
  mesh.material.color.set(color);
  mesh.material.opacity = 0.58;
  mesh.position.set(position.x, state.world.floorTop + 0.08, position.z);
  mesh.scale.setScalar(0.4);
  effectGroup.add(mesh);
  state.shockwaves.push({
    mesh,
    radius,
    duration,
    life: duration,
  });
}

function strikeCollectiblesInFront(range, width, color, damage = 1) {
  const direction = helper.tempVector.set(
    Math.sin(state.player.heading),
    0,
    Math.cos(state.player.heading),
  );

  state.collectibles.forEach((collectible) => {
    if (collectible.collected) {
      return;
    }

    helper.tempVectorB.set(
      collectible.x - state.player.position.x,
      0,
      collectible.z - state.player.position.z,
    );

    const distance = helper.tempVectorB.length();
    if (distance > range) {
      return;
    }

    helper.tempVectorB.normalize();
    if (helper.tempVectorB.dot(direction) < width / Math.max(range, 0.001) - 0.16) {
      return;
    }

    damageCollectibleBarrier(collectible, color, damage);
  });
}

function collectInRadius(center, radius, color) {
  state.collectibles.forEach((collectible) => {
    if (collectible.collected) {
      return;
    }
    const distance = Math.hypot(collectible.x - center.x, collectible.z - center.z);
    if (distance <= radius && collectible.barrierHp <= 0) {
      collectOne(collectible, color);
    }
  });
}

function strikeCollectiblesInRadius(center, radius, color, damage = 1) {
  state.collectibles.forEach((collectible) => {
    if (collectible.collected) {
      return;
    }

    const distance = Math.hypot(collectible.x - center.x, collectible.z - center.z);
    if (distance <= radius) {
      damageCollectibleBarrier(collectible, color, damage);
    }
  });
}

function checkCollectiblesPassive(radius) {
  if (simulationState.ready && state.nearestId !== null && state.nearestDistance !== null && state.nearestDistance <= radius) {
    const collectible = state.collectibles.find((entry) => entry.id === state.nearestId && !entry.collected && entry.barrierHp <= 0);
    if (collectible) {
      collectOne(collectible, "#ffd873");
      return;
    }
  }

  collectInRadius(state.player.position, radius, "#ffd873");
}

function collectOne(collectible, color) {
  if (collectible.collected || collectible.barrierHp > 0) {
    return;
  }

  collectible.collected = true;
  collectible.group.visible = false;
  syncCollectibleToSimulation(collectible.id, true);
  playCollectibleSound();
  state.collectedLetterIds.add(collectible.id);
  state.collectedCount = state.collectedLetterIds.size;
  state.ui.alphabetDirty = true;
  state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + 6);
  state.stats.mp = Math.min(state.stats.maxMp, state.stats.mp + 5);
  grantXp(24);
  spawnShockwave(collectible.group.position, color, 3.4, 0.24);
  showToast(`${collectible.label} toplandi`);
  state.message = `${collectible.label} envantere eklendi`;
  announceCollectedLetter(collectible);
  scheduleLetterCardReveal(collectible.meta, collectible.imageHref, 500);
  updateInteractionTargets();
  sendMultiplayerSnapshot(true);

  if (getRemainingCollectibleCount() === 0) {
    const nextStage = getNextStage(state.world.stageKey);
    if (nextStage) {
      createStagePortal(nextStage);
      state.message = `${getStageLabel(state.world.stageKey)} tamamlandi. Buyuk gecitten ilerle`;
      return;
    }

    if (state.collectedCount === state.totalCollectibles) {
      state.mode = "victory";
      state.player.actionLock = 0;
      dom.winScreen.classList.add("is-visible");
      syncWinPlacement(0);
    }
  }
}

function grantXp(amount) {
  state.stats.xp += amount;
  while (state.stats.xp >= state.stats.nextXp) {
    state.stats.xp -= state.stats.nextXp;
    state.stats.level += 1;
    playLevelUpSound();
    state.stats.nextXp = Math.round(state.stats.nextXp * 1.18);
    state.stats.maxHp += 18;
    state.stats.maxMp += 10;
    state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + 24);
    state.stats.mp = Math.min(state.stats.maxMp, state.stats.mp + 15);
    showToast(`Seviye ${state.stats.level} oldu`);
  }
  sendMultiplayerSnapshot(true);
}

function grantGold(amount) {
  state.stats.gold += amount;
  playCoinCollectSound();
  sendMultiplayerSnapshot(true);
}

function createCoinValueChunks(total, parts) {
  const safeParts = Math.max(1, Math.min(parts, total));
  const chunks = [];
  const base = Math.floor(total / safeParts);
  let remainder = total - base * safeParts;

  for (let index = 0; index < safeParts; index += 1) {
    const bonus = remainder > 0 ? 1 : 0;
    remainder -= bonus;
    chunks.push(base + bonus);
  }

  return chunks;
}

function getWorldSectionForPosition(x, z) {
  if (!state.world.sections.length) {
    return null;
  }

  const padding = state.world.tileSize * 0.6;
  const directMatch = state.world.sections.find((section) => (
    x >= section.bounds.minX - padding
    && x <= section.bounds.maxX + padding
    && z >= section.bounds.minZ - padding
    && z <= section.bounds.maxZ + padding
  ));

  if (directMatch) {
    return directMatch;
  }

  return state.world.sections.reduce((closest, section) => {
    const sectionDistance = Math.hypot(x - section.centerX, z - section.centerZ);
    if (!closest || sectionDistance < closest.distance) {
      return { section, distance: sectionDistance };
    }
    return closest;
  }, null)?.section ?? null;
}

function getStageLabel(stageKey) {
  return stageLabels[stageKey] ?? stageKey;
}

function updateZoneLabel() {
  const { x, z } = state.player.position;
  const section = getWorldSectionForPosition(x, z);
  if (section) {
    state.world.currentMap = section.stageKey ?? section.key;
    state.zone = section.label;
    return;
  }
  state.world.currentMap = state.world.stageKey;
  state.zone = getStageLabel(state.world.stageKey);
}

function drawMinimap() {
  const ctx = minimapContext;
  const size = dom.minimapCanvas.width;
  const center = size / 2;
  const span = Math.max(
    state.world.bounds.maxX - state.world.bounds.minX,
    state.world.bounds.maxZ - state.world.bounds.minZ,
  );
  const scale = (size * 0.82) / Math.max(span, 1);

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, size * 0.44, 0, Math.PI * 2);
  ctx.clip();

  const gradient = ctx.createRadialGradient(center, center, 8, center, center, size * 0.44);
  gradient.addColorStop(0, "rgba(73, 50, 30, 0.72)");
  gradient.addColorStop(1, "rgba(16, 11, 9, 0.95)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const sectionPalette = {
    sunCourt: {
      fill: "rgba(214, 176, 110, 0.54)",
      stroke: "rgba(255, 229, 168, 0.42)",
      activeFill: "rgba(234, 196, 122, 0.74)",
    },
    halloweenHollows: {
      fill: "rgba(72, 90, 111, 0.46)",
      stroke: "rgba(151, 192, 255, 0.22)",
      activeFill: "rgba(112, 145, 184, 0.68)",
    },
  };

  state.world.sections.forEach((section) => {
    const palette = sectionPalette[section.stageKey ?? section.key] ?? sectionPalette.sunCourt;
    const isActive = section.label === state.zone;
    const width = (section.bounds.maxX - section.bounds.minX) * scale;
    const height = (section.bounds.maxZ - section.bounds.minZ) * scale;
    const x = center + section.bounds.minX * scale;
    const y = center + section.bounds.minZ * scale;

    ctx.fillStyle = isActive ? palette.activeFill : palette.fill;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = isActive ? 2.4 : 1.4;
    ctx.strokeRect(x, y, width, height);
  });

  if (!state.world.sections.length) {
    const floorWidth = (state.world.bounds.maxX - state.world.bounds.minX) * scale;
    const floorHeight = (state.world.bounds.maxZ - state.world.bounds.minZ) * scale;
    ctx.fillStyle = "rgba(214, 176, 110, 0.66)";
    ctx.fillRect(center - floorWidth / 2, center - floorHeight / 2, floorWidth, floorHeight);
  }

  state.blockers.forEach((blocker) => {
    ctx.fillStyle = "rgba(64, 42, 24, 0.82)";
    ctx.fillRect(
      center + blocker.x * scale - blocker.halfX * scale,
      center + blocker.z * scale - blocker.halfZ * scale,
      blocker.halfX * 2 * scale,
      blocker.halfZ * 2 * scale,
    );
  });

  if (state.portal) {
    const x = center + state.portal.x * scale;
    const y = center + state.portal.z * scale;
    const isNearest = state.nearestPortalDistance !== null && state.nearestPortalDistance <= 4.4;
    ctx.strokeStyle = isNearest ? "#d8ffff" : "rgba(114, 238, 255, 0.86)";
    ctx.lineWidth = isNearest ? 2.6 : 2;
    ctx.beginPath();
    ctx.arc(x, y, 7.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  state.chests.forEach((chest) => {
    const x = center + chest.x * scale;
    const y = center + chest.z * scale;
    ctx.fillStyle = chest.opened ? "rgba(122, 255, 198, 0.7)" : "#ffd873";
    ctx.fillRect(x - 4.5, y - 4.5, 9, 9);
    if (chest.id === state.nearestChestId && !chest.opened) {
      ctx.strokeStyle = "rgba(255, 248, 184, 0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 6.5, y - 6.5, 13, 13);
    }
  });

  if (state.bannerAura) {
    const x = center + state.bannerAura.origin.x * scale;
    const y = center + state.bannerAura.origin.z * scale;
    ctx.strokeStyle = "rgba(244, 141, 177, 0.58)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
  }

  state.collectibles.forEach((collectible) => {
    if (collectible.collected) {
      return;
    }
    const x = center + collectible.x * scale;
    const y = center + collectible.z * scale;
    ctx.fillStyle = collectible.barrierHp > 0
      ? collectible.id === state.nearestId ? "#93efff" : "rgba(147, 239, 255, 0.78)"
      : collectible.id === state.nearestId ? "#ffdc72" : "rgba(255, 223, 155, 0.82)";
    ctx.beginPath();
    ctx.arc(x, y, collectible.id === state.nearestId ? 4.5 : 3.1, 0, Math.PI * 2);
    ctx.fill();
  });

  const remoteBudget = getRemoteRenderBudget();
  const minimapPlayers = getVisibleRemoteRosterPlayers(state.session.roster, {
    ...remoteBudget,
    visibleCap: remoteBudget.minimapMarkerCap,
  });
  state.session.remoteVisualSync.minimapRemoteIterationCount = minimapPlayers.length;
  minimapPlayers.forEach((player) => {
    const x = center + player.position.x * scale;
    const y = center + player.position.z * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-player.position.heading);
    ctx.fillStyle = "#7ee8ff";
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.5, 5.5);
    ctx.lineTo(-5.5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  const playerX = center + state.player.position.x * scale;
  const playerY = center + state.player.position.z * scale;
  ctx.translate(playerX, playerY);
  ctx.rotate(-state.player.heading);
  ctx.fillStyle = "#ff8d2c";
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6.5, 7);
  ctx.lineTo(-6.5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateOverlays(delta, force = false) {
  state.performance.uiTimer += delta;
  state.performance.minimapTimer += delta;
  const uiInterval = Math.max(qualityProfile.uiInterval ?? 0, 0);
  const minimapInterval = Math.max(qualityProfile.minimapInterval ?? 0, 0);

  if (force || uiInterval === 0 || state.performance.uiTimer >= uiInterval) {
    syncUi();
    state.performance.uiTimer = 0;
  }

  if (force || minimapInterval === 0 || state.performance.minimapTimer >= minimapInterval) {
    if (state.settings.minimapEnabled) {
      drawMinimap();
    }
    state.performance.minimapTimer = 0;
  }
}

function syncUi() {
  dom.playerName.textContent = state.session.playerName || defaultPlayerTitle;
  dom.collectedCountLabel.textContent = `${state.collectedCount} / ${state.totalCollectibles}`;
  syncAlphabetHud();
  dom.zoneLabel.textContent = state.zone;
  dom.messageLabel.textContent = state.settings.showHints ? (state.interactionHint || state.message) : state.message;
  dom.levelLabel.textContent = String(state.stats.level);
  dom.hpLabel.textContent = `${Math.round(state.stats.hp)} / ${state.stats.maxHp}`;
  dom.mpLabel.textContent = `${Math.round(state.stats.mp)} / ${state.stats.maxMp}`;
  dom.goldLabel.textContent = `${Math.round(state.stats.gold)}`;
  if (dom.presenceLabel) {
    const activeMapKey = getActiveMultiplayerMapKey();
    const count = Math.max(
      1,
      state.session.roster.filter((player) => getNormalizedRemoteMapKey(player) === activeMapKey).length || (multiplayer.isConnected() ? 1 : 0),
    );
    dom.presenceLabel.textContent = String(count);
  }
  dom.xpLabel.textContent = `${Math.round(state.stats.xp)} / ${state.stats.nextXp}`;
  dom.hpFill.style.width = `${(state.stats.hp / state.stats.maxHp) * 100}%`;
  dom.mpFill.style.width = `${(state.stats.mp / state.stats.maxMp) * 100}%`;
  dom.coordinateLabel.textContent = `${state.player.position.x.toFixed(1)}, ${state.player.position.z.toFixed(1)}`;

  const xpProgress = THREE.MathUtils.clamp(state.stats.xp / Math.max(state.stats.nextXp, 1), 0, 1);
  if (Math.abs(xpProgress - state.ui.lastXpProgress) > 0.001) {
    state.ui.xpCells.forEach(({ cell, fill }, index) => {
      const cellProgress = THREE.MathUtils.clamp(xpProgress * xpCubeCount - index, 0, 1);
      fill.style.transform = `scaleX(${cellProgress})`;
      cell.classList.toggle("is-active", cellProgress > 0.01);
    });
    state.ui.lastXpProgress = xpProgress;
  }

  if (state.mode === "loading") {
    dom.targetLabel.textContent = "Yukleniyor";
  } else if (state.mode === "victory") {
    dom.targetLabel.textContent = "Tum harfler";
  } else if (!state.settings.showHints) {
    dom.targetLabel.textContent = "Takip kapali";
  } else {
    const collectible = state.collectibles.find((entry) => entry.id === state.nearestId);
    const portalActive = state.portal && state.nearestPortalDistance !== null && state.nearestPortalDistance <= 5.2;
    const chest = state.chests.find((entry) => entry.id === state.nearestChestId && !entry.opened);
    const moveTargetDistance = state.moveTarget
      ? Math.hypot(state.moveTarget.x - state.player.position.x, state.moveTarget.z - state.player.position.z)
      : null;
    dom.targetLabel.textContent = collectible
      ? collectible.barrierHp > 0
        ? `${collectible.label} · ${state.nearestDistance?.toFixed(1) ?? "-"}m · Muhafaza ${collectible.barrierHp}/${collectible.barrierMaxHp}`
        : `${collectible.label} · ${state.nearestDistance?.toFixed(1) ?? "-"}m · Serbest`
      : portalActive
        ? `${state.portal.label ?? "Buyuk Gecit"} · ${state.nearestPortalDistance.toFixed(1)}m`
        : chest && state.nearestChestDistance !== null && state.nearestChestDistance <= 5.4
          ? `${chest.label} · ${state.nearestChestDistance.toFixed(1)}m`
          : moveTargetDistance !== null && moveTargetDistance > 0.35
            ? `Tik hedefi · ${moveTargetDistance.toFixed(1)}m`
            : state.autoAttackEnabled
              ? "Hazir · Oto saldiri acik"
              : "Hazir";
  }

  if (!state.cooldownsDirty) {
    return;
  }

  state.skills.forEach((skill) => {
    const ui = state.skillUi.get(skill.id);
    if (!ui) {
      return;
    }
    const cooling = skill.cooldownLeft > 0.01;
    ui.button.classList.toggle("is-cooling", cooling);
    ui.button.classList.toggle("is-empty", state.stats.mp < skill.cost);
    ui.touchButton.classList.toggle("is-cooling", cooling);
    ui.touchButton.classList.toggle("is-empty", state.stats.mp < skill.cost);
    ui.cooldownLabel.textContent = skill.cooldownLeft.toFixed(1);
    if (ui.touchCooldownLabel) {
      ui.touchCooldownLabel.textContent = cooling ? skill.cooldownLeft.toFixed(1) : "";
    }
    ui.touchButton.disabled = cooling || state.stats.mp < skill.cost;
    ui.touchButton.style.opacity = cooling || state.stats.mp < skill.cost ? "0.45" : "1";
  });

  state.cooldownsDirty = false;
}

function renderGameToText() {
  const collectedLetterIds = [...state.collectedLetterIds].sort((left, right) => left - right);
  const currentStageLetterIds = getStageLetterPool(state.world.stageKey).map((asset) => asset.id);
  const remoteBudget = getRemoteRenderBudget();
  const sameMapRoster = getSameMapRemoteRoster();
  const remoteLabelCount = [...state.session.remotePlayers.values()].reduce(
    (count, visual) => count + Number(Boolean(visual?.userData?.label)),
    0,
  );
  const visibleCollectibles = state.collectibles
    .filter((collectible) => !collectible.collected)
    .sort((left, right) => {
      const leftDistance = Math.hypot(left.x - state.player.position.x, left.z - state.player.position.z);
      const rightDistance = Math.hypot(right.x - state.player.position.x, right.z - state.player.position.z);
      return leftDistance - rightDistance;
    })
    .slice(0, 6)
    .map((collectible) => ({
      id: collectible.id,
      label: collectible.label,
      x: Number(collectible.x.toFixed(2)),
      z: Number(collectible.z.toFixed(2)),
      distance: Number(Math.hypot(collectible.x - state.player.position.x, collectible.z - state.player.position.z).toFixed(2)),
      barrierHp: collectible.barrierHp,
      barrierMaxHp: collectible.barrierMaxHp,
      barrierBroken: collectible.barrierHp <= 0,
    }));

  const chestState = state.chests
    .map((chest) => ({
      id: chest.id,
      label: chest.label,
      x: Number(chest.x.toFixed(2)),
      z: Number(chest.z.toFixed(2)),
      opened: chest.opened,
      distance: Number(Math.hypot(chest.x - state.player.position.x, chest.z - state.player.position.z).toFixed(2)),
      loot: chest.loot.map((item) => item.name),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 3);
  return JSON.stringify({
    mode: state.mode,
    note: "Koordinat sistemi: origin kale merkezi, +x dogu, +z guney, y yukari.",
    player: {
      x: Number(state.player.position.x.toFixed(2)),
      y: Number(state.player.position.y.toFixed(2)),
      z: Number(state.player.position.z.toFixed(2)),
      floorHeight: Number(getStageFloorHeight(state.player.position.x, state.player.position.z).toFixed(2)),
      heading: Number(state.player.heading.toFixed(3)),
      clip: state.player.currentClip,
      running: state.keys.has("shift") && state.player.motionAmount > 0.08 && state.player.crouchAmount < 0.2,
      crouch: Number(state.player.crouchAmount.toFixed(2)),
      comboHit: state.player.lastComboHit,
      nextComboHit: state.player.comboIndex + 1,
      attackHeld: state.player.attackHeld,
      basicAttackClip: state.player.lastBasicAttackClip,
      moveTarget: state.moveTarget
        ? {
          x: Number(state.moveTarget.x.toFixed(2)),
          z: Number(state.moveTarget.z.toFixed(2)),
          source: state.moveTarget.source,
        }
        : null,
    },
    combat: {
      autoAttackEnabled: state.autoAttackEnabled,
    },
    stats: {
      level: state.stats.level,
      hp: Number(state.stats.hp.toFixed(1)),
      mp: Number(state.stats.mp.toFixed(1)),
      gold: Math.round(state.stats.gold),
      xp: state.stats.xp,
      nextXp: state.stats.nextXp,
    },
    collectedCount: state.collectedCount,
    totalCollectibles: state.totalCollectibles,
    stageCollected: getTargetCollectibleCount(state.world.stageKey) - getRemainingCollectibleCount(),
    stageTotal: getTargetCollectibleCount(state.world.stageKey),
    collected: state.collectedCount,
    total: state.totalCollectibles,
    alphabet: {
      totalLetters: totalLetterCount,
      collectedLetterIds,
      currentStageLetterIds,
    },
    zone: state.zone,
    stageKey: state.world.stageKey,
    currentMap: state.world.currentMap,
    phase: state.world.phase,
    nearestId: state.nearestId,
    nearestDistance: state.nearestDistance ? Number(state.nearestDistance.toFixed(2)) : null,
    interaction: {
      hint: state.interactionHint,
      nearestChestId: state.nearestChestId,
      nearestChestDistance: state.nearestChestDistance !== null ? Number(state.nearestChestDistance.toFixed(2)) : null,
      nearestPortalDistance: state.nearestPortalDistance !== null ? Number(state.nearestPortalDistance.toFixed(2)) : null,
    },
    ui: {
      questVisible: state.ui.questVisible,
      settingsVisible: state.ui.settingsVisible,
      letterCardVisible: state.ui.letterCardVisible,
      mobileImmersivePromptVisible: state.ui.mobileImmersivePromptVisible,
      mobileLandscape: state.ui.mobileLandscape,
      mobileFullscreen: state.ui.mobileFullscreen,
      mobileMinimapCollapsed: state.ui.mobileMinimapCollapsed,
      touchActionCount: dom.touchActions?.childElementCount ?? 0,
      activeLetterCard: state.ui.activeLetterCard
        ? {
          id: state.ui.activeLetterCard.id,
          name: state.ui.activeLetterCard.nameTr,
          symbol: state.ui.activeLetterCard.symbol,
          exampleWord: state.ui.activeLetterCard.example.word,
          sunMoon: state.ui.activeLetterCard.sunMoon?.label ?? null,
          thickness: state.ui.activeLetterCard.thickness?.label ?? null,
        }
        : null,
      xpProgress: Number((state.stats.xp / Math.max(state.stats.nextXp, 1)).toFixed(3)),
    },
    settings: {
      quality: state.settings.quality,
      letterDensity: state.settings.letterDensity,
      chestDensity: state.settings.chestDensity,
      characterScale: state.settings.characterScale,
      letterScale: state.settings.letterScale,
      minimapEnabled: state.settings.minimapEnabled,
      showHints: state.settings.showHints,
      reduceMotion: state.settings.reduceMotion,
      showFps: state.settings.showFps,
      volumes: {
        master: state.settings.masterVolume,
        music: state.settings.musicVolume,
        sfx: state.settings.sfxVolume,
      },
    },
    camera: {
      yaw: Number(state.camera.yaw.toFixed(3)),
      pitch: Number(state.camera.pitch.toFixed(3)),
      distance: Number(state.camera.distance.toFixed(2)),
      actualDistance: Number(state.camera.actualDistance.toFixed(2)),
    },
    performance: {
      lowSpec: qualityProfile.lowSpec,
      pixelRatioCap: qualityProfile.pixelRatioCap,
      shadows: qualityProfile.enableShadows,
      fps: state.performance.fpsValue,
      rendererBackend: state.performance.rendererBackend,
      webgpuSupported: state.performance.webgpuSupported,
      physicsBackend: state.performance.physicsBackend,
      ktx2Enabled: state.performance.ktx2Enabled,
      simulationReady: simulationState.ready,
      rapierVersion: simulationState.rapierVersion || null,
    },
    audio: {
      unlocked: audioState.musicUnlocked,
      musicEnabled: state.settings.musicEnabled,
      footstepsEnabled: state.settings.footstepsEnabled,
    },
    skills: state.skills.map((skill) => ({
      id: skill.id,
      cd: Number(skill.cooldownLeft.toFixed(2)),
      mana: skill.cost,
    })),
    multiplayer: {
      connected: multiplayer.isConnected(),
      connectionStatus: state.session.connectionStatus,
      status: state.session.match.status,
      roundId: state.session.match.roundId,
      allowedRoundId: state.session.match.allowedRoundId,
      finishPlace: state.session.match.finishPlace,
      playerId: state.session.playerId || null,
      playerName: state.session.playerName || null,
      selectedCharacterId: state.session.selectedCharacterId,
      onlineCount: state.session.roster.length,
      remoteRosterCount: state.session.roster.length,
      sameMapRosterCount: sameMapRoster.length,
      renderedRemoteCount: state.session.remotePlayers.size,
      remoteCap: remoteBudget.visibleCap,
      remoteLabelCount,
      remoteLabelCap: remoteBudget.labelCap,
      visualSyncIntervalMs: remoteBudget.visualSyncIntervalMs,
      snapshotIntervalMs: remoteBudget.snapshotIntervalMs,
      finisherCount: state.session.match.finishOrder.length,
      rosterEventCount: state.session.remoteVisualSync.rosterEventCount,
      rosterFlushCount: state.session.remoteVisualSync.flushCount,
      coalescedRosterEventCount: state.session.remoteVisualSync.coalescedEventCount,
      pendingVisualSync: state.session.remoteVisualSync.pending,
      summaryIterationCount: state.session.remoteVisualSync.summaryIterationCount,
      minimapRemoteIterationCount: state.session.remoteVisualSync.minimapRemoteIterationCount,
      visiblePlayers: sameMapRoster
        .map((player) => ({
          id: player.id,
          name: player.name,
          characterId: player.characterId ?? null,
          mapKey: player.mapKey,
          stageKey: player.stageKey,
          x: Number(Number(player.position?.x ?? 0).toFixed(2)),
          z: Number(Number(player.position?.z ?? 0).toFixed(2)),
          heading: Number(Number(player.position?.heading ?? 0).toFixed(3)),
          score: Number(player.score?.total ?? 0),
          collectedCount: Number(player.score?.collectedCount ?? 0),
          gold: Number(player.score?.gold ?? 0),
        })),
    },
    chests: chestState,
    portal: state.portal
      ? {
        label: state.portal.label ?? null,
        targetStage: state.portal.targetStage,
        x: Number(state.portal.x.toFixed(2)),
        z: Number(state.portal.z.toFixed(2)),
        distance: state.nearestPortalDistance !== null ? Number(state.nearestPortalDistance.toFixed(2)) : null,
      }
      : null,
    lootBursts: state.lootBursts.map((burst) => ({
      chestId: burst.sourceChestId,
      totalGold: burst.totalGold,
      collectedGold: burst.collectedGold,
      remainingCoins: burst.items.filter((item) => !item.collected).length,
      coinScale: burst.coinScale,
      loot: burst.loot,
    })),
    visibleCollectibles,
  });
}

function render() {
  if (!renderer) {
    return;
  }

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  if (renderer) {
    configureRenderer(renderer, qualityProfile);
  }

  refreshTouchJoystick();
  updateMobileImmersivePrompt();
  applyUiSettings();
  updateOverlays(0, true);
  render();
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await requestFullscreenPreferred();
  } else {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore unsupported fullscreen exits.
    }
  }
  updateMobileImmersivePrompt();
}

function showToast(message, durationMs = 1300) {
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  window.clearTimeout(state.toastTimeoutId);
  state.toastTimeoutId = window.setTimeout(() => {
    dom.toast.classList.remove("is-visible");
  }, Math.max(500, Number(durationMs) || 1300));
}

function pseudoRandom(seed) {
  const value = Math.sin(seed * 91.73) * 43758.5453;
  return value - Math.floor(value);
}

function freezeStaticObject(root) {
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    node.matrixAutoUpdate = false;
  });
}

function detectQualityProfile() {
  const coarsePointer = window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ?? false;
  const smallScreen = Math.max(window.innerWidth, window.innerHeight) <= 1024;
  const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 6;
  const lowMemory = (navigator.deviceMemory ?? 8) <= 4;
  const lowSpec = (coarsePointer && (smallScreen || lowCpu || lowMemory)) || lowMemory;

  if (lowSpec) {
    dom.minimapCanvas.width = 164;
    dom.minimapCanvas.height = 164;
  }

  return {
    autoLowSpec: lowSpec,
    lowSpec,
    pixelRatioCap: lowSpec ? 1 : 1.75,
    enableShadows: !lowSpec,
    enableChestLights: !lowSpec,
    uiInterval: lowSpec ? 0.08 : 1 / 30,
    minimapInterval: lowSpec ? 0.12 : 1 / 15,
  };
}

