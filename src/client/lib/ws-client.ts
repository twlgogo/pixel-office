/**
 * WebSocket 客户端模块
 * 自动重连（指数退避，最大 30 秒），事件分发
 */

type MessageHandler = (data: unknown) => void;

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 20;
  private baseReconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionalClose: boolean = false;
  private statusHandlers: Set<(status: ConnectionStatus) => void> = new Set();
  private _status: ConnectionStatus = 'disconnected';

  constructor(url: string) {
    // 如果 url 是相对路径，转换为 ws:// 协议
    if (url.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      this.url = `${protocol}//${host}${url}`;
    } else {
      this.url = url;
    }
  }

  /**
   * 获取当前连接状态
   */
  get status(): ConnectionStatus {
    return this._status;
  }

  /**
   * 注册连接状态变化处理器
   */
  onStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusHandlers.add(handler);
  }

  /**
   * 移除连接状态变化处理器
   */
  offStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusHandlers.delete(handler);
  }

  /**
   * 更新连接状态
   */
  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusHandlers.forEach((handler) => {
      try {
        handler(status);
      } catch (e) {
        console.error('[WSClient] status handler 错误:', e);
      }
    });
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.isIntentionalClose = false;
    this.setStatus('connecting');
    console.log(`[WSClient] 连接到: ${this.url}`);

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.error('[WSClient] WebSocket 创建失败:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WSClient] 连接已建立');
      this.reconnectAttempts = 0;
      this.setStatus('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.dispatch(data);
      } catch (error) {
        console.error('[WSClient] 消息解析失败:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WSClient] WebSocket 错误:', error);
    };

    this.ws.onclose = () => {
      console.log('[WSClient] 连接已关闭');
      this.setStatus('disconnected');
      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * 调度重连（指数退避，最大 30 秒）
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WSClient] 最大重连次数已达上限，请刷新页面重试');
      return;
    }

    this.reconnectAttempts++;
    // 指数退避: baseDelay * 2^(attempts-1)，最大 30 秒
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WSClient] ${delay}ms 后尝试重连 (第 ${this.reconnectAttempts} 次)`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 分发消息到对应的处理器
   */
  private dispatch(data: { type: string; [key: string]: unknown }): void {
    const { type, ...rest } = data;
    const handlers = this.handlers.get(type);

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(rest);
        } catch (error) {
          console.error(`[WSClient] 处理 ${type} 消息失败:`, error);
        }
      });
    }
  }

  /**
   * 注册消息处理器
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * 移除消息处理器
   */
  off(type: string, handler?: MessageHandler): void {
    if (!handler) {
      this.handlers.delete(type);
    } else {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  /**
   * 发送消息
   */
  send(data: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WSClient] WebSocket 未连接，无法发送消息');
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.isIntentionalClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
