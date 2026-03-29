/**
 * 办公室场景
 * 使用真实精灵图渲染办公室背景和道具
 * Phase 3: 支持所有已知 Agent（含离线），时钟，状态栏，day/night 周期，气泡系统
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { AgentSprite, STATUS_POSITIONS, AREA_OFFSETS } from './entities/AgentSprite';
import { BubbleSystem } from './systems/BubbleSystem';

/**
 * 已知 Agent 列表（与 gateway.ts 同步）
 */
export const KNOWN_AGENTS: Array<{ id: string; name: string; emoji: string }> = [
  { id: 'agent:main:main', name: '🐦 蜂鸟 (主 Agent)', emoji: '🐦' },
  { id: 'agent:main:owl', name: '🦉 猫头鹰', emoji: '🦉' },
  { id: 'agent:main:horse', name: '🐴 小马', emoji: '🐴' },
  { id: 'agent:main:maliang', name: '🎨 马良', emoji: '🎨' },
  { id: 'agent:main:spider', name: '🕷️ 蜘蛛', emoji: '🕷️' },
  { id: 'agent:main:darwin', name: '🦎 达尔文', emoji: '🦎' },
  { id: 'agent:main:xiaohuazhu', name: '🐷 小花猪', emoji: '🐷' },
];

export interface AgentData {
  id: string;
  name: string;
  status: string;
}

export class OfficeScene extends Phaser.Scene {
  // Agent 角色映射
  private agents: Map<string, AgentSprite> = new Map();
  // 气泡系统
  private bubbleSystem!: BubbleSystem;
  // 标记是否已完成入场动画
  private hasEntered: boolean = false;
  // 服务器闪烁定时器
  private serverTimer: Phaser.Time.TimerEvent | null = null;
  // 时钟文字
  private clockText!: Phaser.GameObjects.Text;
  // 状态栏文字
  private statusText!: Phaser.GameObjects.Text;
  // Day/Night 周期定时器
  private dayNightTimer: Phaser.Time.TimerEvent | null = null;
  // 服务器闪烁专用图形
  private serverBlinkGfx: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  /**
   * 创建场景
   */
  create(): void {
    // 清理之前可能残留的对象（防止热重载或场景重启时重复）
    this.children.removeAll(true);
    
    // 重置状态
    this.agents.clear();
    this.hasEntered = false;
    this.bgSprite = null;

    // 初始化气泡系统
    this.bubbleSystem = new BubbleSystem(this);

    // 绘制办公室背景（使用真实精灵图）
    this.createOfficeBackground();

    // 创建场景道具
    this.createSceneProps();

    // 顶部状态栏：时钟 + 在线统计
    this.createTopStatusBar();
  }

