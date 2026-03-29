# Pixel Office 开发进度

## 2026-03-28 开发记录

### ✅ 已完成

1. **像素风小人头像** (`AgentSprite.ts`)
   - 用 Phaser Graphics API 手绘 24x32 像素小人，每个 Agent 独特配色
   - 7 个角色：蜂鸟(蓝)、猫头鹰(棕)、小马(绿)、马良(紫)、蜘蛛(橙)、达尔文(青)、小花猪(粉)
   - 替代之前的 emoji 圆形头像，风格统一

2. **纯代码绘制办公室背景** (`OfficeScene.ts`)
   - 三区布局：工作区(左) / 茶歇区(中) / 服务器区(右)
   - 道具：3张办公桌+显示器、红色沙发+茶几+饮水机+绿植、2台服务器机柜+闪烁指示灯、门口
   - 不再依赖外部背景图(office_bg_small.webp)
   - 天花板灯管、墙上挂钟/挂画、分区柱子、踢脚线

3. **状态栏优化** (`OfficeScene.ts`)
   - 从 y=80 移到 y=0（顶部窄条），高度 24px
   - 蓝色半透明(#0f3460, 0.7)，与侧边栏统一风格
   - 时钟等宽字体右上角，在线统计左上角

4. **ChatPanel 改进** (`ChatPanel.ts`)
   - 去掉 overlay 半透明遮罩，面板直接滑入不挡交互
   - 支持历史消息加载（GET /api/agents/:id/history）
   - 支持真实消息发送（POST /api/agents/:id/message）
   - 流式回复展示

5. **Agent 状态/位置优化** (`AgentSprite.ts`)
   - setStatus() 不再移动位置（由 OfficeScene 统一管理）
   - 位置更新适配新背景布局

6. **加载失败容错** (`PreloadScene.ts`)
   - loaderror 事件跳过失败资源，不卡死游戏启动

7. **Gateway 集成 — CLI 模式** (`gateway.ts`)
   - 通过 `openclaw sessions --json` 轮询 Agent 状态
   - 通过 `openclaw agent chat` 发送真实消息
   - Agent 活动检测（ageMs 降低 = 有新交互）

8. **消息发送链路打通** (`routes.ts`, `index.ts`)
   - 前端 ChatPanel → Express API → CLI → Agent → 真实回复
   - 已验证 Pixel Office 里发消息给 Agent 能收到回复

9. **猫咪精灵移除** — 闪烁的 spritesheet 动画已去掉

### 🔴 下次继续

1. **Gateway WS RPC 连接**（高优先级）
   - 尝试过直接 WS、ESM 子进程桥接(bridge)，均因 origin 检查失败
   - GatewayClient 的 `origin not allowed` 错误：Gateway 要求 Control UI 从 gateway host 打开
   - 待尝试方案：
     - `openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true`（如果存在）
     - 查阅 OpenClaw 文档找到正确的 Control UI 连接方式
     - 联系 OpenClaw 开发者确认非浏览器环境连接方式
   - 代码文件 `scripts/gateway-bridge.mjs` 和 `src/server/gateway.ts`(WS版)已保留供参考

2. **Agent 回复实时展示**（高优先级）
   - 目前有 CLI 检测 ageMs 变化的方案，但只能显示"正在回复..."气泡
   - WS RPC 打通后可实现流式气泡展示（chat.delta 事件）

3. **聊天历史加载**
   - CLI 没有 `agent history` 命令
   - 需要 WS RPC 的 `chat.history` 方法
   - ChatPanel 代码已写好，等后端支持

4. **设计文档剩余项**
   - 状态细化：thinking/working/responding/error 四种状态
   - PathFinder 路径系统（角色走动）
   - 前端 store 状态管理
   - shared/types.ts 共享类型
   - 7 天消息清理

### ⚠️ 已知问题

- `OfficeScene.ts` 有 `bgSprite` 属性缺失的编译警告
- `ChatPanel.ts` 有 `container` 未初始化的编译警告
- `db.ts` 的 sql.js 缺少类型声明（不影响运行）

### 📁 关键文件索引

| 文件 | 说明 |
|------|------|
| `src/client/game/OfficeScene.ts` | 办公室场景（背景绘制、Agent 管理、气泡） |
| `src/client/game/entities/AgentSprite.ts` | Agent 像素小人精灵 |
| `src/client/game/systems/BubbleSystem.ts` | 气泡系统 |
| `src/client/game/PreloadScene.ts` | 资源加载 |
| `src/client/ui/ChatPanel.ts` | 聊天面板（DOM） |
| `src/client/ui/AgentList.ts` | Agent 列表侧边栏 |
| `src/client/lib/ws-client.ts` | 前端 WebSocket 客户端 |
| `src/client/main.ts` | 前端入口 |
| `src/server/gateway.ts` | Gateway CLI 客户端 |
| `src/server/index.ts` | Express + WS 服务器 |
| `src/server/routes.ts` | API 路由 |
| `src/server/agent-engine.ts` | Agent 状态引擎 |
| `src/server/config.ts` | 配置 |
| `src/server/db.ts` | SQLite 数据库(sql.js) |
| `scripts/gateway-bridge.mjs` | ESM 桥接脚本（未完成，备用） |
| `.env` | 环境变量（GATEWAY_TOKEN） |

### 🔧 环境信息

- Node.js: v24.14.0
- pnpm: v10.33.0
- OpenClaw: 2026.3.23-2
- Gateway: ws://127.0.0.1:18789 (token 模式)
- Express: port 3456
- Vite: port 5173/5174
- Phaser: 3.80.0, pixelArt: true
- 画布: 1280x720, FIT + CENTER_BOTH
