"use strict";
/**
 * Agent 引擎模块
 * 从 CLI 轮询结果推断 Agent 状态
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentEngine = void 0;
const db_1 = require("./db");
/**
 * Agent 引擎类
 * 从 Gateway sessions 推断 Agent 状态
 */
class AgentEngine {
    gatewayClient;
    agents = new Map();
    callback = null;
    constructor(gatewayClient) {
        this.gatewayClient = gatewayClient;
    }
    /**
     * 从 sessions 推断 Agent 状态
     * Phase 3: 直接使用 session 中已有的 status（因为 GatewayClient 已处理）
     */
    inferAgentState(sessions) {
        return sessions.map((session) => {
            return {
                id: session.key,
                name: session.label,
                status: session.status || 'offline',
                model: session.model,
                provider: session.provider,
                ageSeconds: Math.round(session.ageMs / 1000),
            };
        });
    }
    /**
     * 更新数据库中的 Agent 记录
     */
    updateDatabaseAgents(agents) {
        try {
            const db = (0, db_1.getDb)();
            if (!db)
                return;
            for (const agent of agents) {
                db.run(`INSERT OR REPLACE INTO agents (id, name, status, last_active_at, updated_at)
           VALUES (?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))`, [agent.id, agent.name, agent.status, Math.floor(Date.now() / 1000) - agent.ageSeconds]);
            }
        }
        catch (e) {
            // sql.js 更新失败不影响主流程
        }
    }
    /**
     * 获取所有 Agent 状态
     */
    getAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * 启动引擎
     * Phase 3: 使用 listAllKnownAgents 获取完整列表（包括离线 Agent）
     */
    start(callback) {
        this.callback = callback;
        // 包装回调：Gateway 返回完整列表（包含离线），我们只需推断状态
        const onGatewayUpdate = (sessions) => {
            const agents = this.inferAgentState(sessions);
            this.agents.clear();
            agents.forEach((agent) => {
                this.agents.set(agent.id, agent);
            });
            this.updateDatabaseAgents(agents);
            if (this.callback) {
                this.callback(agents);
            }
        };
        // 注册 session 变化回调
        this.gatewayClient.onSessionsChange(onGatewayUpdate);
    }
    /**
     * 停止引擎
     */
    stop() {
        this.gatewayClient.disconnect();
        console.log('[AgentEngine] 引擎已停止');
    }
}
exports.AgentEngine = AgentEngine;