  /**
   * 创建办公室背景（使用 Phaser Graphics 纯代码绘制）
   */
  private createOfficeBackground(): void {
    const g = this.add.graphics();
    g.setDepth(-100);

    // ============ 1. 天花板 ============
    g.fillStyle(0x4a4a5e);
    g.fillRect(0, 0, 1280, 30);

    // 日光灯管 x3
    const lightX = [200, 650, 1050];
    lightX.forEach((x) => {
      // 灯管主体
      g.fillStyle(0xf4f6f7);
      g.fillRect(x - 40, 28, 80, 4);
      // 发光效果（下方浅色）
      g.fillStyle(0xe8f4f8, 0.3);
      g.fillRect(x - 45, 32, 90, 8);
    });

    // ============ 2. 墙壁 ============
    g.fillStyle(0x5a5a6e);
    g.fillRect(0, 30, 1280, 120);

    // 踢脚线
    g.fillStyle(0x44445a);
    g.fillRect(0, 140, 1280, 8);

    // --- 工作区：挂钟 ---
    // 钟框
    g.fillStyle(0x7b5b3a);
    g.fillCircle(250, 100, 22);
    // 钟面
    g.fillStyle(0xf5f5dc);
    g.fillCircle(250, 100, 18);
    // 时针
    g.fillStyle(0x333333);
    g.fillRect(248, 88, 2, 12);
    // 分针
    g.fillStyle(0x333333);
    g.fillRect(248, 82, 2, 18);

    // --- 茶歇区：挂画 ---
    // 画框
    g.fillStyle(0x5d4037);
    g.fillRect(650, 75, 80, 55);
    // 画布（绿色风景）
    g.fillStyle(0x27ae60);
    g.fillRect(655, 80, 70, 45);
    // 简单树形
    g.fillStyle(0x1e8449);
    g.fillRect(660, 95, 8, 30);
    g.fillRect(670, 90, 20, 8);
    g.fillRect(672, 85, 16, 5);
    g.fillRect(674, 80, 12, 5);
    // 草地
    g.fillStyle(0x2ecc71);
    g.fillRect(655, 115, 70, 10);

    // --- 服务器区：排线槽 ---
    for (let x = 900; x < 1200; x += 20) {
      g.fillStyle(0x3a3a4a);
      g.fillRect(x, 50, 12, 90);
      g.fillStyle(0x2a2a3a);
      g.fillRect(x + 2, 55, 8, 80);
    }

    // ============ 3. 分区柱子 ============
    g.fillStyle(0x5c5c6e);
    g.fillRect(490, 150, 10, 550);
    g.fillRect(855, 150, 10, 550);

    // ============ 4. 地板 ============
    // 底色
    g.fillStyle(0x3a3a4a);
    g.fillRect(0, 148, 1280, 572);

    // 瓷砖网格线
    g.lineStyle(1, 0x33334a);
    for (let x = 0; x <= 1280; x += 32) {
      g.lineBetween(x, 148, x, 720);
    }
    for (let y = 148; y <= 720; y += 32) {
      g.lineBetween(0, y, 1280, y);
    }

    // 工作区地毯 (浅棕色)
    g.fillStyle(0x6d5d4b);
    g.fillRect(20, 400, 460, 300);

    // 茶歇区木地板 (木纹色)
    g.fillStyle(0x8b7355);
    g.fillRect(500, 400, 350, 300);

    // 服务器区水泥地板
    g.fillStyle(0x4a4a5a);
    g.fillRect(865, 400, 395, 300);

    // ============ 5. 工作区家具 (x: 20-480) ============
    const deskX = [80, 240, 400];
    const deskY = 380;
    const seatY = 450;

    deskX.forEach((dx) => {
      // 桌腿（左）
      g.fillStyle(0x5c4033);
      g.fillRect(dx + 10, deskY + 15, 4, 50);
      // 桌腿（右）
      g.fillRect(dx + 106, deskY + 15, 4, 50);
      // 桌面
      g.fillStyle(0x7b5b3a);
      g.fillRect(dx, deskY, 120, 15);
      // 桌面高光
      g.fillStyle(0x8d6e4a);
      g.fillRect(dx, deskY, 120, 3);

      // 显示器外壳
      g.fillStyle(0x2a2a3a);
      g.fillRect(dx + 30, deskY - 22, 30, 22);
      // 显示器屏幕
      g.fillStyle(0x4a90d9);
      g.fillRect(dx + 33, deskY - 19, 24, 16);
      // 屏幕高光
      g.fillStyle(0x7ab8e8, 0.5);
      g.fillRect(dx + 33, deskY - 19, 8, 6);
      // 显示器支架
      g.fillStyle(0x2a2a3a);
      g.fillRect(dx + 42, deskY - 5, 6, 5);
      g.fillRect(dx + 38, deskY, 14, 2);

      // 键盘
      g.fillStyle(0x3a3a4a);
      g.fillRect(dx + 35, deskY + 2, 25, 8);
      g.fillStyle(0x4a4a5a);
      g.fillRect(dx + 37, deskY + 3, 21, 5);

      // 椅子座垫
      g.fillStyle(0x4a4a5a);
      g.fillRect(dx + 35, seatY, 40, 12);
      // 椅背
      g.fillStyle(0x5a5a6a);
      g.fillRect(dx + 35, seatY - 25, 40, 20);
      // 椅腿
      g.fillStyle(0x3a3a4a);
      g.fillRect(dx + 40, seatY + 12, 4, 15);
      g.fillRect(dx + 66, seatY + 12, 4, 15);
    });

    // ============ 6. 茶歇区 (x: 500-850) ============
    // 沙发座垫
    g.fillStyle(0xc0392b);
    g.fillRect(550, 430, 80, 20);
    // 沙发靠背
    g.fillStyle(0xa93226);
    g.fillRect(550, 400, 80, 25);
    // 沙发扶手
    g.fillStyle(0x922b21);
    g.fillRect(548, 400, 8, 50);
    g.fillRect(624, 400, 8, 50);
    // 沙发高光
    g.fillStyle(0xd35438, 0.4);
    g.fillRect(550, 400, 80, 5);

    // 茶几桌面
    g.fillStyle(0x6d5d4b);
    g.fillRect(615, 410, 60, 10);
    // 茶几腿
    g.fillStyle(0x5c4033);
    g.fillRect(620, 420, 4, 20);
    g.fillRect(666, 420, 4, 20);
    // 茶杯
    g.fillStyle(0xecf0f1);
    g.fillRect(635, 403, 8, 7);
    g.fillStyle(0x85c1e9, 0.6);
    g.fillRect(636, 404, 6, 4);

    // 饮水机主体
    g.fillStyle(0xbdc3c7);
    g.fillRect(775, 350, 25, 50);
    // 饮水机水桶
    g.fillStyle(0x85c1e9);
    g.fillRect(780, 330, 15, 25);
    // 水桶顶部弧形（简化为矩形）
    g.fillStyle(0x6ca0c8);
    g.fillRect(780, 325, 15, 8);
    // 出水口
    g.fillStyle(0x7f8c8d);
    g.fillRect(785, 375, 5, 8);

    // 绿植 x2
    const plantPositions = [500, 830];
    plantPositions.forEach((px) => {
      // 花盆（梯形简化为矩形）
      g.fillStyle(0xa0522d);
      g.fillRect(px - 12, 440, 24, 20);
      g.fillStyle(0x8b4513);
      g.fillRect(px - 14, 438, 28, 5);
      // 茎
      g.fillStyle(0x27ae60);
      g.fillRect(px - 2, 420, 4, 20);
      // 叶子
      g.fillStyle(0x2ecc71);
      g.fillCircle(px - 8, 415, 8);
      g.fillCircle(px + 8, 415, 8);
      g.fillCircle(px, 408, 10);
      // 叶子高光
      g.fillStyle(0x58d68d, 0.5);
      g.fillCircle(px - 6, 413, 3);
      g.fillCircle(px + 6, 413, 3);
    });

    // ============ 7. 服务器区 (x: 860-1260) ============
    // 服务器机柜 x2
    const serverX = [900, 1000];
    serverX.forEach((sx) => {
      // 机柜外壳
      g.fillStyle(0x2c3e50);
      g.fillRect(sx, 300, 40, 80);
      // 机柜高光边
      g.fillStyle(0x34495e);
      g.fillRect(sx, 300, 3, 80);
      // 散热孔（小横线）
      g.fillStyle(0x1a2a3a);
      for (let h = 0; h < 5; h++) {
        g.fillRect(sx + 5, 308 + h * 12, 30, 3);
      }
      // 指示灯（初始颜色）
      const ledColors = [0x2ecc71, 0xf39c12, 0xe74c3c];
      ledColors.forEach((col, i) => {
        g.fillStyle(col);
        g.fillCircle(sx + 35, 310 + i * 12, 3);
      });
      // 状态 LED（等待闪烁）
      g.fillStyle(0x2ecc71);
      g.fillCircle(sx + 35, 346, 3);
    });

    // 线缆（从服务器底部到地面）
    g.lineStyle(3, 0x1a1a2a);
    g.lineBetween(920, 380, 915, 450);
    g.lineBetween(925, 380, 930, 450);
    g.lineBetween(1020, 380, 1015, 450);
    g.lineBetween(1025, 380, 1030, 450);

    // ============ 8. 门口 (底部中央) ============
    // 门框
    g.fillStyle(0x7b5b3a);
    g.fillRect(605, 520, 70, 105);
    // 门板
    g.fillStyle(0x8b6914);
    g.fillRect(610, 525, 60, 100);
    // 门板分割线
    g.fillStyle(0x7a5c10);
    g.fillRect(610, 525, 60, 3);
    g.fillRect(610, 575, 60, 3);
    g.fillRect(610, 620, 60, 3);
    // 门把手
    g.fillStyle(0xd4ac0d);
    g.fillCircle(660, 580, 4);
    // 门框顶部装饰
    g.fillStyle(0x8b6914);
    g.fillRect(600, 515, 80, 8);

    // ============ 启动服务器指示灯闪烁 ============
    this.startServerBlink();
  }

