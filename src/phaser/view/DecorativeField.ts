import Phaser from 'phaser';

import type { GameSnapshot } from '../../game/simulation/types.ts';
import { getTextureRenderScale } from '../../game/assets/manifest.ts';

export class DecorativeField {
  private readonly farLayer: Phaser.GameObjects.TileSprite;

  private readonly nearLayer: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    const textureDisplayScale = 1 / getTextureRenderScale();

    this.farLayer = scene.add
      .tileSprite(0, 0, scene.scale.width, scene.scale.height, 'background')
      .setOrigin(0)
      .setTileScale(textureDisplayScale)
      .setAlpha(0.45);

    this.nearLayer = scene.add
      .tileSprite(0, 0, scene.scale.width, scene.scale.height, 'background')
      .setOrigin(0)
      .setTileScale(textureDisplayScale)
      .setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.SCREEN);
  }

  render(snapshot: GameSnapshot, reducedMotion: boolean): void {
    const drift = reducedMotion ? 0.18 : 0.55 + snapshot.spawnIntensity * 0.5;
    const elapsed = snapshot.elapsedMs / 1000;

    this.farLayer.tilePositionX = elapsed * 8 * drift;
    this.farLayer.tilePositionY = elapsed * 12 * drift;
    this.nearLayer.tilePositionX = -elapsed * 16 * drift;
    this.nearLayer.tilePositionY = elapsed * 22 * drift;
  }

  resize(width: number, height: number): void {
    this.farLayer.setSize(width, height);
    this.nearLayer.setSize(width, height);
  }
}
