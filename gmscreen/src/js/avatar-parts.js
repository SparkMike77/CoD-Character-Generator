// Human avatar assembled from parts: head, torso, left/right arm, left/right
// leg, each independently Healthy, Damaged, or Morphed, plus a gender
// (body shape), hairstyle, and colors. An avatar is fully described by a small JSON
// descriptor (see AVATAR_DEFAULT), so GMScreen rebuilds the exact same
// figure from it without any model data crossing the network.
//
// Geometry comes from Quaternius's CC0 "Universal Base Characters" (see
// src/assets/avatar/LICENSE.txt and scripts/prepare-avatar-assets.js): one
// rigged male and one rigged female body plus separate hairstyles. Those
// are "Superhero"-proportioned, so every body type is reshaped here.
// "Other" is instead the mannequin from the Universal Animation Library
// (scripts/extract-mannequin.js), shown as it comes, without hair.
//
//
//   - Body shape is changed per VERTEX, not by scaling bones. Each vertex is
//     pulled toward / pushed away from the bone segments it's skinned to,
//     blended by its skin weights. (Bone scale would cascade down the
//     hierarchy - slimming the waist would also squash the head.) Male and
//     Female get a mild toning-down; Non-Binary is the female body with the
//     chest flattened, the hips straightened and the torso surface smoothed
//     of its sculpted musculature (BODY_SMOOTH), with normals recomputed for
//     the new shape). Morphed limbs use the same mechanism in reverse, to
//     bulk up.
//   - The six parts are the body mesh split by which bone dominates each
//     triangle, each part with its own material - that's what lets one
//     limb be tinted Damaged/Morphed independently of the others.
//   - Clothing (shirt, trousers, shoes) is generated from the reshaped body
//     surface itself, offset slightly outward and skinned to the same
//     skeleton, so it fits every body type and limb state automatically.
//   - Bandages and blades are attached to the bones in the posed figure,
//     so they sit correctly on any body.
//   - Morphed limbs are chrome; their material is flagged
//     userData.chrome so the viewer can give it a reflection map.
//   - Conditions can pose the figure (descriptor.pose, see normalizePose):
//     single frames of Quaternius's Universal Animation Library, which
//     shares this skeleton (avatar-poses.js, scripts/extract-poses.js),
//     applied once everything is built - so clothing, bandages, blades and
//     hair, all skinned or attached to bones, simply follow.
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
import { POSE_FRAMES } from './avatar-poses.js';

export const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'nonbinary', label: 'Non-Binary' },
  { id: 'other', label: 'Other' } // for now built exactly like Non-Binary
];

export const HAIRSTYLES = [
  { id: 'bald', label: 'Bald' },
  { id: 'buzzed', label: 'Buzzed' },
  { id: 'parted', label: 'Parted' },
  { id: 'long', label: 'Long' },
  { id: 'buns', label: 'Buns' }
];

export const PART_STATES = [
  { id: 'healthy', label: 'Healthy' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'morphed', label: 'Morphed' }
];

// The six body parts, each independently Healthy / Damaged / Morphed.
export const BODY_PARTS = [
  { id: 'head', label: 'Head', short: 'Head' },
  { id: 'torso', label: 'Torso', short: 'Torso' },
  { id: 'leftArm', label: 'Left Arm', short: 'L.Arm' },
  { id: 'rightArm', label: 'Right Arm', short: 'R.Arm' },
  { id: 'leftLeg', label: 'Left Leg', short: 'L.Leg' },
  { id: 'rightLeg', label: 'Right Leg', short: 'R.Leg' }
];

export const AVATAR_DEFAULT = {
  gender: 'nonbinary',
  style: 'parted', // hairstyle
  skin: '#c99a78',
  hair: '#3b2a1e',
  outfit: '#4d5866',
  parts: { head: 'healthy', torso: 'healthy', leftArm: 'healthy', rightArm: 'healthy', leftLeg: 'healthy', rightLeg: 'healthy' }
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const pick = (value, options, fallback) => (options.some((o) => o.id === value) ? value : fallback);
const hex = (value, fallback) => (typeof value === 'string' && HEX_RE.test(value) ? value : fallback);

// Fills gaps / replaces anything invalid with defaults, so an older or
// hand-edited character file (or a malformed network message) always
// produces a buildable avatar. Also migrates the earlier shape, where the
// hairstyle was `head` and the part states were `limbs` (arms/legs only).
export function normalizeAvatar(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const rawParts = [a.parts, a.limbs].find((p) => p && typeof p === 'object') || {};
  return {
    gender: pick(a.gender, GENDERS, AVATAR_DEFAULT.gender),
    style: pick(a.style ?? a.head, HAIRSTYLES, AVATAR_DEFAULT.style),
    skin: hex(a.skin, AVATAR_DEFAULT.skin),
    hair: hex(a.hair, AVATAR_DEFAULT.hair),
    outfit: hex(a.outfit, AVATAR_DEFAULT.outfit),
    parts: Object.fromEntries(BODY_PARTS.map(({ id }) => [id, pick(rawParts[id], PART_STATES, 'healthy')]))
  };
}

// A pose (from the Conditions on the sheet - conditions.js conditionPose;
// never saved, only shown and sent to the GM):
//   body:  null (standing) | 'down' (flat on the ground) | 'kneel' (on the
//          right knee, head bowed) | 'hunch' (hunched and low) | 'stagger'
//   mirrorBody: true = the body pose's mirror image (kneel on the left knee)
//   shield: null | 'left' | 'right' - that arm thrown across the eyes
//   sling: ['left', 'right'] subset - those forearms held across the chest
export const POSE_BODIES = ['down', 'kneel', 'hunch', 'stagger'];
const SIDES = ['left', 'right'];

export function normalizePose(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    body: POSE_BODIES.includes(p.body) ? p.body : null,
    mirrorBody: p.mirrorBody === true,
    shield: SIDES.includes(p.shield) ? p.shield : null,
    sling: Array.isArray(p.sling) ? SIDES.filter((side) => p.sling.includes(side)) : []
  };
}

