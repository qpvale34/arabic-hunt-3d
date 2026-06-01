import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const adminHtmlPath = path.join(repoRoot, "admin.html");
const hostHtmlPath = path.join(repoRoot, "host.html");
const adminJsPath = path.join(repoRoot, "src", "admin.js");

const MULTIPLAYER_ADMIN_CODE = process.env.MULTIPLAYER_ADMIN_CODE;
if (!MULTIPLAYER_ADMIN_CODE) {
  throw new Error(
    "[multiplayer-server] MULTIPLAYER_ADMIN_CODE env var is required. " +
      "Set it in your environment or a local .env file before starting the server."
  );
}

const CONFIG = {
  host: process.env.MULTIPLAYER_HOST || "127.0.0.1",
  port: Number(process.env.MULTIPLAYER_PORT ?? 2567) || 2567,
  adminCode: MULTIPLAYER_ADMIN_CODE,
  totalLetters: Number(process.env.MULTIPLAYER_TOTAL_LETTERS ?? 30) || 30,
  appOrigin: (process.env.MULTIPLAYER_APP_ORIGIN || "").trim(),
  adminSessionTtlMs: 12 * 60 * 60 * 1000,
  stalePlayerMs: 25_000,
  corsOrigin: process.env.MULTIPLAYER_CORS_ORIGIN || "*",
  rosterBroadcastIntervalMs: Number(process.env.MULTIPLAYER_ROSTER_INTERVAL_MS ?? 180) || 180,
};

const state = {
  match: {
    status: "lobby",
    roundId: 0,
    totalLetters: CONFIG.totalLetters,
    startedAt: null,
    finishedAt: null,
    finishOrder: [],
  },
  players: new Map(),
  sockets: new Map(),
  adminSessions: new Map(),
  events: [],
  qrCache: new Map(),
  rosterBroadcast: {
    timer: null,
    pending: false,
    pendingReason: "",
    broadcastCount: 0,
    scheduledCount: 0,
    immediateCount: 0,
    coalescedCount: 0,
    lastBroadcastAt: 0,
    lastReason: "startup",
  },
};

const server = http.createServer((req, res) => {
  void handleRequest(req, res);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket) => {
  if (req.url !== "/multiplayer") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, Buffer.alloc(0), (ws) => {
    const player = createPlayerRecord();
    attachSocketWs(player, ws);
  });
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`[multiplayer] http://${CONFIG.host}:${CONFIG.port} · admin code: ${CONFIG.adminCode}`);
});

setInterval(() => {
  pruneAdminSessions();
  pruneStalePlayers();
}, 30_000).unref();

