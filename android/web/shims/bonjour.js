// Stands in for 'bonjour-service' in the Android bundle. Discovery is done by
// the app (GmDiscovery.kt, Android's NsdManager); this turns its gm-up /
// gm-down events back into the service objects gmscreen-client.js expects
// from a Bonjour browser.
import { native, onNative } from '../native.js';
import { EventEmitter } from './events.js';

export class Bonjour {
  find() {
    const browser = new EventEmitter();
    const offUp = onNative('gm-up', (s) => {
      browser.emit('up', { name: s.name, txt: { id: s.id, name: s.name }, addresses: [s.host], port: s.port });
    });
    const offDown = onNative('gm-down', (s) => browser.emit('down', { txt: { id: s.id } }));
    native('startDiscovery');
    browser.stop = () => {
      offUp();
      offDown();
      native('stopDiscovery');
    };
    return browser;
  }

  destroy() {}
}

export default { Bonjour };
