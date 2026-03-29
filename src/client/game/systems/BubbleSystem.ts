/**
 * 回复气泡系统
 * 管理所有 Agent 角色的气泡显示
 * 气泡样式：白色圆角矩形 + 小三角指向角色 + 打字机效果
 */

import Phaser from 'phaser';
import { AgentSprite } from '../entities/AgentSprite';

// 预设气泡内容
const BUBBLE_PRESETS: string[] = [
  '正在分析数据...',
  '完成了一项任务',
  '等待新指令中...',
  '今日大盘表现不错',
  '正在查询资料...',
  '处理中，请稍候...',
  '任务进度 80%',
  '结果已生成',
  '检查中...',
  '思考中...',
];

export class BubbleSystem {
  private scene: Phaser.Scene;
  private agents: Map<string, AgentSprite> = new Map();
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 注册 Agent 角色
   */
  registerAgent(agent: AgentSprite): void {
    this.agents.set(agent.agentId, agent);
  }

  /**
   * 移除 Agent 角色
   */
  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.hideBubble();
      this.agents.delete(agentId);
    }
  }

  /**
   * 获取指定 Agent 的气泡
   */
  getAgentBubble(agentId: string): AgentSprite | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 随机给一个在线 Agent 显示气泡
   */
  showRandomBubble(): void {
    // 筛选 online 或 working 状态的 Agent
    const activeAgents = Array.from(this.agents.values()).filter(
      (agent) => agent.status === 'online' || agent.status === 'working'
    );

    if (activeAgents.length === 0) return;

    // 随机选择一个 Agent
    const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];

    // 随机选择气泡内容
    const randomText = BUBBLE_PRESETS[Math.floor(Math.random() * BUBBLE_PRESETS.length)];

    // 显示气泡
    randomAgent.showBubble(randomText);
  }

  /**
   * 给指定 Agent 显示气泡
   */
  showBubble(agentId: string, text?: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const bubbleText = text || BUBBLE_PRESETS[Math.floor(Math.random() * BUBBLE_PRESETS.length)];
    agent.showBubble(bubbleText);
  }

  /**
   * 启动自动气泡定时器
   * @param intervalMs 间隔时间（毫秒）
   */
  startAutoBubble(intervalMs: number = 30000): void {
    // 清除已有定时器
    this.stopAutoBubble();

    // 每隔指定时间随机显示气泡
    this.timer = this.scene.time.addEvent({
      delay: intervalMs,
      callback: () => {
        this.showRandomBubble();
      },
      loop: true,
    });
  }

  /**
   * 停止自动气泡定时器
   */
  stopAutoBubble(): void {
    if (this.timer) {
      this.timer.destroy();
      this.timer = null;
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopAutoBubble();
    this.agents.clear();
  }
}
