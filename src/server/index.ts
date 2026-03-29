/**
 * 服务器入口文件
 * Express + WebSocket 服务器
 * 支持开发模式（Vite proxy）和生产模式（静态文件）
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import * as path from 'path';
import { config } from './config';
import { GatewayClientWrapper } from './gateway';
import { AgentEngine } from './agent-engine';
import { initDatabase, saveDatabase } from './db';
import { createRoutes } from './routes';

async function main() {
  // 创建 Express 应用
  const app = express();
  const server = createServer(app);

  // 请求日志中间件
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // JSON 解析中间件
  app.use(express.json());

  // 初始化数据库（sql.js 需要异步初始化）
  await initDatabase();

  // 创建 WebSocket 服务器（与 Express 共用同一端口）
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<any>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[WS] 客户端已连接');

    // 心跳
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        // 忽略格式错误的消息
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      clearInterval(heartbeat);
      console.log('[WS] 客户端已断开');
    });
  });

  // 广播函数
  function broadcast(event: any) {
    const data = JSON.stringify(event);
    clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });
  }

  // 创建 Gateway 客户端（WS RPC 模式）
  const gatewayClient = new GatewayClientWrapper();

  // 创建 Agent 引擎
  const agentEngine = new AgentEngine(gatewayClient);

  // API 路由
  const routes = createRoutes(agentEngine, gatewayClient);
  app.use('/api', routes);

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', nodeEnv: config.nodeEnv });
  });

  // 生产模式：serve 前端构建产物
  const isProduction = config.nodeEnv === 'production';
  if (isProduction) {
    const publicPath = path.join(__dirname, 'public');
    app.use(express.static(publicPath));
    // 所有未匹配的路由都返回 index.html（SPA 路由支持）
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
    console.log('[Server] 生产模式：启用静态文件服务');
  } else {
    // 开发模式提示
    console.log('[Server] 开发模式：静态文件由 Vite 提供');
  }

  // 启动 Gateway 连接（WS RPC）
  await gatewayClient.connect();

  // 启动 Agent 引擎（session 列表轮询）
  agentEngine.start((agents) => {
    broadcast({ type: 'agent:list', agents });
  });

  // 启动 session 列表轮询
  gatewayClient.startPolling((sessions) => {
    const agents = agentEngine.inferAgentState(sessions);
    broadcast({ type: 'agent:list', agents });
  });

  // 启动消息轮询（检测 Agent 新活动）
  gatewayClient.startMessagePolling((sessionKey) => {
    broadcast({ type: 'agent:activity', sessionKey });
  });

  // 定期保存数据库（每 30 秒）
  setInterval(saveDatabase, 30000);

  // 优雅关闭函数
  function gracefulShutdown(signal: string) {
    console.log(`\n[Server] 收到 ${signal}，正在关闭...`);
    gatewayClient.disconnect();
    agentEngine.stop();
    saveDatabase();

    // 关闭 WebSocket 连接
    wss.clients.forEach((ws) => {
      ws.close();
    });
    wss.close();

    server.close(() => {
      console.log('[Server] 服务器已关闭');
      process.exit(0);
    });

    // 30 秒后强制退出
    setTimeout(() => {
      console.error('[Server] 强制退出（超时）');
      process.exit(1);
    }, 30000);
  }

  // 注册关闭信号处理
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // 全局错误处理中间件
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] 未处理错误:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  // 启动服务器
  server.listen(config.server.port, () => {
    console.log(`[Server] Pixel Office 服务器启动，端口: ${config.server.port}`);
    console.log(`[Server] Gateway 地址: ${config.gateway.url}`);
    console.log(`[Server] 轮询间隔: ${config.pollInterval}ms`);
    console.log(`[Server] WebSocket 路径: ws://localhost:${config.server.port}/ws`);
  });
}

main().catch((err) => {
  console.error('[Server] 启动失败:', err);
  process.exit(1);
});