/* ---------- Tuning ---------- */

// Cross-section factors per bone (1 = unchanged; <1 slimmer, >1 bulkier).
// Keys are bone names without their _l/_r suffix. A number scales the
// cross-section evenly; { w, d } scales width (side to side) and depth
// (front to back) separately.
const BODY_SHAPE = {
  male: { spine_01: 0.94, spine_02: 0.93, spine_03: 0.93, neck_01: 0.95, upperarm: 0.86, lowerarm: 0.9, thigh: 0.92, calf: 0.94 },
  // pelvis/thigh: the Superhero female's hips are extreme; ~15% narrower.
  female: { pelvis: 0.85, spine_01: 0.97, spine_02: 0.97, spine_03: 0.97, upperarm: 0.9, lowerarm: 0.93, thigh: 0.88, calf: 0.95 },
  // Androgynous: the FEMALE body (its softer face, no sculpted abs or
  // pecs) with the chest flattened, the waist filled out, and straight
  // hips - no hourglass, bust or flare.
  nonbinary: {
    pelvis: { w: 0.76, d: 0.97, back: { from: 0.55, k: 0.35 } },
    spine_01: { w: 1.12, d: 1.02 },
    spine_02: { w: 1, d: 0.98, front: { from: 0.4, k: 0.06 } },
    spine_03: { w: 1, d: 0.97, front: { from: 0.4, k: 0.05 } },
    upperarm: 0.94, lowerarm: 0.95, thigh: { w: 0.76, d: 0.92, back: { from: 0.6, k: 0.5 } }, calf: 0.95
  }
};
// Surface smoothing after reshaping, per body type: iterations of a
// non-shrinking (Taubin) smooth, applied in proportion to each vertex's
// skin weight on `bones` - so it fades out toward the neck, arms and legs.
// Non-Binary's softens the torso's sculpted musculature (abs, pec and rib
// edges) and the crease left under the flattened bust; the shirt, made from
// this surface, comes out smooth too.
const BODY_SMOOTH = {
  nonbinary: {
    iterations: 20,
    bones: { pelvis: 0.6, spine_01: 1, spine_02: 1, spine_03: 1, clavicle_l: 0.7, clavicle_r: 0.7 },
    // Plus a plain (flattening) smooth over the front of the chest only,
    // which irons out what's left of the bust and the fold beneath it -
    // the smooth above keeps broad shapes by design.
    chest: { iterations: 40, bones: { spine_01: 0.5, spine_02: 1, spine_03: 1 } }
  }
};
// Shoulder span (distance between the shoulder joints) as a fraction of
// the body's own: Non-Binary's a little broader than the female body's.
// Done by moving the arms in along the collarbone (a bone translation,
// which doesn't cascade like scale).
const SHOULDER_SPAN = { male: 1, female: 1, nonbinary: 1.06 };
// "Other" is the Universal Animation Library's mannequin (see
// scripts/extract-mannequin.js), as it comes.
BODY_SHAPE.other = {};
SHOULDER_SPAN.other = 1;
const BODY_FILES = { male: 'body_male.glb', female: 'body_female.glb', nonbinary: 'body_female.glb', other: 'body_mannequin.glb' };
// Morphed limbs are liquid metal reshaped into weapons (think T-1000):
// sleek rather than bulky, the hand replaced by a flat blade, a fin blade
// down the shin. Faceted (flat-shaded) chrome for a hard, blocky read.
const MORPH_BULK = { lowerarm: 1.06, calf: 1.06 };
const MORPH_HAND_SCALE = 0.05; // the hand collapses into the blade's root
// Placement in multiples of the bone's average radius (tuned by eye):
const HEAD_BAND_HEIGHT = 1.55; // brow bandage, above the Head bone origin
const BACK_DEPTH = 0.75; // spine blades' roots, behind the spine axis
const TRUNK_WRAP_FORWARD = 0.3; // torso bandages' centre, ahead of the spine axis

