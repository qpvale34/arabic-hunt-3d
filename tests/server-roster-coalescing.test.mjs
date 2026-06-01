import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';

const HOST = '127.0.0.1';
const PORT = 2667;

async function waitForHealth(url, attempts = 60) {
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
    socket.once('open', resolve);
    socket.once('error', reject);
  });
}

test('server coalesces bursty snapshot roster broadcasts', async (t) => {
  const server = spawn('node', ['server/multiplayer-server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MULTIPLAYER_HOST: HOST,
      MULTIPLAYER_PORT: String(PORT),
      MULTIPLAYER_ROSTER_INTERVAL_MS: '180',
      MULTIPLAYER_ADMIN_CODE: 'test-admin-code',
    },
    stdio: 'pipe',
  });

  t.after(() => {
    server.kill('SIGTERM');
  });

  await waitForHealth(`http://${HOST}:${PORT}/health`);

  const socket = new WebSocket(`ws://${HOST}:${PORT}/multiplayer`);
  await waitForSocketOpen(socket);

  t.after(() => {
    try {
      socket.close();
    } catch {
      // ignore close races
    }
  });

  socket.send(JSON.stringify({
    type: 'join',
    name: 'Perf Bot',
    mapKey: 'sunCourt',
    characterId: 'knight',
  }));

  await delay(120);
  const before = await waitForHealth(`http://${HOST}:${PORT}/health`);

  for (let index = 0; index < 12; index += 1) {
    socket.send(JSON.stringify({
      type: 'snapshot',
      snapshot: {
        currentMap: 'sunCourt',
        stageKey: 'sunCourt',
        player: {
          x: index * 0.9,
          z: index * 0.5,
          heading: index / 10,
        },
        stats: {
          level: 1,
          xp: index,
          gold: index * 2,
          collectedCount: 0,
        },
        collectedCount: 0,
      },
    }));
  }

  await delay(320);
  const after = await waitForHealth(`http://${HOST}:${PORT}/health`);

  assert.ok(after.rosterBroadcast.scheduledCount >= before.rosterBroadcast.scheduledCount + 1);
  assert.ok(after.rosterBroadcast.coalescedCount >= before.rosterBroadcast.coalescedCount + 1);
  assert.ok(after.rosterBroadcast.broadcastCount - before.rosterBroadcast.broadcastCount <= 2);
  assert.equal(after.rosterBroadcast.pending, false);
  assert.equal(after.rosterBroadcast.lastReason, 'snapshot');
});