async function handleRequest(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, inferOrigin(req));
  const pathname = url.pathname;

  if (pathname === "/health") {
    respondJson(res, 200, {
      ok: true,
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      players: state.players.size,
      match: summarizeMatch(),
      rosterBroadcast: buildRosterBroadcastMetrics(),
    });
    return;
  }

  if (pathname === "/admin" || pathname === "/admin.html") {
    serveFile(res, adminHtmlPath, "text/html; charset=utf-8");
    return;
  }

  if (pathname === "/host" || pathname === "/host.html") {
    serveFile(res, hostHtmlPath, "text/html; charset=utf-8");
    return;
  }

  if (pathname === "/src/admin.js") {
    serveFile(res, adminJsPath, "text/javascript; charset=utf-8");
    return;
  }

  if (pathname === "/api/state") {
    respondJson(res, 200, await serializePublicState(req));
    return;
  }

  if (pathname === "/api/admin/login" && req.method === "POST") {
    const body = await readJson(req);
    if (String(body.code ?? "").trim() !== CONFIG.adminCode) {
      respondJson(res, 403, { error: "Admin kodu gecersiz." });
      return;
    }

    const token = crypto.randomBytes(24).toString("hex");
    state.adminSessions.set(token, {
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
    respondJson(res, 200, { token });
    return;
  }

  if (pathname.startsWith("/api/admin/")) {
    const session = requireAdmin(req, res);
    if (!session) {
      return;
    }
    session.lastUsedAt = Date.now();

    if (pathname === "/api/admin/state" && req.method === "GET") {
      respondJson(res, 200, await serializeAdminState(req));
      return;
    }

    if (pathname === "/api/admin/start" && req.method === "POST") {
      startRound();
      respondJson(res, 200, { ok: true, match: summarizeMatch() });
      return;
    }

    if (pathname === "/api/admin/reset" && req.method === "POST") {
      resetRound();
      respondJson(res, 200, { ok: true, match: summarizeMatch() });
      return;
    }

    if (pathname === "/api/admin/announce" && req.method === "POST") {
      const body = await readJson(req);
      const message = String(body.message ?? "").trim().slice(0, 240);
      if (!message) {
        respondJson(res, 400, { error: "Duyuru metni gerekli." });
        return;
      }
      pushEvent("announcement", "Duyuru", message);
      broadcast({
        type: "announcement",
        message,
        durationMs: Number(body.durationMs ?? 10000) || 10000,
      });
      respondJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/admin/kick" && req.method === "POST") {
      const body = await readJson(req);
      const playerId = String(body.playerId ?? "").trim();
      if (!playerId || !state.players.has(playerId)) {
        respondJson(res, 404, { error: "Oyuncu bulunamadi." });
        return;
      }
      kickPlayer(playerId, "Admin tarafindan cikarildin.");
      respondJson(res, 200, { ok: true });
      return;
    }

    respondJson(res, 404, { error: "Bilinmeyen admin endpointi." });
    return;
  }

  respondJson(res, 404, { error: "Not found" });
}

function createPlayerRecord() {
  return {
    id: crypto.randomUUID(),
    name: "Oyuncu",
    characterId: "knight",
    mapKey: "sunCourt",
    stageKey: "sunCourt",
    currentMap: "sunCourt",
    connected: true,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    lastSnapshotAt: 0,
    allowedRoundId: state.match.status === "running" ? 0 : state.match.roundId,
    finishPlace: 0,
    position: { x: 0, z: 0, heading: 0 },
    score: createEmptyScore(),
  };
}

function createEmptyScore() {
  return {
    total: 0,
    level: 1,
    xp: 0,
    gold: 0,
    collectedCount: 0,
  };
}

function attachSocketWs(player, socket) {
  state.players.set(player.id, player);
  state.sockets.set(player.id, socket);
  pushEvent("player-join", "Yeni baglanti", `${player.id.slice(0, 8)} baglandi`);

  socket.on("message", (chunk) => {
    let payload;
    try {
      payload = JSON.parse(chunk.toString());
    } catch {
      return;
    }
    handleClientMessage(player.id, payload);
  });

  socket.on("close", () => handleDisconnect(player.id, "Baglanti kapandi."));
  socket.on("error", () => handleDisconnect(player.id, "Baglanti koptu."));

  sendToPlayer(player.id, {
    type: "welcome",
    playerId: player.id,
    serverTime: new Date().toISOString(),
  });
  sendMatchStateToPlayer(player.id);
  scheduleRosterBroadcast("player-join", { immediate: true });
}

function attachSocket(player, socket) {
  state.players.set(player.id, player);
  state.sockets.set(player.id, socket);
  pushEvent("player-join", "Yeni baglanti", `${player.id.slice(0, 8)} baglandi`);

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 1) {
      const frame = parseWebSocketFrame(buffer);
      if (!frame) {
        break;
      }
      buffer = buffer.subarray(frame.frameLength);
      handleSocketFrame(player.id, socket, frame);
    }
  });

  socket.on("close", () => handleDisconnect(player.id, "Baglanti kapandi."));
  socket.on("end", () => handleDisconnect(player.id, "Baglanti kapandi."));
  socket.on("error", () => handleDisconnect(player.id, "Baglanti koptu."));

  sendToPlayer(player.id, {
    type: "welcome",
    playerId: player.id,
    serverTime: new Date().toISOString(),
  });
  sendMatchStateToPlayer(player.id);
  scheduleRosterBroadcast("player-join", { immediate: true });
}

function handleSocketFrame(playerId, socket, frame) {
  if (frame.opcode === 0x8) {
    socket.end();
    handleDisconnect(playerId, "Baglanti kapandi.");
    return;
  }

  if (frame.opcode === 0x9) {
    socket.write(buildWebSocketFrame(frame.payload, 0xA));
    return;
  }

  if (frame.opcode !== 0x1) {
    return;
  }

  let payload;
  try {
    payload = JSON.parse(frame.payload.toString("utf8"));
  } catch {
    return;
  }

  handleClientMessage(playerId, payload);
}

