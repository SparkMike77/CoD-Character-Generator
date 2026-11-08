// Stands in for Node's 'events' in the Android bundle: just the part of
// EventEmitter that gmscreen-client.js and the other shims use.
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
    return this;
  }

  off(event, fn) {
    const list = this._listeners.get(event);
    if (list) this._listeners.set(event, list.filter((f) => f !== fn));
    return this;
  }

  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list || !list.length) return false;
    [...list].forEach((fn) => fn(...args));
    return true;
  }
}

export default { EventEmitter };
