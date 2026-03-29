/**
 * 预加载场景
 * 用于加载游戏精灵图资源
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  /**
   * 预加载资源
   * 加载所有精灵图资源
   */
  preload(): void {
    // 创建加载进度条背景
    const progressBarBg = this.add.graphics();
    progressBarBg.fillStyle(0x333333, 1);
    progressBarBg.fillRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 - 10, 300, 30);

    // 创建加载进度条
    const progressBar = this.add.graphics();

    // 监听加载进度
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00c853, 1);
      progressBar.fillRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 - 10, 300 * value, 30);
    });

    // 加载完成
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBarBg.destroy();
    });

    // 加载失败时跳过（不阻塞游戏启动）
    this.load.on('loaderror', (fileObj: Phaser.Loader.File) => {
      console.warn(`[PreloadScene] 资源加载失败，已跳过: ${fileObj.key} (${fileObj.url})`);
    });

    // 显示加载文本
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '加载精灵图中...', {
      fontSize: '16px',
      color: '#e8e8e8',
      fontFamily: 'Segoe UI',
    }).setOrigin(0.5);

    // === 加载所有精灵图资源 ===

    // 主角色（idle 是单帧，working 是 spritesheet）
    this.load.image('star_idle', 'assets/star-idle-v5.png');
    this.load.spritesheet('star_working', 'assets/star-working-spritesheet-grid.webp', {
      frameWidth: 230,
      frameHeight: 144,
    });

    // 错误状态
    this.load.spritesheet('error_bug', 'assets/error-bug-spritesheet-grid.webp', {
      frameWidth: 180,
      frameHeight: 180,
    });

    // 猫咪
    this.load.spritesheet('cats', 'assets/cats-spritesheet.webp', {
      frameWidth: 160,
      frameHeight: 160,
    });

    // 场景道具
    this.load.image('desk', 'assets/desk-v3.webp');
    this.load.spritesheet('flowers', 'assets/flowers-bloom-v2.webp', {
      frameWidth: 160,
      frameHeight: 160,
    });
    this.load.spritesheet('plants', 'assets/plants-spritesheet.webp', {
      frameWidth: 160,
      frameHeight: 160,
    });
    this.load.spritesheet('posters', 'assets/posters-spritesheet.webp', {
      frameWidth: 160,
      frameHeight: 160,
    });
    this.load.spritesheet('serverroom', 'assets/serverroom-spritesheet.webp', {
      frameWidth: 180,
      frameHeight: 251,
    });
    this.load.spritesheet('coffee_machine', 'assets/coffee-machine-v3-grid.webp', {
      frameWidth: 230,
      frameHeight: 230,
    });
    this.load.image('coffee_shadow', 'assets/coffee-machine-shadow-v1.png');
    this.load.image('memo_bg', 'assets/memo-bg.webp');
  }

  /**
   * 场景创建完成
   * 创建动画并切换到 OfficeScene
   */
  create(): void {
    // 创建所有动画（这些动画在 OfficeScene 中使用）
    // 注意：先检查动画是否已存在，防止热重载时重复创建

    // 服务器机房动画
    if (!this.anims.exists('serverroom_anim')) {
      this.anims.create({
        key: 'serverroom_anim',
        frames: this.anims.generateFrameNumbers('serverroom'),
        repeat: -1,
        frameRate: 8,
      });
    }

    // 咖啡机动画
    if (!this.anims.exists('coffee_anim')) {
      this.anims.create({
        key: 'coffee_anim',
        frames: this.anims.generateFrameNumbers('coffee_machine'),
        repeat: -1,
        frameRate: 6,
      });
    }

    // 植物动画
    if (!this.anims.exists('plants_anim')) {
      this.anims.create({
        key: 'plants_anim',
        frames: this.anims.generateFrameNumbers('plants'),
        repeat: -1,
        frameRate: 4,
      });
    }

    // 花朵动画
    if (!this.anims.exists('flowers_anim')) {
      this.anims.create({
        key: 'flowers_anim',
        frames: this.anims.generateFrameNumbers('flowers'),
        repeat: -1,
        frameRate: 3,
      });
    }

    // 海报动画
    if (!this.anims.exists('posters_anim')) {
      this.anims.create({
        key: 'posters_anim',
        frames: this.anims.generateFrameNumbers('posters'),
        repeat: -1,
        frameRate: 2,
      });
    }

    // 猫咪待机动画（使用前4帧）
    if (!this.anims.exists('cat_idle')) {
      this.anims.create({
        key: 'cat_idle',
        frames: this.anims.generateFrameNumbers('cats', { start: 0, end: 3 }),
        repeat: -1,
        frameRate: 3,
      });
    }

    // 主角工作动画
    if (!this.anims.exists('star_working')) {
      this.anims.create({
        key: 'star_working',
        frames: this.anims.generateFrameNumbers('star_working'),
        repeat: -1,
        frameRate: 12,
      });
    }

    // 错误状态动画
    if (!this.anims.exists('error_bug_anim')) {
      this.anims.create({
        key: 'error_bug_anim',
        frames: this.anims.generateFrameNumbers('error_bug'),
        repeat: -1,
        frameRate: 8,
      });
    }

    // 淡出效果
    this.cameras.main.fade(500, 0, 0, 0);

    // 延迟切换场景，确保淡出完成
    this.time.delayedCall(500, () => {
      this.scene.start('OfficeScene');
    });
  }
}