function handleClientMessage(playerId, payload) {
  const player = state.players.get(playerId);
  if (!player) {
    return;
  }

  const type = String(payload?.type ?? "").trim();
  player.lastSeenAt = new Date().toISOString();

  if (type === "ping") {
    sendToPlayer(playerId, { type: "pong", at: Date.now() });
    return;
  }

  if (type === "join" || type === "profile") {
    player.name = sanitizeName(payload.name, player.name);
    player.mapKey = sanitizeMap(payload.mapKey, player.mapKey);
    player.currentMap = player.mapKey;
    player.characterId = sanitizeCharacterId(payload.characterId, player.characterId);
    if (state.match.status !== "running") {
      player.allowedRoundId = state.match.roundId;
      player.finishPlace = 0;
    }
    pushEvent("profile", "Profil", `${player.name} · ${player.mapKey} · ${player.characterId}`);
    sendMatchStateToPlayer(playerId);
    scheduleRosterBroadcast("profile", { immediate: true });
    return;
  }

  if (type === "snapshot") {
    const snapshot = payload.snapshot ?? payload;
    player.currentMap = sanitizeMap(snapshot.currentMap, player.currentMap || player.mapKey);
    player.mapKey = sanitizeMap(player.mapKey || snapshot.currentMap, player.currentMap);
    player.stageKey = sanitizeMap(snapshot.stageKey, player.stageKey || player.currentMap);
    player.position = {
      x: toFiniteNumber(snapshot.player?.x),
      z: toFiniteNumber(snapshot.player?.z),
      heading: toFiniteNumber(snapshot.player?.heading),
    };
    player.lastSnapshotAt = Date.now();
    player.score = normalizeScore(snapshot, state.match.totalLetters);
    if (
      state.match.status === "running"
      && player.allowedRoundId === state.match.roundId
      && !player.finishPlace
      && player.score.collectedCount >= state.match.totalLetters
    ) {
      recordFinisher(player);
    }
    scheduleRosterBroadcast("snapshot");
  }
}

function handleDisconnect(playerId, reason) {
  const player = state.players.get(playerId);
  if (!player) {
    return;
  }

  const socket = state.sockets.get(playerId);
  if (socket) {
    state.sockets.delete(playerId);
    socket.removeAllListeners?.();
    try {
      if (typeof socket.close === "function") {
        socket.close();
      } else {
        socket.destroy();
      }
    } catch {
      // Ignore socket destroy failures.
    }
  }

  state.players.delete(playerId);
  pushEvent("disconnect", "Ayrildi", `${player.name} ayrildi`);
  scheduleRosterBroadcast("disconnect", { immediate: true });
  finalizeRoundIfComplete();
}

function kickPlayer(playerId, reason) {
  const player = state.players.get(playerId);
  if (!player) {
    return;
  }

  sendToPlayer(playerId, { type: "kicked", reason });
  pushEvent("kick", "Cikarildi", `${player.name} cikarildi`);
  handleDisconnect(playerId, reason);
}

function startRound() {
  state.match.status = "running";
  state.match.roundId += 1;
  state.match.startedAt = new Date().toISOString();
  state.match.finishedAt = null;
  state.match.finishOrder = [];
  state.match.totalLetters = CONFIG.totalLetters;

  state.players.forEach((player) => {
    player.allowedRoundId = state.match.roundId;
    player.finishPlace = 0;
    player.score = createEmptyScore();
  });

  pushEvent("round-start", "Tur basladi", `Round #${state.match.roundId} canli.`);
  broadcastMatchState();
  scheduleRosterBroadcast("round-start", { immediate: true });
}

function resetRound() {
  state.match.status = "lobby";
  state.match.startedAt = null;
  state.match.finishedAt = null;
  state.match.finishOrder = [];

  state.players.forEach((player) => {
    player.allowedRoundId = 0;
    player.finishPlace = 0;
    player.score = createEmptyScore();
  });

  pushEvent("round-reset", "Tur reset", "Lobby yeniden acildi.");
  broadcastMatchState();
  scheduleRosterBroadcast("round-reset", { immediate: true });
}

