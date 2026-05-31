import QRCode from "qrcode";

const STORAGE_KEYS = {
  token: "arabic-hunt-admin-token",
  backend: "arabic-hunt-multiplayer-origin",
};

const appRoot = document.querySelector("#admin-app");

if (appRoot) {
  const dom = {
    authForm: document.querySelector("#auth-form"),
    adminCode: document.querySelector("#admin-code"),
    logoutButton: document.querySelector("#logout-button"),
    adminStatus: document.querySelector("#admin-status"),
    adminHint: document.querySelector("#admin-hint"),
    generatedAt: document.querySelector("#generated-at"),
    summaryOnline: document.querySelector("#summary-online"),
    summaryMatchStatus: document.querySelector("#summary-match-status"),
    summaryTopScore: document.querySelector("#summary-top-score"),
    summaryFinishers: document.querySelector("#summary-finishers"),
    startButton: document.querySelector("#start-button"),
    resetButton: document.querySelector("#reset-button"),
    refreshButton: document.querySelector("#refresh-button"),
    matchHint: document.querySelector("#match-hint"),
    rosterMeta: document.querySelector("#roster-meta"),
    joinQrCanvas: document.querySelector("#join-qr-canvas"),
    joinLinkStatus: document.querySelector("#join-link-status"),
    joinLinkCopy: document.querySelector("#join-link-copy"),
    announceForm: document.querySelector("#announce-form"),
    announcementMessage: document.querySelector("#announcement-message"),
    eventLog: document.querySelector("#event-log"),
    leaderboardBody: document.querySelector("#leaderboard-body"),
    finishersBody: document.querySelector("#finishers-body"),
    rosterBody: document.querySelector("#roster-body"),
  };

  const params = new URLSearchParams(window.location.search);
  const configuredBackend = params.get("server")
    || window.localStorage.getItem(STORAGE_KEYS.backend)
    || window.location.origin;
  const backendOrigin = new URL(configuredBackend, window.location.origin).origin;
  const state = {
    token: window.sessionStorage.getItem(STORAGE_KEYS.token) || "",
    pollTimer: 0,
    lastJoinUrl: "",
    lastQrDataUrl: "",
    busy: false,
  };

  window.localStorage.setItem(STORAGE_KEYS.backend, backendOrigin);
  injectStyles();
  bindEvents();
  void refreshState({ silent: false });
  startPolling();

  function injectStyles() {
    if (document.querySelector("#admin-runtime-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "admin-runtime-style";
    style.textContent = `
      :root {
        color-scheme: dark;
        --bg: #0b0d0a;
        --panel: rgba(20, 24, 18, 0.92);
        --panel-border: rgba(236, 209, 145, 0.16);
        --muted: #a7ae9c;
        --text: #f7f4e9;
        --gold: #ecd191;
        --accent: #8be0ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(236, 209, 145, 0.12), transparent 32%),
          linear-gradient(180deg, #121510 0%, #090b09 100%);
        color: var(--text);
        min-height: 100vh;
      }
      #admin-app { padding: 32px 24px 56px; max-width: 1480px; margin: 0 auto; }
      .admin-hero, .admin-card {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 24px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.28);
        backdrop-filter: blur(14px);
      }
      .admin-hero {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 20px;
        padding: 28px;
        margin-bottom: 20px;
      }
      .admin-layout { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; }
      .admin-card { padding: 22px; min-width: 0; }
      .auth-card, .match-card, .qr-card { grid-column: span 4; }
      .announce-card, .roster-card { grid-column: span 6; }
      .leaderboard-card, .finishers-card { grid-column: span 3; }
      .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
      .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
      .summary-chip {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 18px;
        padding: 14px;
      }
      .summary-chip span, .hint-copy, .card-kicker, .hero-kicker, .list-board__meta, .field span, th {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .summary-chip strong { display: block; margin-top: 6px; font-size: 26px; }
      .hero-copy, .hint-copy, .qr-copy p { line-height: 1.6; }
      .hero-actions, .inline-actions, .stack-form { display: flex; gap: 12px; }
      .hero-actions, .inline-actions { align-items: center; flex-wrap: wrap; }
      .stack-form { flex-direction: column; }
      .hero-link, .primary-button, .ghost-button {
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        padding: 11px 16px;
        color: inherit;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(236, 209, 145, 0.22);
        cursor: pointer;
      }
      .primary-button {
        background: linear-gradient(135deg, rgba(236, 209, 145, 0.94), rgba(255, 186, 112, 0.88));
        color: #1d1608;
        border: none;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(139, 224, 255, 0.24);
        padding: 8px 12px;
        color: var(--accent);
        background: rgba(139, 224, 255, 0.08);
        min-height: 36px;
      }
      .field { display: flex; flex-direction: column; gap: 8px; }
      input, textarea {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
        color: inherit;
        padding: 14px 16px;
        font: inherit;
      }
      textarea { resize: vertical; min-height: 120px; }
      .qr-layout { display: flex; gap: 18px; align-items: center; min-width: 0; }
      .qr-shell {
        width: 236px;
        max-width: 100%;
        aspect-ratio: 1;
        border-radius: 24px;
        background: #fff;
        display: grid;
        place-items: center;
        flex: 0 0 min(236px, 100%);
        padding: 8px;
        overflow: visible;
      }
      #join-qr-canvas { display: block; width: 100%; height: auto; max-width: 220px; aspect-ratio: 1; }
      .qr-copy { min-width: 0; }
      .list-board, .event-log { display: grid; gap: 10px; }
      .list-board__item, .event-log__item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
      }
      .table-wrap { overflow: auto; }
      .roster-table { width: 100%; border-collapse: collapse; min-width: 760px; }
      th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: top; }
      .player-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.05);
      }
      .player-badge__dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #7ddc92;
        box-shadow: 0 0 0 6px rgba(125, 220, 146, 0.12);
      }
      .player-badge--waiting .player-badge__dot { background: #ffd27f; box-shadow: 0 0 0 6px rgba(255, 210, 127, 0.12); }
      .player-badge--finished .player-badge__dot { background: #8be0ff; box-shadow: 0 0 0 6px rgba(139, 224, 255, 0.12); }
      .empty-state {
        padding: 18px;
        border-radius: 18px;
        border: 1px dashed rgba(255,255,255,0.1);
        color: var(--muted);
      }
      .muted { color: var(--muted); }
      @media (max-width: 1180px) {
        .auth-card, .match-card, .qr-card, .announce-card, .roster-card, .leaderboard-card, .finishers-card { grid-column: span 12; }
        .leaderboard-card, .finishers-card { grid-column: span 6; }
      }
      @media (max-width: 760px) {
        #admin-app { padding: 18px 14px 36px; }
        .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .qr-layout { flex-direction: column; align-items: center; }
        .qr-copy { width: 100%; }
        .leaderboard-card, .finishers-card { grid-column: span 12; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindEvents() {
    dom.authForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = String(dom.adminCode?.value ?? "").trim();
      if (!code) {
        setStatus("Kod gerekli.", "Admin kodunu gir.");
        return;
      }

      try {
        setBusy(true);
        const response = await request("/api/admin/login", {
          method: "POST",
          body: { code },
        });
        state.token = String(response.token ?? "");
        window.sessionStorage.setItem(STORAGE_KEYS.token, state.token);
        setStatus("Yetkili", "Admin oturumu acildi.");
        dom.adminCode.value = "";
        await refreshState({ silent: false });
      } catch (error) {
        setStatus("Giris hatasi", error.message);
      } finally {
        setBusy(false);
      }
    });

    dom.logoutButton?.addEventListener("click", () => {
      state.token = "";
      window.sessionStorage.removeItem(STORAGE_KEYS.token);
      setStatus("Cikis yapildi", "Tekrar baglanmak icin admin kodunu gir.");
      renderEmptyBoards();
    });

    dom.refreshButton?.addEventListener("click", () => {
      void refreshState({ silent: false });
    });

    dom.startButton?.addEventListener("click", () => runAdminAction("/api/admin/start", {}, "Tur baslatildi."));
    dom.resetButton?.addEventListener("click", () => runAdminAction("/api/admin/reset", {}, "Tur lobbye alindi."));

    dom.announceForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = String(dom.announcementMessage?.value ?? "").trim();
      if (!message) {
        setStatus("Bos mesaj", "Gonderilecek bir duyuru yaz.");
        return;
      }
      void runAdminAction("/api/admin/announce", { message }, "Duyuru gonderildi.", () => {
        dom.announcementMessage.value = "";
      });
    });

    dom.joinLinkCopy?.addEventListener("click", async () => {
      if (!state.lastJoinUrl) {
        setStatus("Link yok", "Join linki once yuklenmeli.");
        return;
      }
      try {
        await navigator.clipboard.writeText(state.lastJoinUrl);
        setStatus("Link kopyalandi", state.lastJoinUrl);
      } catch {
        setStatus("Kopyalama hatasi", state.lastJoinUrl);
      }
    });
  }

  function startPolling() {
    window.clearInterval(state.pollTimer);
    state.pollTimer = window.setInterval(() => {
      void refreshState({ silent: true });
    }, 2000);
  }

  async function runAdminAction(path, body, successMessage, onSuccess) {
    if (!state.token) {
      setStatus("Yetki gerekli", "Once admin koduyla giris yap.");
      return;
    }

    try {
      setBusy(true);
      await request(path, {
        method: "POST",
        body,
        authenticated: true,
      });
      if (typeof onSuccess === "function") {
        onSuccess();
      }
      setStatus("Tamam", successMessage);
      await refreshState({ silent: false });
    } catch (error) {
      setStatus("Islem hatasi", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshState({ silent }) {
    try {
      const health = await request("/health");
      if (!state.token) {
        const publicState = await request("/api/state");
        renderState(publicState);
        setStatus("Hazir", `Sunucu ${health.status || "ok"} · ${backendOrigin}`);
        return;
      }

      const adminState = await request("/api/admin/state", {
        method: "GET",
        authenticated: true,
      });
      renderState(adminState);
      if (!silent) {
        setStatus("Yetkili", "Canli durum guncellendi.");
      }
    } catch (error) {
      if (!silent) {
        setStatus("Baglanti hatasi", error.message);
      }
      if (state.token && /yetkisi|401|403/i.test(error.message)) {
        state.token = "";
        window.sessionStorage.removeItem(STORAGE_KEYS.token);
      }
    }
  }

  async function request(path, options = {}) {
    const url = new URL(path, backendOrigin);
    const init = {
      method: options.method || "GET",
      headers: { Accept: "application/json" },
    };

    if (options.authenticated && state.token) {
      init.headers.Authorization = `Bearer ${state.token}`;
    }

    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  function renderState(payload) {
    const summary = payload.summary || {};
    const match = payload.match || {};
    const roster = Array.isArray(payload.roster) ? payload.roster : [];
    const leaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
    const finishers = Array.isArray(payload.finishers) ? payload.finishers : [];
    const events = Array.isArray(payload.events) ? payload.events : [];

    const serverJoinUrl = payload.joinUrl || "";
    state.lastJoinUrl = resolveClientJoinUrl(payload);
    state.lastQrDataUrl = state.lastJoinUrl === serverJoinUrl ? payload.joinQrDataUrl || "" : "";

    dom.generatedAt.textContent = formatDateTime(payload.generatedAt);
    dom.summaryOnline.textContent = String(summary.onlineCount ?? roster.length);
    dom.summaryMatchStatus.textContent = renderMatchStatus(match.status);
    dom.summaryTopScore.textContent = String(summary.topScore ?? 0);
    dom.summaryFinishers.textContent = String(summary.finisherCount ?? finishers.length);
    dom.rosterMeta.textContent = `${roster.length} oyuncu`;
    dom.joinLinkStatus.textContent = state.lastJoinUrl || "Join linki olusturulamadi.";
    dom.matchHint.textContent = summary.statusDetail || "Oyuncular lobbyde hazirlaniyor.";

    drawQr(state.lastQrDataUrl, state.lastJoinUrl);
    renderLeaderboard(leaderboard);
    renderFinishers(finishers);
    renderRoster(roster);
    renderEvents(events);
  }

  function renderEmptyBoards() {
    renderPlaceholder(dom.leaderboardBody, "Skor verisi bekleniyor.");
    renderPlaceholder(dom.finishersBody, "Henüz finisher yok.");
    renderPlaceholder(dom.eventLog, "Henuz olay kaydi yok.");
    if (dom.rosterBody) {
      dom.rosterBody.innerHTML = `
        <tr>
          <td colspan="7"><div class="empty-state">Oyuncu rosteri bekleniyor.</div></td>
        </tr>
      `;
    }
    drawQr("");
  }

  function renderLeaderboard(entries) {
    if (!entries.length) {
      renderPlaceholder(dom.leaderboardBody, "Skor tablosu bos.");
      return;
    }

    dom.leaderboardBody.innerHTML = entries.slice(0, 8).map((entry, index) => `
      <article class="list-board__item">
        <div>
          <strong>#${index + 1} · ${escapeHtml(entry.name || "Oyuncu")}</strong>
          <div class="list-board__meta">${escapeHtml(entry.characterId || "karakter")}</div>
        </div>
        <div>
          <strong>${Number(entry.score?.total ?? 0)}</strong>
          <div class="list-board__meta">${Number(entry.score?.collectedCount ?? 0)} harf · ${Number(entry.score?.gold ?? 0)} altin</div>
        </div>
      </article>
    `).join("");
  }

  function renderFinishers(entries) {
    if (!entries.length) {
      renderPlaceholder(dom.finishersBody, "Tur bittiginde finisher sirasi burada gorunur.");
      return;
    }

    dom.finishersBody.innerHTML = entries.map((entry) => `
      <article class="list-board__item">
        <div>
          <strong>#${Number(entry.place ?? 0)} · ${escapeHtml(entry.name || "Oyuncu")}</strong>
          <div class="list-board__meta">${formatDuration(entry.elapsedMs)}</div>
        </div>
        <div>
          <strong>${Number(entry.score?.total ?? 0)}</strong>
          <div class="list-board__meta">${formatDateTime(entry.finishedAt)}</div>
        </div>
      </article>
    `).join("");
  }

  function renderRoster(roster) {
    if (!roster.length) {
      dom.rosterBody.innerHTML = `
        <tr>
          <td colspan="7"><div class="empty-state">Bagli oyuncu yok.</div></td>
        </tr>
      `;
      return;
    }

    dom.rosterBody.innerHTML = roster.map((player) => `
      <tr>
        <td>${renderPresenceChip(player)}</td>
        <td>
          <strong>${escapeHtml(player.name || "Oyuncu")}</strong>
          <div class="muted">${escapeHtml(player.mapKey || "-")} · ${escapeHtml(player.characterId || "-")}</div>
        </td>
        <td>${Number(player.score?.total ?? 0)}</td>
        <td>${Number(player.score?.collectedCount ?? 0)} / ${Number(player.totalLetters ?? 30)}</td>
        <td>${player.finishPlace ? `#${player.finishPlace}` : "-"}</td>
        <td>${formatRelative(player.lastSeenAt)}</td>
        <td><button class="ghost-button" type="button" data-kick-player="${escapeAttribute(player.id || "")}">Cikar</button></td>
      </tr>
    `).join("");

    dom.rosterBody.querySelectorAll("[data-kick-player]").forEach((button) => {
      button.addEventListener("click", () => {
        void runAdminAction("/api/admin/kick", { playerId: button.getAttribute("data-kick-player") }, "Oyuncu cikarildi.");
      });
    });
  }

  function renderPresenceChip(player) {
    const finished = Number(player.finishPlace ?? 0) > 0;
    const waiting = !finished && Number(player.allowedRoundId ?? 0) === 0;
    const modifier = finished ? "player-badge--finished" : waiting ? "player-badge--waiting" : "";
    const label = finished ? "Bitirdi" : waiting ? "Bekliyor" : "Canli";

    return `
      <span class="player-badge ${modifier}">
        <span class="player-badge__dot" aria-hidden="true"></span>
        ${label}
      </span>
    `;
  }

  function renderEvents(events) {
    if (!events.length) {
      renderPlaceholder(dom.eventLog, "Henuz olay kaydi yok.");
      return;
    }

    dom.eventLog.innerHTML = events.slice(0, 18).map((entry) => `
      <article class="event-log__item">
        <div>
          <strong>${escapeHtml(entry.title || entry.type || "Olay")}</strong>
          <div class="list-board__meta">${formatDateTime(entry.createdAt)}</div>
        </div>
        <div>${escapeHtml(entry.message || "")}</div>
      </article>
    `).join("");
  }

  function renderPlaceholder(target, text) {
    target.innerHTML = `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  async function drawQr(dataUrl, qrText = "") {
    const canvas = dom.joinQrCanvas;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (!dataUrl && qrText) {
      try {
        dataUrl = await QRCode.toDataURL(qrText, {
          width: canvas.width,
          margin: 1,
          color: { dark: "#10110e", light: "#ffffff" },
        });
      } catch {
        dataUrl = "";
      }
    }

    if (!dataUrl) {
      context.fillStyle = "#111111";
      context.font = "600 15px Segoe UI";
      context.textAlign = "center";
      context.fillText("QR bekleniyor", canvas.width / 2, canvas.height / 2);
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = dataUrl;
  }

  function resolveClientJoinUrl(payload) {
    const pageOrigin = window.location.origin;
    if (isPublicOrigin(pageOrigin)) {
      return new URL("/", pageOrigin).toString();
    }
    return payload.joinUrl || new URL("/", pageOrigin).toString();
  }

  function isPublicOrigin(origin) {
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
    } catch {
      return false;
    }
  }

  function setStatus(title, detail) {
    dom.adminStatus.textContent = title;
    dom.adminHint.textContent = detail || "Panel hazir.";
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    [dom.startButton, dom.resetButton, dom.refreshButton, dom.logoutButton].forEach((button) => {
      if (button) {
        button.disabled = isBusy;
      }
    });
  }

  function renderMatchStatus(status) {
    switch (String(status || "").toLowerCase()) {
      case "running":
        return "Canli";
      case "finished":
        return "Bitti";
      default:
        return "Lobi";
    }
  }

  function formatDateTime(value) {
    if (!value) {
      return "Veri bekleniyor";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  }

  function formatRelative(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    const diffSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (diffSeconds < 2) return "simdi";
    if (diffSeconds < 60) return `${diffSeconds} sn once`;
    if (diffSeconds < 3600) return `${Math.round(diffSeconds / 60)} dk once`;
    return formatDateTime(value);
  }

  function formatDuration(value) {
    const totalMs = Number(value ?? 0);
    if (!totalMs) {
      return "Süre yok";
    }
    const totalSeconds = Math.max(1, Math.round(totalMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes} dk ${seconds} sn` : `${seconds} sn`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("'", "&#39;");
  }
}
