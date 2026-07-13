import { spawn } from 'node:child_process';
import process from 'node:process';

const extraArgs = process.argv.slice(2);
const server = spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', ...extraArgs], { stdio: 'inherit' });

let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  server.kill('SIGTERM');
  vite.kill('SIGTERM');
  setTimeout(() => process.exit(code), 120);
}

server.on('exit', (code) => close(code ?? 0));
vite.on('exit', (code) => close(code ?? 0));
process.on('SIGINT', () => close(0));
process.on('SIGTERM', () => close(0));
