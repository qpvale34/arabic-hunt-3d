import { MultiplayerClient, sanitizePlayerName } from "./network/multiplayerClient.js";

const params = new URLSearchParams(window.location.search);
const dom = {
  status: document.querySelector("#bot-status"),
  meta: document.querySelector("#bot-meta"),
  json: document.querySelector("#bot-json"),
};

const playerName = sanitizePlayerName(params.get("name") || `Bot-${Math.random().toString(36).slice(2, 8)}`, "Bot");
const mapKey = String(params.get("map") || "sunCourt").trim() || "sunCourt";
const characterId = String(params.get("character") || "knight").trim() || "knight";
const snapshotIntervalMs = Math.max(120, Number(params.get("interval") || 220) || 220);
const radius = Math.max(2, Number(params.get("radius") || 8) || 8);
const autoJoin = !/^(0|false|no|off)$/i.test(String(params.get("autojoin") ?? "1"));
const driftScale = Math.max(0.4, Number(params.get("speed") || 1) || 1);

const client = new MultiplayerClient({ characterId, reconnect: true });

const state = {
  connected: false,
  playerId: null,
  status: "idle",
  detail: "",
  rosterCount: 0,
  roundId: 0,
  snapshotsSent: 0,
  x: 0,
  z: 0,
  heading: 0,
};

function renderState() {
  dom.status.textContent = `${playerName} · ${state.status}`;
  dom.meta.textContent = `${state.detail || "Hazır"} · oyuncu ${state.rosterCount} · snapshot ${state.snapshotsSent}`;
  dom.json.textContent = JSON.stringify({
    ...state,
    playerName,
    mapKey,
    characterId,
    snapshotIntervalMs,
  }, null, 2);
}

function buildSnapshot(step) {
  const angle = step * 0.18 * driftScale;
  state.x = Number((Math.cos(angle) * radius).toFixed(2));
  state.z = Number((Math.sin(angle) * radius).toFixed(2));
  state.heading = Number((angle % (Math.PI * 2)).toFixed(3));

  return {
    currentMap: mapKey,
    stageKey: mapKey,
    player: {
      x: state.x,
      z: state.z,
      heading: state.heading,
    },
    stats: {
      level: 1,
      xp: state.snapshotsSent,
      gold: 0,
      collectedCount: 0,
    },
    collectedCount: 0,
  };
}

let snapshotTimer = 0;
function startSnapshots() {
  if (snapshotTimer) {
    return;
  }
  let step = 0;
  snapshotTimer = window.setInterval(() => {
    if (!client.isConnected()) {
      return;
    }
    step += 1;
    state.snapshotsSent += 1;
    client.sendSnapshot(buildSnapshot(step));
    renderState();
  }, snapshotIntervalMs);
}

client.addEventListener("statuschange", (event) => {
  state.status = event.detail.status;
  state.detail = event.detail.detail || event.detail.label || "";
  renderState();
});

client.addEventListener("welcome", (event) => {
  state.connected = true;
  state.playerId = event.detail.playerId || null;
  renderState();
  startSnapshots();
});

client.addEventListener("roster", (event) => {
  state.rosterCount = event.detail.players?.length ?? 0;
  renderState();
});

client.addEventListener("matchstate", (event) => {
  state.roundId = Number(event.detail.roundId ?? 0) || 0;
  renderState();
});

window.render_bot_to_text = () => JSON.stringify({
  ...state,
  playerName,
  mapKey,
  characterId,
  snapshotIntervalMs,
});

if (autoJoin) {
  void client.connect({
    name: playerName,
    mapKey,
    characterId,
  });
}

renderState();
