/**
 * OpenClaw Gateway 客户端（CLI 模式）
 * 通过 CLI 命令与 Gateway 交互
 * 检测 Agent 活动变化来触发气泡展示
 */

import { exec } from 'child_process';
import { config } from './config';

export interface SessionInfo {
  key: string;
  label: string;
  ageMs: number;
  model: string;
  provider: string;
  agentId: string;
  kind: string;
  totalTokens: number | null;
  contextTokens: number;
  status: 'online' | 'offline' | 'idle' | 'working' | 'thinking';
  lastMessage?: string;
}

type SessionsChangeCallback = (sessions: SessionInfo[]) => void;
type ActivityCallback = (sessionKey: string) => void;

export const KNOWN_AGENTS: Record<string, { label: string; emoji: string }> = {
  'agent:main:main': { label: '蜂鸟 (主 Agent)', emoji: '🐦' },
  'agent:main:owl': { label: '猫头鹰', emoji: '🦉' },
  'agent:main:horse': { label: '小马', emoji: '🐴' },
  'agent:main:maliang': { label: '马良', emoji: '🎨' },
  'agent:main:spider': { label: '蜘蛛', emoji: '🕷️' },
  'agent:main:darwin': { label: '达尔文', emoji: '🦎' },
  'agent:main:xiaohuazhu': { label: '小花猪', emoji: '🐷' },
};

export function extractAgentLabel(key: string): string {
  const known = KNOWN_AGENTS[key];
  if (known) return `${known.emoji} ${known.label}`;
  return key.split(':').pop() || key;
}

export class GatewayClientWrapper {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSessions: SessionInfo[] = [];
  private sessionsCallback: SessionsChangeCallback | null = null;
  private activityCallback: ActivityCallback | null = null;
  // 记录每个 agent 上次的 ageMs，用于检测新活动
  private lastAgeMs: Map<string, number> = new Map();
  // 每个 agent 是否处于"正在活动"状态
  private activeAgents: Map<string, boolean> = new Map();

  async connect(): Promise<boolean> {
    console.log('[Gateway] CLI 模式已就绪');
    return true;
  }

  /**
   * 执行 CLI 命令并解析 JSON 输出
   */
  private execCli(args: string, timeout: number = 10000): Promise<any> {
    return new Promise((resolve) => {
      exec(
        `openclaw ${args}`,
        { timeout: timeout, env: { ...process.env, NO_COLOR: '1' }, shell: true },
        (error: any, stdout: string) => {
          if (error && !stdout) { resolve(null); return; }
          try {
            const s = stdout.indexOf('{');
            const e = stdout.lastIndexOf('}');
            if (s === -1 || e === -1) { resolve(null); return; }
            resolve(JSON.parse(stdout.substring(s, e + 1)));
          } catch { resolve(null); }
        }
      );
    });
  }

  /**
   * 获取活跃 session 列表
   */
  async listSessions(activeMinutes: number = 120): Promise<SessionInfo[]> {
    const data = await this.execCli(`sessions --json --all-agents --active ${activeMinutes}`);
    if (!data?.sessions) return [];

    return data.sessions
      .filter((s: any) => !s.key.includes('subagent'))
      .map((s: any) => this.mapSession(s));
  }

  private mapSession(s: any): SessionInfo {
    const ageMs = s.ageMs || 0;
    let status: SessionInfo['status'] = 'offline';
    if (ageMs < 30000) status = 'online';
    else if (ageMs < 120000) status = 'idle';
    else if (ageMs < 600000) status = 'working';
    else status = 'offline';

    const known = KNOWN_AGENTS[s.key];
    return {
      key: s.key,
      label: known ? `${known.emoji} ${known.label}` : (s.label || s.key),
      ageMs,
      model: s.model || 'unknown',
      provider: s.modelProvider || '',
      agentId: s.agentId || 'main',
      kind: s.kind || 'direct',
      totalTokens: s.totalTokens || null,
      contextTokens: s.contextTokens || 0,
      status,
    };
  }