  /**
   * 创建场景道具
   * 背景图已包含完整办公室布局（桌椅、服务器、休息区），
   * 只添加动态元素（猫咪）和 Agent 角色
   */
  private createSceneProps(): void {
    // 场景道具已在 createOfficeBackground 中绘制
  }

  /**
   * 创建顶部状态栏（时钟 + 在线统计）
   * 浮在画布最顶部，半透明不遮挡太多
   */
  private createTopStatusBar(): void {
    // 状态栏背景（与侧边栏 header 统一蓝色风格）
    const statusBg = this.add.graphics();
    statusBg.fillStyle(0x0f3460, 0.7);
    statusBg.fillRect(0, 0, GAME_WIDTH, 24);
    statusBg.setDepth(100);

    // 时钟（右上角）
    this.clockText = this.add.text(GAME_WIDTH - 60, 12, '00:00', {
      fontSize: '13px',
      color: '#e8e8e8',
      fontFamily: 'monospace',
    });
    this.clockText.setOrigin(0.5);
    this.clockText.setDepth(101);

    // 在线状态（左上角）
    this.statusText = this.add.text(10, 12, '在线: 0 / 0', {
      fontSize: '12px',
      color: '#e8e8e8',
      fontFamily: 'Segoe UI',
    });
    this.statusText.setOrigin(0, 0.5);
    this.statusText.setDepth(101);

    // 启动时钟更新
    this.updateClock();
    this.time.addEvent({
      delay: 1000,
      callback: this.updateClock,
      callbackScope: this,
      loop: true,
    });
  }

