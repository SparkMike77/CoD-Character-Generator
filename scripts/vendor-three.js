// Copies the three.js files the avatar viewer actually loads into
// <appDir>/src/vendor/three/, so the app serves them from its own src/
// folder rather than node_modules.
//
// Why not just load from node_modules: electron-builder silently strips any
// `examples/` folder inside node_modules from packaged builds (it treats
// them as demo code, and an explicit `files` include doesn't override it).
// three's OrbitControls (and loaders, if ever needed) live in
// three/examples/jsm/, so a packaged app would load the core and then fail
// on every addon import - while `npm start` worked fine. Vendoring sidesteps
// that entirely, and three only has to be a devDependency.
//
// Starts from the entry files below and follows their relative imports, so
// it copies only what's reachable (not three's whole 20 MB package), with
// three's directory layout preserved so those relative imports still
// resolve. The bare `'three'` import the addons use is mapped to the
// vendored core by the import map in index.html.
//
// Usage: node scripts/vendor-three.js [appDir]   (appDir defaults to cwd)
// Run automatically by `npm start` / `npm run dist` in both apps.
const fs = require('fs');
const path = require('path');

const ENTRIES = [
  'build/three.module.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/environments/RoomEnvironment.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/utils/SkeletonUtils.js'
];

const appDir = path.resolve(process.argv[2] || '.');
const threeRoot = path.join(appDir, 'node_modules', 'three');
const outRoot = path.join(appDir, 'src', 'vendor', 'three');

if (!fs.existsSync(path.join(threeRoot, 'package.json'))) {
  console.error(`vendor-three: three.js not installed at ${threeRoot} - run npm install first.`);
  process.exit(1);
}

// Static `import ... from './x.js'`, `export ... from './x.js'`, and
// `import './x.js'` - relative specifiers only; bare 'three' is the import map's job.
const RELATIVE_IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*['"](\.{1,2}\/[^'"]+)['"]/g;

fs.rmSync(outRoot, { recursive: true, force: true });

const seen = new Set();
const queue = [...ENTRIES];
while (queue.length) {
  const rel = queue.shift();
  if (seen.has(rel)) continue;
  seen.add(rel);

  const source = fs.readFileSync(path.join(threeRoot, rel), 'utf-8');
  const dest = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, source);

  for (const match of source.matchAll(RELATIVE_IMPORT_RE)) {
    const spec = match[1] || match[2];
    queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
  }
}

fs.copyFileSync(path.join(threeRoot, 'LICENSE'), path.join(outRoot, 'LICENSE'));
const version = JSON.parse(fs.readFileSync(path.join(threeRoot, 'package.json'), 'utf-8')).version;
console.log(`vendor-three: copied ${seen.size} files (three ${version}) to ${path.relative(process.cwd(), outRoot) || outRoot}`);
