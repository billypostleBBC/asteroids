import Phaser from 'phaser';

import { createProceduralTextures } from '../../game/assets/manifest.ts';
import { SCENE_KEYS } from '../sceneKeys.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  create(): void {
    createProceduralTextures(this);
    this.scene.start(SCENE_KEYS.MENU);
  }
}
