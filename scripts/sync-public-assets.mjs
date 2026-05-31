import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourceAssetsDir = resolve(projectRoot, "assets");
const publicAssetsDir = resolve(projectRoot, "public", "assets");
const gltfTransformCliPath = resolve(projectRoot, "node_modules", "@gltf-transform", "cli", "bin", "cli.js");
const sourceScanTargets = [
  resolve(projectRoot, "src"),
  resolve(projectRoot, "index.html"),
  resolve(projectRoot, "admin.html"),
  resolve(projectRoot, "host.html"),
  resolve(projectRoot, "bot.html"),
];
const basisSourceDir = resolve(projectRoot, "node_modules", "three", "examples", "jsm", "libs", "basis");
const basisTargetDir = resolve(publicAssetsDir, "runtime", "basis");
const letterTextureSourceDir = resolve(sourceAssetsDir, "arabic_huruf");
const letterTextureTargetDir = resolve(publicAssetsDir, "runtime", "textures", "letters");
const textureManifestPath = resolve(publicAssetsDir, "runtime", "texture-manifest.json");
const mimeByExtension = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bin": "application/octet-stream",
};

const runtimeCompressedAssets = {
  "/assets/runtime/dungeon/floor_tile_large.glb": "kaykit_dungeon_remastered/Assets/gltf/floor_tile_large.gltf.glb",
  "/assets/runtime/dungeon/floor_tile_large_rocks.glb": "kaykit_dungeon_remastered/Assets/gltf/floor_tile_large_rocks.gltf.glb",
  "/assets/runtime/dungeon/wall.glb": "kaykit_dungeon_remastered/Assets/gltf/wall.gltf.glb",
  "/assets/runtime/dungeon/wall_window_open.glb": "kaykit_dungeon_remastered/Assets/gltf/wall_window_open.gltf.glb",
  "/assets/runtime/dungeon/wall_corner.glb": "kaykit_dungeon_remastered/Assets/gltf/wall_corner.gltf.glb",
  "/assets/runtime/dungeon/pillar_decorated.glb": "kaykit_dungeon_remastered/Assets/gltf/pillar_decorated.gltf.glb",
  "/assets/runtime/dungeon/column.glb": "kaykit_dungeon_remastered/Assets/gltf/column.gltf.glb",
  "/assets/runtime/dungeon/torch_lit.glb": "kaykit_dungeon_remastered/Assets/gltf/torch_lit.gltf.glb",
  "/assets/runtime/dungeon/banner_shield_red.glb": "kaykit_dungeon_remastered/Assets/gltf/banner_shield_red.gltf.glb",
  "/assets/runtime/dungeon/chest_gold.glb": "kaykit_dungeon_remastered/Assets/gltf/chest_gold.glb",
  "/assets/runtime/dungeon/barrel_large_decorated.glb": "kaykit_dungeon_remastered/Assets/gltf/barrel_large_decorated.gltf.glb",
  "/assets/runtime/dungeon/table_long_decorated_A.glb": "kaykit_dungeon_remastered/Assets/gltf/table_long_decorated_A.gltf.glb",
  "/assets/runtime/dungeon/trunk_large_A.glb": "kaykit_dungeon_remastered/Assets/gltf/trunk_large_A.gltf.glb",
  "/assets/runtime/characters/Barbarian.glb": "kaykit_character_pack_adventures/Characters/gltf/Barbarian.glb",
  "/assets/runtime/characters/Knight.glb": "kaykit_character_pack_adventures/Characters/gltf/Knight.glb",
  "/assets/runtime/characters/Mage.glb": "kaykit_character_pack_adventures/Characters/gltf/Mage.glb",
  "/assets/runtime/characters/Rogue.glb": "kaykit_character_pack_adventures/Characters/gltf/Rogue.glb",
  "/assets/runtime/characters/Rogue_Hooded.glb": "kaykit_character_pack_adventures/Characters/gltf/Rogue_Hooded.glb",
};

