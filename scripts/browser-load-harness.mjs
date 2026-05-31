import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.split("=");
  return [key.replace(/^--/, ""), value ?? "1"];
}));

const clientCount = Math.max(1, Number(args.get("clients") || 50) || 50);
const baseUrl = args.get("base-url") || "http://127.0.0.1:4173";
const bootstrap = !/^(0|false|no|off)$/i.test(String(args.get("bootstrap") ?? "1"));
const headless = !/^(0|false|no|off)$/i.test(String(args.get("headless") ?? "1"));
const mapKey = args.get("map") || "sunCourt";
const batchSize = Math.max(1, Number(args.get("batch") || 10) || 10);

function spawnCommand(command, args) {
  if (process.platform === "win32" && (command === "npx" || command === "vite")) {
    return spawn("cmd.exe", ["/c", command, ...args], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
  }
  return spawn(command, args, {
    cwd: process.cwd(),
    stdio: "ignore",
  });
}

async function waitForUrl(url, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json().catch(() => ({}));
      }
    } catch {
      // booting
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const processes = [];
  try {
    if (bootstrap) {
      processes.push(spawnCommand(process.execPath, ["server/multiplayer-server.mjs"]));
      processes.push(spawnCommand("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "4173"]));
      await waitForUrl("http://127.0.0.1:2567/health");
      await waitForUrl(`${baseUrl}/`);
    }

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext();

    const pages = [];
    for (let startIndex = 0; startIndex < clientCount; startIndex += batchSize) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(batchSize, clientCount - startIndex) }, async (_, offset) => {
          const index = startIndex + offset;
          const page = await context.newPage();
          const characterId = ["knight", "barbarian", "mage", "rogue", "rogueHooded"][index % 5];
          const url = `${baseUrl}/bot.html?autojoin=1&name=LoadBot${index + 1}&map=${mapKey}&character=${characterId}&interval=220&radius=${6 + (index % 5)}`;
          await page.goto(url);
          await page.waitForFunction(() => typeof window.render_bot_to_text === "function");
          return page;
        }),
      );
      pages.push(...batch);
    }

    let currentHealth = await waitForUrl("http://127.0.0.1:2567/health");
    const start = Date.now();
    while ((currentHealth.players ?? 0) < clientCount && Date.now() - start < 30000) {
      await delay(500);
      currentHealth = await waitForUrl("http://127.0.0.1:2567/health", 2);
      if ((currentHealth.players ?? 0) >= clientCount) {
        console.log(JSON.stringify({
          clients: clientCount,
          players: currentHealth.players,
          rosterBroadcast: currentHealth.rosterBroadcast,
        }, null, 2));
        await browser.close();
        return;
      }
    }

    const finalHealth = await waitForUrl("http://127.0.0.1:2567/health", 2);
    console.log(JSON.stringify({
      clients: clientCount,
      players: finalHealth.players,
      rosterBroadcast: finalHealth.rosterBroadcast,
    }, null, 2));
    await browser.close();
  } finally {
    for (const child of processes) {
      child.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
