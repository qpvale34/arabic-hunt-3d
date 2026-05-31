const PLAYER_NAME_STORAGE_KEY = "sun-court-player-name-v1";
const SERVER_ORIGIN_STORAGE_KEY = "arabic-hunt-multiplayer-origin";
const DEFAULT_CONNECT_TIMEOUT_MS = 8000;

export function sanitizePlayerName(value, fallback = "") {
  const cleaned = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);

  return cleaned || String(fallback ?? "").trim().slice(0, 24);
}

export function loadStoredPlayerName(fallback = "") {
  try {
    return sanitizePlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY), fallback);
  } catch {
    return sanitizePlayerName(fallback);
  }
}

export function storePlayerName(value) {
  const nextValue = sanitizePlayerName(value);
  try {
    if (nextValue) {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, nextValue);
    } else {
      window.localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
  return nextValue;
}

function normalizeOrigin(input, fallback = "") {
  const source = String(input ?? "").trim();
  if (!source) {
    return fallback || "";
  }

  try {
    return new URL(source, fallback || window.location.origin).origin;
  } catch {
    return fallback || "";
  }
}

function loadStoredServerOrigin() {
  try {
    return normalizeOrigin(window.localStorage.getItem(SERVER_ORIGIN_STORAGE_KEY), window.location.origin);
  } catch {
    return window.location.origin;
  }
}

function storeServerOrigin(value) {
  const origin = normalizeOrigin(value, window.location.origin);
  try {
    window.localStorage.setItem(SERVER_ORIGIN_STORAGE_KEY, origin);
  } catch {
    // Ignore storage failures.
  }
  return origin;
}

function resolveConfiguredOrigin(explicitOrigin = "") {
  const params = new URLSearchParams(window.location.search);
  const queryOrigin = params.get("server");
  const windowOrigin = normalizeOrigin(window.__MULTIPLAYER_SERVER__, window.location.origin);
  const preferred = normalizeOrigin(explicitOrigin, window.location.origin)
    || normalizeOrigin(queryOrigin, window.location.origin)
    || windowOrigin
    || loadStoredServerOrigin()
    || window.location.origin;

  return storeServerOrigin(preferred);
}

function resolveConfiguredSocketUrl(origin) {
  const configuredUrl = import.meta.env?.VITE_MULTIPLAYER_WS_URL || import.meta.env?.VITE_MULTIPLAYER_URL || "";
  const url = configuredUrl
    ? new URL(configuredUrl, origin || window.location.origin)
    : new URL("/multiplayer", origin || window.location.origin);
  url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  return url.toString();
}

function toWebSocketUrl(origin) {
  return resolveConfiguredSocketUrl(origin);
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function safeDetail(detail, fallback = "") {
  const text = String(detail ?? "").trim();
  return text || fallback;
}

export class MultiplayerClient extends EventTarget {
  constructor(options = {}) {
    super();

    this.baseOrigin = resolveConfiguredOrigin(options.baseUrl ?? options.origin ?? "");
    this.status = "idle";
    this.playerId = "";
    this.characterId = String(options.characterId ?? "").trim();
    this.socket = null;
    this.pendingConnection = null;
    this.joinPayload = null;
    this.manualClose = false;
    this.reconnectTimer = 0;
    this.reconnectAttempts = 0;
    this.receivedWelcome = false;
    this.lastSnapshot = null;
    this.options = {
      reconnect: options.reconnect !== false,
      connectTimeoutMs: Number(options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS) || DEFAULT_CONNECT_TIMEOUT_MS,
    };
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN && this.receivedWelcome;
  }

  dispatchTypedEvent(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  setStatus(status, detail = "", label = "") {
    this.status = status;
    this.dispatchTypedEvent("statuschange", {
      status,
      detail: safeDetail(detail),
      label: label || this.getStatusLabel(status),
    });
  }

  getStatusLabel(status = this.status) {
    switch (status) {
      case "connecting":
        return "Baglaniyor";
      case "connected":
        return "Baglandi";
      case "reconnecting":
        return "Tekrar baglaniyor";
      case "disconnected":
        return "Baglanti koptu";
      case "kicked":
        return "Cikarildin";
      case "error":
        return "Baglanti hatasi";
      default:
        return "Hazir";
    }
  }

  async connect(payload = {}) {
    const name = sanitizePlayerName(payload.name);
    if (!name) {
      throw new Error("Karakter adi girmelisin.");
    }

    this.joinPayload = {
      type: "join",
      name,
      mapKey: String(payload.mapKey ?? "").trim() || "sunCourt",
      characterId: String(payload.characterId ?? this.characterId ?? "").trim() || "knight",
    };
    this.characterId = this.joinPayload.characterId;
    this.baseOrigin = resolveConfiguredOrigin(payload.baseUrl ?? payload.origin ?? this.baseOrigin);

    if (this.isConnected()) {
      this.send(this.joinPayload);
      return {
        playerId: this.playerId,
        origin: this.baseOrigin,
      };
    }

    if (this.pendingConnection) {
      return this.pendingConnection.promise;
    }

    this.manualClose = false;
    this.clearReconnectTimer();
    this.pendingConnection = createDeferred();
    this.openSocket();
    return this.pendingConnection.promise;
  }

  openSocket() {
    try {
      this.receivedWelcome = false;
      this.playerId = "";
      this.socket = new WebSocket(toWebSocketUrl(this.baseOrigin));
      this.setStatus("connecting", "Sunucuya baglaniyor...");
    } catch (error) {
      this.handleConnectionFailure(error);
      return;
    }

    const connectTimeout = window.setTimeout(() => {
      if (!this.receivedWelcome && this.socket && this.socket.readyState < WebSocket.CLOSING) {
        this.socket.close(4000, "connect-timeout");
      }
    }, this.options.connectTimeoutMs);

    this.socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.setStatus("connecting", "Baglandi, lobby bilgisi bekleniyor...");
      if (this.joinPayload) {
        this.send(this.joinPayload);
      }
    });

    this.socket.addEventListener("message", (event) => {
      const payload = this.parseMessage(event.data);
      if (!payload) {
        return;
      }
      this.handleMessage(payload);
    });

    this.socket.addEventListener("error", () => {
      if (!this.receivedWelcome) {
        this.handleConnectionFailure(new Error("Sunucuya baglanilamadi."));
      } else {
        this.setStatus("error", "Baglanti sirasinda hata olustu.");
      }
    });

    this.socket.addEventListener("close", (event) => {
      window.clearTimeout(connectTimeout);
      const wasConnected = this.receivedWelcome;
      const kicked = event.code === 4003 || this.status === "kicked";
      const reason = safeDetail(event.reason, kicked ? "Admin tarafindan cikarildin." : "Baglanti kapandi.");

      this.socket = null;
      this.receivedWelcome = false;
      this.playerId = "";

      if (kicked) {
        this.rejectPending(reason);
        this.setStatus("kicked", reason);
        this.dispatchTypedEvent("kicked", { reason });
        return;
      }

      if (!this.manualClose && this.options.reconnect && this.joinPayload) {
        this.scheduleReconnect(reason);
      } else {
        this.setStatus("disconnected", reason);
      }

      this.dispatchTypedEvent("disconnect", {
        wasConnected,
        reason,
      });

      this.rejectPending(reason);
    });
  }

  rejectPending(reason = "Baglanti sonlandi.") {
    if (!this.pendingConnection) {
      return;
    }

    this.pendingConnection.reject(new Error(reason));
    this.pendingConnection = null;
  }

  handleConnectionFailure(error) {
    const message = safeDetail(error?.message, "Sunucuya baglanilamadi.");
    this.setStatus("error", message);
    this.rejectPending(message);
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close();
    }
    this.socket = null;
  }

  scheduleReconnect(reason = "") {
    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    const delay = Math.min(5000, 1000 + this.reconnectAttempts * 650);
    this.setStatus("reconnecting", reason || `Baglanti koptu. ${Math.round(delay / 1000)} sn sonra tekrar denenecek.`);
    this.reconnectTimer = window.setTimeout(() => {
      if (this.manualClose || !this.joinPayload) {
        return;
      }
      this.pendingConnection = createDeferred();
      this.openSocket();
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = 0;
    }
  }

  parseMessage(data) {
    try {
      return JSON.parse(String(data));
    } catch {
      return null;
    }
  }

  handleMessage(payload) {
    const type = String(payload?.type ?? "").trim();
    if (!type || type === "pong") {
      return;
    }

    if (type === "welcome") {
      this.receivedWelcome = true;
      this.playerId = String(payload.playerId ?? "");
      this.setStatus("connected", "Lobiye baglandin.");
      if (this.pendingConnection) {
        this.pendingConnection.resolve({
          playerId: this.playerId,
          origin: this.baseOrigin,
        });
        this.pendingConnection = null;
      }
    }

    if (type === "kicked") {
      this.status = "kicked";
      this.manualClose = true;
      if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
        this.socket.close(4003, safeDetail(payload.reason, "Admin tarafindan cikarildin."));
      }
      return;
    }

    if (type === "disconnect") {
      if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
        this.socket.close(4001, safeDetail(payload.reason, "Sunucu baglantiyi kapatti."));
      }
      return;
    }

    this.dispatchTypedEvent(type, payload);
  }

  send(payload = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  sendSnapshot(snapshot = {}) {
    this.lastSnapshot = snapshot;
    return this.send({
      type: "snapshot",
      snapshot,
    });
  }

  ping() {
    return this.send({ type: "ping", at: Date.now() });
  }

  disconnect(reason = "manual-disconnect") {
    this.manualClose = true;
    this.clearReconnectTimer();
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close(1000, reason);
    }
    this.socket = null;
    this.receivedWelcome = false;
    this.playerId = "";
    this.setStatus("idle", "");
  }
}
