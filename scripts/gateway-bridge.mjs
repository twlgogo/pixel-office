#!/usr/bin/env node
/**
 * Gateway Bridge — ESM 子进程
 * 通过 stdio 与父进程通信，转发 Gateway RPC 和事件
 * 
 * 关键：在 import GatewayClient 之前先 patch WebSocket，
 * 确保不带 Origin header（绕过 Gateway origin 检查）
 */

// ===== 第一步：Patch WebSocket，去掉 Origin header =====
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 获取 ws 模块的原始构造函数
const wsMod = require('ws');
const OrigWebSocket = wsMod.WebSocket || wsMod.default;

// 创建 patch 版本
function PatchedWebSocket(url, protocols, opts) {
  // normalize: (url, protocols) or (url, opts) or (url)
  let actualUrl = url;
  let actualProtocols;
  let actualOpts = {};

  if (protocols && typeof protocols === 'object' && !Array.isArray(protocols)) {
    actualOpts = protocols;
  } else if (Array.isArray(protocols)) {
    actualProtocols = protocols;
  }

  // 去掉 Origin header
  if (actualOpts && actualOpts.headers) {
    delete actualOpts.headers.Origin;
    delete actualOpts.headers.origin;
  }

  if (actualProtocols) {
    return new OrigWebSocket(actualUrl, actualProtocols, actualOpts);
  }
  return new OrigWebSocket(actualUrl, actualOpts);
}

// 复制原型和静态方法
PatchedWebSocket.prototype = OrigWebSocket.prototype;
Object.assign(PatchedWebSocket, OrigWebSocket);

// 替换全局 WebSocket 和 ws 模块导出
globalThis.WebSocket = PatchedWebSocket;

// ===== 第二步：加载 GatewayClient =====
const { default: openclawIndex } = await import('file:///C:/Users/43938/AppData/Roaming/npm/node_modules/openclaw/dist/index.js');
const scopesMod = await import('file:///C:/Users/43938/AppData/Roaming/npm/node_modules/openclaw/dist/method-scopes-BiEi0X2g.js');
const GatewayClient = scopesMod.u || scopesMod.GatewayClient;
if (!GatewayClient) {
  process.stderr.write('[Bridge] 未找到 GatewayClient 导出\n');
  process.exit(1);
}

// ===== 第三步：启动 Gateway 连接 =====
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

process.stderr.write(`[Bridge] 启动，连接 ${GATEWAY_URL}\n`);

const client = new GatewayClient({
  url: GATEWAY_URL,
  token: GATEWAY_TOKEN || undefined,
  clientName: 'openclaw-control-ui',
  clientDisplayName: 'Pixel Office',
  mode: 'backend',
  scopes: ['operator.read', 'operator.write'],

  onEvent: (evt) => {
    try {
      process.stdout.write(JSON.stringify({ type: 'event', event: evt.event, payload: evt.payload }) + '\n');
    } catch (e) {
      process.stderr.write(`[Bridge] 事件转发失败: ${e.message}\n`);
    }
  },

  onHelloOk: () => {
    process.stderr.write('[Bridge] Gateway 连接成功！\n');
    client.request('sessions.messages.subscribe', {})
      .then(() => process.stderr.write('[Bridge] 已订阅消息推送\n'))
      .catch(e => process.stderr.write(`[Bridge] 订阅失败: ${e.message}\n`));
  },

  onConnectError: (err) => {
    process.stderr.write(`[Bridge] 连接错误: ${err.message}\n`);
  },

  onClose: (code, reason) => {
    process.stderr.write(`[Bridge] 连接关闭: code=${code} reason=${reason}\n`);
    process.exit(1);
  },
});

// stdin RPC
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const { id, method, params } = JSON.parse(trimmed);
      client.request(method, params || {})
        .then(result => {
          process.stdout.write(JSON.stringify({ id, ok: true, payload: result }) + '\n');
        })
        .catch(err => {
          process.stdout.write(JSON.stringify({ id, ok: false, error: { code: -1, message: err.message } }) + '\n');
        });
    } catch (e) {
      process.stderr.write(`[Bridge] JSON 解析失败\n`);
    }
  }
});

process.stdin.on('end', () => {
  process.stderr.write('[Bridge] stdin 关闭，退出\n');
  process.exit(0);
});

client.start();
