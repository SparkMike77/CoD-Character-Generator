// Generates the built-in avatar models shipped in src/assets/avatars/.
//
// These are deliberately plain, original placeholder figures built from
// three.js primitives - not downloaded or third-party models - so there's
// no licensing question about redistributing them. Players are expected to
// import their own STL/OBJ/GLB models for anything nicer.
//
// Modeled Y-up (three.js convention) then rotated to Z-up before export,
// because that's how STLs from CAD tools / printing sites are almost always
// oriented - so built-ins exercise exactly the same "STL is Z-up" path in
// the viewer as a player's imported file does.
//
// Usage: node scripts/generate-avatar-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'avatars');

function part(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const mesh = new THREE.Mesh(geometry);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

function base() {
  return part(new THREE.CylinderGeometry(22, 24, 4, 48), { y: 2 });
}

function standingFigure() {
  const g = new THREE.Group();
  g.add(base());
  // legs
  g.add(part(new THREE.CapsuleGeometry(4.2, 30, 6, 16), { x: -5.5, y: 22 }));
  g.add(part(new THREE.CapsuleGeometry(4.2, 30, 6, 16), { x: 5.5, y: 22 }));
  // torso + shoulders
  g.add(part(new THREE.CylinderGeometry(11, 9, 30, 24), { y: 52 }));
  g.add(part(new THREE.CapsuleGeometry(5, 18, 6, 16), { y: 66, rz: Math.PI / 2 }));
  // arms, slightly angled away from the body
  g.add(part(new THREE.CapsuleGeometry(3.4, 26, 6, 16), { x: -14.5, y: 50, rz: -0.12 }));
  g.add(part(new THREE.CapsuleGeometry(3.4, 26, 6, 16), { x: 14.5, y: 50, rz: 0.12 }));
  // neck + head
  g.add(part(new THREE.CylinderGeometry(3.5, 4, 6, 16), { y: 71 }));
  g.add(part(new THREE.SphereGeometry(8.5, 32, 24), { y: 81 }));
  return g;
}

function cloakedFigure() {
  const g = new THREE.Group();
  g.add(base());
  // cloak: a long flared lathe profile, wide at the hem
  const cloakProfile = [
    [19, 4], [18, 12], [15.5, 30], [12.5, 50], [11, 62], [8, 68], [0, 70]
  ].map(([r, h]) => new THREE.Vector2(r, h));
  g.add(part(new THREE.LatheGeometry(cloakProfile, 48)));
  // hood: an open shell around the head, pulled slightly forward
  g.add(part(new THREE.SphereGeometry(11, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.72), { y: 76, z: 1.5, rx: -0.35 }));
  g.add(part(new THREE.SphereGeometry(7.5, 32, 24), { y: 75.5, z: 3 }));
  return g;
}

function bust() {
  const g = new THREE.Group();
  // plinth
  g.add(part(new THREE.CylinderGeometry(16, 19, 10, 48), { y: 5 }));
  g.add(part(new THREE.CylinderGeometry(13, 16, 4, 48), { y: 12 }));
  // chest + shoulders, flattened front-to-back
  const chest = part(new THREE.SphereGeometry(22, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), { y: 14 });
  chest.scale.set(1, 1.05, 0.62);
  g.add(chest);
  g.add(part(new THREE.CylinderGeometry(6, 7.5, 12, 24), { y: 40 }));
  const head = part(new THREE.SphereGeometry(12, 40, 30), { y: 54 });
  head.scale.set(0.92, 1.12, 1);
  g.add(head);
  return g;
}

function pawn() {
  const g = new THREE.Group();
  const profile = [
    [0, 0], [21, 0], [21, 4], [18, 6], [17, 10], [12, 13], [9, 22], [7.5, 38], [13, 41], [13, 44],
    [7, 46], [10.5, 53], [12, 60], [10.5, 67], [6, 72], [0, 73.5]
  ].map(([r, h]) => new THREE.Vector2(r, h));
  g.add(part(new THREE.LatheGeometry(profile, 56)));
  return g;
}

const MODELS = [
  { file: 'standing-figure.stl', name: 'Standing Figure', build: standingFigure },
  { file: 'cloaked-figure.stl', name: 'Cloaked Figure', build: cloakedFigure },
  { file: 'bust.stl', name: 'Bust', build: bust },
  { file: 'pawn.stl', name: 'Pawn', build: pawn }
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const exporter = new STLExporter();

for (const model of MODELS) {
  const zUp = new THREE.Group();
  zUp.rotation.x = Math.PI / 2; // Y-up -> Z-up
  zUp.add(model.build());
  zUp.updateMatrixWorld(true);

  const view = exporter.parse(zUp, { binary: true });
  const bytes = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  fs.writeFileSync(path.join(OUT_DIR, model.file), bytes);
  console.log(`${model.file}: ${(bytes.length / 1024).toFixed(0)} KB`);
}

fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  JSON.stringify(MODELS.map(({ file, name }) => ({ file, name })), null, 2) + '\n'
);
console.log(`Wrote ${MODELS.length} models + index.json to ${OUT_DIR}`);
