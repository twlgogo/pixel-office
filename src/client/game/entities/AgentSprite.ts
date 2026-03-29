/**
 * Agent 角色精灵类
 * 使用 Phaser Graphics API 绘制像素风角色头像
 * 不同 Agent 用不同颜色区分
 */

import Phaser from 'phaser';

// Agent 状态对应位置（适配手绘像素风办公室背景布局）
// 多 Agent 同区域时按索引错开
export const STATUS_POSITIONS: Record<string, { x: number; y: number }> = {
  'online': { x: 240, y: 350 },   // 工作区中间桌前
  'idle': { x: 650, y: 350 },    // 茶歇区沙发旁
  'working': { x: 950, y: 280 },  // 服务器区
  'offline': { x: 640, y: 560 }, // 门口
  'thinking': { x: 950, y: 280 }, // 服务器区
};

// 同区域内多个 Agent 的偏移量（按序号错开）
export const AREA_OFFSETS = [
  { x: 0, y: 0 },
  { x: -60, y: 20 },
  { x: 60, y: 20 },
  { x: -120, y: 40 },
  { x: 0, y: 40 },
  { x: 120, y: 40 },
  { x: -60, y: 60 },
];

export interface AgentSpriteConfig {
  agentId: string;
  name: string;
  status: string;
  emoji: string;
  scene: Phaser.Scene;
}

// Agent 颜色配置接口
export interface AgentColors {
  hair: number;
  skin: number;
  shirt: number;
  pants: number;
  shoes: number;
}

// Agent 像素角色调色板
const AGENT_PALETTES: Record<string, AgentColors> = {
  '🐦': { hair: 0x1565C0, skin: 0xFFCC80, shirt: 0x4FC3F7, pants: 0x1565C0, shoes: 0x0D47A1 },
  '🦉': { hair: 0x5D4037, skin: 0xFFCC80, shirt: 0x8D6E63, pants: 0x4E342E, shoes: 0x3E2723 },
  '🐴': { hair: 0x2E7D32, skin: 0xFFCC80, shirt: 0x66BB6A, pants: 0x1B5E20, shoes: 0x004D40 },
  '🎨': { hair: 0x6A1B9A, skin: 0xFFCC80, shirt: 0xAB47BC, pants: 0x4A148C, shoes: 0x38006B },
  '🕷️': { hair: 0xE65100, skin: 0xFFCC80, shirt: 0xFF7043, pants: 0xBF360C, shoes: 0x8B1A00 },
  '🦎': { hair: 0x00695C, skin: 0xFFCC80, shirt: 0x26A69A, pants: 0x004D40, shoes: 0x002E26 },
  '🐷': { hair: 0xAD1457, skin: 0xFFCC80, shirt: 0xEC407A, pants: 0x880E4F, shoes: 0x560027 },
};

export class AgentSprite extends Phaser.GameObjects.Container {
  public agentId: string;
  public name: string;
  public status: string;
  public emoji: string;

  // 像素角色头像
  private avatarSprite: Phaser.GameObjects.Graphics;
  // 名称标签
  private label: Phaser.GameObjects.Text;
  // 状态指示器
  private statusIndicator: Phaser.GameObjects.Graphics;
  // 高亮图形
  private highlightGraphics: Phaser.GameObjects.Graphics;
  // 气泡容器
  private bubbleContainer: Phaser.GameObjects.Container | null = null;
  // 是否高亮中
  private isHighlighted: boolean = false;
  // 高亮动画
  private highlightTween: Phaser.Tweens.Tween | null = null;

