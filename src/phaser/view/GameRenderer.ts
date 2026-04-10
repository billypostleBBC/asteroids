import Phaser from 'phaser';

import type {
  AsteroidState,
  ExplosionState,
  GameSnapshot,
  ProjectileState,
} from '../../game/simulation/types.ts';
import { getTextureRenderScale } from '../../game/assets/manifest.ts';
import { themeTokens } from '../../game/theme/tokens.ts';
import { DecorativeField } from './DecorativeField.ts';

export class GameRenderer {
  private readonly asteroidSprites = new Map<number, Phaser.GameObjects.Image>();

  private readonly explosionGraphics: Phaser.GameObjects.Graphics;

  private readonly field: DecorativeField;

  private readonly laserSprites = new Map<number, Phaser.GameObjects.Image>();

  private readonly reducedMotion: boolean;

  private readonly scene: Phaser.Scene;

  private readonly shipSprite: Phaser.GameObjects.Image;

  private readonly textureDisplayScale: number;

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    this.textureDisplayScale = 1 / getTextureRenderScale();
    this.field = new DecorativeField(scene);
    this.explosionGraphics = scene.add
      .graphics()
      .setDepth(14)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    this.shipSprite = scene.add
      .image(0, 0, 'ship')
      .setDepth(16)
      .setScale(this.textureDisplayScale);
  }

  destroy(): void {
    this.field.resize(0, 0);
    this.explosionGraphics.destroy();
    this.shipSprite.destroy();
    this.asteroidSprites.forEach((sprite) => sprite.destroy());
    this.laserSprites.forEach((sprite) => sprite.destroy());
    this.asteroidSprites.clear();
    this.laserSprites.clear();
  }

  render(snapshot: GameSnapshot): void {
    const centerX = snapshot.viewport.width / 2;
    const centerY = snapshot.viewport.height / 2;

    this.field.render(snapshot, this.reducedMotion);
    this.renderShip(snapshot, centerX, centerY);
    this.renderExplosions(snapshot.explosions, centerX, centerY);

    syncSprites(
      this.asteroidSprites,
      snapshot.asteroids,
      (asteroid) =>
        this.scene.add
          .image(centerX + asteroid.position.x, centerY + asteroid.position.y, asteroid.textureKey)
          .setDepth(10)
          .setScale(this.textureDisplayScale),
      (sprite, asteroid) => {
        sprite
          .setPosition(centerX + asteroid.position.x, centerY + asteroid.position.y)
          .setRotation(asteroid.rotation);
      },
    );

    syncSprites(
      this.laserSprites,
      snapshot.projectiles,
      (projectile) =>
        this.scene.add
          .image(
            centerX + projectile.position.x,
            centerY + projectile.position.y,
            'laser',
          )
          .setDepth(15)
          .setScale(this.textureDisplayScale)
          .setBlendMode(Phaser.BlendModes.ADD),
      (sprite, projectile) => {
        sprite
          .setPosition(
            centerX + projectile.position.x,
            centerY + projectile.position.y,
          )
          .setRotation(projectile.angle);
      },
    );
  }

  resize(width: number, height: number): void {
    this.field.resize(width, height);
  }

  private renderExplosions(
    explosions: ExplosionState[],
    centerX: number,
    centerY: number,
  ): void {
    this.explosionGraphics.clear();

    for (const explosion of explosions) {
      drawExplosion(
        this.explosionGraphics,
        centerX + explosion.position.x,
        centerY + explosion.position.y,
        explosion,
        this.reducedMotion,
      );
    }
  }

  private renderShip(
    snapshot: GameSnapshot,
    centerX: number,
    centerY: number,
  ): void {
    const isBlinkFrame =
      snapshot.ship.damageCooldownMs > 0 &&
      Math.floor(snapshot.elapsedMs / 90) % 2 === 0;

    this.shipSprite
      .setVisible(snapshot.showShip)
      .setAlpha(snapshot.showShip ? (isBlinkFrame ? 0.35 : 1) : 0)
      .setPosition(
        centerX + snapshot.ship.position.x,
        centerY + snapshot.ship.position.y,
      )
      .setRotation(snapshot.ship.angle + Math.PI / 2);
  }
}

function drawExplosion(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  explosion: ExplosionState,
  reducedMotion: boolean,
): void {
  const duration = explosion.type === 'ship' ? 720 : 320;
  const progress = Phaser.Math.Clamp(1 - explosion.ttlMs / duration, 0, 1);
  const alpha = 1 - progress;
  const outerRadius = Phaser.Math.Linear(
    explosion.maxRadius * 0.22,
    explosion.maxRadius,
    progress,
  );
  const innerRadius = outerRadius * (explosion.type === 'ship' ? 0.42 : 0.34);
  const shardCount = reducedMotion
    ? explosion.type === 'ship'
      ? 5
      : 3
    : explosion.type === 'ship'
      ? 9
      : 6;
  const warning = Number.parseInt(themeTokens.colors.warning.slice(1), 16);
  const accent = Number.parseInt(themeTokens.colors.accent.slice(1), 16);

  graphics.lineStyle(2.2, warning, alpha * 0.95);
  graphics.strokeCircle(x, y, outerRadius * 0.58);
  graphics.lineStyle(1.4, accent, alpha * 0.9);
  graphics.strokeCircle(x, y, innerRadius);
  graphics.fillStyle(warning, alpha * (explosion.type === 'ship' ? 0.16 : 0.12));
  graphics.fillCircle(x, y, innerRadius * 0.82);

  for (let index = 0; index < shardCount; index += 1) {
    const angle =
      (Math.PI * 2 * index) / shardCount +
      progress * (explosion.type === 'ship' ? 0.6 : 0.35);
    const start = innerRadius * Phaser.Math.Linear(0.45, 1, progress);
    const end = outerRadius * Phaser.Math.Linear(0.72, 1.16, progress);

    graphics.lineStyle(
      explosion.type === 'ship' ? 2.4 : 1.8,
      index % 2 === 0 ? warning : accent,
      alpha * 0.92,
    );
    graphics.beginPath();
    graphics.moveTo(x + Math.cos(angle) * start, y + Math.sin(angle) * start);
    graphics.lineTo(x + Math.cos(angle) * end, y + Math.sin(angle) * end);
    graphics.strokePath();
  }
}

function syncSprites<T extends AsteroidState | ProjectileState>(
  sprites: Map<number, Phaser.GameObjects.Image>,
  entities: T[],
  createSprite: (entity: T) => Phaser.GameObjects.Image,
  updateSprite: (sprite: Phaser.GameObjects.Image, entity: T) => void,
): void {
  const visibleIds = new Set<number>();

  for (const entity of entities) {
    visibleIds.add(entity.id);
    let sprite = sprites.get(entity.id);

    if (!sprite) {
      sprite = createSprite(entity);
      sprites.set(entity.id, sprite);
    }

    updateSprite(sprite, entity);
  }

  sprites.forEach((sprite, id) => {
    if (visibleIds.has(id)) {
      return;
    }

    sprite.destroy();
    sprites.delete(id);
  });
}
