// Stands in for Node's 'crypto' (randomUUID) and the global Buffer
// (byteLength) in the Android bundle. Injected by esbuild where the shared
// code refers to Buffer; 'crypto' is aliased here.
export const Buffer = {
  byteLength: (text) => new TextEncoder().encode(String(text)).length
};

export const randomUUID = () => globalThis.crypto.randomUUID();

export default { randomUUID };