function listFiles(targetPath) {
  if (!existsSync(targetPath)) {
    return [];
  }

  const stats = statSync(targetPath);
  if (!stats.isDirectory()) {
    return [targetPath];
  }

  return readdirSync(targetPath, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = resolve(targetPath, entry.name);
    return entry.isDirectory() ? listFiles(nextPath) : [nextPath];
  });
}

function findPublicAssetRefs() {
  const refs = new Set(Object.keys(runtimeCompressedAssets));
  const matcher = /(?<![A-Za-z0-9_.-])\/assets\/[A-Za-z0-9_./-]+/g;

  sourceScanTargets
    .flatMap((targetPath) => listFiles(targetPath))
    .filter((filePath) => /\.(html|css|js|mjs)$/i.test(filePath))
    .forEach((filePath) => {
      const content = readFileSync(filePath, "utf8");
      for (const match of content.matchAll(matcher)) {
        if (match[0].endsWith(".glb")) {
          refs.add(match[0]);
        }
      }
    });

  return [...refs].sort();
}

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function toDataUri(filePath) {
  const extension = extname(filePath).toLowerCase();
  const mimeType = mimeByExtension[extension] ?? "application/octet-stream";
  const payload = readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${payload}`;
}

function embedSingleGltf(sourcePath, targetPath) {
  const payload = JSON.parse(readFileSync(sourcePath, "utf8"));
  const sourceDir = dirname(sourcePath);

  payload.buffers = (payload.buffers ?? []).map((buffer) => (
    buffer.uri && !buffer.uri.startsWith("data:")
      ? { ...buffer, uri: toDataUri(resolve(sourceDir, buffer.uri)) }
      : buffer
  ));

  payload.images = (payload.images ?? []).map((image) => (
    image.uri && !image.uri.startsWith("data:")
      ? { ...image, uri: toDataUri(resolve(sourceDir, image.uri)) }
      : image
  ));

  ensureParentDir(targetPath);
  writeFileSync(targetPath, JSON.stringify(payload));
}

function copyBasisTranscoderFiles() {
  if (!existsSync(basisSourceDir)) {
    return [];
  }

  const copied = [];
  readdirSync(basisSourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => {
      const sourcePath = resolve(basisSourceDir, entry.name);
      const targetPath = resolve(basisTargetDir, entry.name);
      ensureParentDir(targetPath);
      copyFileSync(sourcePath, targetPath);
      copied.push(targetPath);
    });

  return copied;
}

function publicRefToSourcePath(publicRef) {
  if (runtimeCompressedAssets[publicRef]) {
    return resolve(sourceAssetsDir, runtimeCompressedAssets[publicRef]);
  }

  const relativePublicPath = publicRef.replace(/^\/assets\//, "");
  if (relativePublicPath.includes("/gltf_embedded/")) {
    const sourceRelative = relativePublicPath
      .replace("/gltf_embedded/", "/gltf/")
      .replace(/\.glb$/i, ".gltf");
    return resolve(sourceAssetsDir, sourceRelative);
  }

  return resolve(sourceAssetsDir, relativePublicPath);
}

function publicRefToTargetPath(publicRef) {
  return resolve(projectRoot, "public", publicRef.replace(/^\//, ""));
}

function needsRebuild(sourcePath, targetPath) {
  if (!existsSync(targetPath)) {
    return true;
  }

  return statSync(sourcePath).mtimeMs > statSync(targetPath).mtimeMs;
}

function compressAsset(sourcePath, targetPath) {
  ensureParentDir(targetPath);
  if (!needsRebuild(sourcePath, targetPath)) {
    return "cached";
  }

  const result = spawnSync(
    process.execPath,
    [gltfTransformCliPath, "meshopt", sourcePath, targetPath, "--level", "high"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `meshopt failed for ${sourcePath}`);
  }

  return "compressed";
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", shell: true });
  return result.status === 0;
}

function buildTextureManifest() {
  const manifest = {
    basisTranscoderPath: "/assets/runtime/basis/",
    letterKtx2: {},
    toktxAvailable: commandExists("toktx"),
  };

  if (!manifest.toktxAvailable || !existsSync(letterTextureSourceDir)) {
    ensureParentDir(textureManifestPath);
    rmSync(letterTextureTargetDir, { recursive: true, force: true });
    return writeTextureManifest(manifest);
  }

  mkdirSync(letterTextureTargetDir, { recursive: true });
  readdirSync(letterTextureSourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .forEach((entry) => {
      const sourcePath = resolve(letterTextureSourceDir, entry.name);
      const targetPath = resolve(letterTextureTargetDir, entry.name.replace(/\.png$/i, ".ktx2"));
      const result = spawnSync(
        "toktx",
        ["--encode", "etc1s", "--genmipmap", targetPath, sourcePath],
        { encoding: "utf8", shell: true },
      );
      if (result.status === 0) {
        const key = entry.name.replace(/\.png$/i, "");
        manifest.letterKtx2[key] = `/assets/runtime/textures/letters/${targetPath.split(/[/\\\\]/).pop()}`;
      }
    });

  writeTextureManifest(manifest);
}

function writeTextureManifest(manifest) {
  ensureParentDir(textureManifestPath);
  writeFileSync(textureManifestPath, JSON.stringify(manifest, null, 2));
}

function removeEmptyDirectories(targetPath) {
  if (!existsSync(targetPath)) {
    return;
  }

  readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const nextDir = resolve(targetPath, entry.name);
      removeEmptyDirectories(nextDir);
      if (readdirSync(nextDir).length === 0) {
        rmSync(nextDir, { recursive: true, force: true });
      }
    });
}

const publicRefs = findPublicAssetRefs();
const createdDirs = new Set();
let compressedCount = 0;
let cachedCount = 0;

rmSync(publicAssetsDir, { recursive: true, force: true });
mkdirSync(publicAssetsDir, { recursive: true });
copyBasisTranscoderFiles();

for (const publicRef of publicRefs) {
  const sourcePath = publicRefToSourcePath(publicRef);
  const targetPath = publicRefToTargetPath(publicRef);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing asset for public ref ${publicRef}: ${sourcePath}`);
  }

  ensureParentDir(targetPath);
  createdDirs.add(dirname(targetPath));
  const result = compressAsset(sourcePath, targetPath);
  if (result === "compressed") {
    compressedCount += 1;
    console.log(`[sync-public-assets] Compressed ${relative(projectRoot, sourcePath)} -> ${relative(projectRoot, targetPath)}`);
  } else {
    cachedCount += 1;
  }

  if (publicRef.includes("/gltf_embedded/") && sourcePath.toLowerCase().endsWith(".gltf")) {
    const fallbackPath = targetPath.replace(/\.glb$/i, ".gltf");
    embedSingleGltf(sourcePath, fallbackPath);
  }

  if (publicRef.startsWith("/assets/runtime/")) {
    const fallbackPath = publicRefToTargetPath(publicRef.replace("/assets/runtime/", "/assets/runtime-fallback/"));
    ensureParentDir(fallbackPath);
    copyFileSync(sourcePath, fallbackPath);
  }
}

removeEmptyDirectories(publicAssetsDir);
buildTextureManifest();

if (!publicRefs.length) {
  console.log("[sync-public-assets] No explicit compressed asset refs found.");
} else {
  const topLevelDirs = [...new Set(
    publicRefs.map((publicRef) => publicRef.split("/").filter(Boolean)[1]).filter(Boolean),
  )].sort();
  console.log(
    `[sync-public-assets] Synced ${publicRefs.length} compressed object refs across: ${topLevelDirs.join(", ")} `
    + `(rebuilt ${compressedCount}, cached ${cachedCount})`,
  );
}