function recordFinisher(player) {
  player.finishPlace = state.match.finishOrder.length + 1;
  const entry = {
    playerId: player.id,
    name: player.name,
    place: player.finishPlace,
    characterId: player.characterId,
    finishedAt: new Date().toISOString(),
    elapsedMs: state.match.startedAt ? Date.now() - new Date(state.match.startedAt).getTime() : 0,
    score: { ...player.score },
  };
  state.match.finishOrder.push(entry);
  pushEvent("finish", "Finisher", `${player.name} #${player.finishPlace} oldu`);
  broadcast({
    type: "finish",
    playerId: player.id,
    place: player.finishPlace,
    score: player.score,
  });
  scheduleRosterBroadcast("finish", { immediate: true });
  finalizeRoundIfComplete();
}

function finalizeRoundIfComplete() {
  if (state.match.status !== "running") {
    return;
  }

  const allowedPlayers = [...state.players.values()].filter((player) => player.allowedRoundId === state.match.roundId);
  if (!allowedPlayers.length) {
    return;
  }

  if (allowedPlayers.every((player) => player.finishPlace > 0)) {
    state.match.status = "finished";
    state.match.finishedAt = new Date().toISOString();
    pushEvent("round-finished", "Tur bitti", `${allowedPlayers.length} oyuncu tamamladi.`);
    broadcastMatchState();
  }
}

function broadcastMatchState() {
  state.players.forEach((player) => {
    sendMatchStateToPlayer(player.id);
  });
}

function sendMatchStateToPlayer(playerId) {
  const player = state.players.get(playerId);
  if (!player) {
    return;
  }

  sendToPlayer(playerId, {
    type: "matchstate",
    status: state.match.status,
    roundId: state.match.roundId,
    totalLetters: state.match.totalLetters,
    finishOrder: state.match.finishOrder,
    allowedRoundId: player.allowedRoundId,
  });
}

function flushRosterBroadcast(reason = state.rosterBroadcast.pendingReason || "scheduled") {
  if (state.rosterBroadcast.timer) {
    clearTimeout(state.rosterBroadcast.timer);
    state.rosterBroadcast.timer = null;
  }
  state.rosterBroadcast.pending = false;
  state.rosterBroadcast.pendingReason = "";
  state.rosterBroadcast.broadcastCount += 1;
  state.rosterBroadcast.lastBroadcastAt = Date.now();
  state.rosterBroadcast.lastReason = reason;
  broadcast({
    type: "roster",
    players: buildRoster(),
  });
}

function scheduleRosterBroadcast(reason, { immediate = false } = {}) {
  if (immediate) {
    state.rosterBroadcast.immediateCount += 1;
    flushRosterBroadcast(reason || "immediate");
    return;
  }

  state.rosterBroadcast.scheduledCount += 1;
  if (state.rosterBroadcast.pending) {
    state.rosterBroadcast.coalescedCount += 1;
    state.rosterBroadcast.pendingReason = reason || state.rosterBroadcast.pendingReason;
    return;
  }

  state.rosterBroadcast.pending = true;
  state.rosterBroadcast.pendingReason = reason || "scheduled";
  state.rosterBroadcast.timer = setTimeout(() => {
    flushRosterBroadcast(reason || "scheduled");
  }, CONFIG.rosterBroadcastIntervalMs);
  state.rosterBroadcast.timer.unref?.();
}

function buildRosterBroadcastMetrics() {
  return {
    intervalMs: CONFIG.rosterBroadcastIntervalMs,
    pending: state.rosterBroadcast.pending,
    broadcastCount: state.rosterBroadcast.broadcastCount,
    scheduledCount: state.rosterBroadcast.scheduledCount,
    immediateCount: state.rosterBroadcast.immediateCount,
    coalescedCount: state.rosterBroadcast.coalescedCount,
    lastReason: state.rosterBroadcast.lastReason,
    lastBroadcastAt: state.rosterBroadcast.lastBroadcastAt
      ? new Date(state.rosterBroadcast.lastBroadcastAt).toISOString()
      : null,
  };
}

