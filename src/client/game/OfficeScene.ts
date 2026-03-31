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
   * 创建高级像素风办公室背景
   */
  private createOfficeBackground(): void {
    const g = this.add.graphics();
    g.setDepth(-100);

    // ============ 1. 高级天花板设计 ============
    // 主天花板 - 深色基调
    g.fillStyle(0x2c3e50);
    g.fillRect(0, 0, 1280, 30);

    // 天花板装饰线条
    g.fillStyle(0x34495e);
    g.fillRect(0, 15, 1280, 3);
    g.fillRect(0, 25, 1280, 2);

    // 现代化吊灯 - LED 灯条设计
    const lightX = [200, 650, 1050];
    lightX.forEach((x) => {
      // 吊灯底座
      g.fillStyle(0x1a1a2e);
      g.fillRect(x - 25, 20, 50, 10);
      g.fillRect(x - 20, 30, 40, 2);

      // LED 灯光效果（主光源）
      g.fillStyle(0x00d4ff, 0.4);
      g.fillRect(x - 30, 32, 60, 15);

      // 灯光反射
      g.fillStyle(0x74ebd5, 0.2);
      g.fillRect(x - 35, 35, 70, 20);

      // 附加装饰
      g.fillStyle(0x4834d4);
      g.fillRect(x - 5, 25, 2, 3);
      g.fillRect(x + 3, 25, 2, 3);
    });

    // ============ 2. 墙壁 - 立体设计 ============
    // 主墙壁 - 深灰色基调
    g.fillStyle(0x5a5a6e);
    g.fillRect(0, 30, 1280, 80);

    // 中层墙壁
    g.fillStyle(0x6e6e8e);
    g.fillRect(0, 110, 1280, 30);

    // 顶部装饰线
    g.fillStyle(0x8e8eb0);
    g.fillRect(0, 140, 1280, 5);

    // 墙面纹理 - 微妙的垂直条纹
    g.fillStyle(0x6a6a82, 0.3);
    for (let x = 0; x < 1280; x += 100) {
      g.fillRect(x, 30, 1, 110);
    }

    // 踢脚线 - 双层设计
    g.fillStyle(0x2a2a3a);
    g.fillRect(0, 145, 1280, 8);
    g.fillStyle(0x1a1a2a);
    g.fillRect(0, 152, 1280, 3);

    // ============ 3. 区域标识牌 ============
    // 工作区标识（金属铭牌）
    g.fillStyle(0x8b8b8b);
    g.fillRect(100, 40, 80, 30);
    g.fillStyle(0xababab);
    g.fillRect(105, 42, 70, 26);
    // 文字区域（预留）
    g.fillStyle(0x3a3a3a);
    g.fillRect(130, 52, 25, 10);
    g.fillRect(165, 52, 15, 10);

    // 茶歇区标识
    g.fillStyle(0x8b6239);
    g.fillRect(600, 40, 80, 30);
    g.fillStyle(0xa67c52);
    g.fillRect(605, 42, 70, 26);
    g.fillStyle(0x3a2a1a);
    g.fillRect(620, 52, 40, 10);

    // 服务器区标识
    g.fillStyle(0x2c3e50);
    g.fillRect(950, 40, 100, 30);
    g.fillStyle(0x34495e);
    g.fillRect(955, 42, 90, 26);
    // 服务器图标
    g.fillStyle(0x00ff00);
    g.fillRect(980, 52, 5, 10);
    g.fillRect(990, 52, 5, 10);
    g.fillRect(1000, 52, 5, 10);
    g.fillRect(1010, 52, 5, 10);

    // ============ 3. 分区柱子 ============
    g.fillStyle(0x5c5c6e);
    g.fillRect(490, 150, 10, 550);
    g.fillRect(855, 150, 10, 550);

    // ============ 4. 地板 - 高级设计 ============
    // 主地板 - 深色基底
    g.fillStyle(0x2a2a3a);
    g.fillRect(0, 153, 1280, 567);

    // 边缘装饰线
    g.fillStyle(0x3a3a4a);
    g.fillRect(0, 153, 1280, 2);
    g.fillRect(0, 718, 1280, 2);

    // 瓷砖网格线 - 增强立体感
    g.lineStyle(1, 0x1a1a2a);
    for (let x = 0; x <= 1280; x += 64) {
      g.lineBetween(x, 153, x, 720);
    }
    for (let y = 153; y <= 720; y += 64) {
      g.lineBetween(0, y, 1280, y);
    }

    // ============ 5. 区域地板材质区分 ============
    // 工作区 - 高级地毯纹理
    // 地毯主体
    g.fillStyle(0x4a3d36);
    g.fillRect(20, 400, 460, 300);
    // 地毯纹理
    g.fillStyle(0x5a4946, 0.3);
    for (let x = 20; x < 480; x += 20) {
      for (let y = 400; y < 700; y += 20) {
        if ((x + y) % 40 === 0) {
          g.fillRect(x, y, 10, 10);
        }
      }
    }
    // 地毯边缘
    g.fillStyle(0x3a2d26);
    g.fillRect(18, 398, 464, 4);

    // 茶歇区 - 木地板纹理
    // 木地板主体
    g.fillStyle(0x6d5639);
    g.fillRect(500, 400, 350, 300);
    // 木纹线条
    g.fillStyle(0x5d4629, 0.5);
    for (let x = 500; x < 850; x += 50) {
      g.fillRect(x, 400, 2, 300);
    }
    // 木板边缘
    g.fillStyle(0x4d3629);
    g.fillRect(498, 398, 354, 4);

    // 服务器区 - 水磨石地板
    // 地板主体
    g.fillStyle(0x3a3a4a);
    g.fillRect(865, 400, 395, 300);
    // 石材纹理点
    g.fillStyle(0x4a4a5a, 0.3);
    for (let x = 865; x < 1260; x += 16) {
      for (let y = 400; y < 700; y += 16) {
        if (Math.random() > 0.7) {
          g.fillRect(x, y, 8, 8);
        }
      }
    }
    // 区域分割线
    g.fillStyle(0x5a5a6a);
    g.fillRect(860, 400, 5, 300);

    // ============ 6. 工作区 - 现代化办公桌椅 ============
    const deskPositions = [
      { x: 100, y: 450 },
      { x: 260, y: 450 },
      { x: 420, y: 450 }
    ];

    deskPositions.forEach(pos => {
      // 电脑桌 - 深色木质
      // 桌面
      g.fillStyle(0x3d2817);
      g.fillRect(pos.x - 40, pos.y, 80, 40);
      g.fillStyle(0x4a3427);
      g.fillRect(pos.x - 40, pos.y, 80, 4);

      // 桌腿 - 双腿设计
      g.fillStyle(0x2d1817);
      g.fillRect(pos.x - 35, pos.y + 40, 8, 40);
      g.fillRect(pos.x + 27, pos.y + 40, 8, 40);

      // 显示器 - 现代简约
      g.fillStyle(0x1a1a1a);
      g.fillRect(pos.x - 15, pos.y - 25, 30, 20);
      g.fillStyle(0x2a2a2a);
      g.fillRect(pos.x - 13, pos.y - 23, 26, 16);
      // 显示器支架
      g.fillRect(pos.x - 2, pos.y - 5, 4, 10);
      g.fillRect(pos.x - 8, pos.y + 5, 16, 3);

      // 键盘
      g.fillStyle(0x333333);
      g.fillRect(pos.x - 20, pos.y + 5, 40, 8);
      g.fillStyle(0x444444);
      g.fillRect(pos.x - 18, pos.y + 7, 36, 4);

      // 人体工学办公椅
      // 椅背
      g.fillStyle(0x2c3e50);
      g.fillRect(pos.x - 15, pos.y - 20, 30, 30);
      g.fillStyle(0x34495e);
      g.fillRect(pos.x - 13, pos.y - 18, 26, 4);

      // 椅座
      g.fillStyle(0x34495e);
      g.fillRect(pos.x - 18, pos.y + 10, 36, 15);

      // 椅腿
      g.fillStyle(0x1a1a2e);
      g.fillRect(pos.x - 15, pos.y + 25, 4, 25);
      g.fillRect(pos.x + 11, pos.y + 25, 4, 25);

      // 头枕 - 蓝色点缀
      g.fillStyle(0x3498db);
      g.fillRect(pos.x - 10, pos.y - 25, 20, 5);
    });

    // ============ 6. 茶歇区 - 精致休闲空间 ============
    // 现代化 L 型沙发组合
    // 主沙发座垫
    g.fillStyle(0xe74c3c);
    g.fillRect(520, 430, 120, 25);
    g.fillStyle(0xf39c12);
    g.fillRect(520, 430, 120, 5);

    // 沙发靠背 - 环抱式
    g.fillStyle(0xc0392b);
    g.fillRect(520, 400, 120, 35);
    g.fillStyle(0xd35438, 0.3);
    g.fillRect(520, 400, 120, 8);

    // 扶手设计
    // 左扶手
    g.fillStyle(0xa93226);
    g.fillRect(515, 400, 15, 55);
    g.fillStyle(0xb23c4a);
    g.fillRect(517, 402, 11, 10);

    // 右扶手
    g.fillStyle(0xa93226);
    g.fillRect(630, 400, 15, 55);
    g.fillStyle(0xb23c4a);
    g.fillRect(632, 402, 11, 10);

    // 沙发底座
    g.fillStyle(0x8b2a1a);
    g.fillRect(520, 450, 120, 8);
    // 装饰线条
    g.fillStyle(0x9a3220);
    g.fillRect(520, 453, 120, 3);

    // 单人沙发 - 配色协调
    g.fillStyle(0x3498db);
    g.fillRect(680, 410, 80, 20);
    g.fillStyle(0x5dade2);
    g.fillRect(680, 410, 80, 4);
    g.fillStyle(0x2874a6);
    g.fillRect(675, 410, 10, 40);
    g.fillRect(755, 410, 10, 40);

    // 精致茶几
    // 茶几桌面 - 大理石纹理
    g.fillStyle(0xecf0f1);
    g.fillRect(580, 400, 80, 15);
    g.fillStyle(0xbdc3c7);
    g.fillRect(580, 400, 80, 4);
    // 大理石纹路
    g.fillStyle(0x95a5a6, 0.3);
    g.fillRect(585, 405, 3, 8);
    g.fillRect(595, 402, 5, 10);
    g.fillRect(610, 406, 4, 6);
    g.fillRect(625, 403, 3, 9);
    g.fillRect(640, 407, 6, 5);
    g.fillRect(655, 404, 4, 8);

    // 茶几腿 - 金色金属
    g.fillStyle(0xf39c12);
    g.fillRect(585, 415, 5, 30);
    g.fillRect(650, 415, 5, 30);
    // 腿底座
    g.fillStyle(0xf1c40f);
    g.fillRect(583, 443, 9, 5);
    g.fillRect(648, 443, 9, 5);

    // 咖啡杯组
    // 咖啡杯1
    g.fillStyle(0xecf0f1);
    g.fillRect(590, 385, 12, 10);
    g.fillStyle(0xbdc3c7);
    g.fillRect(592, 387, 8, 6);
    // 杯把
    g.fillStyle(0xecf0f1);
    g.fillRect(602, 390, 4, 5);
    // 咖啡蒸汽
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(594, 383, 2, 3);
    g.fillRect(598, 382, 2, 4);
    g.fillRect(602, 383, 2, 3);

    // 咖啡杯2
    g.fillStyle(0xecf0f1);
    g.fillRect(620, 388, 12, 10);
    g.fillStyle(0xbdc3c7);
    g.fillRect(622, 390, 8, 6);
    g.fillStyle(0xecf0f1);
    g.fillRect(632, 393, 4, 5);

    // 咖啡机 - 现代设计
    g.fillStyle(0x2c3e50);
    g.fillRect(720, 340, 40, 60);
    g.fillStyle(0x34495e);
    g.fillRect(722, 342, 36, 56);
    // 控制面板
    g.fillStyle(0x1a252f);
    g.fillRect(728, 350, 16, 20);
    // 按钮
    g.fillStyle(0xe74c3c);
    g.fillRect(730, 353, 4, 4);
    g.fillStyle(0xf39c12);
    g.fillRect(738, 353, 4, 4);
    // 显示屏
    g.fillStyle(0x27ae60);
    g.fillRect(730, 361, 12, 6);
    // 出水口
    g.fillStyle(0x7f8c8d);
    g.fillRect(735, 395, 8, 8);

    // 高级绿植装饰
    // 大盆栽
    g.fillStyle(0x8b4513);
    g.fillRect(540, 450, 30, 25);
    g.fillStyle(0xa0522d);
    g.fillRect(538, 448, 34, 5);
    // 植物茎
    g.fillStyle(0x27ae60);
    g.fillRect(555, 440, 3, 15);
    // 叶子层次
    g.fillStyle(0x2ecc71);
    g.fillCircle(550, 430, 10);
    g.fillCircle(560, 425, 12);
    g.fillCircle(555, 420, 10);
    // 叶子细节
    g.fillStyle(0x58d68d);
    g.fillRect(548, 430, 2, 4);
    g.fillRect(558, 425, 2, 4);

    // 吊篮植物
    g.fillStyle(0x8b4513);
    g.fillRect(750, 300, 25, 15);
    // 绳子
    g.fillStyle(0x654321);
    g.fillRect(755, 280, 2, 20);
    g.fillRect(768, 280, 2, 20);
    // 植物球
    g.fillStyle(0x27ae60);
    g.fillCircle(762, 310, 15);
    g.fillStyle(0x2ecc71);
    g.fillCircle(755, 305, 8);
    g.fillCircle(770, 307, 8);
    g.fillCircle(762, 315, 10);

    // 装饰画框
    g.fillStyle(0x8b6239);
    g.fillRect(680, 320, 80, 60);
    g.fillStyle(0xa67c52);
    g.fillRect(685, 325, 70, 50);
    // 画内容 - 抽象艺术
    g.fillStyle(0xe74c3c);
    g.fillRect(695, 335, 20, 20);
    g.fillStyle(0x3498db);
    g.fillRect(725, 335, 20, 20);
    g.fillStyle(0xf39c12);
    g.fillRect(710, 355, 20, 15);

    // ============ 7. 服务器区 - 科技数据中心 ============
    // 背景墙 - 科技感装饰
    g.fillStyle(0x1a1a2e);
    g.fillRect(865, 300, 395, 150);
    // 网格纹理
    g.fillStyle(0x0f0f1e);
    for (let x = 865; x < 1260; x += 20) {
      for (let y = 300; y < 450; y += 20) {
        g.fillRect(x, y, 1, 20);
        g.fillRect(x, y, 20, 1);
      }
    }

    // 机柜组 - 现代化设计
    const serverUnits = [
      { x: 880, y: 350 },
      { x: 940, y: 350 },
      { x: 1000, y: 350 },
      { x: 1060, y: 350 },
      { x: 1120, y: 350 }
    ];

    serverUnits.forEach((unit, index) => {
      // 机柜主体 - 深金属色
      g.fillStyle(0x1e293b);
      g.fillRect(unit.x, unit.y, 50, 120);
      // 边框高光
      g.fillStyle(0x334155);
      g.fillRect(unit.x, unit.y, 3, 120);

      // 面板细节
      g.fillStyle(0x0f172a);
      g.fillRect(unit.x + 5, unit.y + 5, 40, 30);
      g.fillRect(unit.x + 5, unit.y + 40, 40, 30);
      g.fillRect(unit.x + 5, unit.y + 75, 40, 40);

      // 散热格栅
      const grillY = unit.y + 10;
      for (let i = 0; i < 4; i++) {
        g.fillRect(unit.x + 10 + i * 10, grillY, 2, 8);
        g.fillRect(unit.x + 10 + i * 10, grillY + 15, 2, 8);
      }

      // LED 指示灯系统
      const ledColors = [
        index === 0 ? 0x00ff00 : 0x00cc00,  // 电源
        index === 0 ? 0x0099ff : 0x0077aa,  // 网络
        index === 0 ? 0xffaa00 : 0xff8800,  // 存储
        index === 0 ? 0xff0066 : 0xcc0044   // 错误
      ];

      ledColors.forEach((color, ledIndex) => {
        g.fillStyle(color);
        g.fillCircle(unit.x + 42, unit.y + 12 + ledIndex * 8, 2);
      });
    });

    // 主网络交换机
    g.fillStyle(0x2d3748);
    g.fillRect(900, 280, 80, 40);
    g.fillStyle(0x4a5568);
    g.fillRect(905, 285, 70, 30);
    // 端口指示灯
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0x00ff00);
      g.fillRect(910 + i * 8, 295, 4, 4);
    }

    // 网络状态面板
    g.fillStyle(0x1a202c);
    g.fillRect(1000, 280, 60, 40);
    g.fillStyle(0x2d3748);
    g.fillRect(1005, 285, 50, 30);
    // 屏幕显示
    g.fillStyle(0x00ff00);
    g.fillRect(1010, 290, 40, 15);
    g.fillRect(1012, 290, 2, 15);
    g.fillRect(1018, 290, 2, 15);
    g.fillRect(1024, 290, 2, 15);
    g.fillRect(1030, 290, 2, 15);
    g.fillRect(1036, 290, 2, 15);

    // 动态线缆系统
    g.lineStyle(2, 0x00ccff);
    // 主线缆
    g.lineBetween(940, 320, 940, 470);
    g.lineBetween(1000, 320, 1000, 470);
    // 分支线缆
    g.lineBetween(880, 470, 1120, 470);
    // 连接线
    for (let x = 880; x <= 1120; x += 80) {
      g.lineBetween(x, 470, x, 480);
    }

    // 地面插座
    for (let x = 880; x <= 1120; x += 80) {
      // 插座底座
      g.fillStyle(0x2c3e50);
      g.fillRect(x - 10, 480, 20, 15);
      g.fillStyle(0x34495e);
      g.fillRect(x - 8, 482, 16, 11);
      // 插孔
      g.fillStyle(0x1a1a2a);
      g.fillRect(x - 6, 484, 5, 5);
      g.fillRect(x + 1, 484, 5, 5);
    }

    // 监控屏幕
    g.fillStyle(0x000000);
    g.fillRect(1150, 300, 100, 80);
    g.fillStyle(0x003300);
    g.fillRect(1152, 302, 96, 76);
    // 显示内容
    g.fillStyle(0x00ff00);
    for (let i = 0; i < 20; i++) {
      g.fillRect(1155, 305 + i * 3, Math.random() * 90, 2);
    }
    // 屏幕边框
    g.fillStyle(0x1a1a1a);
    g.fillRect(1148, 298, 104, 84);

    // ============ 8. 入口区 - 现代化接待 ============
    // 地面材质变化
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 720, 1280, 10);

    // 接待台
    g.fillStyle(0x2c3e50);
    g.fillRect(550, 550, 180, 80);
    g.fillStyle(0x34495e);
    g.fillRect(550, 550, 180, 8);
    // 桌面装饰
    g.fillStyle(0x1a252f);
    g.fillRect(580, 560, 120, 3);
    g.fillRect(580, 570, 120, 2);

    // 公司标识牌
    g.fillStyle(0xffffff);
    g.fillRect(600, 540, 80, 20);
    g.fillStyle(0x2c3e50);
    g.fillRect(605, 542, 70, 16);
    // 文字（像素化效果）
    g.fillStyle(0xecf0f1);
    g.fillRect(615, 548, 50, 8);

    // 门禁系统
    g.fillStyle(0x34495e);
    g.fillRect(620, 580, 20, 30);
    g.fillStyle(0x2c3e50);
    g.fillRect(622, 582, 16, 26);
    // 扫描器
    g.fillStyle(0x00ff00);
    g.fillRect(625, 585, 10, 3);
    g.fillRect(625, 592, 10, 3);
    // 按钮
    g.fillStyle(0xe74c3c);
    g.fillRect(624, 600, 14, 4);

    // 现代化双开门设计
    // 左门框
    g.fillStyle(0x1a1a2e);
    g.fillRect(580, 530, 15, 110);
    g.fillStyle(0x2a2a3a);
    g.fillRect(582, 532, 11, 106);
    // 右门框
    g.fillStyle(0x1a1a2e);
    g.fillRect(685, 530, 15, 110);
    g.fillStyle(0x2a2a3a);
    g.fillRect(687, 532, 11, 106);

    // 左门板
    g.fillStyle(0x4a5568);
    g.fillRect(595, 535, 70, 100);
    g.fillStyle(0x5a6578);
    g.fillRect(595, 535, 70, 5);
    // 门把手
    g.fillStyle(0x718096);
    g.fillRect(655, 565, 6, 15);

    // 右门板
    g.fillStyle(0x4a5568);
    g.fillRect(615, 535, 70, 100);
    g.fillStyle(0x5a6578);
    g.fillRect(615, 535, 70, 5);
    // 门把手
    g.fillStyle(0x718096);
    g.fillRect(625, 565, 6, 15);

    // 地面欢迎地毯
    g.fillStyle(0xe74c3c);
    g.fillRect(620, 630, 60, 25);
    g.fillStyle(0xf39c12);
    g.fillRect(625, 633, 50, 3);

    // ============ 9. 装饰细节 ============
    // 墙面时钟
    g.fillStyle(0x2c3e50);
    g.fillRect(100, 50, 60, 60);
    g.fillStyle(0x34495e);
    g.fillRect(105, 55, 50, 50);
    // 时钟刻度
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * Math.PI / 180;
      const x = 130 + Math.cos(angle) * 20;
      const y = 80 + Math.sin(angle) * 20;
      g.fillRect(x, y, 2, 2);
    }
    // 时针
    g.fillStyle(0xffffff);
    g.fillRect(130, 80, 2, 15);
    // 分针
    g.fillRect(130, 80, 2, 20);

    // 消息板
    g.fillStyle(0xffffff);
    g.fillRect(200, 50, 80, 60);
    g.fillStyle(0xf8f9fa);
    g.fillRect(205, 55, 70, 50);
    // 固定钉
    g.fillStyle(0x6c757d);
    g.fillRect(203, 53, 4, 4);
    g.fillRect(273, 53, 4, 4);
    g.fillRect(203, 103, 4, 4);
    g.fillRect(273, 103, 4, 4);
    // 留白区域（用于显示消息）
    g.fillStyle(0xe9ecef);
    g.fillRect(210, 65, 60, 35);

    // 文件柜
    g.fillStyle(0x495057);
    g.fillRect(300, 520, 80, 100);
    g.fillStyle(0x6c757d);
    g.fillRect(302, 522, 76, 96);
    // 抽屉
    for (let i = 0; i < 3; i++) {
      g.fillRect(305, 530 + i * 25, 70, 8);
      g.fillRect(305, 545 + i * 25, 70, 8);
      // 把手
      g.fillStyle(0xadb5bd);
      g.fillRect(355, 532 + i * 25, 15, 4);
      g.fillRect(355, 547 + i * 25, 15, 4);
    }

    // 窗户装饰 - 自然光线
    g.fillStyle(0x2c3e50);
    g.fillRect(950, 50, 100, 100);
    g.fillStyle(0x3498db);
    g.fillRect(955, 55, 90, 90);
    // 窗框
    g.fillStyle(0x2c3e50);
    g.fillRect(990, 55, 5, 90);
    g.fillRect(955, 100, 90, 5);
    // 窗外景色
    g.fillStyle(0x27ae60);
    g.fillRect(960, 60, 25, 35);
    g.fillRect(990, 60, 25, 35);
    g.fillRect(1015, 60, 25, 35);
    // 天空
    g.fillStyle(0x74b9ff);
    g.fillRect(960, 95, 90, 45);

    // 启动服务器指示灯闪烁
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