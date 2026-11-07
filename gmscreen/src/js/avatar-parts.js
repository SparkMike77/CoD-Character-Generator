// Human avatar assembled from parts: one head (hairstyle), one torso, and
// four limbs (left/right arm, left/right leg), each limb independently
// Healthy, Damaged, or Morphed. An avatar is fully described by a small JSON
// descriptor (see AVATAR_DEFAULT), so GMScreen rebuilds the exact same
// figure from it without any model data crossing the network.
//
// Geometry comes from Quaternius's CC0 "Universal Base Characters" (see
// src/assets/avatar/LICENSE.txt and scripts/prepare-avatar-assets.js): one
// rigged male and one rigged female body plus separate hairstyles. Those
// are "Superhero"-proportioned, so every body type is reshaped here:
//
//   - Body shape is changed per VERTEX, not by scaling bones. Each vertex is
//     pulled toward / pushed away from the bone segments it's skinned to,
//     blended by its skin weights. (Bone scale would cascade down the
//     hierarchy - slimming the waist would also squash the head.) Male and
//     Female get a mild toning-down; Non-Binary is the male body slimmed
//     further with narrower shoulders. Morphed limbs use the same mechanism
//     in reverse, to bulk up.
//   - The six parts are the body mesh split by which bone dominates each
//     triangle, each part with its own material - that's what lets one
//     limb be tinted Damaged/Morphed independently of the others.
//   - Clothing (shirt, trousers, shoes) is generated from the reshaped body
//     surface itself, offset slightly outward and skinned to the same
//     skeleton, so it fits every body type and limb state automatically.
//   - Bandages, spines and claws are attached to the bones in the posed
//     figure, so they sit correctly on any body.
//
// SHARED FILE: an identical copy lives at gmscreen/src/js/avatar-parts.js,
// with the same assets in gmscreen/src/assets/avatar/. The two apps are
// packaged separately, so edit both together. GMScreen's gm-server.js also
// validates incoming descriptors against these option ids - keep its lists
// in sync if you add parts.
//
// The character's LEFT is +X (on the viewer's right, as when facing
// someone); the figure faces +Z.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'nonbinary', label: 'Non-Binary' }
];

export const HEADS = [
  { id: 'bald', label: 'Bald' },
  { id: 'buzzed', label: 'Buzzed' },
  { id: 'parted', label: 'Parted' },
  { id: 'long', label: 'Long' },
  { id: 'buns', label: 'Buns' }
];

export const LIMB_STATES = [
  { id: 'healthy', label: 'Healthy' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'morphed', label: 'Morphed' }
];

export const LIMBS = [
  { id: 'leftArm', label: 'Left Arm' },
  { id: 'rightArm', label: 'Right Arm' },
  { id: 'leftLeg', label: 'Left Leg' },
  { id: 'rightLeg', label: 'Right Leg' }
];

