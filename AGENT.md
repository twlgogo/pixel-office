# Pixel Office 开发指南

> 本文档为 AI Agent 提供项目上下文，辅助后续开发工作。

## 项目概述

Pixel Office 是一个**像素风在线办公室管控页面**，用于监控和管理 OpenClaw 的 AI Agent。前端使用 Phaser 3 游戏引擎渲染像素风办公室场景，后端通过 OpenClaw CLI 获取 Agent 状态并通过 WebSocket 实时推送。

---

## 架构速览

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (Phaser 3 + Vite)                   │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  main.ts     │  OfficeScene │  AgentList   │  ChatPanel        │
│  入口初始化   │  游戏场景     │  侧边栏列表   │  聊天面板         │
└──────────────┴──────────────┴──────────────┴───────────────────┘
                              ▲
                              │ WebSocket (/ws)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         后端 (Express + WS)                      │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  index.ts    │  gateway.ts  │ agent-engine │  routes.ts        │
│  服务器入口   │  CLI 通信     │  状态引擎     │  REST API         │
└──────────────┴──────────────┴──────────────┴───────────────────┘
                              ▲
                              │ openclaw CLI
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OpenClaw (外部系统)                         │
│                   openclaw sessions / agent chat                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键文件说明

### 后端 (`src/server/`)

| 文件 | 职责 | 注意事项 |
|------|------|----------|
| `index.ts` | 服务器入口，启动 Express + WebSocket | 数据库初始化是异步的，必须在 `initDatabase()` 完成后才能启动服务 |
| `config.ts` | 配置管理，从环境变量读取 | 支持 `.env` 文件，开发环境自动加载 |
| `db.ts` | SQLite 数据库操作 (sql.js) | 数据库文件存储在 `data/pixel-office.db`，每 30 秒自动保存 |
| `gateway.ts` | OpenClaw CLI 通信客户端 | **核心模块**：通过 `openclaw sessions` 获取 Agent 状态，通过 `openclaw agent chat` 发送消息 |
| `agent-engine.ts` | Agent 状态推断引擎 | 从 Gateway sessions 推断 Agent 状态并更新数据库 |
| `routes.ts` | REST API 路由 | 主要端点：`GET /api/agents`、`POST /api/agents/:id/message` |

### 前端 (`src/client/`)

| 文件 | 职责 | 注意事项 |
|------|------|----------|
| `main.ts` | 客户端入口 | 初始化顺序：Phaser → UI 组件 → WebSocket → 场景联动 |
| `game/config.ts` | 游戏配置常量 | 画布尺寸 1280x720，使用 `Scale.FIT` 响应式模式 |
| `game/OfficeScene.ts` | 办公室主场景 | **核心场景**：管理所有 Agent 角色，处理状态更新 |
| `game/PreloadScene.ts` | 资源预加载 | 加载精灵图、背景图等资源 |
| `game/entities/AgentSprite.ts` | Agent 角色精灵 | 不同状态对应不同位置，使用 tint 颜色区分 Agent |
| `ui/AgentList.ts` | 侧边栏 Agent 列表 | 与 OfficeScene 双向同步，选中时打开聊天面板 |
| `ui/ChatPanel.ts` | 聊天面板 | 从右侧滑入，支持发送消息到 Agent |

---

## Agent 列表（需同步维护）

以下位置需要保持一致：

1. `src/server/gateway.ts` - `KNOWN_AGENTS`
2. `src/client/game/OfficeScene.ts` - `KNOWN_AGENTS`

```typescript
export const KNOWN_AGENTS: Record<string, { label: string; emoji: string }> = {
  'agent:main:main': { label: '蜂鸟 (主 Agent)', emoji: '🐦' },
  'agent:main:owl': { label: '猫头鹰', emoji: '🦉' },
  'agent:main:horse': { label: '小马', emoji: '🐴' },
  'agent:main:maliang': { label: '马良', emoji: '🎨' },
  'agent:main:spider': { label: '蜘蛛', emoji: '🕷️' },
  'agent:main:darwin': { label: '达尔文', emoji: '🦎' },
  'agent:main:xiaohuazhu': { label: '小花猪', emoji: '🐷' },
};
```

### Agent 颜色映射 (`AgentSprite.ts`)

```typescript
const agentTints: Record<string, number> = {
  '🐦': 0x4FC3F7,  // 蓝色 - 蜂鸟
  '🦉': 0x8D6E63,  // 棕色 - 猫头鹰
  '🐴': 0x66BB6A,  // 绿色 - 小马
  '🎨': 0xAB47BC,  // 紫色 - 马良
  '🕷️': 0xFF7043,  // 橙色 - 蜘蛛
  '🦎': 0x26A69A,  // 青色 - 达尔文
  '🐷': 0xEC407A,  // 粉色 - 小花猪
};
```

