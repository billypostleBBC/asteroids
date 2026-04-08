import Phaser from 'phaser';

import { themeTokens } from '../theme/tokens.ts';

export type AssetKey =
  | 'asteroidLarge'
  | 'asteroidMedium'
  | 'asteroidSmall'
  | 'background'
  | 'laser'
  | 'ship'
  | 'shipLifeIcon'
  | 'uiFrame';

export type ProceduralTextureDefinition = {
  draw: (graphics: Phaser.GameObjects.Graphics, scale: number) => void;
  height: number;
  key: AssetKey;
  width: number;
};

export type AssetManifest = Record<AssetKey, ProceduralTextureDefinition>;

export const shipSilhouettePoints = [
  '18,0',
  '36,30',
  '23,25',
  '18,38',
  '13,25',
  '0,30',
].join(' ');

const glow = hexToNumber(themeTokens.colors.accent);
const shipColor = hexToNumber(themeTokens.colors.ship);
const warning = hexToNumber(themeTokens.colors.warning);
const laser = hexToNumber(themeTokens.colors.laser);
const DEFAULT_MAX_TEXTURE_SCALE = 2;

export function getTextureRenderScale(maxScale = DEFAULT_MAX_TEXTURE_SCALE): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  return Math.min(Math.max(window.devicePixelRatio || 1, 1), maxScale);
}

export const assetManifest: AssetManifest = {
  ship: {
    key: 'ship',
    width: 48,
    height: 48,
    draw: (graphics, scale) => {
      graphics.lineStyle(themeTokens.stroke.main * scale, shipColor, 1);
      graphics.fillStyle(glow, 0.12);
      graphics.beginPath();
      graphics.moveTo(24 * scale, 6 * scale);
      graphics.lineTo(40 * scale, 38 * scale);
      graphics.lineTo(27 * scale, 31 * scale);
      graphics.lineTo(24 * scale, 44 * scale);
      graphics.lineTo(21 * scale, 31 * scale);
      graphics.lineTo(8 * scale, 38 * scale);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
      graphics.lineStyle(2 * scale, glow, 0.95);
      graphics.beginPath();
      graphics.moveTo(24 * scale, 10 * scale);
      graphics.lineTo(29 * scale, 30 * scale);
      graphics.lineTo(19 * scale, 30 * scale);
      graphics.closePath();
      graphics.strokePath();
    },
  },
  shipLifeIcon: {
    key: 'shipLifeIcon',
    width: 36,
    height: 38,
    draw: (graphics, scale) => {
      graphics.lineStyle(2 * scale, shipColor, 0.95);
      graphics.fillStyle(shipColor, 0.16);
      graphics.beginPath();
      graphics.moveTo(18 * scale, 0);
      graphics.lineTo(36 * scale, 30 * scale);
      graphics.lineTo(23 * scale, 25 * scale);
      graphics.lineTo(18 * scale, 38 * scale);
      graphics.lineTo(13 * scale, 25 * scale);
      graphics.lineTo(0, 30 * scale);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    },
  },
  asteroidSmall: {
    key: 'asteroidSmall',
    width: 32,
    height: 32,
    draw: (graphics, scale) => {
      drawAsteroid(graphics, 16 * scale, 16 * scale, 11 * scale, scale, [
        [0.1, 0.96],
        [0.92, 0.24],
        [0.7, -0.62],
        [-0.08, -0.98],
        [-0.86, -0.42],
        [-0.72, 0.66],
      ]);
    },
  },
  asteroidMedium: {
    key: 'asteroidMedium',
    width: 76,
    height: 76,
    draw: (graphics, scale) => {
      drawAsteroid(graphics, 38 * scale, 38 * scale, 27 * scale, scale, [
        [0.15, 1],
        [0.95, 0.2],
        [0.8, -0.52],
        [0.18, -0.98],
        [-0.58, -0.86],
        [-0.98, -0.14],
        [-0.72, 0.7],
      ]);
    },
  },
  asteroidLarge: {
    key: 'asteroidLarge',
    width: 312,
    height: 312,
    draw: (graphics, scale) => {
      drawAsteroid(graphics, 156 * scale, 156 * scale, 111 * scale, scale, [
        [0.18, 1],
        [0.9, 0.52],
        [0.98, -0.12],
        [0.48, -0.86],
        [-0.12, -1],
        [-0.76, -0.64],
        [-1, 0.02],
        [-0.76, 0.72],
      ]);
    },
  },
  laser: {
    key: 'laser',
    width: 26,
    height: 8,
    draw: (graphics, scale) => {
      graphics.fillStyle(laser, 1);
      graphics.fillRoundedRect(
        1 * scale,
        2 * scale,
        24 * scale,
        4 * scale,
        2 * scale,
      );
      graphics.lineStyle(scale, glow, 1);
      graphics.strokeRoundedRect(
        1 * scale,
        2 * scale,
        24 * scale,
        4 * scale,
        2 * scale,
      );
    },
  },
  background: {
    key: 'background',
    width: 256,
    height: 256,
    draw: (graphics, scale) => {
      graphics.fillStyle(hexToNumber(themeTokens.colors.background), 1);
      graphics.fillRect(0, 0, 256 * scale, 256 * scale);

      const stars = [
        [12, 28, 1.6],
        [38, 130, 1.2],
        [64, 60, 0.9],
        [90, 210, 1.4],
        [118, 34, 1.1],
        [140, 162, 1.3],
        [180, 96, 1.5],
        [204, 48, 0.8],
        [222, 188, 1.6],
        [236, 118, 1],
      ];

      for (const [x, y, radius] of stars) {
        graphics.fillStyle(shipColor, 0.8);
        graphics.fillCircle(x * scale, y * scale, radius * scale);
        graphics.fillStyle(glow, 0.22);
        graphics.fillCircle(x * scale, y * scale, (radius + 2) * scale);
      }
    },
  },
  uiFrame: {
    key: 'uiFrame',
    width: 64,
    height: 64,
    draw: (graphics, scale) => {
      graphics.lineStyle(2 * scale, glow, 0.65);
      graphics.strokeRoundedRect(
        4 * scale,
        4 * scale,
        56 * scale,
        56 * scale,
        12 * scale,
      );
      graphics.lineStyle(scale, warning, 0.5);
      graphics.strokeRoundedRect(
        12 * scale,
        12 * scale,
        40 * scale,
        40 * scale,
        8 * scale,
      );
    },
  },
};

export function createProceduralTextures(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  const scale = getTextureRenderScale();

  for (const definition of Object.values(assetManifest)) {
    graphics.clear();
    definition.draw(graphics, scale);
    graphics.generateTexture(
      definition.key,
      definition.width * scale,
      definition.height * scale,
    );
  }

  graphics.destroy();
}

function drawAsteroid(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  scale: number,
  outline: Array<[number, number]>,
): void {
  graphics.lineStyle(themeTokens.stroke.main * scale, warning, 0.95);
  graphics.fillStyle(warning, 0.08);
  graphics.beginPath();

  outline.forEach(([x, y], index) => {
    const px = centerX + x * radius;
    const py = centerY + y * radius;

    if (index === 0) {
      graphics.moveTo(px, py);
      return;
    }

    graphics.lineTo(px, py);
  });

  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

function hexToNumber(value: string): number {
  return Number.parseInt(value.replace('#', ''), 16);
}