const ARM_DROP = THREE.MathUtils.degToRad(70); // from the rest T-pose down toward the sides
// Offset off the skin, metres. "shin" is the trouser leg below the knee -
// its own garment so a morphed leg can show its chrome shin.
const CLOTH = { shirt: 0.009, pants: 0.007, shin: 0.007, shoe: 0.011 };

// Damaged parts are soaked toward this: fresh blood, deep and saturated.
// Skin and cloth both lean well into it (DAMAGE_BLEND), and the cloth is
// glossier, as if wet.
const BLOOD = '#9a0b0b';
const DAMAGE_BLEND = { skin: 0.68, cloth: 0.72 };
const CHROME = '#d6dbe1';
const BANDAGE = '#ece6d8';
const SHOE = '#2a2622';

const PARTS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const FINGER_RE = /^(index|middle|pinky|ring|thumb)_/;

const ASSET_URL = new URL('../assets/avatar/', import.meta.url);
// The pack's hairstyles are positioned for one of its two base heads
// ("Origin at 0" = that body's world space), and NOT the same one for all:
// measured crown gaps say Buzzed (male cut) and Simple Parted sit on the
// male head, the rest on the female. Each is re-anchored from its authoring
// head to this body's Head bone; anchoring them all to the female head left
// those two floating ~5 cm above the skull.
const HAIR_AUTHORED_ON = { 'hair_buzzed.glb': 'body_male.glb', 'hair_simpleparted.glb': 'body_male.glb' };
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
  if (base === 'pelvis' || base === 'thigh') return 'pants';
  if (base === 'calf') return 'shin';
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
  t.vertexBone = new Uint16Array(count); // dominant bone
  t.vertexGarment = new Array(count);
  for (let i = 0; i < count; i++) {
    let best = 0;
    let bestW = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bestW) { bestW = w; best = skinIndex.getComponent(i, k); }
    }
    t.vertexBone[i] = best;
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
    const bulk = a.parts[part] === 'morphed' ? MORPH_BULK[key] ?? 1 : 1; // (only limb bones have entries)
    if (typeof f === 'number') return f * bulk;
    return { ...f, w: f.w * bulk, d: f.d * bulk };
  };
}

// One number for a factor that may be { w, d } - for sizing props.
function meanFactor(f) {
  return typeof f === 'number' ? f : (f.w + f.d) / 2;
}

