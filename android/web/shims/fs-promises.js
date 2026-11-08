// Stands in for Node's 'fs/promises' in the Android bundle. The desktop app
// keeps its GM pairings and chronicles in small JSON files in its data
// folder; here each "file" is a localStorage entry in the app's own storage
// (kept until the app is uninstalled or its data cleared).
const PREFIX = 'cod.file:';

export async function readFile(path) {
  const value = localStorage.getItem(PREFIX + path);
  if (value === null) {
    const err = new Error(`ENOENT: no such file, open '${path}'`);
    err.code = 'ENOENT';
    throw err;
  }
  return value;
}

export async function writeFile(path, data) {
  localStorage.setItem(PREFIX + path, String(data));
}

export default { readFile, writeFile };
