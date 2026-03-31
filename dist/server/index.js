"use strict";
/**
 * 服务器入口文件
 * Express + WebSocket 服务器
 * 支持开发模式（Vite proxy）和生产模式（静态文件）
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const path = __importStar(require("path"));
const config_1 = require("./config");
const gateway_1 = require("./gateway");
const agent_engine_1 = require("./agent-engine");
const db_1 = require("./db");
const routes_1 = require("./routes");
async function main() {
    // 创建 Express 应用
    const app = (0, express_1.default)();
    const server = (0, http_1.createServer)(app);
    // 请求日志中间件
    app.use((req, _res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
    // JSON 解析中间件
    app.use(express_1.default.json());
    // 初始化数据库（sql.js 需要异步初始化）
    await (0, db_1.initDatabase)();
    // 创建 WebSocket 服务器（与 Express 共用同一端口）
    const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
    const clients = new Set();
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
            }
            catch (e) {
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
    function broadcast(event) {
        const data = JSON.stringify(event);
        clients.forEach((ws) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(data);
            }
        });
    }
    // 创建 Gateway 客户端（WS RPC 模式）
    const gatewayClient = new gateway_1.GatewayClientWrapper();
    // 创建 Agent 引擎
    const agentEngine = new agent_engine_1.AgentEngine(gatewayClient);
    // API 路由
    const routes = (0, routes_1.createRoutes)(agentEngine, gatewayClient);
    app.use('/api', routes);
    // 健康检查
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', nodeEnv: config_1.config.nodeEnv });
    });
    // 生产模式：serve 前端构建产物
    const isProduction = config_1.config.nodeEnv === 'production';
    if (isProduction) {
        const publicPath = path.join(__dirname, 'public');
        app.use(express_1.default.static(publicPath));
        // 所有未匹配的路由都返回 index.html（SPA 路由支持）
        app.get('*', (_req, res) => {
            res.sendFile(path.join(publicPath, 'index.html'));
        });
        console.log('[Server] 生产模式：启用静态文件服务');
    }
    else {
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
    setInterval(db_1.saveDatabase, 30000);
    // 优雅关闭函数
    function gracefulShutdown(signal) {
        console.log(`\n[Server] 收到 ${signal}，正在关闭...`);
        gatewayClient.disconnect();
        agentEngine.stop();
        (0, db_1.saveDatabase)();
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
    app.use((err, _req, res, _next) => {
        console.error('[Server] 未处理错误:', err.message);
        console.error(err.stack);
        res.status(500).json({ error: 'Internal server error' });
    });
    // 启动服务器
    server.listen(config_1.config.server.port, () => {
        console.log(`[Server] Pixel Office 服务器启动，端口: ${config_1.config.server.port}`);
        console.log(`[Server] Gateway 地址: ${config_1.config.gateway.url}`);
        console.log(`[Server] 轮询间隔: ${config_1.config.pollInterval}ms`);
        console.log(`[Server] WebSocket 路径: ws://localhost:${config_1.config.server.port}/ws`);
    });
}
main().catch((err) => {
    console.error('[Server] 启动失败:', err);
    process.exit(1);
});