  /**
   * 更新时钟显示
   */
  private updateClock(): void {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.clockText.setText(`${hours}:${minutes}`);
  }

  /**
   * 启动服务器闪烁效果
   */
  private startServerBlink(): void {
    // 创建专用闪烁图形层（覆盖在背景之上，Agent 之下）
    this.serverBlinkGfx = this.add.graphics();
    this.serverBlinkGfx.setDepth(-50);

    let blinkState = false;
    const serverX = [920, 1020];
    const blinkLedY = 346;

    const drawLeds = (bright: boolean) => {
      this.serverBlinkGfx!.clear();
      serverX.forEach((sx) => {
        // 状态 LED 在机柜右下角 (sx+35, 346)
        this.serverBlinkGfx!.fillStyle(bright ? 0x2ecc71 : 0x1a7a3a);
        this.serverBlinkGfx!.fillCircle(sx + 35, blinkLedY, 3);
      });
    };

    drawLeds(true);

    this.serverTimer = this.time.addEvent({
      delay: 800,
      callback: () => {
        blinkState = !blinkState;
        drawLeds(blinkState);
      },
      loop: true,
    });
  }

  /**
   * 启动 Day/Night 周期（暂时禁用，背景图自带配色）
   */
  private startDayNightCycle(): void {
    // 背景图已有固定配色，不再叠加 day/night 滤镜
  }

