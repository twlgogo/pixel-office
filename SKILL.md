# Pixel Office
像素办公室 — OpenClaw Agent 实时监控与交互面板

## 概述
Phaser 3 像素风办公室场景，实时显示 OpenClaw Agent 状态，支持消息交互。

## 启动
- 开发模式：`pnpm dev`（后端 3456 + Vite 5173）
- 生产模式：`pnpm build && NODE_ENV=production pnpm start`

## 前置条件
- Node.js >= 18
- OpenClaw Gateway 运行中（默认 127.0.0.1:18789）
- `openclaw` CLI 可用

## 功能
- Agent 状态实时监控
- 像素角色动画
- 聊天面板
- 气泡通知
- 设置面板
- 响应式适配

## 配置
见 .env.example
