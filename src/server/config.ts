/**
 * 配置文件模块
 * 从环境变量读取配置，支持 .env 文件
 */

import * as fs from 'fs';
import * as path from 'path';

// 尝试加载 .env 文件（仅在非生产环境）
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          const value = trimmed.substring(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

export interface Config {
  gateway: {
    url: string;
  };
  gatewayUrl: string;
  gatewayToken: string;
  server: {
    port: number;
  };
  pollInterval: number;
  nodeEnv: string;
}

const defaultConfig: Config = {
  gateway: {
    url: process.env.GATEWAY_URL || 'ws://127.0.0.1:18789',
  },
  gatewayUrl: process.env.GATEWAY_URL || 'ws://127.0.0.1:18789',
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  server: {
    port: parseInt(process.env.PORT || '3456', 10),
  },
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};

export const config: Config = defaultConfig;