  constructor(config: AgentSpriteConfig) {
    const pos = STATUS_POSITIONS[config.status] || STATUS_POSITIONS['offline'];
    super(config.scene, pos.x, pos.y);

    this.agentId = config.agentId;
    this.name = config.name;
    this.status = config.status;
    this.emoji = config.emoji;

    // 创建高亮图形
    this.highlightGraphics = config.scene.add.graphics();
    this.add(this.highlightGraphics);

    // 创建像素角色头像
    this.avatarSprite = config.scene.add.graphics();
    const palette = AGENT_PALETTES[config.emoji] || AGENT_PALETTES['🐦'];
    this.drawPixelCharacter(this.avatarSprite, palette);
    // 像素角色总大小 48x64，缩放至约 34x45 匹配原头像大小
    this.avatarSprite.setScale(0.7);
    // 头像位置保持在 (0, -8) 居中
    this.avatarSprite.setPosition(0, -8);
    this.add(this.avatarSprite);

    // 离线状态半透明
    if (config.status === 'offline') {
      this.avatarSprite.setAlpha(0.4);
    }

    // 创建状态指示器
    this.statusIndicator = config.scene.add.graphics();
    this.drawStatusIndicator();
    this.add(this.statusIndicator);

    // 创建名称标签
    // 只显示名字，不含 emoji 和括号
    const displayName = config.name.replace(/^[\u{1F300}-\u{1FAFF}]\s*/u, '').replace(/\s*\(.*\)\s*$/, '');
    this.label = config.scene.add.text(0, 20, displayName, {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'Segoe UI',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 4, y: 1 },
    });
    this.label.setOrigin(0.5);
    this.add(this.label);

