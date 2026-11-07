// Builds the avatar assets shipped in src/assets/avatar/ (and the identical
// copy in gmscreen/src/assets/avatar/) from Quaternius's "Universal Base
// Characters [Standard]" pack - CC0, https://quaternius.com - so the
// committed assets can always be regenerated from the original download.
//
// Usage:  npm run avatar-assets -- "<path to the unzipped pack folder>"
//   (the folder containing "Base Characters" and "Hairstyles")
//
// What it does, per model:
//   - packs the .gltf + .bin + textures into one self-contained .glb, so
//     the app loads each model with a single file read
//   - body/hair/eyebrow base-color textures are converted to greyscale and
//     normalized, so the avatar's Skin / Hair color pickers set the actual
//     tone by multiplying (multiplying on top of baked-in beige or brown
//     would only ever darken it)
//   - textures downscaled (1024px body, 512px hair) and JPEG-encoded, and
//     the roughness maps dropped in favour of a constant - roughly 60 MB of
//     source textures down to a few MB, invisible at avatar-panel size
//
// Needs Electron's nativeImage for image decode/resize, so when started
// with plain `node` it relaunches itself under the project's Electron.
const path = require('path');
const fs = require('fs');

const ELECTRON_MAIN = !!process.versions.electron && process.type === 'browser';

if (!ELECTRON_MAIN) {
  const { spawnSync } = require('child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // see scripts/start.js for why
  const result = spawnSync(require('electron'), [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exit(result.status ?? 1);
}

const { app, nativeImage } = require('electron');

const REPO = path.resolve(__dirname, '..');
const OUT_DIRS = [path.join(REPO, 'src', 'assets', 'avatar'), path.join(REPO, 'gmscreen', 'src', 'assets', 'avatar')];

const BODIES = [
  {
    out: 'body_male.glb',
    gltf: 'Base Characters/Godot - UE/Superhero_Male_FullBody.gltf',
    // The glTF references the dark-skinned base color; swap in the light
    // one - it's greyscaled anyway, and has the most tonal range to tint.
    replaceImages: { 'T_Superhero_Male_Dark.png': 'Base Characters/Textures/T_Superhero_Male_Ligh.png' }
  },
  {
    out: 'body_female.glb',
    gltf: 'Base Characters/Godot - UE/Superhero_Female_FullBody.gltf',
    replaceImages: { 'T_Superhero_Female_Dark_BaseColor.png': 'Base Characters/Textures/T_Superhero_Female_Light_BaseColor.png' }
  }
];

const HAIRSTYLES = ['Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns'].map((name) => ({
  out: `${name.toLowerCase()}.glb`,
  gltf: `Hairstyles/Origin at 0/glTF (Godot)/${name}.gltf`,
  replaceImages: {}
}));

/* ---------- image processing ---------- */

function greyscaleNormalized(image) {
  const { width, height } = image.getSize();
  const bgra = Buffer.from(image.toBitmap());
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    const o = i * 4;
    lum[i] = 0.0722 * bgra[o] + 0.7152 * bgra[o + 1] + 0.2126 * bgra[o + 2];
  }
  // Normalize so the brightest areas (ignoring the top 2% - specular
  // flecks) map to white: then a picked color comes out as that color.
  const sorted = Float32Array.from(lum).sort();
  const ref = Math.max(sorted[Math.floor(sorted.length * 0.98)], 1);
  for (let i = 0; i < lum.length; i++) {
    const v = Math.min(255, Math.round((lum[i] / ref) * 255));
    const o = i * 4;
    bgra[o] = bgra[o + 1] = bgra[o + 2] = v;
  }
  return nativeImage.createFromBitmap(bgra, { width, height });
}

function processImage(filePath, { maxSize, greyscale, keepAlpha }) {
  let image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) throw new Error(`Could not decode ${filePath}`);
  const { width } = image.getSize();
  if (width > maxSize) image = image.resize({ width: maxSize, quality: 'best' });
  if (greyscale) image = greyscaleNormalized(image);
  // PNG where the alpha channel matters (hair strand cutouts), JPEG otherwise.
  return keepAlpha ? { mime: 'image/png', bytes: image.toPNG() } : { mime: 'image/jpeg', bytes: image.toJPEG(88) };
}

// Some of the pack's glTFs reference names that aren't in the folder (e.g.
// "T_Hair_1_Normal_png.png" when the file is "T_Hair_1_Normal.png" - an
// export naming quirk), so fall back to the stripped name, then to the
// pack's shared Textures folders.
function resolveImage(packDir, dir, uri) {
  const names = [uri, uri.replace(/_png\.png$/i, '.png')];
  const dirs = [dir, path.join(packDir, 'Base Characters', 'Textures'), path.join(packDir, 'Hairstyles', 'Textures')];
  for (const d of dirs) for (const n of names) if (fs.existsSync(path.join(d, n))) return path.join(d, n);
  throw new Error(`Texture "${uri}" not found near ${dir}`);
}

/* ---------- glTF -> GLB ---------- */

function pad4(buffer, fill = 0) {
  const extra = (4 - (buffer.length % 4)) % 4;
  return extra ? Buffer.concat([buffer, Buffer.alloc(extra, fill)]) : buffer;
}

function buildGlb(packDir, spec) {
  const gltfPath = path.join(packDir, spec.gltf);
  const dir = path.dirname(gltfPath);
  const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf-8'));
  if (gltf.buffers.length !== 1) throw new Error(`${spec.gltf}: expected one buffer`);
  let bin = pad4(fs.readFileSync(path.join(dir, gltf.buffers[0].uri)));

  // Drop roughness maps (constant roughness instead), then prune any
  // texture/image nothing references anymore.
  for (const mat of gltf.materials || []) {
    const pbr = mat.pbrMetallicRoughness || {};
    if (pbr.metallicRoughnessTexture) {
      delete pbr.metallicRoughnessTexture;
      pbr.roughnessFactor = 0.62;
      pbr.metallicFactor = 0;
    }
  }
  const usedTextures = new Set();
  const baseColorTextures = new Set();
  for (const mat of gltf.materials || []) {
    const bc = mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
    if (bc) { usedTextures.add(bc.index); baseColorTextures.add(bc.index); }
    if (mat.normalTexture) usedTextures.add(mat.normalTexture.index);
  }
  const textureRemap = new Map();
  const textures = [];
  (gltf.textures || []).forEach((tex, i) => {
    if (!usedTextures.has(i)) return;
    textureRemap.set(i, textures.length);
    textures.push(tex);
  });
  const imageRemap = new Map();
  const images = [];
  textures.forEach((tex) => {
    if (!imageRemap.has(tex.source)) {
      imageRemap.set(tex.source, images.length);
      images.push({ old: gltf.images[tex.source], oldIndex: tex.source });
    }
    tex.source = imageRemap.get(tex.source);
  });
  for (const mat of gltf.materials || []) {
    const bc = mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
    if (bc) bc.index = textureRemap.get(bc.index);
    if (mat.normalTexture) mat.normalTexture.index = textureRemap.get(mat.normalTexture.index);
  }
  const baseColorImages = new Set(
    [...baseColorTextures].map((t) => gltf.textures[t].source) // old image indices
  );
  const alphaImages = new Set();
  for (const mat of gltf.materials || []) {
    const bc = mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
    if (bc && (mat.alphaMode === 'MASK' || mat.alphaMode === 'BLEND')) alphaImages.add(images[textures[bc.index].source].oldIndex);
  }

  const isBody = spec.out.startsWith('body_');
  const newImages = images.map(({ old, oldIndex }) => {
    const sourceRel = spec.replaceImages[old.uri];
    const sourcePath = sourceRel ? path.join(packDir, sourceRel) : resolveImage(packDir, dir, old.uri);
    const isBase = baseColorImages.has(oldIndex);
    const isEye = /eye/i.test(old.uri);
    const { mime, bytes } = processImage(sourcePath, {
      maxSize: isBody && !/hair|eye/i.test(old.uri) ? 1024 : 512,
      greyscale: isBase && !isEye,
      keepAlpha: alphaImages.has(oldIndex)
    });
    const offset = bin.length;
    bin = Buffer.concat([bin, pad4(bytes)]);
    gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    return { name: old.uri, mimeType: mime, bufferView: gltf.bufferViews.length - 1 };
  });

  gltf.textures = textures;
  gltf.images = newImages;
  gltf.buffers = [{ byteLength: bin.length }];
  gltf.asset = { ...gltf.asset, copyright: 'Quaternius (CC0 1.0) - Universal Base Characters', generator: 'prepare-avatar-assets.js' };

  const json = pad4(Buffer.from(JSON.stringify(gltf), 'utf-8'), 0x20);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const chunk = (type, data) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(data.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, data]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, json), chunk(0x004e4942, bin)]);
}