export const AVATAR_DEFAULT = {
  gender: 'nonbinary',
  head: 'parted',
  skin: '#c99a78',
  hair: '#3b2a1e',
  outfit: '#4d5866',
  limbs: { leftArm: 'healthy', rightArm: 'healthy', leftLeg: 'healthy', rightLeg: 'healthy' }
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const pick = (value, options, fallback) => (options.some((o) => o.id === value) ? value : fallback);
const hex = (value, fallback) => (typeof value === 'string' && HEX_RE.test(value) ? value : fallback);

// Fills gaps / replaces anything invalid with defaults, so an older or
// hand-edited character file (or a malformed network message) always
// produces a buildable avatar.
export function normalizeAvatar(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const limbs = a.limbs && typeof a.limbs === 'object' ? a.limbs : {};
  return {
    gender: pick(a.gender, GENDERS, AVATAR_DEFAULT.gender),
    head: pick(a.head, HEADS, AVATAR_DEFAULT.head),
    skin: hex(a.skin, AVATAR_DEFAULT.skin),
    hair: hex(a.hair, AVATAR_DEFAULT.hair),
    outfit: hex(a.outfit, AVATAR_DEFAULT.outfit),
    limbs: Object.fromEntries(LIMBS.map(({ id }) => [id, pick(limbs[id], LIMB_STATES, 'healthy')]))
  };
}

/* ---------- Tuning ---------- */

// Cross-section factors per bone (1 = unchanged; <1 slimmer, >1 bulkier).
// Keys are bone names without their _l/_r suffix.
const BODY_SHAPE = {
  male: { spine_01: 0.94, spine_02: 0.93, spine_03: 0.93, neck_01: 0.95, upperarm: 0.86, lowerarm: 0.9, thigh: 0.92, calf: 0.94 },
  female: { spine_01: 0.97, spine_02: 0.97, spine_03: 0.97, upperarm: 0.9, lowerarm: 0.93, thigh: 0.95, calf: 0.95 },
  nonbinary: { pelvis: 0.93, spine_01: 0.88, spine_02: 0.86, spine_03: 0.85, neck_01: 0.92, upperarm: 0.8, lowerarm: 0.85, thigh: 0.86, calf: 0.88 }
};
// Non-Binary narrows the shoulders by moving the arms in along the
// collarbone (a bone translation, which doesn't cascade like scale).
const SHOULDER_WIDTH = { male: 1, female: 1, nonbinary: 0.86 };
const MORPH_BULK = { lowerarm: 1.45, hand: 1.35, finger: 1.3, calf: 1.4, foot: 1.2, ball: 1.15 };

const ARM_DROP = THREE.MathUtils.degToRad(70); // from the rest T-pose down toward the sides
const CLOTH = { shirt: 0.009, pants: 0.007, shoe: 0.011 }; // offset off the skin, metres

const BRUISE = '#7a1c1c';
const MORPH_TINT = '#5d6e52'; // sickly green-grey
const HORN = '#d8cfb8';
const BANDAGE = '#ece6d8';
const SHOE = '#2a2622';

const PARTS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const FINGER_RE = /^(index|middle|pinky|ring|thumb)_/;

const ASSET_URL = new URL('../assets/avatar/', import.meta.url);
const HAIR_FILES = {
  buzzed: { male: 'hair_buzzed.glb', female: 'hair_buzzedfemale.glb' },
  parted: { male: 'hair_simpleparted.glb', female: 'hair_simpleparted.glb' },
  long: { male: 'hair_long.glb', female: 'hair_long.glb' },
  buns: { male: 'hair_buns.glb', female: 'hair_buns.glb' }
};

/* ---------- Bone helpers ---------- */

function baseName(name) {
  return name.replace(/_(l|r)$/, '');
}

function sideOf(name) {
  if (/_l$/.test(name)) return 'left';
  if (/_r$/.test(name)) return 'right';
  return null;
}

function partOfBone(name) {
  const base = baseName(name);
  const side = sideOf(name);
  if (base === 'neck_01' || base === 'Head') return 'head';
  if (side && (base === 'upperarm' || base === 'lowerarm' || base === 'hand' || FINGER_RE.test(base))) return `${side}Arm`;
  if (side && /^(thigh|calf|foot|ball)/.test(base)) return `${side}Leg`;
  return 'torso'; // root, pelvis, spine_*, clavicles
}

function garmentOfBone(name) {
  const base = baseName(name);
  if (/^spine_|^clavicle/.test(base) || base === 'upperarm') return 'shirt'; // short sleeves
  if (base === 'pelvis' || base === 'thigh' || base === 'calf') return 'pants';
  if (base === 'foot' || base === 'ball' || base === 'ball_leaf') return 'shoe';
  return null; // head, neck, forearms, hands stay bare
}

/* ---------- Templates (loaded + analysed once per file) ---------- */

const templateCache = new Map();

function loadAsset(file) {
  if (!templateCache.has(file)) {
    const url = new URL(file, ASSET_URL).href;
    templateCache.set(file, new GLTFLoader().loadAsync(url).then((gltf) => analyseTemplate(gltf)));
  }
  return templateCache.get(file);
}

function findBodyMesh(root) {
  let body = null;
  root.traverse((n) => {
    if (n.isSkinnedMesh && (!body || n.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = n;
  });
  return body;
}

function majority(parts) {
  return parts[0] === parts[1] || parts[0] === parts[2] ? parts[0] : parts[1];
}

// For a body template: per-vertex dominant bone/part/garment, bind-space
// positions and bone axes (for reshaping), and the triangle order grouped
// by part (for per-part materials).
function analyseTemplate(gltf) {
  const t = { gltf, body: null };
  const body = findBodyMesh(gltf.scene);
  if (!body) {
    // Hairstyle file: just a static mesh. Some (Buns) carry a rotation +
    // 0.01 scale on their node instead of baked vertices, so bake the node
    // transform in - every hairstyle then shares the same rest-head space.
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((n) => { if (n.isMesh && !t.hairMesh) t.hairMesh = n; });
    if (t.hairMesh) {
      t.hairMesh.geometry = t.hairMesh.geometry.clone().applyMatrix4(t.hairMesh.matrixWorld);
      t.hairMesh.geometry.computeBoundingSphere();
    }
    return t;
  }
  gltf.scene.updateMatrixWorld(true);
  const geo = body.geometry;
  const bones = body.skeleton.bones;
  const count = geo.attributes.position.count;
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;

  t.bodyName = body.name;
  t.boneNames = bones.map((b) => b.name);
  t.vertexPart = new Uint8Array(count);
  t.vertexGarment = new Array(count);
  for (let i = 0; i < count; i++) {
    let best = 0;
    let bestW = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bestW) { bestW = w; best = skinIndex.getComponent(i, k); }
    }
    t.vertexPart[i] = PARTS.indexOf(partOfBone(bones[best].name));
    t.vertexGarment[i] = garmentOfBone(bones[best].name);
  }

  // Bind-space ("world at bind time") geometry for reshaping: vertex
  // positions, and each bone's origin + axis (bones run along local +Y).
  const bindPos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(body.bindMatrix);
    v.toArray(bindPos, i * 3);
  }
  t.bindPos = bindPos;
  t.bindMatrixInverse = body.bindMatrixInverse.clone();
  t.boneOrigin = [];
  t.boneAxis = [];
  body.skeleton.boneInverses.forEach((inv) => {
    const m = inv.clone().invert();
    t.boneOrigin.push(new THREE.Vector3().setFromMatrixPosition(m));
    t.boneAxis.push(new THREE.Vector3().setFromMatrixColumn(m, 1).normalize());
  });
  t.headRestWorld = body.skeleton.boneInverses[t.boneNames.indexOf('Head')].clone().invert();

  // Average distance of each bone's vertices from its axis - used to size
  // bandages and place spines on the surface.
  const radiusSum = new Float64Array(bones.length);
  const radiusN = new Uint32Array(bones.length);
  for (let i = 0; i < count; i++) {
    const j = skinIndex.getComponent(i, 0);
    if (skinWeight.getComponent(i, 0) < 0.6) continue;
    v.fromArray(bindPos, i * 3).sub(t.boneOrigin[j]);
    const along = v.dot(t.boneAxis[j]);
    radiusSum[j] += v.addScaledVector(t.boneAxis[j], -along).length();
    radiusN[j]++;
  }
  t.boneRadius = Array.from(radiusSum, (s, j) => (radiusN[j] ? s / radiusN[j] : 0.04));

  // Triangles reordered so each part is one contiguous draw group.
  const index = geo.index.array;
  const buckets = PARTS.map(() => []);
  for (let f = 0; f < index.length; f += 3) {
    const tri = [index[f], index[f + 1], index[f + 2]];
    buckets[majority(tri.map((i) => t.vertexPart[i]))].push(...tri);
  }
  t.groups = [];
  const sorted = [];
  buckets.forEach((tris, part) => {
    t.groups.push({ start: sorted.length, count: tris.length, materialIndex: part });
    for (const x of tris) sorted.push(x);
  });
  t.sortedIndex = new THREE.BufferAttribute(new Uint32Array(sorted), 1);
  t.body = body;
  return t;
}

