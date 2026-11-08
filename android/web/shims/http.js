// Stands in for Node's 'http' in the Android bundle: the slice of
// http.request() that gmscreen-client.js's requestJson() uses, carried out
// by the app (MainActivity.http) - a page fetch() would be blocked, see there.
import { native } from '../native.js';
import { EventEmitter } from './events.js';

export function request(options, onResponse) {
  const req = new EventEmitter();
  let body = '';
  let finished = false;

  req.write = (chunk) => {
    body += chunk;
  };

  req.destroy = (err) => {
    if (finished) return;
    finished = true;
    req.emit('error', err || new Error('Request aborted'));
  };

  // Timeouts are enforced natively (timeoutMs), and surface as an 'error'.
  req.end = () => {
    native('http', {
      host: options.host,
      port: options.port,
      method: options.method || 'GET',
      path: options.path || '/',
      headers: options.headers || {},
      body: body || null,
      timeoutMs: options.timeout || 5000
    }).then((result) => {
      if (finished) return;
      finished = true;
      if (result.error) {
        req.emit('error', new Error(result.error));
        return;
      }
      const res = new EventEmitter();
      res.statusCode = result.status;
      onResponse(res);
      if (result.body) res.emit('data', result.body);
      res.emit('end');
    });
  };

  return req;
}

export default { request };
