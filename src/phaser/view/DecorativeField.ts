import Phaser from 'phaser';

import type { GameSnapshot } from '../../game/simulation/types.ts';
import { getTextureRenderScale } from '../../game/assets/manifest.ts';

export class DecorativeField {
  private readonly farLayer: Phaser.GameObjects.TileSprite;

  private readonly nearLayer: Phaser.GameObjects.TileSprite;

  private lastElapsedMs: number | null = null;

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
    const elapsedDeltaMs =
      this.lastElapsedMs === null ||
      snapshot.elapsedMs < this.lastElapsedMs ||
      snapshot.elapsedMs - this.lastElapsedMs > 250
        ? 0
        : snapshot.elapsedMs - this.lastElapsedMs;
    const elapsedDeltaSeconds = elapsedDeltaMs / 1000;

    this.farLayer.tilePositionX += elapsedDeltaSeconds * 8 * drift;
    this.farLayer.tilePositionY += elapsedDeltaSeconds * 12 * drift;
    this.nearLayer.tilePositionX -= elapsedDeltaSeconds * 16 * drift;
    this.nearLayer.tilePositionY += elapsedDeltaSeconds * 22 * drift;
    this.lastElapsedMs = snapshot.elapsedMs;
  }

  resize(width: number, height: number): void {
    this.farLayer.setSize(width, height);
    this.nearLayer.setSize(width, height);
  }
}