---

## Agent 状态与位置映射

状态定义：
- `online` - 在线（活跃 < 1 分钟）
- `idle` - 空闲（活跃 1-5 分钟）
- `offline` - 离线（活跃 > 5 分钟或从未活跃）
- `working` - 工作中
- `thinking` - 思考中

位置映射 (`AgentSprite.ts` - `STATUS_POSITIONS`)：

```typescript
export const STATUS_POSITIONS: Record<string, { x: number; y: number }> = {
  'online': { x: 760, y: 320 },   // 工作区
  'idle': { x: 620, y: 180 },     // 休息区
  'working': { x: 830, y: 280 },  // 研究区
  'offline': { x: 640, y: 550 },  // 门口
  'thinking': { x: 830, y: 280 }, // 研究区
};
```

同区域多 Agent 偏移 (`AREA_OFFSETS`)：

```typescript
export const AREA_OFFSETS = [
  { x: 0, y: 0 },
  { x: -40, y: 30 },
  { x: 40, y: 30 },
  { x: -80, y: 60 },
  { x: 0, y: 60 },
  { x: 80, y: 60 },
  { x: -40, y: 90 },
];
```

---

## WebSocket 事件

### 服务端 → 客户端

| 事件 | 数据 | 说明 |
|------|------|------|
| `agent:list` | `{ agents: AgentState[] }` | Agent 列表更新 |
| `agent:message` | `{ agentId, message }` | Agent 消息（预留） |
| `ping` | - | 心跳检测 |

### 客户端 → 服务端

| 事件 | 数据 | 说明 |
|------|------|------|
| `ping` | - | 心跳响应 |
| `pong` | - | 心跳响应 |

---

## REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/agents` | GET | 获取 Agent 列表 |
| `/api/agents/:id/message` | POST | 向 Agent 发送消息 |

---

## 开发注意事项

### 1. 数据库初始化是异步的

```typescript
// ❌ 错误：数据库未初始化
await initDatabase();
const db = getDb(); // 可能为空

// ✅ 正确：确保初始化完成
await initDatabase();
// initDatabase 内部已处理完成
```

### 2. OfficeScene 场景联动

场景准备是异步的，需要等待：

```typescript
const checkSceneReady = () => {
  const scene = game.scene.getScene('OfficeScene');
  if (scene) {
    // 场景已就绪
  } else {
    setTimeout(checkSceneReady, 100);
  }
};
```

### 3. 聊天面板全局回调

为方便从 Phaser 场景打开聊天面板，使用了全局回调：

```typescript
// 设置全局回调
(window as any).__pixelOfficeOpenChat = (agentId, agentName) => {
  this.open(agentId, agentName);
};

// 在 Phaser 场景中调用
sprite.on('pointerdown', () => {
  (window as any).__pixelOfficeOpenChat?.(agentId, agentName);
});
```

### 4. OpenClaw CLI 依赖

确保 `openclaw` 命令在 PATH 中可用：

```bash
# 测试命令
openclaw sessions --json --all-agents --active 60
openclaw agent chat --agent "agent:main:main" --message "test"
```

### 5. 资源文件

精灵图等资源存放在 `assets/sprites/` 目录，需要在 `PreloadScene.ts` 中预加载。

---

## 启动命令

```bash
# 开发模式（同时启动后端 + Vite）
pnpm dev

# 构建生产版本
pnpm build

# 运行生产服务器
pnpm start
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3456 | 服务器端口 |
| `GATEWAY_URL` | ws://127.0.0.1:18789 | OpenClaw Gateway 地址（预留） |
| `POLL_INTERVAL` | 5000 | CLI 轮询间隔 (ms) |
| `NODE_ENV` | development | 运行环境 |

---

## 后续开发方向

1. **真实消息通信** - 目前 ChatPanel 使用模拟回复，需要对接真实的 Agent 消息流
2. **气泡系统完善** - BubbleSystem 已实现，可展示 Agent 的实时消息
3. **Day/Night 周期** - 预留了 day/night 循环功能
4. **更多 Agent 状态** - 可扩展更多状态类型和对应动画
5. **移动端适配** - ChatPanel 已有响应式处理，可进一步优化

---

## 常见问题

### Q: Agent 显示在错误的位置

检查 `STATUS_POSITIONS` 和 `AREA_OFFSETS` 配置，确保坐标适配背景图。

### Q: WebSocket 连接失败

确认后端服务已启动，检查端口是否被占用。

### Q: CLI 命令执行失败

确保 `openclaw` 命令可用，检查环境变量和 PATH 配置。

---

*最后更新: 2026-03-27*