// Builds the "Other" avatar body, src/assets/avatar/body_mannequin.glb (and
// the identical gmscreen copy), from the Mannequin in Quaternius's Universal
// Animation Library (CC0) - the same skeleton as the Universal Base
// Characters bodies, so the avatar code treats it like them.
//
//   node scripts/extract-mannequin.js "<path to>/UAL1_Standard.glb"
//
// Keeps only the rig and the mesh (no animations - that's most of the 7.6
// MB), and merges the mesh's two parts - the shell and the ball joints -
// into one, as the avatar code expects one body mesh. The joints stay
// distinguishable through a vertex color (JOINT_SHADE), which the skin
// color multiplies, so they show a shade darker.
const fs = require('fs');
const path = require('path');

const JOINT_SHADE = 0.62;
const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/extract-mannequin.js <UAL1_Standard.glb>');
  process.exit(1);
}

const buf = fs.readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const src = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

// An accessor's elements, tightly packed.
function raw(index) {
  const acc = src.accessors[index];
  const view = src.bufferViews[acc.bufferView];
  const elementBytes = COMPONENT_BYTES[acc.componentType] * TYPE_WIDTH[acc.type];
  const stride = view.byteStride || elementBytes;
  const start = binStart + (view.byteOffset || 0) + (acc.byteOffset || 0);
  const out = Buffer.alloc(acc.count * elementBytes);
  for (let i = 0; i < acc.count; i++) buf.copy(out, i * elementBytes, start + i * stride, start + i * stride + elementBytes);
  return { acc, bytes: out };
}

function indices(index) {
  const { acc, bytes } = raw(index);
  const read = { 5121: (o) => bytes.readUInt8(o), 5123: (o) => bytes.readUInt16LE(o), 5125: (o) => bytes.readUInt32LE(o) }[acc.componentType];
  const size = COMPONENT_BYTES[acc.componentType];
  return Array.from({ length: acc.count }, (_, i) => read(i * size));
}

const meshNodeIndex = src.nodes.findIndex((n) => n.mesh !== undefined);
const prims = src.meshes[src.nodes[meshNodeIndex].mesh].primitives;
const jointsMaterial = src.materials.findIndex((m) => /joint/i.test(m.name));

// ---- new binary + accessors ----
const chunks = [];
let offset = 0;
const accessors = [];
const bufferViews = [];
function addAccessor(bytes, meta, target) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
  chunks.push(bytes);
  offset += bytes.length;
  accessors.push({ bufferView: bufferViews.length - 1, ...meta });
  return accessors.length - 1;
}

const attributes = {};
for (const name of Object.keys(prims[0].attributes)) {
  const parts = prims.map((p) => raw(p.attributes[name]));
  const first = parts[0].acc;
  if (parts.some((p) => p.acc.componentType !== first.componentType || p.acc.type !== first.type)) throw new Error(`${name}: parts differ in type`);
  const meta = { componentType: first.componentType, type: first.type, count: parts.reduce((n, p) => n + p.acc.count, 0) };
  if (first.normalized) meta.normalized = true;
  if (name === 'POSITION') {
    meta.min = [0, 1, 2].map((c) => Math.min(...parts.map((p) => p.acc.min[c])));
    meta.max = [0, 1, 2].map((c) => Math.max(...parts.map((p) => p.acc.max[c])));
  }
  attributes[name] = addAccessor(Buffer.concat(parts.map((p) => p.bytes)), meta, 34962);
}
const counts = prims.map((p) => src.accessors[p.attributes.POSITION].count);
const total = counts.reduce((a, b) => a + b, 0);
const colors = Buffer.alloc(total * 12);
let v = 0;
prims.forEach((p, k) => {
  const shade = p.material === jointsMaterial ? JOINT_SHADE : 1;
  for (let i = 0; i < counts[k]; i++, v++) for (let c = 0; c < 3; c++) colors.writeFloatLE(shade, v * 12 + c * 4);
});
attributes.COLOR_0 = addAccessor(colors, { componentType: 5126, type: 'VEC3', count: total }, 34962);

let base = 0;
const allIndices = [];
prims.forEach((p, k) => {
  for (const i of indices(p.indices)) allIndices.push(i + base);
  base += counts[k];
});
if (total > 65535) throw new Error('too many vertices for 16-bit indices');
const indexBytes = Buffer.alloc(allIndices.length * 2);
allIndices.forEach((i, n) => indexBytes.writeUInt16LE(i, n * 2));
const indexAccessor = addAccessor(indexBytes, { componentType: 5123, type: 'SCALAR', count: allIndices.length }, 34963);

const skin = { ...src.skins[0] };
const ibm = raw(skin.inverseBindMatrices);
skin.inverseBindMatrices = addAccessor(ibm.bytes, { componentType: 5126, type: 'MAT4', count: ibm.acc.count });

const gltf = {
  asset: { version: '2.0', generator: 'CoD Character Generator extract-mannequin.js' },
  scene: 0,
  scenes: [{ nodes: src.scenes[src.scene || 0].nodes }],
  nodes: src.nodes.map((n, i) => (i === meshNodeIndex ? { ...n, mesh: 0, skin: 0, name: 'Mannequin' } : n)),
  meshes: [{ name: 'Mannequin', primitives: [{ attributes, indices: indexAccessor, material: 0 }] }],
  // White, so the skin color picker sets the tone outright.
  materials: [{ name: 'M_Mannequin', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.45 } }],
  skins: [skin],
  accessors,
  bufferViews,
  buffers: [{ byteLength: offset }]
};

let json = Buffer.from(JSON.stringify(gltf), 'utf8');
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
let bin = Buffer.concat(chunks);
bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunkHeader = (length, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(length, 0); h.writeUInt32LE(type, 4); return h; };
const glb = Buffer.concat([header, chunkHeader(json.length, 0x4e4f534a), json, chunkHeader(bin.length, 0x004e4942), bin]);

for (const dir of ['src/assets/avatar', 'gmscreen/src/assets/avatar']) {
  fs.writeFileSync(path.join(__dirname, '..', dir, 'body_mannequin.glb'), glb);
  console.log('wrote', `${dir}/body_mannequin.glb`, `${(glb.length / 1024).toFixed(0)} KB`, `${total} vertices`);
}