    config.scene.add.existing(this);
  }

  /**
   * 从名字中提取 emoji
   */
  static extractEmoji(name: string): string {
    const match = name.match(/[\u{1F300}-\u{1FAFF}]/u);
    return match ? match[0] : '🤖';
  }

  /**
   * 绘制像素角色
   * 角色为 24x32 像素网格，每个像素绘制为 2x2 的方块
   * 绘制时以 (0,0) 为中心点，左上角为 (-24, -32)
   */
  private drawPixelCharacter(g: Phaser.GameObjects.Graphics, colors: AgentColors): void {
    // 辅助函数：在网格坐标 (gx, gy) 处绘制像素，颜色为 col
    // 网格中心为 (0,0)，所以要偏移 (-12, -16) 再乘以 2（每个像素 2x2）
    const px = (gx: number, gy: number, col: number) => {
      const sx = (gx - 12) * 2;
      const sy = (gy - 16) * 2;
      g.fillStyle(col);
      g.fillRect(sx, sy, 2, 2);
    };

    const darkColor = 0x333333;

    // 头发：行 0-3，x=10-12（3x4 像素块）
    for (let y = 0; y < 4; y++) {
      px(10, y, colors.hair);
      px(11, y, colors.hair);
      px(12, y, colors.hair);
    }

    // 脸部：行 4-8，x=9-13（5x5 像素块）
    for (let y = 4; y < 9; y++) {
      for (let x = 9; x < 14; x++) {
        px(x, y, colors.skin);
      }
    }

    // 眼睛：行 4-5，x=10 和 x=12（两个深色像素点，间隔 1 像素）
    px(10, 4, darkColor);
    px(12, 4, darkColor);
    px(10, 5, darkColor);
    px(12, 5, darkColor);

    // 颈部：行 8-9，x=11（1x2 像素）
    px(11, 8, colors.skin);
    px(11, 9, colors.skin);

    // 身体：行 10-18，x=8-14（7x9 像素块）
    for (let y = 10; y < 19; y++) {
      for (let x = 8; x < 15; x++) {
        px(x, y, colors.shirt);
      }
    }

    // 手臂：行 12-14，两侧各 1x3 像素
    px(7, 12, colors.skin);
    px(7, 13, colors.skin);
    px(7, 14, colors.skin);
    px(15, 12, colors.skin);
    px(15, 13, colors.skin);
    px(15, 14, colors.skin);

    // 腰带：行 19-20，x=9-13（5x2 像素，深色）
    for (let x = 9; x < 14; x++) {
      px(x, 19, darkColor);
      px(x, 20, darkColor);
    }

    // 裤子/腿：行 21-31，左腿 x=9-10，右腿 x=13-14（3x11 像素，分左右两条腿）
    for (let y = 21; y < 32; y++) {
      px(9, y, colors.pants);
      px(10, y, colors.pants);
      px(13, y, colors.pants);
      px(14, y, colors.pants);
    }

    // 鞋子：行 29-31，每只 2x3 像素
    for (let y = 29; y < 32; y++) {
      // 左鞋
      px(9, y, colors.shoes);
      px(10, y, colors.shoes);
      // 右鞋
      px(13, y, colors.shoes);
      px(14, y, colors.shoes);
    }
  }

  /**
   * 绘制状态指示器（小圆点）
   */
  private drawStatusIndicator(): void {
    const statusColors: Record<string, number> = {
      'online': 0x4CAF50,
      'idle': 0xFFC107,
      'working': 0x2196F3,
      'thinking': 0x9C27B0,
      'offline': 0x757575,
    };

    const dotColor = statusColors[this.status] || 0x757575;

    this.statusIndicator.clear();

    // 状态圆点（头像右下角）
    this.statusIndicator.fillStyle(0xffffff, 1);
    this.statusIndicator.fillCircle(16, 6, 5);
    this.statusIndicator.fillStyle(dotColor, 1);
    this.statusIndicator.fillCircle(16, 6, 3);
  }

  /**
   * 设置角色状态
   * 只切换外观，不处理位置移动（位置由 OfficeScene 统一管理）
   */
  setStatus(newStatus: string): void {
    if (this.status === newStatus) return;

    this.status = newStatus;

    // 更新离线半透明
    if (newStatus === 'offline') {
      this.avatarSprite.setAlpha(0.4);
    } else {
      this.avatarSprite.setAlpha(1.0);
    }

    // 更新状态指示器
    this.drawStatusIndicator();
  }

  /**
   * 走路到指定位置
   */
  walkTo(x: number, y: number, onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this,
      x: x,
      y: y,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onComplete: onComplete ? () => onComplete() : undefined,
    });
  }

  /**
   * 显示气泡
   */
  showBubble(text: string): void {
    // 隐藏已有气泡
    this.hideBubble();

    this.bubbleContainer = this.scene.add.container(this.x, this.y - 45);

    // 气泡背景
    const bubbleWidth = Math.min(text.length * 10 + 20, 200);
    const bubbleHeight = 40;

    const bubble = this.scene.add.graphics();
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, 8);
    bubble.lineStyle(1, 0xcccccc, 1);
    bubble.strokeRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, 8);

    // 小三角指向角色
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillTriangle(0, bubbleHeight / 2 - 2, -6, bubbleHeight / 2 + 8, 6, bubbleHeight / 2 + 8);

    // 气泡文字
    const bubbleText = this.scene.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#333333',
      fontFamily: 'Segoe UI',
      align: 'center',
      wordWrap: { width: bubbleWidth - 16 },
    });
    bubbleText.setOrigin(0.5);

    this.bubbleContainer.add([bubble, bubbleText]);

    // 打字机效果
    let charIndex = 0;
    const typeInterval = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        charIndex++;
        bubbleText.setText(text.substring(0, charIndex));
        if (charIndex >= text.length) {
          typeInterval.destroy();
        }
      },
      loop: true,
    });

    // 15秒后自动淡出
    this.scene.time.delayedCall(15000, () => {
      this.hideBubble();
    });
  }

  /**
   * 隐藏气泡
   */
  hideBubble(): void {
    if (this.bubbleContainer) {
      // 淡出效果
      this.scene.tweens.add({
        targets: this.bubbleContainer,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.bubbleContainer?.destroy();
          this.bubbleContainer = null;
        },
      });
    }
  }

  /**
   * 高亮闪烁动画
   */
  highlight(): void {
    this.isHighlighted = true;

    if (this.highlightTween) {
      this.highlightTween.stop();
    }

    this.highlightTween = this.scene.tweens.add({
      targets: this.avatarSprite,
      alpha: 0.3,
      duration: 300,
      yoyo: true,
      repeat: 3,
      onUpdate: () => {
        // 头像高亮时绘制黄色边框
        this.highlightGraphics.clear();
        this.highlightGraphics.lineStyle(2, 0xffff00, this.avatarSprite.alpha);
        this.highlightGraphics.strokeCircle(0, -8, 24);
      },
      onComplete: () => {
        this.highlightGraphics.clear();
        this.avatarSprite.setAlpha(this.status === 'offline' ? 0.4 : 1.0);
        this.isHighlighted = false;
      },
    });
  }

  /**
   * 从门口走进办公室的入场动画
   */
  enterOffice(targetX: number, targetY: number): void {
    // 先放置在门口位置
    this.setPosition(600, 580);
    this.setAlpha(0);

    // 淡入
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        // 走路到目标位置
        this.walkTo(targetX, targetY);
      },
    });
  }

  /**
   * 销毁
   */
  destroy(fromScene?: boolean): void {
    if (this.highlightTween) {
      this.highlightTween.stop();
    }
    this.hideBubble();
    super.destroy(fromScene);
  }
}
