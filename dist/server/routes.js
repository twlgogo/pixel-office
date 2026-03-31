"use strict";
/**
 * API 路由模块
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutes = createRoutes;
const express_1 = require("express");
function createRoutes(agentEngine, gatewayClient) {
    const router = (0, express_1.Router)();
    /**
     * GET /api/agents
     * 返回 Agent 状态列表
     */
    router.get('/agents', (_req, res) => {
        const agents = agentEngine.getAgents();
        res.json({ agents });
    });
    /**
     * GET /api/agents/:id/history
     * 获取指定 Agent 的聊天历史
     */
    router.get('/agents/:id/history', async (req, res) => {
        const { id } = req.params;
        try {
            const messages = await gatewayClient.getChatHistory(id, 30);
            res.json({ messages });
        }
        catch (error) {
            console.error('[Routes] 获取历史失败:', error);
            res.json({ messages: [] });
        }
    });
    /**
     * POST /api/agents/:id/message
     * 向指定 Agent 发消息
     */
    router.post('/agents/:id/message', async (req, res) => {
        const { id } = req.params;
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            res.status(400).json({ error: 'message is required' });
            return;
        }
        try {
            const result = await gatewayClient.sendMessage(id, message);
            if (result.success) {
                res.json({
                    success: true,
                    note: '消息已发送',
                    output: result.output,
                });
            }
            else {
                res.json({
                    success: false,
                    note: result.error || '消息发送失败',
                });
            }
        }
        catch (error) {
            console.error('[Routes] 消息发送异常:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return router;
}
