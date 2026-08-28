// Placeholder scaffold. No framework/transport decisions made yet —
// this just proves out the directory and gives GMScreen a runnable entry
// point to build on once the client/server protocol is designed.
const http = require('http');

const PORT = process.env.GMSCREEN_PORT || 4177;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', app: 'GMScreen', version: require('../package.json').version }));
});

server.listen(PORT, () => {
  console.log(`GMScreen scaffold listening on http://localhost:${PORT}`);
});
