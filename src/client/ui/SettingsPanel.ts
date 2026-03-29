/**
 * 设置面板 UI 组件（原生 DOM 实现）
 * Phase 3: 齿轮图标，点击展开设置面板
 * 设置项：轮询间隔、自动气泡、气泡间隔
 * 设置保存到 localStorage
 */

export interface Settings {
  pollInterval: number;    // 轮询间隔（秒），3-30
  autoBubble: boolean;      // 自动气泡开关
  bubbleInterval: number;  // 气泡间隔（秒），15-120
  bgMusic: boolean;         // 背景音乐开关（预留）
}

const DEFAULT_SETTINGS: Settings = {
  pollInterval: 5,
  autoBubble: true,
  bubbleInterval: 30,
  bgMusic: false,
};

const STORAGE_KEY = 'pixel-office-settings';

export class SettingsPanel {
  private container: HTMLElement;
  private gearButton: HTMLElement;
  private panel: HTMLElement;
  private settings: Settings;
  private isOpen: boolean = false;
  private onChangeCallback: ((settings: Settings) => void) | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`SettingsPanel: 容器 #${containerId} 不存在`);
    }
    this.container = container;
    this.settings = this.loadSettings();

    // 创建齿轮按钮
    this.gearButton = document.createElement('button');
    this.gearButton.id = 'settings-gear';
    this.gearButton.textContent = '⚙️';
    Object.assign(this.gearButton.style, {
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      border: 'none',
      backgroundColor: '#0f3460',
      color: '#e8e8e8',
      fontSize: '18px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background-color 0.2s',
    });
    this.gearButton.addEventListener('mouseover', () => {
      this.gearButton.style.backgroundColor = '#1a4a80';
    });
    this.gearButton.addEventListener('mouseout', () => {
      this.gearButton.style.backgroundColor = '#0f3460';
    });
    this.gearButton.addEventListener('click', () => this.toggle());
    this.container.style.position = 'relative';
    this.container.appendChild(this.gearButton);

    // 创建设置面板（初始隐藏）
    this.panel = this.createPanel();
    this.panel.style.display = 'none';
    document.body.appendChild(this.panel);
  }

  /**
   * 加载设置
   */
  private loadSettings(): Settings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      // ignore
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * 保存设置
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      // ignore
    }
  }

  /**
   * 创建设置面板 DOM
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '70px',
      right: '16px',
      width: '280px',
      backgroundColor: '#16213e',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: '10000',
      overflow: 'hidden',
      transition: 'opacity 0.2s, transform 0.2s',
      opacity: '0',
      transform: 'translateY(10px)',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '14px 16px',
      backgroundColor: '#0f3460',
      color: '#e8e8e8',
      fontSize: '14px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    });
    header.innerHTML = '<span>⚙️ 设置</span>';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: '#9e9e9e',
      fontSize: '16px',
      cursor: 'pointer',
    });
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // 设置项容器
    const content = document.createElement('div');
    Object.assign(content.style, {
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    });

    // === 轮询间隔 ===
    content.appendChild(this.createSliderSetting(
      '轮询间隔',
      '秒',
      this.settings.pollInterval,
      3,
      30,
      (value) => {
        this.settings.pollInterval = value;
        this.saveSettings();
        this.notifyChange();
      }
    ));

    // === 自动气泡开关 ===
    content.appendChild(this.createToggleSetting(
      '自动气泡',
      this.settings.autoBubble,
      (value) => {
        this.settings.autoBubble = value;
        this.saveSettings();
        this.notifyChange();
      }
    ));

    // === 气泡间隔 ===
    content.appendChild(this.createSliderSetting(
      '气泡间隔',
      '秒',
      this.settings.bubbleInterval,
      15,
      120,
      (value) => {
        this.settings.bubbleInterval = value;
        this.saveSettings();
        this.notifyChange();
      }
    ));

    // === 背景音乐开关（预留）===
    content.appendChild(this.createToggleSetting(
      '背景音乐',
      this.settings.bgMusic,
      (value) => {
        this.settings.bgMusic = value;
        this.saveSettings();
        // TODO: 实现背景音乐
      }
    ));

    // 提示文字
    const hint = document.createElement('div');
    hint.textContent = '设置会自动保存';
    Object.assign(hint.style, {
      fontSize: '11px',
      color: '#666',
      textAlign: 'center',
      marginTop: '8px',
    });
    content.appendChild(hint);

    panel.appendChild(content);
    return panel;
  }

  /**
   * 创建滑块设置项
   */
  private createSliderSetting(
    label: string,
    unit: string,
    initialValue: number,
    min: number,
    max: number,
    onChange: (value: number) => void
  ): HTMLElement {
    const item = document.createElement('div');

    // 标签行
    const labelRow = document.createElement('div');
    Object.assign(labelRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px',
    });

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      fontSize: '13px',
      color: '#e8e8e8',
    });

    const valueEl = document.createElement('span');
    valueEl.textContent = `${initialValue}${unit}`;
    Object.assign(valueEl.style, {
      fontSize: '13px',
      color: '#4FC3F7',
      fontWeight: 'bold',
    });

    labelRow.appendChild(labelEl);
    labelRow.appendChild(valueEl);
    item.appendChild(labelRow);

    // 滑块
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(initialValue);
    Object.assign(slider.style, {
      width: '100%',
      height: '6px',
      borderRadius: '3px',
      background: `linear-gradient(to right, #4FC3F7 0%, #4FC3F7 ${((initialValue - min) / (max - min)) * 100}%, #2a2a4a ${((initialValue - min) / (max - min)) * 100}%, #2a2a4a 100%)`,
      outline: 'none',
      cursor: 'pointer',
      WebkitAppearance: 'none',
    });

    // 滑块样式
    const style = document.createElement('style');
    style.textContent = `
      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #4FC3F7;
        cursor: pointer;
      }
      input[type=range]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #4FC3F7;
        cursor: pointer;
        border: none;
      }
    `;
    document.head.appendChild(style);

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      valueEl.textContent = `${val}${unit}`;
      const progress = ((val - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, #4FC3F7 0%, #4FC3F7 ${progress}%, #2a2a4a ${progress}%, #2a2a4a 100%)`;
      onChange(val);
    });

    item.appendChild(slider);
    return item;
  }

  /**
   * 创建开关设置项
   */
  private createToggleSetting(
    label: string,
    initialValue: boolean,
    onChange: (value: boolean) => void
  ): HTMLElement {
    const item = document.createElement('div');
    Object.assign(item.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      fontSize: '13px',
      color: '#e8e8e8',
    });

    // 开关
    const toggle = document.createElement('div');
    Object.assign(toggle.style, {
      width: '48px',
      height: '26px',
      borderRadius: '13px',
      backgroundColor: initialValue ? '#4FC3F7' : '#2a2a4a',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    });

    const knob = document.createElement('div');
    Object.assign(knob.style, {
      width: '22px',
      height: '22px',
      borderRadius: '50%',
      backgroundColor: '#fff',
      position: 'absolute',
      top: '2px',
      left: initialValue ? '24px' : '2px',
      transition: 'left 0.2s',
    });

    toggle.appendChild(knob);
    toggle.addEventListener('click', () => {
      const newValue = !toggle.dataset['value'];
      toggle.dataset['value'] = String(newValue);
      toggle.style.backgroundColor = newValue ? '#4FC3F7' : '#2a2a4a';
      knob.style.left = newValue ? '24px' : '2px';
      onChange(newValue);
    });
    toggle.dataset['value'] = String(initialValue);

    item.appendChild(labelEl);
    item.appendChild(toggle);
    return item;
  }

  /**
   * 切换面板显示
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 打开面板
   */
  open(): void {
    this.panel.style.display = 'block';
    requestAnimationFrame(() => {
      this.panel.style.opacity = '1';
      this.panel.style.transform = 'translateY(0)';
    });
    this.isOpen = true;
  }

  /**
   * 关闭面板
   */
  close(): void {
    this.panel.style.opacity = '0';
    this.panel.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (!this.isOpen) {
        this.panel.style.display = 'none';
      }
    }, 200);
    this.isOpen = false;
  }

  /**
   * 设置变化回调
   */
  onChange(callback: (settings: Settings) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * 通知设置变化
   */
  private notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback({ ...this.settings });
    }
  }

  /**
   * 获取当前设置
   */
  getSettings(): Settings {
    return { ...this.settings };
  }
}
