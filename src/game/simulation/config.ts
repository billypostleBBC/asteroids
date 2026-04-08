import type { AsteroidDefinition, SpawnDirectorConfig } from './types.ts';

export const ASTEROID_DEFINITIONS: Record<
  AsteroidDefinition['size'],
  AsteroidDefinition
> = {
  small: {
    hp: 1,
    points: 1,
    radius: 11,
    size: 'small',
    speedRange: [130, 175],
    textureKey: 'asteroidSmall',
  },
  medium: {
    hp: 3,
    points: 5,
    radius: 27,
    size: 'medium',
    speedRange: [90, 130],
    textureKey: 'asteroidMedium',
  },
  large: {
    hp: 6,
    points: 10,
    radius: 111,
    size: 'large',
    speedRange: [60, 95],
    textureKey: 'asteroidLarge',
  },
};

export const SHIP_COLLISION_RADIUS = 20;
export const SHIP_TURN_SPEED = 4.08;
export const SHIP_TURN_ACCELERATION = 22;
export const SHIP_TURN_DRAG = 14;
export const SHIP_FIRE_INTERVAL_MS = 300;
export const SHIP_FIRE_INTERVAL_STEP_MS = 20;
export const SHIP_FIRE_INTERVAL_SCORE_STEP = 100;
export const SHIP_FIRE_INTERVAL_MIN_MS = 140;
export const SHIP_DAMAGE_COOLDOWN_MS = 750;
export const LASER_SPEED = 720;
export const LASER_TTL_MS = 900;
export const LASER_RADIUS = 8;

export const ATTRACT_MODE_DIRECTOR: SpawnDirectorConfig = {
  intervalMs: {
    max: 950,
    min: 520,
  },
  largeWeight: [0.18, 0.28],
  mediumWeight: [0.38, 0.48],
  speedScale: {
    max: 1.15,
    min: 0.8,
  },
};

export const GAMEPLAY_DIRECTOR: SpawnDirectorConfig = {
  intervalMs: {
    max: 1800,
    min: 780,
  },
  largeWeight: [0.08, 0.24],
  mediumWeight: [0.26, 0.44],
  speedScale: {
    max: 1.35,
    min: 0.85,
  },
};
