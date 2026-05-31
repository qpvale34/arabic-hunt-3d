import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";

const HOST = "127.0.0.1";
const PORT = 2668;
const PLAYER_COUNT = 50;

async function waitForHealth(url, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // server booting
    }
    await delay(250);
  }
  throw new Error(`Server did not become healthy: ${url}`);
}

function waitForSocketOpen(socket) {
  return new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
}

test("server sustains 50 simultaneous multiplayer clients", async (t) => {
  const server = spawn("node", ["server/multiplayer-server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MULTIPLAYER_HOST: HOST,
      MULTIPLAYER_PORT: String(PORT),
      MULTIPLAYER_ROSTER_INTERVAL_MS: "180",
    },
    stdio: "pipe",
  });

  t.after(() => {
    server.kill("SIGTERM");
  });

  await waitForHealth(`http://${HOST}:${PORT}/health`);

  const sockets = [];
  t.after(() => {
    sockets.forEach((socket) => {
      try {
        socket.close();
      } catch {
        // ignore close races
      }
    });
  });

  for (let index = 0; index < PLAYER_COUNT; index += 1) {
    const socket = new WebSocket(`ws://${HOST}:${PORT}/multiplayer`);
    await waitForSocketOpen(socket);
    sockets.push(socket);
    socket.send(JSON.stringify({
      type: "join",
      name: `Load Bot ${index + 1}`,
      mapKey: "sunCourt",
      characterId: "knight",
    }));
  }

  await delay(600);
  const connected = await waitForHealth(`http://${HOST}:${PORT}/health`);
  assert.equal(connected.players, PLAYER_COUNT);
  const baselineBroadcasts = connected.rosterBroadcast.broadcastCount;

  for (let burst = 0; burst < 4; burst += 1) {
    sockets.forEach((socket, index) => {
      socket.send(JSON.stringify({
        type: "snapshot",
        snapshot: {
          currentMap: "sunCourt",
          stageKey: "sunCourt",
          player: {
            x: Number((Math.cos(index) * 12 + burst).toFixed(2)),
            z: Number((Math.sin(index) * 12 - burst).toFixed(2)),
            heading: Number(((index % 12) / 12).toFixed(3)),
          },
          stats: {
            level: 1,
            xp: burst + index,
            gold: index,
            collectedCount: burst % 3,
          },
          collectedCount: burst % 3,
        },
      }));
    });
  }

  await delay(900);
  const afterBurst = await waitForHealth(`http://${HOST}:${PORT}/health`);
  assert.equal(afterBurst.players, PLAYER_COUNT);
  assert.ok(afterBurst.rosterBroadcast.coalescedCount > 0);
  assert.ok(afterBurst.rosterBroadcast.broadcastCount - baselineBroadcasts <= 8);
});
