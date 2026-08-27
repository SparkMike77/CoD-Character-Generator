// Launches Electron directly instead of via `electron .`, because a plain
// `electron` invocation inherits ELECTRON_RUN_AS_NODE from the parent shell
// when run inside VS Code's integrated terminal (VS Code sets it for its own
// child-process bookkeeping). With that var set, Electron just runs main.js
// as plain Node instead of bootstrapping the app, which crashes on
// `app.whenReady()` being undefined. Clearing it here, in a plain Node
// process (not Electron's), fixes that for any terminal it's launched from.
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