function buildRoster() {
  return [...state.players.values()]
    .map((player) => ({
      id: player.id,
      name: player.name,
      connected: true,
      mapKey: player.mapKey,
      currentMap: player.currentMap,
      stageKey: player.stageKey,
      characterId: player.characterId,
      allowedRoundId: player.allowedRoundId,
      finishPlace: player.finishPlace,
      totalLetters: state.match.totalLetters,
      joinedAt: player.joinedAt,
      lastSeenAt: player.lastSeenAt,
      lastSnapshotAt: player.lastSnapshotAt ? new Date(player.lastSnapshotAt).toISOString() : null,
      position: { ...player.position },
      score: { ...player.score },
    }))
    .sort(compareRosterEntries);
}

function compareRosterEntries(left, right) {
  const leftPlace = Number(left.finishPlace ?? 0);
  const rightPlace = Number(right.finishPlace ?? 0);
  if (leftPlace && rightPlace) {
    return leftPlace - rightPlace;
  }
  if (leftPlace || rightPlace) {
    return leftPlace ? -1 : 1;
  }
  return (right.score?.total ?? 0) - (left.score?.total ?? 0);
}

function normalizeScore(snapshot, totalLetters) {
  const stats = snapshot.stats ?? {};
  const collectedCount = Math.max(0, Number(snapshot.collectedCount ?? stats.collectedCount ?? 0) || 0);
  const level = Math.max(1, Number(stats.level ?? 1) || 1);
  const xp = Math.max(0, Number(stats.xp ?? 0) || 0);
  const gold = Math.max(0, Number(stats.gold ?? 0) || 0);
  const normalizedCollected = Math.min(totalLetters, collectedCount);
  return {
    level,
    xp,
    gold,
    collectedCount: normalizedCollected,
    total: (normalizedCollected * 100) + gold + xp + (level * 250),
  };
}

function broadcast(message) {
  const encoded = JSON.stringify(message);
  const frame = buildWebSocketFrame(Buffer.from(encoded, "utf8"));
  state.sockets.forEach((socket) => {
    if (!socket.destroyed && (socket.readyState === undefined || socket.readyState === 1)) {
      if (typeof socket.send === "function") {
        socket.send(encoded);
      } else {
        socket.write(frame);
      }
    }
  });
}

function sendToPlayer(playerId, message) {
  const socket = state.sockets.get(playerId);
  if (!socket || socket.destroyed || (socket.readyState !== undefined && socket.readyState !== 1)) {
    return;
  }
  const encoded = JSON.stringify(message);
  if (typeof socket.send === "function") {
    socket.send(encoded);
  } else {
    socket.write(buildWebSocketFrame(Buffer.from(encoded, "utf8")));
  }
}

function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }

  const byte1 = buffer[0];
  const byte2 = buffer[1];
  const opcode = byte1 & 0x0f;
  const masked = (byte2 & 0x80) === 0x80;
  let offset = 2;
  let payloadLength = byte2 & 0x7f;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    payloadLength = Number((BigInt(high) << 32n) | BigInt(low));
    offset += 8;
  }

  const maskLength = masked ? 4 : 0;
  const frameLength = offset + maskLength + payloadLength;
  if (buffer.length < frameLength) {
    return null;
  }

  const payload = Buffer.from(buffer.subarray(offset + maskLength, frameLength));
  if (masked) {
    const mask = buffer.subarray(offset, offset + 4);
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }

  return { opcode, payload, frameLength };
}

function buildWebSocketFrame(payload, opcode = 0x1) {
  const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const length = payloadBuffer.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, length]), payloadBuffer]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payloadBuffer]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeUInt32BE(0, 2);
  header.writeUInt32BE(length, 6);
  return Buffer.concat([header, payloadBuffer]);
}

async function serializeAdminState(req) {
  const joinUrl = resolveJoinUrl(req);
  return {
    generatedAt: new Date().toISOString(),
    backendOrigin: inferOrigin(req),
    joinUrl,
    joinQrDataUrl: await getQrDataUrl(joinUrl),
    summary: buildSummary(),
    match: summarizeMatch(),
    rosterBroadcast: buildRosterBroadcastMetrics(),
    roster: buildRoster(),
    leaderboard: buildRoster(),
    finishers: [...state.match.finishOrder],
    events: [...state.events],
  };
}

