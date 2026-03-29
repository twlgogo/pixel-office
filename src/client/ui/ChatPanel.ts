/**
 * 聊天面板 UI 组件（原生 DOM 实现）
 * Phase 4: 真实消息链路，加载历史，实时回复展示
 */

import { WSClient } from '../lib/ws-client';

export class ChatPanel {
  private panel: HTMLElement;
  private header: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputField: HTMLInputElement;
  private sendButton: HTMLElement;
  private isOpen: boolean = false;
  private currentAgentId: string = '';
  private currentAgentName: string = '';
  private wsClient: WSClient | null = null;
  // 当前 Agent 回复拼接（流式）
  private streamingText: string = '';
  private streamingEl: HTMLElement | null = null;
  // 是否正在等待回复
  private isWaitingReply: boolean = false;
  // 消息历史是否已加载
  private historyLoaded: string = '';

  constructor() {
    // 创建面板容器
    this.panel = document.createElement('div');
    this.panel.id = 'chat-panel';
    Object.assign(this.panel.style, {
      position: 'fixed',
      top: '50%',
      right: '-380px',
      transform: 'translateY(-50%)',
      width: '350px',
      height: '70vh',
      maxHeight: '600px',
      backgroundColor: '#16213e',
      borderRadius: '12px 0 0 12px',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'right 0.3s ease',
    });

    // 创建 header
    this.header = document.createElement('div');
    Object.assign(this.header.style, {
      padding: '16px',
      backgroundColor: '#0f3460',
      color: '#e8e8e8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #1a1a2e',
    });

    // Agent 名称区域
    const titleArea = document.createElement('div');
    const agentNameEl = document.createElement('div');
    agentNameEl.id = 'chat-agent-name';
    Object.assign(agentNameEl.style, {
      fontSize: '15px',
      fontWeight: 'bold',
      color: '#e8e8e8',
    });
    const statusBadge = document.createElement('span');
    statusBadge.id = 'chat-status-badge';
    Object.assign(statusBadge.style, {
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '10px',
      marginLeft: '8px',
      backgroundColor: '#4CAF50',
      color: '#fff',
    });
    statusBadge.textContent = '在线';
    titleArea.appendChild(agentNameEl);
    titleArea.appendChild(statusBadge);

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: '#9e9e9e',
      fontSize: '20px',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px',
    });
    closeBtn.addEventListener('mouseover', () => {
      closeBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
    });
    closeBtn.addEventListener('mouseout', () => {
      closeBtn.style.backgroundColor = 'transparent';
    });
    closeBtn.addEventListener('click', () => this.close());

    this.header.appendChild(titleArea);
    this.header.appendChild(closeBtn);
    this.panel.appendChild(this.header);

    // 创建消息列表容器
    this.messagesContainer = document.createElement('div');
    Object.assign(this.messagesContainer.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    });
    this.panel.appendChild(this.messagesContainer);

    // 创建输入区域
    const inputArea = document.createElement('div');
    Object.assign(inputArea.style, {
      padding: '12px',
      backgroundColor: '#0f0f1a',
      display: 'flex',
      gap: '8px',
      borderTop: '1px solid #1a1a2e',
    });

    this.inputField = document.createElement('input');
    Object.assign(this.inputField.style, {
      flex: '1',
      padding: '10px 14px',
      borderRadius: '20px',
      border: '1px solid #2a2a4a',
      backgroundColor: '#1a1a2e',
      color: '#e8e8e8',
      fontSize: '14px',
      outline: 'none',
    });
    this.inputField.placeholder = '输入消息...';
    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    this.sendButton = document.createElement('button');
    this.sendButton.textContent = '发送';
    Object.assign(this.sendButton.style, {
      padding: '10px 18px',
      borderRadius: '20px',
      border: 'none',
      backgroundColor: '#e94560',
      color: '#fff',
      fontSize: '14px',
      cursor: 'pointer',
      fontWeight: 'bold',
    });
    this.sendButton.addEventListener('click', () => this.sendMessage());

    inputArea.appendChild(this.inputField);
    inputArea.appendChild(this.sendButton);
    this.panel.appendChild(inputArea);

    document.body.appendChild(this.panel);

    // 暴露到 window，方便 OfficeScene 调用
    (window as any).__pixelOfficeOpenChat = (agentId: string, agentName: string) => {
      this.open(agentId, agentName);
    };
  }

  /**
   * 打开聊天面板
   */
  open(agentId: string, agentName: string): void {
    this.currentAgentId = agentId;
    this.currentAgentName = agentName;

    // 更新 header
    const nameEl = document.getElementById('chat-agent-name');
    if (nameEl) nameEl.textContent = agentName;

    // 滑入面板
    this.panel.style.right = '0';
    this.isOpen = true;

    // 加载历史消息（首次打开时）
    if (this.historyLoaded !== agentId) {
      this.loadHistory(agentId);
      this.historyLoaded = agentId;
    }

    // 聚焦输入框
    setTimeout(() => {
      this.inputField.focus();
    }, 300);

    // 响应式
    this.handleResponsive();
  }

  /**
   * 关闭聊天面板
   */
  close(): void {
    const isMobile = window.innerWidth < 768;
    this.panel.style.right = isMobile ? '-100%' : '-380px';
    this.isOpen = false;
    // 重置流式状态
    this.streamingText = '';
    this.streamingEl = null;
  }

  /**
   * 加载聊天历史
   */
  private async loadHistory(agentId: string): Promise<void> {
    this.addMessage('加载历史消息...', 'system');

    try {
      const response = await fetch(`/api/agents/${agentId}/history`);
      if (response.ok) {
        const data = await response.json();
        // 清空当前消息（包括"加载中"提示）
        this.messagesContainer.innerHTML = '';

        const messages = data.messages || [];
        if (messages.length === 0) {
          this.addMessage('暂无历史消息', 'system');
        } else {
          // 最近的 30 条消息
          const recent = messages.slice(-30);
          for (const msg of recent) {
            const sender = msg.role === 'user' ? 'user' : 'agent';
            this.addMessage(msg.text || msg.content || '', sender);
          }
        }

        // 滚动到底部
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      } else {
        // 移除"加载中"提示
        const loadingMsg = this.messagesContainer.lastElementChild;
        if (loadingMsg) loadingMsg.remove();
        this.addMessage('历史消息加载失败', 'system');
      }
    } catch (e) {
      const loadingMsg = this.messagesContainer.lastElementChild;
      if (loadingMsg) loadingMsg.remove();
      this.addMessage('历史消息加载失败', 'system');
    }
  }

  /**
   * 发送消息
   */
  private sendMessage(): void {
    const text = this.inputField.value.trim();
    if (!text || this.isWaitingReply) return;

    // 清空输入框
    this.inputField.value = '';

    // 显示用户消息
    this.addMessage(text, 'user');

    // 通过 API 真实发送
    this.isWaitingReply = true;
    this.sendButton.textContent = '...';
    this.sendToAPI(text);
  }

  /**
   * 通过 API 发送消息
   */
  private async sendToAPI(text: string): Promise<void> {
    try {
      const response = await fetch(`/api/agents/${this.currentAgentId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      if (data.success) {
        // 消息已发送，等待 Agent 通过 WebSocket 回复
        // 如果 60 秒内没收到回复，显示超时提示
        setTimeout(() => {
          if (this.isWaitingReply) {
            this.isWaitingReply = false;
            this.sendButton.textContent = '发送';
            this.finalizeStream();
          }
        }, 60000);
      } else {
        console.error('[ChatPanel] 发送失败:', data.error);
        this.addMessage(`发送失败: ${data.error || '未知错误'}`, 'system');
        this.isWaitingReply = false;
        this.sendButton.textContent = '发送';
      }
    } catch (e) {
      console.error('[ChatPanel] 请求失败:', e);
      this.addMessage('发送失败：网络错误', 'system');
      this.isWaitingReply = false;
      this.sendButton.textContent = '发送';
    }
  }

  /**
   * 添加消息到列表
   */
  private addMessage(text: string, sender: 'user' | 'agent' | 'system'): void {
    const msgEl = document.createElement('div');

    if (sender === 'system') {
      // 系统消息：居中灰色小字
      Object.assign(msgEl.style, {
        textAlign: 'center',
        color: '#666',
        fontSize: '12px',
        padding: '4px',
        alignSelf: 'center',
      });
      msgEl.textContent = text;
    } else {
      const isUser = sender === 'user';
      Object.assign(msgEl.style, {
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        backgroundColor: isUser ? '#e94560' : '#1a1a2e',
        color: '#e8e8e8',
        fontSize: '14px',
        maxWidth: '75%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        wordBreak: 'break-word',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        whiteSpace: 'pre-wrap',
      });
      msgEl.textContent = text;
    }

    this.messagesContainer.appendChild(msgEl);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return msgEl;
  }

  /**
   * 接收 Agent 回复（流式/完成）
   */
  handleReply(sessionKey: string, text: string, isComplete: boolean): void {
    // 只处理当前打开的 Agent
    if (sessionKey !== this.currentAgentId || !this.isOpen) return;

    if (!isComplete) {
      // 流式片段：追加到当前流式消息
      this.streamingText += text;
      if (!this.streamingEl) {
        // 创建流式消息气泡
        this.streamingEl = this.addMessage('', 'agent');
      }
      if (this.streamingEl) {
        this.streamingEl.textContent = this.streamingText;
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    } else {
      // 回复完成
      this.finalizeStream();
      this.isWaitingReply = false;
      this.sendButton.textContent = '发送';
    }
  }

  /**
   * 完成流式消息
   */
  private finalizeStream(): void {
    if (this.streamingText && this.streamingEl) {
      this.streamingEl.textContent = this.streamingText;
    } else if (this.isWaitingReply) {
      // 没收到任何内容
      this.addMessage('（无回复内容）', 'system');
    }
    this.streamingText = '';
    this.streamingEl = null;
  }

  /**
   * 绑定 WebSocket 客户端
   */
  bindWS(wsClient: WSClient): void {
    this.wsClient = wsClient;

    // 监听 Agent 回复事件
    wsClient.on('agent:reply', (data: any) => {
      this.handleReply(data.sessionKey, data.text, data.isComplete);
    });
  }

  /**
   * 响应式处理
   */
  private handleResponsive(): void {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      this.panel.style.width = '100%';
      this.panel.style.right = '0';
      this.panel.style.top = '0';
      this.panel.style.transform = 'none';
      this.panel.style.height = '100vh';
      this.panel.style.maxHeight = '100vh';
      this.panel.style.borderRadius = '0';
    } else {
      this.panel.style.width = '350px';
      this.panel.style.height = '70vh';
      this.panel.style.maxHeight = '600px';
      this.panel.style.transform = 'translateY(-50%)';
      this.panel.style.borderRadius = '12px 0 0 12px';
    }
  }
}
