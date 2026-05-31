import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const publicAssetsDir = resolve(projectRoot, "public", "assets");

function listFiles(targetPath) {
  if (!existsSync(targetPath)) {
    return [];
  }

  return readdirSync(targetPath, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = resolve(targetPath, entry.name);
    return entry.isDirectory() ? listFiles(nextPath) : [nextPath];
  });
}

test("sync-public-assets only emits allowlisted compressed public object assets", () => {
  const syncResult = spawnSync("node", ["scripts/sync-public-assets.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(syncResult.status, 0, syncResult.stderr || syncResult.stdout);

  const files = listFiles(publicAssetsDir);
  assert.ok(files.length > 0, "expected synced public asset files");
  assert.ok(files.every((filePath) => !/\.(obj|mtl|import)$/i.test(filePath)), "unexpected raw asset sidecars copied");
  assert.ok(
    files.every((filePath) => /\.(glb|gltf|js|wasm|json|md)$/i.test(filePath)),
    "public assets should only contain compressed/fallback object assets and runtime support files",
  );
  assert.ok(
    existsSync(resolve(publicAssetsDir, "kaykit_halloween_bits", "Assets", "gltf_embedded", "arch_gate.glb")),
    "expected allowlisted halloween asset",
  );
  assert.ok(
    existsSync(resolve(publicAssetsDir, "kaykit_medieval_hexagon_pack", "Assets", "gltf_embedded", "tiles", "base", "hex_grass.glb")),
    "expected allowlisted hex asset",
  );
  assert.ok(
    existsSync(resolve(publicAssetsDir, "runtime", "characters", "Knight.glb")),
    "expected compressed runtime character asset",
  );
  assert.ok(
    existsSync(resolve(publicAssetsDir, "runtime-fallback", "characters", "Knight.glb")),
    "expected runtime fallback character asset",
  );
  const textureManifest = JSON.parse(readFileSync(resolve(publicAssetsDir, "runtime", "texture-manifest.json"), "utf8"));
  assert.equal(typeof textureManifest.toktxAvailable, "boolean");
  assert.ok(
    existsSync(resolve(publicAssetsDir, "runtime", "basis", "basis_transcoder.js")),
    "expected basis transcoder runtime support",
  );
  assert.equal(
    existsSync(resolve(publicAssetsDir, "kaykit_medieval_hexagon_pack", "Assets", "obj")),
    false,
    "raw obj directory should not exist in public",
  );
});
