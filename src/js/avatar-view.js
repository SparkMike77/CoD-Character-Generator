// 3D avatar viewer: renders one STL / OBJ / GLB model in a container, with
// drag-to-orbit, wheel zoom, and a slow turntable spin when idle.
//
// SHARED FILE: an identical copy lives at gmscreen/src/js/avatar-view.js.
// The two apps are packaged separately with no shared module boundary (same
// reason character-view.js is a hand-kept copy), so edit both together.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_HEIGHT = 2; // every model is normalized to this many scene units tall
const IDLE_RESUME_SPIN_MS = 3000;
const DEFAULT_COLOR = '#b9a68d';

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  // Uint8Array / Node Buffer arriving over IPC: copy out exactly its bytes,
  // since its underlying buffer may be a larger shared pool.
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function disposeObject(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    materials.forEach((m) => {
      Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
      m.dispose();
    });
  });
}

export class AvatarViewer {
  constructor(container, { autoRotate = true } = {}) {
    this.container = container;
    this.model = null;
    this.tintMaterial = new THREE.MeshStandardMaterial({ color: DEFAULT_COLOR, roughness: 0.55, metalness: 0.05 });
    this.tintable = true;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.className = 'avatar-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
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

  async _parse(format, data) {
    if (format === 'stl') {
      const geometry = new STLLoader().parse(toArrayBuffer(data));
      // STLs from CAD tools and printing sites are almost universally Z-up;
      // three.js is Y-up.
      geometry.rotateX(-Math.PI / 2);
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      return new THREE.Mesh(geometry, this.tintMaterial);
    }
    if (format === 'obj') {
      const group = new OBJLoader().parse(new TextDecoder().decode(toArrayBuffer(data)));
      // OBJs imported on their own have no material library, so give every
      // part the tintable material rather than OBJLoader's grey default.
      group.traverse((node) => {
        if (node.isMesh) {
          if (node.material) [].concat(node.material).forEach((m) => m.dispose());
          node.material = this.tintMaterial;
        }
      });
      return group;
    }
    if (format === 'glb') {
      const gltf = await new GLTFLoader().parseAsync(toArrayBuffer(data), '');
      return gltf.scene;
    }
    throw new Error(`Unsupported model format "${format}"`);
  }

  // data: ArrayBuffer | Uint8Array of the model file's bytes.
  async setModel({ format, data }) {
    const object = await this._parse(format, data);
    this.clear();

    // Normalize: MODEL_HEIGHT tall, centred on the turntable axis, feet on
    // the ground - imported models arrive in wildly different units/origins.
    const wrapper = new THREE.Group();
    wrapper.add(object);
    let box = new THREE.Box3().setFromObject(wrapper);
    const size = box.getSize(new THREE.Vector3());
    const scale = MODEL_HEIGHT / Math.max(size.y, size.x * 0.6, size.z * 0.6, 1e-6);
    object.scale.multiplyScalar(scale);
    box = new THREE.Box3().setFromObject(wrapper);
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    box = new THREE.Box3().setFromObject(wrapper);

    const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    this.shadow.scale.setScalar(Math.max(footprint * 0.75, 0.4));

    this.model = wrapper;
    this.tintable = format !== 'glb';
    this.scene.add(wrapper);
    this._frame(box);
  }

  // Applies to STL/OBJ only - GLB models keep their own materials/textures.
  setColor(hex) {
    this.tintMaterial.color.set(hex || DEFAULT_COLOR);
  }

  setAutoRotate(enabled) {
    this._spinEnabled = enabled;
    this.controls.autoRotate = enabled;
  }

  clear() {
    if (!this.model) return;
    this.scene.remove(this.model);
    // The shared tint material outlives any one model; dispose everything
    // else the old model owned (its geometry, and a GLB's own materials).
    this.model.traverse((node) => {
      if (node.material === this.tintMaterial) node.material = null;
    });
    disposeObject(this.model);
    this.model = null;
  }

  dispose() {
    clearTimeout(this._resumeTimer);
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this.clear();
    this.tintMaterial.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