const CREDIT = `Avatar models and textures in this folder are derived from
"Universal Base Characters" by Quaternius - https://quaternius.com
Licensed CC0 1.0 Universal (public domain dedication):
https://creativecommons.org/publicdomain/zero/1.0/

Generated by scripts/prepare-avatar-assets.js (textures greyscaled for
tinting, downscaled, and packed into .glb). Regenerate from the original
download rather than editing these files.
`;

app.whenReady().then(() => {
  const packDir = process.argv.slice(2).find((a) => fs.existsSync(path.join(a, 'Base Characters')));
  if (!packDir) {
    console.error('prepare-avatar-assets: pass the unzipped pack folder (the one containing "Base Characters" and "Hairstyles").');
    app.exit(1);
    return;
  }
  for (const dir of OUT_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'LICENSE.txt'), CREDIT);
  }
  try {
    let total = 0;
    for (const spec of [...BODIES, ...HAIRSTYLES]) {
      const glb = buildGlb(packDir, spec);
      total += glb.length;
      for (const dir of OUT_DIRS) fs.writeFileSync(path.join(dir, spec.out), glb);
      console.log(`${spec.out.padEnd(26)} ${(glb.length / 1024).toFixed(0).padStart(6)} KB`);
    }
    console.log(`total ${(total / 1048576).toFixed(2)} MB per app -> ${OUT_DIRS.map((d) => path.relative(REPO, d)).join(', ')}`);
    app.exit(0);
  } catch (err) {
    console.error(`prepare-avatar-assets: ${err.message}`);
    app.exit(1); // an uncaught error would otherwise leave Electron running headless
  }
});