/* ---------- Build steps ---------- */

function shapeFactors(a) {
  const shape = BODY_SHAPE[a.gender];
  return (boneName) => {
    const base = baseName(boneName);
    const key = FINGER_RE.test(base) ? 'finger' : base;
    let f = shape[key] ?? 1;
    const part = partOfBone(boneName);
    if (part !== 'head' && part !== 'torso' && a.limbs[part] === 'morphed') f *= MORPH_BULK[key] ?? 1;
    return f;
  };
}

// Reshaped vertex positions (mesh-local), per the module comment: each
// vertex moves radially about each influencing bone's axis by that bone's
// factor, blended by skin weight.
function reshapePositions(t, geo, factorFor) {
  const count = geo.attributes.position.count;
  const out = new Float32Array(count * 3);
  const factors = t.boneNames.map(factorFor);
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  const v = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.fromArray(t.bindPos, i * 3);
    acc.set(0, 0, 0);
    let total = 0;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w <= 0) continue;
      const j = skinIndex.getComponent(i, k);
      const f = factors[j];
      if (f === 1) {
        acc.addScaledVector(v, w);
      } else {
        const along = c.copy(v).sub(t.boneOrigin[j]).dot(t.boneAxis[j]);
        c.copy(t.boneOrigin[j]).addScaledVector(t.boneAxis[j], along); // closest point on the bone axis
        acc.addScaledVector(c.lerp(v, f), w);
      }
      total += w;
    }
    if (total > 0) acc.divideScalar(total); else acc.copy(v);
    acc.applyMatrix4(t.bindMatrixInverse).toArray(out, i * 3);
  }
  return out;
}

