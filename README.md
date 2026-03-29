# Pixel Office

像素风在线办公室监控页面，用于监控和管理 OpenClaw 的 AI Agent。

## 系统要求

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- OpenClaw CLI（需要在 PATH 中可用）

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/twlgogo/pixel-office.git
cd pixel-office
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件（可选，使用默认值即可运行）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3456` | 服务器端口 |
| `GATEWAY_URL` | `ws://127.0.0.1:18789` | OpenClaw Gateway 地址 |
| `POLL_INTERVAL` | `5000` | 状态轮询间隔 (ms) |
| `NODE_ENV` | `development` | 运行环境 |

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3456 查看页面。

## 生产部署

### 方式一：本地构建

```bash
# 构建
pnpm build

# 运行
pnpm start
```

### 方式二：Docker

```bash
# 构建镜像
docker build -t pixel-office .

# 运行容器
docker run -d -p 3456:3456 \
  -e GATEWAY_URL=ws://host.docker.internal:18789 \
  pixel-office
```

## 项目结构

```
pixel-office/
├── src/
│   ├── client/              # 前端代码
│   │   ├── main.ts          # 入口
│   │   ├── index.html       # HTML 模板
│   │   ├── assets/          # 静态资源（精灵图、背景等）
│   │   ├── game/            # Phaser 游戏逻辑
│   │   │   ├── OfficeScene.ts    # 主场景
│   │   │   ├── PreloadScene.ts   # 资源加载
│   │   │   └── entities/         # 游戏实体
│   │   ├── ui/              # UI 组件
│   │   └── lib/             # 工具库
│   ├── server/              # 后端代码
│   │   ├── index.ts         # 服务入口
│   │   ├── config.ts        # 配置管理
│   │   ├── db.ts            # SQLite 数据库
│   │   ├── gateway.ts       # OpenClaw CLI 通信
│   │   ├── agent-engine.ts  # 状态推断引擎
│   │   ├── routes.ts        # REST API
│   │   └── ws-server.ts     # WebSocket 服务
│   └── types/               # TypeScript 类型定义
├── data/                    # 数据存储
│   └── pixel-office.db      # SQLite 数据库文件
├── assets/sprites/          # 原始精灵图资源
├── .env.example             # 环境变量示例
├── Dockerfile               # Docker 构建文件
├── vite.config.ts           # Vite 配置
├── tsconfig.json            # TypeScript 配置
└── package.json             # 项目配置
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Phaser 3 (游戏引擎) |
| 前端构建 | Vite |
| 后端框架 | Express |
| 实时通信 | WebSocket (ws) |
| 数据库 | SQLite (sql.js) |
| 语言 | TypeScript |

## API 接口

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/agents` | GET | 获取 Agent 列表 |
| `/api/agents/:id/message` | POST | 向 Agent 发送消息 |

### WebSocket 事件

**服务端 → 客户端：**

| 事件 | 数据 | 说明 |
|------|------|------|
| `agent:list` | `{ agents: AgentState[] }` | Agent 列表更新 |
| `agent:message` | `{ agentId, message }` | Agent 消息 |

**客户端 → 服务端：**

| 事件 | 说明 |
|------|------|
| `ping` | 心跳 |
| `pong` | 心跳响应 |

## 开发指南

### 常用命令

```bash
# 开发模式（热重载）
pnpm dev

# 类型检查
npx tsc --noEmit

# 构建生产版本
pnpm build

# 运行生产服务器
pnpm start
```

### 添加新 Agent

需要在以下位置同步添加：

1. `src/server/gateway.ts` - `KNOWN_AGENTS`
2. `src/client/game/OfficeScene.ts` - `KNOWN_AGENTS`
3. `src/client/game/entities/AgentSprite.ts` - `agentTints`（颜色映射）

### 修改 Agent 状态位置

编辑 `src/client/game/entities/AgentSprite.ts` 中的 `STATUS_POSITIONS` 和 `AREA_OFFSETS`。

### 数据库操作

数据库使用 sql.js（内存中的 SQLite），每 30 秒自动保存到 `data/pixel-office.db`。

## 依赖服务

### OpenClaw CLI

本项目依赖 `openclaw` 命令行工具获取 Agent 状态。确保命令可用：

```bash
# 测试命令
openclaw sessions --json --all-agents --active 60
openclaw agent chat --agent "agent:main:main" --message "test"
```

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| WebSocket 连接失败 | 确认后端服务已启动，检查端口是否被占用 |
| Agent 不显示 | 检查 OpenClaw CLI 是否可用，查看后端日志 |
| 页面空白 | 检查浏览器控制台错误，确认资源加载成功 |
| Docker 无法连接 Gateway | 使用 `host.docker.internal` 替代 `127.0.0.1` |

## 相关文档

- [AGENT.md](./AGENT.md) - 详细的开发指南和架构说明
- [PROGRESS.md](./PROGRESS.md) - 开发进度记录

## License

ISC