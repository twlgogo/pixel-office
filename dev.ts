// dev.ts — 开发启动脚本，依次启动后端和前端
import { spawn } from 'child_process';

// 启动后端
const backend = spawn('npx', ['tsx', 'src/server/index.ts'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
});

// 等后端启动后再启动前端
setTimeout(() => {
  const frontend = spawn('npx', ['vite', '--host'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });

  frontend.on('exit', (code) => {
    console.log(`前端进程退出，code: ${code}`);
    backend.kill();
    process.exit(code || 0);
  });
}, 2000);

backend.on('exit', (code) => {
  console.log(`后端进程退出，code: ${code}`);
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  backend.kill();
  process.exit(0);
});