function material(base, color, extra = {}) {
  const m = base.clone();
  m.color = new THREE.Color(color);
  Object.assign(m, extra);
  m.userData.ownMaterial = true;
  return m;
}

function plainMaterial(color, roughness = 0.6) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  m.userData.ownMaterial = true;
  return m;
}

function blend(a, b, t) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

// Garment mesh: the triangles of the reshaped body that belong to a garment
// (any vertex counts, so neighbouring garments overlap rather than leaving
// a seam), pushed out along the normals, grouped by garment+part so each
// limb's clothing can be colored/hidden on its own.
function buildClothing(t, geo, positions, materialFor) {
  const normals = geo.attributes.normal;
  const count = positions.length / 3;
  const offsetPos = new Float32Array(positions.length);
  for (let i = 0; i < count; i++) {
    const off = CLOTH[t.vertexGarment[i]] ?? CLOTH.shirt;
    for (let k = 0; k < 3; k++) offsetPos[i * 3 + k] = positions[i * 3 + k] + normals.getComponent(i, k) * off;
  }

  const index = geo.index.array;
  const byGroup = new Map(); // `${garment}:${part}` -> triangle list
  for (let f = 0; f < index.length; f += 3) {
    const tri = [index[f], index[f + 1], index[f + 2]];
    const garment = tri.map((i) => t.vertexGarment[i]).find((g) => g);
    if (!garment) continue;
    const key = `${garment}:${majority(tri.map((i) => t.vertexPart[i]))}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(...tri);
  }

  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.BufferAttribute(offsetPos, 3));
  cloth.setAttribute('normal', normals);
  cloth.setAttribute('skinIndex', geo.attributes.skinIndex);
  cloth.setAttribute('skinWeight', geo.attributes.skinWeight);
  const sorted = [];
  const materials = [];
  for (const [key, tris] of byGroup) {
    const [garment, part] = key.split(':');
    cloth.addGroup(sorted.length, tris.length, materials.length);
    materials.push(materialFor(garment, PARTS[Number(part)]));
    for (const x of tris) sorted.push(x);
  }
  cloth.setIndex(new THREE.BufferAttribute(new Uint32Array(sorted), 1));
  cloth.computeBoundingSphere();
  cloth.userData.ownGeometry = true;
  return { geometry: cloth, materials };
}

// Rotate a bone about a world-space axis (rest-pose bone axes vary, so
// posing in world terms is far easier to reason about).
function rotateBoneWorld(bone, axis, angle) {
  bone.updateWorldMatrix(true, false);
  const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const rotated = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(worldQ);
  bone.quaternion.copy(parentQ.invert().multiply(rotated));
}

// A mesh placed in world space at a->b (parameter t), its `lookAxis`
// pointed along `dir` (default: the a->b direction), then parented to
// `bone` keeping that placement, so it follows the skeleton from then on.
function attachAlong(bone, geometry, mat, a, b, t, { offset, lookAxis = new THREE.Vector3(0, 0, 1), dir } = {}) {
  const m = new THREE.Mesh(geometry, mat);
  geometry.userData.ownGeometry = true;
  const along = dir || new THREE.Vector3().subVectors(b, a).normalize();
  m.position.copy(a).lerp(b, t);
  if (offset) m.position.add(offset);
  m.quaternion.setFromUnitVectors(lookAxis, along);
  m.updateMatrixWorld(true);
  bone.attach(m);
  return m;
}

/* ---------- Assembly ---------- */

// Resolves to a THREE.Object3D for the descriptor. Geometry/materials made
// for this figure are flagged userData.ownGeometry / ownMaterial; anything
// unflagged (template geometry, textures) is shared via the cache and must
// not be disposed.
export async function buildAvatar(descriptor) {
  const a = normalizeAvatar(descriptor);
  const female = a.gender === 'female';
  const hairFile = a.head === 'bald' ? null : HAIR_FILES[a.head][female ? 'female' : 'male'];
  const [t, femaleT, hairT] = await Promise.all([
    loadAsset(female ? 'body_female.glb' : 'body_male.glb'),
    loadAsset('body_female.glb'), // the hairstyles are authored around the female head
    hairFile ? loadAsset(hairFile) : null
  ]);

  const root = SkeletonUtils.clone(t.gltf.scene);
  let body = null;
  let brows = null;
  root.traverse((n) => {
    if (n.isSkinnedMesh && n.name === t.bodyName) body = n;
    else if (n.isSkinnedMesh && /hair/i.test(n.material.name)) brows = n;
  });
  const bone = Object.fromEntries(body.skeleton.bones.map((b) => [b.name, b]));
  const stateOf = (part) => (part === 'head' || part === 'torso' ? 'healthy' : a.limbs[part]);

  // 1. Reshape: body type + morphed bulk.
  const factor = shapeFactors(a);
  const positions = reshapePositions(t, t.body.geometry, factor);
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(t.body.geometry.attributes)) {
    geo.setAttribute(name, name === 'position' ? new THREE.BufferAttribute(positions, 3) : attr);
  }
  geo.setIndex(t.sortedIndex);
  t.groups.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
  geo.computeBoundingSphere();
  geo.userData.ownGeometry = true;
  body.geometry = geo;

  // 2. Per-part skin materials.
  const baseSkin = t.body.material;
  body.material = PARTS.map((part) => {
    const state = stateOf(part);
    if (state === 'damaged') return material(baseSkin, blend(a.skin, BRUISE, 0.32));
    if (state === 'morphed') return material(baseSkin, blend(a.skin, MORPH_TINT, 0.6), { roughness: 0.45 });
    return material(baseSkin, a.skin);
  });
  if (brows) brows.material = material(brows.material, a.hair);

  // 3. Clothing.
  const cloth = buildClothing(t, geo, positions, (garment, part) => {
    const state = stateOf(part);
    if (garment === 'shoe') {
      const m = plainMaterial(SHOE, 0.5);
      m.visible = state !== 'morphed'; // morphed feet go bare (and clawed)
      return m;
    }
    return plainMaterial(state === 'damaged' ? blend(a.outfit, BRUISE, 0.35) : a.outfit, 0.85);
  });
  const clothMesh = new THREE.SkinnedMesh(cloth.geometry, cloth.materials);
  // Same parent AND same local transform as the body, so the shared
  // skeleton + bind matrix deform it identically.
  clothMesh.position.copy(body.position);
  clothMesh.quaternion.copy(body.quaternion);
  clothMesh.scale.copy(body.scale);
  clothMesh.bind(body.skeleton, body.bindMatrix);
  body.parent.add(clothMesh);

  // 4. Pose: shoulders (narrower for Non-Binary), then arms down.
  for (const side of ['l', 'r']) bone[`upperarm_${side}`].position.multiplyScalar(SHOULDER_WIDTH[a.gender]);
  rotateBoneWorld(bone.upperarm_l, new THREE.Vector3(0, 0, 1), -ARM_DROP);
  rotateBoneWorld(bone.upperarm_r, new THREE.Vector3(0, 0, 1), ARM_DROP);
  root.updateMatrixWorld(true);

  // 5. Bandages / spines / claws on the posed skeleton.
  const worldPos = (name) => bone[name].getWorldPosition(new THREE.Vector3());
  // boneRadius is in the mesh's bind space (the pack's armature is scaled,
  // so that's not world units); convert using a bone length posing doesn't
  // change.
  const bindIdx = (name) => t.boneNames.indexOf(name);
  const unit = worldPos('lowerarm_l').distanceTo(worldPos('hand_l')) /
    t.boneOrigin[bindIdx('lowerarm_l')].distanceTo(t.boneOrigin[bindIdx('hand_l')]);
  const radius = (name) => t.boneRadius[bindIdx(name)] * factor(name) * unit;
  const horn = plainMaterial(HORN, 0.35);
  const bandage = plainMaterial(BANDAGE, 0.9);
  const UP = new THREE.Vector3(0, 1, 0);
  const outward = (sign) => new THREE.Vector3(sign, 0, 0);

  for (const [limb, s, sign] of [['leftArm', 'l', 1], ['rightArm', 'r', -1]]) {
    const state = a.limbs[limb];
    const from = worldPos(`lowerarm_${s}`);
    const to = worldPos(`hand_${s}`);
    const r = radius(`lowerarm_${s}`);
    if (state === 'damaged') {
      for (const tt of [0.42, 0.62]) attachAlong(bone[`lowerarm_${s}`], new THREE.TorusGeometry(r * 1.05, 0.009, 8, 28), bandage, from, to, tt);
    }
    if (state === 'morphed') {
      // Spines along the outside of the forearm, pointing outward.
      for (const tt of [0.25, 0.5, 0.75]) {
        attachAlong(bone[`lowerarm_${s}`], new THREE.ConeGeometry(r * 0.45, r * 3.2, 8), horn, from, to, tt, {
          offset: outward(sign).multiplyScalar(r * 1.05), lookAxis: UP, dir: outward(sign)
        });
      }
      // Claws past the fingertips, pointing down along the arm.
      const dir = new THREE.Vector3().subVectors(to, from).normalize();
      for (const dz of [-1, 0, 1]) {
        const tip = to.clone().addScaledVector(dir, r * 2.8).add(new THREE.Vector3(0, 0, dz * r * 0.5));
        attachAlong(bone[`hand_${s}`], new THREE.ConeGeometry(r * 0.28, r * 2.6, 8), horn, tip, tip, 0, { lookAxis: UP, dir });
      }
    }
  }

  for (const [limb, s, sign] of [['leftLeg', 'l', 1], ['rightLeg', 'r', -1]]) {
    const state = a.limbs[limb];
    const from = worldPos(`calf_${s}`);
    const to = worldPos(`foot_${s}`);
    const r = radius(`calf_${s}`);
    if (state === 'damaged') {
      for (const tt of [0.45, 0.6]) attachAlong(bone[`calf_${s}`], new THREE.TorusGeometry(r * 1.05 + CLOTH.pants, 0.011, 8, 28), bandage, from, to, tt);
    }
    if (state === 'morphed') {
      for (const tt of [0.3, 0.55]) {
        attachAlong(bone[`calf_${s}`], new THREE.ConeGeometry(r * 0.4, r * 2.8, 8), horn, from, to, tt, {
          offset: outward(sign).multiplyScalar(r * 1.05), lookAxis: UP, dir: outward(sign)
        });
      }
      const toe = worldPos(`ball_${s}`);
      const forward = new THREE.Vector3(0, -0.15, 1).normalize();
      for (const dx of [-1, 0, 1]) {
        const tip = toe.clone().add(new THREE.Vector3(dx * 0.025, 0, 0.04));
        attachAlong(bone[`ball_${s}`], new THREE.ConeGeometry(0.013, 0.07, 8), horn, tip, tip, 0, { lookAxis: UP, dir: forward });
      }
    }
  }

  // 6. Hair, re-anchored from the female head it was authored on to this
  // body's head bone.
  if (hairT) {
    const hair = new THREE.Mesh(hairT.hairMesh.geometry, material(hairT.hairMesh.material, a.hair));
    femaleT.headRestWorld.clone().invert().decompose(hair.position, hair.quaternion, hair.scale);
    bone.Head.add(hair);
  }

  return root;
}
