/**
 * Agent 列表 UI 组件
 * 从 WebSocket 接收 agent:list 事件并渲染
 * Phase 3: 点击 Agent 项时打开聊天面板
 */

import { WSClient } from '../lib/ws-client';
import { OfficeScene } from '../game/OfficeScene';
import { ChatPanel } from './ChatPanel';

export interface AgentState {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'working' | 'thinking' | 'idle';
  lastMessage: string;
  lastActiveAt: number;
}

// Agent 颜色映射（对应 AgentSprite）
const AGENT_COLORS: Record<string, string> = {
  '蜂鸟': '#4FC3F7',
  '猫头鹰': '#8D6E63',
  '小马': '#66BB6A',
  '马良': '#AB47BC',
  'default': '#78909C',
};

// 状态颜色
const STATUS_COLORS: Record<string, string> = {
  'online': '#4CAF50',
  'idle': '#FFC107',
  'working': '#2196F3',
  'thinking': '#9C27B0',
  'offline': '#757575',
};

export class AgentList {
  private container: HTMLElement;
  private agents: Map<string, AgentState> = new Map();
  private selectedId: string | null = null;
  private onSelectCallback: ((agent: AgentState) => void) | null = null;
  private officeScene: OfficeScene | null = null;
  private chatPanel: ChatPanel | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`AgentList: 容器 #${containerId} 不存在`);
    }
    this.container = container;
    this.render();
  }

  /**
   * 设置关联的 Phaser 场景
   */
  setOfficeScene(scene: OfficeScene): void {
    this.officeScene = scene;
  }

  /**
   * 设置选中变化回调
   */
  onSelect(callback: (agent: AgentState) => void): void {
    this.onSelectCallback = callback;
  }

  /**
   * 绑定聊天面板
   */
  bindChatPanel(chatPanel: ChatPanel): void {
    this.chatPanel = chatPanel;
  }

  /**
   * 打开聊天面板
   */
  openChat(agent: AgentState): void {
    if (this.chatPanel) {
      this.chatPanel.open(agent.id, agent.name);
    } else {
      // 备用：使用 window 回调
      (window as any).__pixelOfficeOpenChat?.(agent.id, agent.name);
    }
  }

  /**
   * 更新 Agent 列表
   */
  updateAgents(agents: AgentState[]): void {
    // 更新内存中的状态
    this.agents.clear();
    agents.forEach((agent) => {
      this.agents.set(agent.id, agent);
    });
    this.render();

    // 同步更新 Phaser 场景中的角色
    if (this.officeScene) {
      this.officeScene.updateAgents(agents);
    }
  }

  /**
   * 绑定 WebSocket 事件
   */
  bindWS(wsClient: WSClient): void {
    wsClient.on('agent:list', (data: unknown) => {
      const { agents } = data as { agents: AgentState[] };
      this.updateAgents(agents);
    });
  }

  /**
   * 渲染 Agent 列表
   */
  private render(): void {
    if (this.agents.size === 0) {
      this.container.innerHTML = `
        <div style="color: #757575; text-align: center; padding: 20px; font-size: 12px;">
          暂无连接
        </div>
      `;
      return;
    }

    const agentArray = Array.from(this.agents.values());
    this.container.innerHTML = agentArray.map((agent) => {
      const statusClass = `status-${agent.status}`;
      const isActive = agent.id === this.selectedId;
      const activeClass = isActive ? 'active' : '';
      const agentColor = AGENT_COLORS[agent.name] || AGENT_COLORS['default'];
      const statusColor = STATUS_COLORS[agent.status] || '#757575';

      // 格式化最后消息
      const lastMsg = agent.lastMessage
        ? agent.lastMessage.substring(0, 30) + (agent.lastMessage.length > 30 ? '...' : '')
        : '无消息';

      // 格式化时间
      const timeStr = this.formatTime(agent.lastActiveAt);

      return `
        <div class="agent-item ${activeClass}" data-id="${agent.id}" style="border-left: 3px solid ${agentColor};">
          <div class="agent-name" style="color: ${agentColor};">${this.escapeHtml(agent.name)}</div>
          <span class="agent-status ${statusClass}" style="background-color: ${statusColor};">${this.getStatusLabel(agent.status)}</span>
          <div class="agent-message">${this.escapeHtml(lastMsg)}</div>
          <div class="agent-time">${timeStr}</div>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    this.container.querySelectorAll('.agent-item').forEach((item: Element) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        if (id) {
          this.selectAgent(id);
        }
      });
    });
  }

  /**
   * 选中 Agent
   */
  private selectAgent(id: string): void {
    this.selectedId = id;
    this.render();

    const agent = this.agents.get(id);
    if (agent) {
      if (this.onSelectCallback) {
        this.onSelectCallback(agent);
      }
      // Phase 3: 选中时打开聊天面板
      this.openChat(agent);
    }

    // 触发 Phaser 场景中的高亮动画
    if (this.officeScene) {
      this.officeScene.highlightAgent(id);
    }
  }

  /**
   * 获取状态标签
   */
  private getStatusLabel(status: AgentState['status']): string {
    const labels: Record<AgentState['status'], string> = {
      online: '在线',
      offline: '离线',
      working: '工作中',
      thinking: '思考中',
      idle: '空闲',
    };
    return labels[status] || status;
  }

  /**
   * 格式化时间
   */
  private formatTime(timestamp: number): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
