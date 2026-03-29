/**
 * 客户端入口文件
 * Phase 3: 初始化 Phaser 游戏、WebSocket、AgentList、ChatPanel、SettingsPanel
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './game/config';
import { PreloadScene } from './game/PreloadScene';
import { OfficeScene } from './game/OfficeScene';
import { WSClient } from './lib/ws-client';
import { AgentList, AgentState } from './ui/AgentList';
import { ChatPanel } from './ui/ChatPanel';
import { SettingsPanel } from './ui/SettingsPanel';

/**
 * 全局变量（挂载到 globalThis 对象，防止 HMR 重复初始化）
 */
interface PixelOfficeGlobal {
  __pixelOfficeGame?: Phaser.Game;
  __pixelOfficeWsClient?: WSClient;
  __pixelOfficeAgentList?: AgentList;
  __pixelOfficeChatPanel?: ChatPanel;
  __pixelOfficeSettingsPanel?: SettingsPanel;
  __pixelOfficeInitialized?: boolean;
}

const globalObj = globalThis as unknown as PixelOfficeGlobal;

/**
 * 初始化 Phaser 游戏
 * Phase 3: 使用 Scale.FIT 模式支持响应式
 */
function initPhaser(): Phaser.Game {
  // 如果已有游戏实例，先销毁
  if (globalObj.__pixelOfficeGame) {
    globalObj.__pixelOfficeGame.destroy(true);
    globalObj.__pixelOfficeGame = undefined;
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    pixelArt: true, // 像素模式
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloadScene, OfficeScene],
  };

  const newGame = new Phaser.Game(config);
  globalObj.__pixelOfficeGame = newGame;

  // 监听场景启动事件，获取 OfficeScene 引用
  newGame.events.on('ready', () => {
    console.log('[Client] Phaser 游戏已就绪');
  });

  return newGame;
}

/**
 * 设置 Phaser 场景与 UI 的联动
 */
function setupSceneLinkage(game: Phaser.Game, agentList: AgentList): void {
  // 等待 Phaser 场景准备就绪
  const checkSceneReady = () => {
    const scene = game.scene.getScene('OfficeScene') as OfficeScene | undefined;
    if (scene) {
      // 将 OfficeScene 引用传给 AgentList
      agentList.setOfficeScene(scene);
      console.log('[Client] OfficeScene 联动已建立');
    } else {
      // 场景还没好，稍后再试
      setTimeout(checkSceneReady, 100);
    }
  };

  checkSceneReady();
}

/**
 * 初始化应用
 */
function initApp(): void {
  // 防止重复初始化（HMR 热重载时）
  if (globalObj.__pixelOfficeInitialized) {
    console.log('[Client] 检测到已初始化，跳过重复初始化');
    return;
  }
  globalObj.__pixelOfficeInitialized = true;

  console.log('[Client] 开始初始化...');

  // 初始化 Phaser 游戏
  const game = initPhaser();

  // 创建 Agent 列表 UI
  const agentList = new AgentList('agent-list');
  globalObj.__pixelOfficeAgentList = agentList;

  // 创建聊天面板
  const chatPanel = new ChatPanel();
  globalObj.__pixelOfficeChatPanel = chatPanel;

  // Agent 选中时打开聊天面板
  agentList.onSelect((agent) => {
    console.log('[Client] 选中 Agent:', agent.name, agent.status);
    chatPanel.open(agent.id, agent.name);
  });

  // 绑定聊天面板到 AgentList
  agentList.bindChatPanel(chatPanel);

  // 初始化 WebSocket 并建立联动
  const wsClient = new WSClient('/ws');
  globalObj.__pixelOfficeWsClient = wsClient;
  wsClient.connect();

  wsClient.on('open', () => {
    console.log('[Client] WebSocket 已连接');
  });

  wsClient.on('agent:list', (data: unknown) => {
    const { agents } = data as { agents: AgentState[] };
    console.log(`[Client] 收到 agent:list，共 ${agents.length} 个 Agent`);
    agentList.updateAgents(agents);
  });

  agentList.bindWS(wsClient);

  // 绑定 WebSocket 到聊天面板
  chatPanel.bindWS(wsClient);

  // 绑定 Agent 回复到 OfficeScene（在角色头上显示气泡）
  wsClient.on('agent:activity', (data: unknown) => {
    const { sessionKey } = data as { sessionKey: string };
    const scene = game.scene.getScene('OfficeScene') as OfficeScene | undefined;
    if (scene) {
      scene.handleAgentReply(sessionKey, '💬 正在回复...', true);
    }
  });

  // 聊天面板也监听活动事件
  wsClient.on('agent:activity', (data: unknown) => {
    const { sessionKey } = data as { sessionKey: string };
    const known = {
      'agent:main:main': '蜂鸟',
      'agent:main:owl': '猫头鹰',
      'agent:main:horse': '小马',
      'agent:main:maliang': '马良',
      'agent:main:spider': '蜘蛛',
      'agent:main:darwin': '达尔文',
      'agent:main:xiaohuazhu': '小花猪',
    };
    const name = known[sessionKey] || sessionKey;
    console.log(`[Pixel Office] ${name} 有新活动`);
  });

  // 设置 Phaser 场景与 UI 的联动
  setupSceneLinkage(game, agentList);

  // 初始化设置面板
  const settingsPanel = new SettingsPanel('sidebar');
  globalObj.__pixelOfficeSettingsPanel = settingsPanel;

  // 定期发送 ping 保持连接
  setInterval(() => {
    if (wsClient.isConnected()) {
      wsClient.send({ type: 'ping' });
    }
  }, 30000);

  console.log('[Client] Pixel Office 客户端初始化完成');
}

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});