// Reshaped vertex positions (mesh-local), per the module comment: each
// vertex moves radially about each influencing bone's axis by that bone's
// factor, blended by skin weight. A { w, d } factor splits the radial
// offset into its side-to-side component (world X, made perpendicular to
// the bone) and the rest, scaled separately. Bones lying along X (the
// collarbones) have no side-to-side cross-section, so they use the mean.
// Smooth vertex normals for the geometry's current positions, averaged
// across vertices sharing a position (UV seams), so no seams show.
// Vertex neighbours across the whole surface (UV-seam duplicates, which
// share a position, count as one vertex). Cached per template.
function surfaceNeighbours(t, geo) {
  if (t.neighbours) return t.neighbours;
  const pos = t.bindPos;
  const keyOf = (i) => `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
  const welded = new Map();
  const rep = new Uint32Array(pos.length / 3);
  for (let i = 0; i < rep.length; i++) {
    const key = keyOf(i);
    if (!welded.has(key)) welded.set(key, i);
    rep[i] = welded.get(key);
  }
  const sets = new Map();
  const index = geo.index.array;
  for (let f = 0; f < index.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const a = rep[index[f + e]];
      const b = rep[index[f + ((e + 1) % 3)]];
      if (a === b) continue;
      if (!sets.has(a)) sets.set(a, new Set());
      if (!sets.has(b)) sets.set(b, new Set());
      sets.get(a).add(b);
      sets.get(b).add(a);
    }
  }
  t.neighbours = { rep, lists: new Map([...sets].map(([k, v]) => [k, [...v]])) };
  return t.neighbours;
}

// Smoothing on mesh-local `positions`, in place - see BODY_SMOOTH. Taubin
// (alternate shrink / inflate steps, so the overall size holds) over the
// given bones, then, for `chest`, a plain flattening smooth over the front
// of the chest.
function smoothSurface(t, geo, positions, { iterations, bones, chest }) {
  const { rep, lists } = surfaceNeighbours(t, geo);
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  const amounts = (weights, frontOnly) => {
    const boneAmount = t.boneNames.map((name) => weights[name] || 0);
    const amount = new Float32Array(rep.length);
    for (let i = 0; i < rep.length; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += skinWeight.getComponent(i, k) * boneAmount[skinIndex.getComponent(i, k)];
      amount[i] = Math.min(1, sum);
      if (frontOnly) {
        // How far in front of its main bone the vertex is, in that bone's radii.
        const j = t.vertexBone[i];
        const ahead = (t.bindPos[i * 3 + 2] - t.boneOrigin[j].z) / Math.max(t.boneRadius[j], 1e-4);
        amount[i] *= THREE.MathUtils.smoothstep(ahead, 0.1, 0.7);
      }
    }
    return amount;
  };
  smoothPasses(positions, lists, amounts(bones, false), iterations, true);
  if (chest) smoothPasses(positions, lists, amounts(chest.bones, true), chest.iterations, false);
  // Seam duplicates follow their representative.
  for (let i = 0; i < rep.length; i++) {
    if (rep[i] !== i) for (let c = 0; c < 3; c++) positions[i * 3 + c] = positions[rep[i] * 3 + c];
  }
}

function smoothPasses(positions, lists, amount, iterations, taubin) {
  const verts = [...lists.keys()].filter((v) => amount[v] > 0.01);
  const next = new Float32Array(positions.length);
  for (let it = 0; it < iterations * (taubin ? 2 : 1); it++) {
    const factor = !taubin ? 0.5 : it % 2 === 0 ? 0.5 : -0.53;
    next.set(positions);
    for (const v of verts) {
      const ns = lists.get(v);
      for (let c = 0; c < 3; c++) {
        let mean = 0;
        for (const n of ns) mean += positions[n * 3 + c];
        mean /= ns.length;
        next[v * 3 + c] = positions[v * 3 + c] + factor * amount[v] * (mean - positions[v * 3 + c]);
      }
    }
    positions.set(next);
  }
}

function weldedNormals(geo) {
  const temp = new THREE.BufferGeometry();
  temp.setAttribute('position', geo.attributes.position);
  temp.setIndex(geo.index);
  temp.computeVertexNormals();
  const n = temp.attributes.normal;
  const pos = geo.attributes.position;
  const sums = new Map();
  const keyOf = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) {
    const key = keyOf(i);
    const sum = sums.get(key) || [0, 0, 0];
    sum[0] += n.getX(i); sum[1] += n.getY(i); sum[2] += n.getZ(i);
    sums.set(key, sum);
  }
  const out = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) v.fromArray(sums.get(keyOf(i))).normalize().toArray(out, i * 3);
  return new THREE.BufferAttribute(out, 3);
}

function reshapePositions(t, geo, factorFor) {
  const count = geo.attributes.position.count;
  const out = new Float32Array(count * 3);
  const factors = t.boneNames.map((name, j) => {
    const f = factorFor(name);
    if (typeof f === 'number') return f;
    const axis = t.boneAxis[j];
    const side = new THREE.Vector3(1, 0, 0).addScaledVector(axis, -axis.x);
    const fwd = new THREE.Vector3(0, 0, 1).addScaledVector(axis, -axis.z).normalize();
    return side.length() > 0.5 ? { ...f, side: side.normalize(), fwd } : meanFactor(f);
  });
  const radial = new THREE.Vector3();
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
        total += w;
        continue;
      }
      const along = c.copy(v).sub(t.boneOrigin[j]).dot(t.boneAxis[j]);
      c.copy(t.boneOrigin[j]).addScaledVector(t.boneAxis[j], along); // closest point on the bone axis
      radial.subVectors(v, c);
      if (typeof f === 'number') {
        radial.multiplyScalar(f);
      } else {
        const sideways = radial.dot(f.side);
        radial.multiplyScalar(f.d).addScaledVector(f.side, sideways * (f.w - f.d));
        // front / back: { from, k } - whatever sticks out further forward
        // (or back) than `from` x the bone's average radius is scaled by k.
        const ahead = radial.dot(f.fwd);
        const cut = ahead > 0 ? f.front : f.back;
        if (cut) {
          const limit = t.boneRadius[j] * cut.from;
          const reach = Math.abs(ahead);
          if (reach > limit) {
            // Eased in (slope 1 at the limit, k far beyond) so it leaves no crease.
            const over = reach - limit;
            const ease = limit * 0.25;
            const squeezed = limit + over * cut.k + (1 - cut.k) * ease * (1 - Math.exp(-over / ease));
            radial.addScaledVector(f.fwd, Math.sign(ahead) * (squeezed - reach));
          }
        }
      }
      acc.addScaledVector(c.add(radial), w);
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

function chromeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: CHROME, metalness: 1, roughness: 0.24, flatShading: true });
  m.userData.ownMaterial = true;
  m.userData.chrome = true;
  return m;
}

// A blade: `points` is its outline as [across, along] pairs. A thin core
// with one wide, steep chamfer each side, so the cross-section is a flat
// hexagon - the angled faces catch different reflections, which is what
// makes it read as a hard metal blade rather than a flat white slab. The
// chamfer grows the outline by `edge` all round.
function bladeGeometry(points, thickness, edge) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const core = thickness * 0.25;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core, bevelEnabled: true, bevelThickness: (thickness - core) / 2, bevelSize: edge, bevelSegments: 1
  });
  g.translate(0, 0, -core / 2);
  g.userData.ownGeometry = true;
  return g;
}

// Parents `mesh` to `bone` at world position `origin`, its local +Y along
// `along` and local +X toward `across` (made perpendicular to `along`).
function attachOriented(bone, mesh, origin, along, across) {
  const y = along.clone().normalize();
  const x = across.clone().addScaledVector(y, -across.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  mesh.position.copy(origin);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  mesh.updateMatrixWorld(true);
  bone.attach(mesh);
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
  const female = BODY_FILES[a.gender] === 'body_female.glb'; // (the head the hair has to fit)
  // The mannequin has no hair: the hairstyles are shaped for the human heads.
  const hairFile = a.style === 'bald' || a.gender === 'other' ? null : HAIR_FILES[a.style][female ? 'female' : 'male'];
  const [t, hairAnchorT, hairT] = await Promise.all([
    loadAsset(BODY_FILES[a.gender]),
    loadAsset(HAIR_AUTHORED_ON[hairFile] || 'body_female.glb'), // the head the hairstyle was made for
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
  const stateOf = (part) => a.parts[part];
  const restLocal = Object.fromEntries(body.skeleton.bones.map((b) => [b.name, b.quaternion.clone()]));
  root.updateMatrixWorld(true);
  const restChest = bone.spine_03.getWorldQuaternion(new THREE.Quaternion());

  // 1. Reshape: body type + morphed bulk.
  const factor = shapeFactors(a);
  const positions = reshapePositions(t, t.body.geometry, factor);
  if (BODY_SMOOTH[a.gender]) smoothSurface(t, t.body.geometry, positions, BODY_SMOOTH[a.gender]);
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(t.body.geometry.attributes)) {
    geo.setAttribute(name, name === 'position' ? new THREE.BufferAttribute(positions, 3) : attr);
  }
  geo.setIndex(t.sortedIndex);
  t.groups.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
  // Reshaping keeps the template's normals, which is right for mild
  // changes; a body reshaped hard enough to change its silhouette (front /
  // back cuts) gets normals for its new shape, or it's still lit - and its
  // clothes, pushed out along them, shaped - as the old one.
  if (BODY_SMOOTH[a.gender] || Object.values(BODY_SHAPE[a.gender]).some((f) => f && (f.front || f.back))) geo.setAttribute('normal', weldedNormals(geo));
  geo.computeBoundingSphere();
  geo.userData.ownGeometry = true;
  body.geometry = geo;

  // 2. Per-part skin materials.
  const baseSkin = t.body.material;
  body.material = PARTS.map((part) => {
    const state = stateOf(part);
    if (state === 'damaged') return material(baseSkin, blend(a.skin, BLOOD, DAMAGE_BLEND.skin));
    if (state === 'morphed') return chromeMaterial();
    return material(baseSkin, a.skin);
  });
  // Brows and hair follow the head: hair-colored, or metal when the head is
  // morphed. (A clone of the hair material, not chromeMaterial(), so the
  // strand cutouts in its texture alpha still apply.)
  const hairMaterial = (base) => {
    if (stateOf('head') !== 'morphed') return material(base, a.hair);
    const m = material(base, CHROME, { metalness: 1, roughness: 0.24, flatShading: true });
    m.userData.chrome = true;
    return m;
  };
  if (brows) brows.material = hairMaterial(brows.material);

  // 3. Clothing. A morphed leg's trouser ends at the knee and its shoe is
  // gone, showing the metal shin and foot; a morphed torso sheds the whole
  // shirt (sleeves too). A torso wound stains the shirt, not the waistband.
  const cloth = buildClothing(t, geo, positions, (garment, part) => {
    const state = garment === 'pants' && part === 'torso' ? 'healthy' : stateOf(part);
    const m = garment === 'shoe'
      ? plainMaterial(SHOE, 0.5)
      : state === 'damaged' ? plainMaterial(blend(a.outfit, BLOOD, DAMAGE_BLEND.cloth), 0.5) : plainMaterial(a.outfit, 0.85);
    if (state === 'morphed' && (garment === 'shoe' || garment === 'shin')) m.visible = false;
    if (garment === 'shirt' && stateOf('torso') === 'morphed') m.visible = false;
    return m;
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
  const span = SHOULDER_SPAN[a.gender];
  if (span !== 1) {
    root.updateMatrixWorld(true);
    const l = bone.upperarm_l.getWorldPosition(new THREE.Vector3());
    const r = bone.upperarm_r.getWorldPosition(new THREE.Vector3());
    const inward = ((1 - span) * l.distanceTo(r)) / 2; // world distance each arm moves in
    for (const side of ['l', 'r']) {
      const arm = bone[`upperarm_${side}`];
      const reach = arm.getWorldPosition(new THREE.Vector3()).distanceTo(arm.parent.getWorldPosition(new THREE.Vector3()));
      arm.position.multiplyScalar(Math.max(0, 1 - inward / reach));
    }
  }
  rotateBoneWorld(bone.upperarm_l, new THREE.Vector3(0, 0, 1), -ARM_DROP);
  rotateBoneWorld(bone.upperarm_r, new THREE.Vector3(0, 0, 1), ARM_DROP);
  for (const [limb, s] of [['leftArm', 'l'], ['rightArm', 'r']]) {
    if (a.parts[limb] === 'morphed') bone[`hand_${s}`].scale.setScalar(MORPH_HAND_SCALE);
  }
  root.updateMatrixWorld(true);

  // 5. Bandages / blades on the posed skeleton.
  const worldPos = (name) => bone[name].getWorldPosition(new THREE.Vector3());
  // boneRadius is in the mesh's bind space (the pack's armature is scaled,
  // so that's not world units); convert using a bone length posing doesn't
  // change.
  const bindIdx = (name) => t.boneNames.indexOf(name);
  const unit = worldPos('lowerarm_l').distanceTo(worldPos('hand_l')) /
    t.boneOrigin[bindIdx('lowerarm_l')].distanceTo(t.boneOrigin[bindIdx('hand_l')]);
  const radius = (name) => t.boneRadius[bindIdx(name)] * meanFactor(factor(name)) * unit;
  const bandage = plainMaterial(BANDAGE, 0.9);
  const FORWARD = new THREE.Vector3(0, 0, 1);
  const BACK = new THREE.Vector3(0, 0, -1);

  for (const [limb, s, sign] of [['leftArm', 'l', 1], ['rightArm', 'r', -1]]) {
    const state = a.parts[limb];
    const from = worldPos(`lowerarm_${s}`);
    const to = worldPos(`hand_${s}`);
    const r = radius(`lowerarm_${s}`);
    if (state === 'damaged') {
      for (const tt of [0.42, 0.62]) attachAlong(bone[`lowerarm_${s}`], new THREE.TorusGeometry(r * 1.05, 0.009, 8, 28), bandage, from, to, tt);
    }
    if (state === 'morphed') {
      // The hand is a long flat blade running on from the forearm: edges
      // front and back, a chisel point toward the front edge.
      // Turned ~20 degrees outward so its flat shows from the front too.
      const len = from.distanceTo(to) * 1.6;
      const w = r * 1.6;
      const blade = new THREE.Mesh(bladeGeometry([
        [-w * 0.5, 0], [w * 0.5, 0], [w * 0.44, len * 0.8], [w * 0.12, len], [-w * 0.34, len * 0.86], [-w * 0.5, len * 0.3]
      ], r * 0.5, r * 0.3), chromeMaterial());
      const across = FORWARD.clone().add(new THREE.Vector3(sign * 0.36, 0, 0));
      attachOriented(bone[`lowerarm_${s}`], blade, from.clone().lerp(to, 0.62), new THREE.Vector3().subVectors(to, from), across);
    }
  }

  for (const [limb, s] of [['leftLeg', 'l'], ['rightLeg', 'r']]) {
    const state = a.parts[limb];
    const from = worldPos(`calf_${s}`);
    const to = worldPos(`foot_${s}`);
    const r = radius(`calf_${s}`);
    if (state === 'damaged') {
      for (const tt of [0.45, 0.6]) attachAlong(bone[`calf_${s}`], new THREE.TorusGeometry(r * 1.05 + CLOTH.shin, 0.011, 8, 28), bandage, from, to, tt);
    }
    if (state === 'morphed') {
      // A fin blade down the back of the shin, sweeping out to a point.
      const len = from.distanceTo(to) * 0.8;
      const fin = new THREE.Mesh(bladeGeometry([
        [0, 0], [r * 0.4, 0], [r * 2.8, len * 0.74], [r * 2.1, len * 0.88], [0, len * 0.96]
      ], r * 0.42, r * 0.18), chromeMaterial());
      const origin = from.clone().lerp(to, 0.1).addScaledVector(BACK, r * 0.55);
      attachOriented(bone[`calf_${s}`], fin, origin, new THREE.Vector3().subVectors(to, from), BACK);
    }
  }

  // Head: a bandage round the brow, dipping toward the back.
  if (stateOf('head') === 'damaged') {
    const r = radius('Head');
    const c = worldPos('Head').add(new THREE.Vector3(0, r * HEAD_BAND_HEIGHT, 0));
    const band = attachAlong(bone.Head, new THREE.TorusGeometry(r * 1.08, 0.011, 8, 32).scale(0.92, 1.06, 1), bandage, c, c, 0, {
      dir: new THREE.Vector3(0, 1, -0.22).normalize()
    });
    band.renderOrder = 1;
  }

  // Torso: wounds get two wraps round the middle - oval, and centred ahead
  // of the spine, which runs near the back of the trunk; morphed grows a
  // ridge of blades down the spine.
  const trunkFrom = worldPos('spine_01');
  const trunkTo = worldPos('neck_01');
  if (stateOf('torso') === 'damaged') {
    for (const [boneName, tt] of [['spine_01', 0.18], ['spine_02', 0.36]]) {
      const r = radius(boneName);
      attachAlong(bone[boneName], new THREE.TorusGeometry(r * 1.12 + CLOTH.shirt, 0.013, 8, 36).scale(1.12, 0.84, 1), bandage, trunkFrom, trunkTo, tt, {
        offset: FORWARD.clone().multiplyScalar(r * TRUNK_WRAP_FORWARD)
      });
    }
  }
  if (stateOf('torso') === 'morphed') {
    const r = radius('spine_02');
    const up = new THREE.Vector3().subVectors(trunkTo, trunkFrom).normalize();
    const along = up.clone().addScaledVector(BACK, 0.7).normalize(); // raked back
    for (const [boneName, tt, size] of [['spine_01', 0.22, 0.8], ['spine_02', 0.48, 1], ['spine_03', 0.74, 0.85]]) {
      const len = r * 1.6 * size;
      const fin = new THREE.Mesh(bladeGeometry([
        [0, 0], [r * 0.25, 0], [r * 1.0 * size, len * 0.8], [r * 0.75 * size, len], [0, len * 0.45]
      ], r * 0.16, r * 0.08), chromeMaterial());
      const origin = trunkFrom.clone().lerp(trunkTo, tt).addScaledVector(BACK, r * BACK_DEPTH);
      attachOriented(bone[boneName], fin, origin, along, BACK);
    }
  }

  // 6. Hair, re-anchored from the head it was authored on to this
  // body's head bone.
  if (hairT) {
    const hair = new THREE.Mesh(hairT.hairMesh.geometry, hairMaterial(hairT.hairMesh.material));
    hairAnchorT.headRestWorld.clone().invert().decompose(hair.position, hair.quaternion, hair.scale);
    bone.Head.add(hair);
  }

  // The viewer sizes the figure by this mesh alone, so hair, blades, etc.
  // never change how tall the character appears.
  body.userData.avatarBody = true;

  // 7. Pose. The viewer scales the figure by its standing height, so
  // measure that first; the posed bounds are measured afresh after.
  root.updateMatrixWorld(true);
  root.userData.restHeight = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3()).y;
  const pose = normalizePose(descriptor && descriptor.pose);
  if (applyPose({ t, root, bone, bones: body.skeleton.bones, restLocal, restChest, radius }, pose)) {
    root.updateMatrixWorld(true);
    body.boundingBox = null;
    clothMesh.boundingBox = null;
  }
  root.userData.poseKey = JSON.stringify(pose);

  return root;
}

/* ---------- Poses ---------- */

const partnerOf = (name) => name.replace(/_(l|r)$/, (_, s) => (s === 'l' ? '_r' : '_l'));

// Each bone's rotation in skeleton space (the root's parent ignored).
function chainWorld(bones, localOf) {
  const world = {};
  for (const b of bones) { // parents come first in the skeleton
    const q = localOf(b.name).clone();
    world[b.name] = b.parent && b.parent.isBone ? world[b.parent.name].clone().multiply(q) : q;
  }
  return world;
}

// A frame as { bone name -> local Quaternion, pelvis: Vector3 | null },
// optionally mirrored left <-> right. Mirroring works on each bone's
// change from rest in skeleton space, reflected across the body's
// centre plane (X), so it doesn't depend on how the rig's left and right
// bone axes are set up. Cached per body template.
function poseFrame(t, bones, restLocal, id, mirror) {
  t.poseCache = t.poseCache || new Map();
  const key = `${id}:${mirror}`;
  if (t.poseCache.has(key)) return t.poseCache.get(key);
  const raw = POSE_FRAMES[id];
  const local = (name) => (raw.q[name] ? new THREE.Quaternion().fromArray(raw.q[name]) : restLocal[name]);
  const frame = { q: {}, pelvis: raw.pelvis ? new THREE.Vector3().fromArray(raw.pelvis) : null };
  if (!mirror) {
    for (const b of bones) frame.q[b.name] = local(b.name).clone();
  } else {
    const posedWorld = chainWorld(bones, local);
    const restWorld = chainWorld(bones, (name) => restLocal[name]);
    const mirroredWorld = {};
    for (const b of bones) {
      const p = partnerOf(b.name);
      const change = posedWorld[p].clone().multiply(restWorld[p].clone().invert());
      change.set(change.x, -change.y, -change.z, change.w); // reflect across X
      mirroredWorld[b.name] = change.multiply(restWorld[b.name]);
      frame.q[b.name] = b.parent && b.parent.isBone
        ? mirroredWorld[b.parent.name].clone().invert().multiply(mirroredWorld[b.name])
        : mirroredWorld[b.name].clone();
    }
    if (frame.pelvis) {
      const pelvisBone = bones.find((b) => b.name === 'pelvis');
      const parentName = pelvisBone.parent && pelvisBone.parent.isBone ? pelvisBone.parent.name : null;
      if (parentName) {
        const v = frame.pelvis.clone().applyQuaternion(posedWorld[parentName]);
        v.x = -v.x;
        frame.pelvis = v.applyQuaternion(mirroredWorld[parentName].clone().invert());
      } else {
        frame.pelvis.x = -frame.pelvis.x;
      }
    }
  }
  t.poseCache.set(key, frame);
  return frame;
}

// The whole-body pose (a frame), then arms placed by aiming them: one
// hand over the eyes (Blinded), wracked forearms held against the belly.
// An arm taken from another animation's frame would only land right on
// that animation's torso, so these are aimed at points relative to
// wherever the chest and head ended up. Lying down takes neither.
// Returns whether it posed anything.
function applyPose(ctx, pose) {
  const { t, root, bone, bones, restLocal, restChest, radius } = ctx;
  const arms = pose.body === 'down' ? [] : [
    ...(pose.shield ? [[pose.shield, 'shield']] : []),
    ...pose.sling.map((side) => [side, 'sling'])
  ];
  if (!pose.body && !arms.length) return false;
  if (pose.body) {
    const frame = poseFrame(t, bones, restLocal, pose.body, pose.mirrorBody);
    for (const b of bones) b.quaternion.copy(frame.q[b.name]);
    if (frame.pelvis) bone.pelvis.position.copy(frame.pelvis);
    // Lying down: turned to lie across the view rather than end-on (the
    // frame falls backward, head away from the viewer).
    if (pose.body === 'down') root.rotateY(Math.PI / 2);
  }
  root.updateMatrixWorld(true);
  // The chest's axes now (the figure faces +Z, its left is +X, at rest).
  const chestTurn = bone.spine_03.getWorldQuaternion(new THREE.Quaternion()).multiply(restChest.clone().invert());
  const axis = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(chestTurn);
  const fwd = axis(0, 0, 1);
  const up = axis(0, 1, 0);
  const left = axis(1, 0, 0);
  const pos = (name) => bone[name].getWorldPosition(new THREE.Vector3());
  for (const [side, kind] of arms) {
    const s = side === 'left' ? 'l' : 'r';
    const out = left.clone().multiplyScalar(side === 'left' ? 1 : -1); // away from the body, this side
    let wrist;
    let elbowToward;
    if (kind === 'shield') {
      // Wrist at this side's cheek, out in front, so the hand lies across the eyes.
      const r = radius('Head');
      wrist = pos('Head').addScaledVector(up, r * 0.6).addScaledVector(fwd, r * 1.9).addScaledVector(out, r * 0.7);
      elbowToward = out.clone().multiplyScalar(0.7).addScaledVector(up, -1).addScaledVector(fwd, 0.3);
    } else {
      // Wrist in front of the belly, toward the other side; elbow at the waist.
      const r = radius('spine_02');
      wrist = pos('spine_02').addScaledVector(fwd, r * 1.7).addScaledVector(out, -r * 0.3);
      elbowToward = out.clone().addScaledVector(up, -0.8).addScaledVector(fwd, -0.2);
    }
    reachArm(bone, s, wrist, elbowToward, restLocal);
  }
  return true;
}

// Two-bone reach: bends the arm so the wrist (hand bone) lands on
// `target`, the elbow bowing toward `elbowToward`; the hand straight on.
function reachArm(bone, s, target, elbowToward, restLocal) {
  const upper = bone[`upperarm_${s}`];
  const lower = bone[`lowerarm_${s}`];
  const hand = bone[`hand_${s}`];
  hand.quaternion.copy(restLocal[hand.name]);
  const at = (b) => b.getWorldPosition(new THREE.Vector3());
  const shoulder = at(upper);
  const l1 = shoulder.distanceTo(at(lower));
  const l2 = at(lower).distanceTo(at(hand));
  const toTarget = new THREE.Vector3().subVectors(target, shoulder);
  const d = THREE.MathUtils.clamp(toTarget.length(), Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.999);
  const dir = toTarget.normalize();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const bow = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const pole = elbowToward.clone().addScaledVector(dir, -elbowToward.dot(dir)).normalize();
  const elbow = shoulder.clone().addScaledVector(dir, along).addScaledVector(pole, bow);
  const wrist = shoulder.clone().addScaledVector(dir, d);
  aimBone(upper, at(lower), elbow);
  aimBone(lower, at(hand), wrist);
}

// Turns `b` (about its own origin) so the point `from` moves toward `to`.
function aimBone(b, from, to) {
  const origin = b.getWorldPosition(new THREE.Vector3());
  const turn = new THREE.Quaternion().setFromUnitVectors(
    from.clone().sub(origin).normalize(), to.clone().sub(origin).normalize());
  const parentQ = b.parent.getWorldQuaternion(new THREE.Quaternion());
  const worldQ = b.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(parentQ.invert().multiply(turn.multiply(worldQ)));
  b.updateMatrixWorld(true);
}