  /**
   * 获取所有已知 Agent（含离线）
   */
  async listAllKnownAgents(): Promise<SessionInfo[]> {
    const sessions = await this.listSessions();
    const keys = new Set(sessions.map(s => s.key));
    const result = [...sessions];
    for (const [key, info] of Object.entries(KNOWN_AGENTS)) {
      if (!keys.has(key)) {
        result.push({
          key, label: `${info.emoji} ${info.label}`, ageMs: 999999,
          model: 'unknown', provider: '', agentId: 'main', kind: 'direct',
          totalTokens: null, contextTokens: 0, status: 'offline',
        });
      }
    }
    return result;
  }

  /**
   * 发送消息到指定 session（通过 CLI）
   */
  async sendMessage(sessionKey: string, message: string): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const cmd = `openclaw agent chat --agent "${sessionKey}" --message "${message.replace(/"/g, '\\"')}"`;
      console.log(`[Gateway] 发送消息: ${message.substring(0, 50)}`);
      exec(cmd, { timeout: 30000, env: { ...process.env, NO_COLOR: '1' }, shell: true },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true, output: (stdout + stderr).trim() });
          }
        }
      );
    });
  }

  /**
   * 获取聊天历史
   */
  async getChatHistory(sessionKey: string, limit: number = 20): Promise<any[]> {
    // CLI 没有 agent history 命令，返回空
    return [];
  }

  /**
   * 检测 Agent 新活动（ageMs 降低 = 有新交互）
   */
  private checkActivity(sessions: SessionInfo[]): void {
    for (const session of sessions) {
      if (session.status === 'offline') continue;

      const prevAge = this.lastAgeMs.get(session.key);
      const curAge = session.ageMs;
      const wasActive = this.activeAgents.get(session.key) || false;

      if (prevAge !== undefined && curAge < prevAge) {
        // ageMs 降低了，说明 Agent 有新活动
        if (!wasActive) {
          // 从非活动 → 活动：通知前端
          console.log(`[Gateway] 新活动: ${session.key} (ageMs: ${prevAge} → ${curAge})`);
          this.activityCallback?.(session.key);
          this.activeAgents.set(session.key, true);
        }
      } else if (curAge > 30000) {
        // 超过 30 秒无活动，标记为非活动
        if (wasActive) {
          this.activeAgents.set(session.key, false);
        }
      } else if (curAge <= 30000) {
        // 30 秒内有活动
        if (!wasActive) {
          this.activityCallback?.(session.key);
          this.activeAgents.set(session.key, true);
        }
      }

      this.lastAgeMs.set(session.key, curAge);
    }
  }

  private hasChanges(newSessions: SessionInfo[]): boolean {
    if (newSessions.length !== this.lastSessions.length) return true;
    for (let i = 0; i < newSessions.length; i++) {
      if (newSessions[i].key !== this.lastSessions[i]?.key) return true;
      if (newSessions[i].status !== this.lastSessions[i]?.status) return true;
    }
    return false;
  }

  /**
   * 启动轮询
   */
  startPolling(callback: SessionsChangeCallback): void {
    this.sessionsCallback = callback;

    const poll = async () => {
      const sessions = await this.listAllKnownAgents();
      this.checkActivity(sessions);
      if (this.hasChanges(sessions)) {
        this.lastSessions = sessions;
        this.sessionsCallback?.(sessions);
      }
    };

    poll();
    this.pollTimer = setInterval(poll, config.pollInterval);
    console.log(`[Gateway] 启动轮询，间隔: ${config.pollInterval}ms`);
  }

  // CLI 兼容接口
  onSessionsChange(callback: SessionsChangeCallback): void { this.sessionsCallback = callback; }
  onMessage(callback: ActivityCallback): void { this.activityCallback = callback; }
  async subscribeMessages(_sessionKey: string): Promise<void> {}
  startMessagePolling(cb: ActivityCallback): void { this.activityCallback = cb; }
  stopPolling(): void { if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; } }
  disconnect(): void { this.stopPolling(); }
  isConnected(): boolean { return true; }
}
