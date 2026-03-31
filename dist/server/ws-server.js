"use strict";
/**
 * WebSocket 服务器模块
 * 管理 WebSocket 连接列表，心跳检测
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSServer = void 0;
const ws_1 = require("ws");
class WSServer {
    wss;
    clients = new Set();
    heartbeatInterval = null;
    constructor(port) {
        this.wss = new ws_1.WebSocketServer({ port });
        this.setupConnectionHandler();
        this.startHeartbeat();
        console.log(`[WSServer] WebSocket 服务器启动，端口: ${port}`);
    }
    /**
     * 设置连接处理
     */
    setupConnectionHandler() {
        this.wss.on('connection', (ws, req) => {
            console.log(`[WSServer] 新的 WebSocket 连接: ${req.socket.remoteAddress}`);
            this.clients.add(ws);
            // 处理客户端消息
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(ws, message);
                }
                catch (error) {
                    console.error('[WSServer] 消息解析失败:', error);
                }
            });
            // 处理连接关闭
            ws.on('close', () => {
                console.log(`[WSServer] WebSocket 连接关闭`);
                this.clients.delete(ws);
            });
            // 处理错误
            ws.on('error', (error) => {
                console.error('[WSServer] WebSocket 错误:', error);
                this.clients.delete(ws);
            });
        });
    }
    /**
     * 处理客户端消息
     */
    handleMessage(ws, message) {
        switch (message.type) {
            case 'ping':
                // 客户端发送 ping，服务端回复 pong
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            default:
                console.log(`[WSServer] 收到未知消息类型: ${message.type}`);
        }
    }
    /**
     * 广播消息给所有客户端
     */
    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    /**
     * 启动心跳检测
     * 每 30 秒检测一次连接状态
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.clients.forEach((client) => {
                if (client.readyState === ws_1.WebSocket.OPEN) {
                    // 发送心跳 ping
                    client.ping();
                }
                else {
                    // 连接已关闭，移除
                    this.clients.delete(client);
                }
            });
        }, 30000);
    }
    /**
     * 停止服务器
     */
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.wss.close();
        console.log('[WSServer] WebSocket 服务器已停止');
    }
}
exports.WSServer = WSServer;