  /**
   * 更新 Agent 列表（供外部调用）
   * Phase 3: 所有已知 Agent 都要有角色，离线的显示在门口
   */
  updateAgents(agents: AgentData[]): void {
    // 建立 ID 到状态的映射
    const agentStatusMap = new Map(agents.map((a) => [a.id, a.status]));

    // 先按照状态分组，为每个状态内的 Agent 分配不同的偏移
    const statusGroups: Record<string, string[]> = {};
    
    // 按 KNOWN_AGENTS 的顺序分组（保证顺序一致）
    KNOWN_AGENTS.forEach((known) => {
      const status = agentStatusMap.get(known.id) || 'offline';
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      statusGroups[status].push(known.id);
    });

    // 为每个 Agent 计算最终位置
    const agentPositions: Map<string, { x: number; y: number }> = new Map();
    
    Object.entries(statusGroups).forEach(([status, agentIds]) => {
      const basePos = STATUS_POSITIONS[status] || STATUS_POSITIONS['offline'];
      
      agentIds.forEach((agentId, index) => {
        const offsetIdx = index % AREA_OFFSETS.length;
        const offset = AREA_OFFSETS[offsetIdx];
        agentPositions.set(agentId, {
          x: basePos.x + offset.x,
          y: basePos.y + offset.y,
        });
      });
    });

    // 确保所有已知 Agent 都有角色
    KNOWN_AGENTS.forEach((known) => {
      const status = agentStatusMap.get(known.id) || 'offline';
      const name = known.name;
      const targetPos = agentPositions.get(known.id) || STATUS_POSITIONS['offline'];

      if (this.agents.has(known.id)) {
        // 更新状态并移动到偏移位置
        const sprite = this.agents.get(known.id)!;
        sprite.setStatus(status);
        sprite.walkTo(targetPos.x, targetPos.y);
      } else {
        // 创建新 Agent
        const sprite = new AgentSprite({
          agentId: known.id,
          name: name,
          status: status,
          emoji: known.emoji,
          scene: this,
        });

        // 初始位置设为偏移后的位置
        sprite.setPosition(targetPos.x, targetPos.y);

        // 设置交互（点击打开聊天面板）
        sprite.setInteractive({ useHandCursor: true });
        sprite.on('pointerdown', () => {
          (globalThis as any).__pixelOfficeOpenChat?.(known.id, known.name);
        });

        this.agents.set(known.id, sprite);
        this.bubbleSystem.registerAgent(sprite);

        // 入场动画（仅第一次）
        if (!this.hasEntered) {
          sprite.enterOffice(targetPos.x, targetPos.y);
        }
      }
    });

    // 更新状态栏
    const onlineCount = agents.filter((a) => a.status === 'online' || a.status === 'working').length;
    this.statusText.setText(`在线: ${onlineCount} / 总数: ${KNOWN_AGENTS.length}`);

    // 标记已完成入场
    if (!this.hasEntered && agents.length > 0) {
      this.hasEntered = true;
      // 启动自动气泡
      this.bubbleSystem.startAutoBubble(30000);
    }
  }

  /**
   * 高亮指定 Agent
   */
  highlightAgent(agentId: string): void {
    const sprite = this.agents.get(agentId);
    if (sprite) {
      sprite.highlight();
    }
  }

  /**
   * 获取气泡系统
   */
  getBubbleSystem(): BubbleSystem {
    return this.bubbleSystem;
  }

  // 流式回复文本缓存（agentId → 拼接中的文本）
  private streamingReplies: Map<string, string> = new Map();

  /**
   * 处理 Agent 回复事件（来自 WebSocket）
   * 在角色头上显示气泡
   */
  handleAgentReply(sessionKey: string, text: string, isComplete: boolean): void {
    // 追加流式文本
    const prev = this.streamingReplies.get(sessionKey) || '';
    const full = prev + text;
    this.streamingReplies.set(sessionKey, full);

    if (isComplete) {
      // 完成：显示完整回复（截断过长的文本）
      const display = full.length > 60 ? full.substring(0, 57) + '...' : full;
      if (display.trim()) {
        this.bubbleSystem.showBubble(sessionKey, display);
      }
      this.streamingReplies.delete(sessionKey);
    } else {
      // 流式中：显示 "回复中..." 提示
      this.bubbleSystem.showBubble(sessionKey, '💬 回复中...');
    }
  }

  /**
   * 销毁场景
   */
  shutdown(): void {
    if (this.serverTimer) {
      this.serverTimer.destroy();
    }
    if (this.dayNightTimer) {
      this.dayNightTimer.destroy();
    }
    if (this.bubbleSystem) {
      this.bubbleSystem.destroy();
    }
    this.agents.clear();
  }
}