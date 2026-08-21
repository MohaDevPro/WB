import { spawn, spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const build = spawnSync(pnpm, ['exec', 'tsc', '-p', 'tsconfig.build.json'], { stdio: 'inherit' });

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const compiler = spawn(pnpm, ['exec', 'tsc', '--watch', '-p', 'tsconfig.build.json', '--preserveWatchOutput'], { stdio: 'inherit' });
const server = spawn(process.execPath, ['--watch', 'dist/main.js'], { stdio: 'inherit' });

function shutdown(signal) {
  compiler.kill(signal);
  server.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
server.on('exit', (code, signal) => {
  compiler.kill(signal ?? 'SIGTERM');
  process.exit(code ?? 1);
});
