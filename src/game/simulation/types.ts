import type { InputFrameState } from '../input/actions.ts';

export type AsteroidDefinition = {
  hp: number;
  points: number;
  radius: number;
  size: AsteroidSize;
  speedRange: [number, number];
  textureKey: 'asteroidLarge' | 'asteroidMedium' | 'asteroidSmall';
};

export type AsteroidSize = 'large' | 'medium' | 'small';

export type GameMode = 'gameover' | 'menu' | 'playing';

export type SpawnDirectorConfig = {
  intervalMs: {
    max: number;
    min: number;
  };
  largeWeight: [number, number];
  mediumWeight: [number, number];
  speedScale: {
    max: number;
    min: number;
  };
};

export type Vec2 = {
  x: number;
  y: number;
};

export type ShipState = {
  angle: number;
  alive: boolean;
  angularVelocity: number;
  damageCooldownMs: number;
  fireCooldownMs: number;
  lives: number;
};

export type AsteroidState = {
  hp: number;
  id: number;
  points: number;
  position: Vec2;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  size: AsteroidSize;
  textureKey: AsteroidDefinition['textureKey'];
  velocity: Vec2;
};

export type ProjectileState = {
  angle: number;
  id: number;
  position: Vec2;
  radius: number;
  ttlMs: number;
  velocity: Vec2;
};

export type ExplosionState = {
  id: number;
  maxRadius: number;
  position: Vec2;
  ttlMs: number;
  type: 'asteroid' | 'ship';
};

export type ViewportState = {
  height: number;
  width: number;
};

export type InternalGameState = {
  asteroids: AsteroidState[];
  elapsedMs: number;
  explosions: ExplosionState[];
  gameOverOverlayDelayMs: number;
  lastScoreAt: number | null;
  mode: GameMode;
  nextEntityId: number;
  nextLifeScore: number;
  projectiles: ProjectileState[];
  score: number;
  ship: ShipState;
  spawnCooldownMs: number;
  spawnIntensity: number;
  viewport: ViewportState;
};

export type GameSnapshot = {
  asteroids: AsteroidState[];
  elapsedMs: number;
  explosions: ExplosionState[];
  gameOverOverlayDelayMs: number;
  mode: GameMode;
  projectiles: ProjectileState[];
  score: number;
  ship: ShipState;
  showShip: boolean;
  spawnIntensity: number;
  viewport: ViewportState;
};

export type UpdatePayload = {
  deltaMs: number;
  input: InputFrameState;
  viewport: ViewportState;
};