async function serializePublicState(req) {
  const joinUrl = resolveJoinUrl(req);
  return {
    generatedAt: new Date().toISOString(),
    backendOrigin: inferOrigin(req),
    joinUrl,
    joinQrDataUrl: await getQrDataUrl(joinUrl),
    summary: buildSummary(),
    match: summarizeMatch(),
    rosterBroadcast: buildRosterBroadcastMetrics(),
  };
}

function buildSummary() {
  const roster = buildRoster();
  return {
    onlineCount: roster.length,
    finisherCount: state.match.finishOrder.length,
    topScore: roster[0]?.score?.total ?? 0,
    statusDetail: state.match.status === "running"
      ? `${state.match.finishOrder.length} bitiren var · round #${state.match.roundId}`
      : state.match.status === "finished"
        ? "Tur tamamlandi. Reset bekleniyor."
        : "Oyuncular lobbyde hazirlaniyor.",
  };
}

function summarizeMatch() {
  return {
    status: state.match.status,
    roundId: state.match.roundId,
    totalLetters: state.match.totalLetters,
    startedAt: state.match.startedAt,
    finishedAt: state.match.finishedAt,
    finishOrder: [...state.match.finishOrder],
  };
}

function pushEvent(type, title, message) {
  state.events.unshift({
    id: crypto.randomUUID(),
    type,
    title,
    message,
    createdAt: new Date().toISOString(),
  });
  state.events = state.events.slice(0, 24);
}

function requireAdmin(req, res) {
  pruneAdminSessions();
  const authHeader = String(req.headers.authorization ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || !state.adminSessions.has(token)) {
    respondJson(res, 401, { error: "Admin yetkisi gerekli." });
    return null;
  }
  return state.adminSessions.get(token);
}

function pruneAdminSessions() {
  const cutoff = Date.now() - CONFIG.adminSessionTtlMs;
  state.adminSessions.forEach((session, token) => {
    if (session.lastUsedAt < cutoff) {
      state.adminSessions.delete(token);
    }
  });
}

function pruneStalePlayers() {
  const cutoff = Date.now() - CONFIG.stalePlayerMs;
  state.players.forEach((player, playerId) => {
    if (player.lastSnapshotAt && player.lastSnapshotAt < cutoff) {
      sendToPlayer(playerId, {
        type: "disconnect",
        reason: "Uzun sure veri gelmedi, baglanti yenileniyor.",
      });
      handleDisconnect(playerId, "Oyuncu zaman asimina ugradi.");
    }
  });
}

async function getQrDataUrl(text) {
  if (!text) {
    return "";
  }
  const cached = state.qrCache.get(text);
  if (cached) {
    return cached;
  }

  const dataUrl = await QRCode.toDataURL(text, {
    width: 220,
    margin: 1,
    color: { dark: "#10110e", light: "#ffffff" },
  });
  state.qrCache.set(text, dataUrl);
  return dataUrl;
}

function resolveJoinUrl(req) {
  const backendOrigin = inferOrigin(req);
  let appOrigin = CONFIG.appOrigin;
  if (!appOrigin) {
    const backendUrl = new URL(backendOrigin);
    if (backendUrl.port && backendUrl.port !== "4173") {
      backendUrl.port = "4173";
      appOrigin = backendUrl.origin;
    } else {
      appOrigin = backendOrigin;
    }
  }
  const joinUrl = new URL("/", appOrigin);
  if (appOrigin !== backendOrigin) {
    joinUrl.searchParams.set("server", backendOrigin);
  }
  return joinUrl.toString();
}

function sanitizeName(value, fallback = "Oyuncu") {
  const cleaned = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  return cleaned || fallback;
}

function sanitizeMap(value, fallback = "sunCourt") {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
}

function sanitizeCharacterId(value, fallback = "knight") {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
}

function toFiniteNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function respondJson(res, statusCode, payload) {
  const json = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function serveFile(res, filePath, contentType) {
  try {
    const buffer = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  } catch {
    respondJson(res, 404, { error: "Dosya bulunamadi." });
  }
}

function inferOrigin(req) {
  const protocol = String(req.headers["x-forwarded-proto"] ?? "http").trim() || "http";
  const host = String(req.headers.host ?? `${CONFIG.host}:${CONFIG.port}`);
  return `${protocol}://${host}`;
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", CONFIG.corsOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}
