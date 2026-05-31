// vite.config.js
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const multiplayerTarget = process.env.MULTIPLAYER_PROXY_TARGET || "http://127.0.0.1:2567";
const indexEntry = fileURLToPath(new URL("./index.html", import.meta.url));
const adminEntry = fileURLToPath(new URL("./admin.html", import.meta.url));
const hostEntry = fileURLToPath(new URL("./host.html", import.meta.url));
const botEntry = fileURLToPath(new URL("./bot.html", import.meta.url));
const optionalEntries = {
  admin: adminEntry,
  host: hostEntry,
  bot: botEntry,
};
const input = Object.entries(optionalEntries).reduce((entries, [name, entryPath]) => {
  if (existsSync(entryPath)) {
    entries[name] = entryPath;
  }
  return entries;
}, { main: indexEntry });

const proxy = {
  "/health": {
    target: multiplayerTarget,
    changeOrigin: true,
  },
  "/api": {
    target: multiplayerTarget,
    changeOrigin: true,
  },
  "/multiplayer": {
    target: multiplayerTarget,
    changeOrigin: true,
    ws: true,
  },
};

const base = process.env.BASE_URL || "/";

export default defineConfig({
  base,
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.fbx", "**/*.obj"],
  build: {
    rollupOptions: {
      input,
    },
  },
  server: {
    allowedHosts: true,
    proxy,
  },
  preview: {
    proxy,
  },
});
