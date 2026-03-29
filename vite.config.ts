/**
 * Vite 配置文件
 */

import { defineConfig } from 'vite';
import * as path from 'path';

export default defineConfig({
  root: './src/client',
  build: {
    // 前端构建产物输出到 server/public 目录
    // 生产模式下 Express 会 serve 这个目录
    outDir: path.resolve(__dirname, 'dist/server/public'),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:3456',
        ws: true,
      },
    },
  },
});
