// 3D avatar viewer: renders one parts-assembled avatar (see avatar-parts.js)
// in a container, with drag-to-orbit, wheel zoom, and a slow turntable spin
// when idle.
//
// SHARED FILE: identical copies of this and avatar-parts.js live in
// gmscreen/src/js/. The two apps are packaged separately with no shared
// module boundary (same reason character-view.js is a hand-kept copy), so
// edit both together.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAvatar } from './avatar-parts.js';

const MODEL_HEIGHT = 2; // the figure is normalized to this many scene units tall
const IDLE_RESUME_SPIN_MS = 3000;

// Frees only what one build created (flagged by avatar-parts.js). Template
// geometry and textures are shared through its cache - by every figure in
// every viewer, e.g. all of GMScreen's roster cards - so they're never
// disposed here.
function disposeObject(root) {
  root.traverse((node) => {
    if (node.geometry && node.geometry.userData.ownGeometry) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    materials.forEach((m) => m.userData.ownMaterial && m.dispose());
  });
}

export class AvatarViewer {
  constructor(container, { autoRotate = true } = {}) {
    this.container = container;
    this.model = null;
    this._buildSeq = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.className = 'avatar-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Reflection map for the chrome (morphed) materials only. Metal with
    // nothing to reflect renders near-black; skin and cloth keep the plain
    // lighting below.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3328, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.5, 4, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1dd, 1.2);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim);

    // Soft contact shadow so the figure reads as standing on something
    // rather than floating in the panel.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    this.shadow = shadow;
    this.scene.add(shadow);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.autoRotate = autoRotate;
    this.controls.autoRotateSpeed = 1.2;
    this._spinEnabled = autoRotate;
    this.controls.addEventListener('start', () => {
      clearTimeout(this._resumeTimer);
      this.controls.autoRotate = false;
    });
    this.controls.addEventListener('end', () => {
      if (!this._spinEnabled) return;
      this._resumeTimer = setTimeout(() => { this.controls.autoRotate = true; }, IDLE_RESUME_SPIN_MS);
    });

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(container);
    this._resize();
    this._frame(new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, MODEL_HEIGHT, 0.5)));

    // Rendering keeps going every frame for the damping/turntable, but is
    // skipped entirely while the container isn't on screen (a hidden tab,
    // a collapsed panel) - several of these can exist at once on GMScreen's
    // roster, and none of them should burn GPU when nobody can see them.
    this.renderer.setAnimationLoop(() => {
      if (!this.container.isConnected || this.container.offsetParent === null) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  _resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this._lastBox) this._frame(this._lastBox);
  }

  // Point the camera so the whole model fits with some margin, looking
  // slightly down at it from the front.
  _frame(box) {
    this._lastBox = box;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fitHeight = (size.y / 2) / Math.tan(vFov / 2);
    const fitWidth = (Math.max(size.x, size.z) / 2) / Math.tan(hFov / 2);
    const distance = Math.max(fitHeight, fitWidth) * 1.08 + Math.max(size.x, size.z) / 2;

    this.controls.target.copy(center);
    this.camera.position.set(center.x, center.y + size.y * 0.12, center.z + distance);
    this.camera.near = distance / 100;
    this.camera.far = distance * 10;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = distance * 0.35;
    this.controls.maxDistance = distance * 3;
    this.controls.update();
  }

  // Rebuilds the figure from a descriptor ({ gender, style, colors, parts }).
  // The first build loads the body templates; after that a rebuild is quick
  // enough to do on every change, including live while a color picker is
  // being dragged. Builds can overlap, so only the newest one is shown.
  async setAvatar(descriptor) {
    const seq = ++this._buildSeq;
    const figure = await buildAvatar(descriptor);
    if (seq !== this._buildSeq) {
      disposeObject(figure); // superseded (or cleared) while it was building
      return;
    }
    // Always drawn in full, so skip per-mesh frustum culling (a skinned
    // mesh's bounds are computed in the pose it was first seen in).
    let sizer = figure;
    figure.traverse((n) => {
      n.frustumCulled = false;
      if (n.userData.avatarBody) sizer = n;
      const materials = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
      materials.forEach((m) => { if (m.userData.chrome) m.envMap = this.envMap; });
    });
    this._removeModel();

    // Normalize: the BODY is MODEL_HEIGHT tall (so a tall hairstyle doesn't
    // shrink the character), centred on the turntable axis, feet on the
    // ground.
    const wrapper = new THREE.Group();
    wrapper.add(figure);
    let box = new THREE.Box3().setFromObject(sizer);
    const size = box.getSize(new THREE.Vector3());
    figure.scale.multiplyScalar(MODEL_HEIGHT / Math.max(size.y, 1e-6));
    box = new THREE.Box3().setFromObject(sizer);
    const center = box.getCenter(new THREE.Vector3());
    figure.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    box = new THREE.Box3().setFromObject(wrapper);

    const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    this.shadow.scale.setScalar(Math.max(footprint * 0.75, 0.4));

    this.model = wrapper;
    this.scene.add(wrapper);
    // Keep the camera where the user left it when only a part or color
    // changed; frame afresh on the first build.
    if (!this._framedOnce) {
      this._frame(box);
      this._framedOnce = true;
    }
  }

  setAutoRotate(enabled) {
    this._spinEnabled = enabled;
    this.controls.autoRotate = enabled;
  }

  clear() {
    this._buildSeq++; // a build still in flight must not appear after a clear
    this._removeModel();
  }

  _removeModel() {
    if (!this.model) return;
    this.scene.remove(this.model);
    disposeObject(this.model);
    this.model = null;
  }

  dispose() {
    clearTimeout(this._resumeTimer);
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this.clear();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.envMap.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
