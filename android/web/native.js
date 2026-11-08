// The page's side of the native bridge (MainActivity.Bridge, window.CodAndroid).
// Every call is async: native(method, args) resolves with whatever the app
// sends back to window.__codAndroid.resolve(id, json). Unprompted events
// (GMScreen found/lost) arrive at window.__codAndroid.emit(name, json).

const pending = new Map();
const listeners = new Map();
let nextId = 0;

window.__codAndroid = {
  resolve(id, json) {
    const done = pending.get(id);
    if (!done) return;
    pending.delete(id);
    done(JSON.parse(json));
  },

  emit(event, json) {
    const data = JSON.parse(json);
    (listeners.get(event) || []).forEach((fn) => fn(data));
  },

  // The Back key: close whatever popup is open and report that it was
  // handled; false lets the app close. Popups close the way their own
  // Escape handlers do (or their close button, for ones without one).
  back() {
    const open = [...document.querySelectorAll('.modal-overlay:not(.hidden), .android-overlay')].pop();
    if (!open) return false;
    const close = open.querySelector('.modal-close, .android-overlay-close');
    if (close) close.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }
};

export function native(method, args = {}) {
  return new Promise((resolve) => {
    const id = String(++nextId);
    pending.set(id, resolve);
    window.CodAndroid.call(id, method, JSON.stringify(args));
  });
}

// Returns a function that removes the listener.
export function onNative(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
  return () => listeners.set(event, listeners.get(event).filter((f) => f !== fn));
}
