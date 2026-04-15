import Phaser from 'phaser';

import {
  ASTEROID_DEFINITIONS,
  ATTRACT_MODE_DIRECTOR,
  GAMEPLAY_DIRECTOR,
  LASER_RADIUS,
  LASER_SPEED,
  LASER_TTL_MS,
  SHIP_COLLISION_RADIUS,
  SHIP_DAMAGE_COOLDOWN_MS,
  SHIP_FIRE_INTERVAL_MS,
  SHIP_FIRE_INTERVAL_MIN_MS,
  SHIP_FIRE_INTERVAL_SCORE_STEP,
  SHIP_FIRE_INTERVAL_STEP_MS,
  SHIP_MAX_SPEED,
  SHIP_THRUST_ACCELERATION,
  SHIP_TURN_ACCELERATION,
  SHIP_TURN_DRAG,
  SHIP_TURN_SPEED,
} from './config.ts';
import type {
  AsteroidState,
  AsteroidSize,
  ExplosionState,
  GameMode,
  GameSnapshot,
  InternalGameState,
  SpawnDirectorConfig,
  UpdatePayload,
  Vec2,
  ViewportState,
} from './types.ts';

const DEFAULT_VIEWPORT: ViewportState = {
  width: window.innerWidth,
  height: window.innerHeight,
};
const ASTEROID_EXPLOSION_TTL_MS = 320;
const GAME_OVER_OVERLAY_DELAY_MS = 3000;
const MAX_MENU_ASTEROIDS = 8;
const MAX_PLAYING_ASTEROIDS = 18;
const SHIP_EXPLOSION_TTL_MS = 720;
const SPAWN_COOLDOWN_WHEN_CAPPED_MS = 180;

export class GameController {
  private state: InternalGameState = this.createState('menu');

  private suspended = false;

  getSnapshot(): GameSnapshot {
    return {
      asteroids: this.state.asteroids,
      elapsedMs: this.state.elapsedMs,
      explosions: this.state.explosions,
      gameOverOverlayDelayMs: this.state.gameOverOverlayDelayMs,
      mode: this.state.mode,
      projectiles: this.state.projectiles,
      score: this.state.score,
      ship: this.state.ship,
      showShip: this.state.ship.alive && this.state.mode !== 'gameover',
      spawnIntensity: this.state.spawnIntensity,
      viewport: this.state.viewport,
    };
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
  }

  startAttractMode(viewport = this.state.viewport): void {
    this.state = this.createState('menu', viewport);
  }

  startRun(viewport = this.state.viewport): void {
    this.state = this.createState('playing', viewport);
  }

  update({ deltaMs, input, viewport }: UpdatePayload): void {
    this.state.viewport = viewport;

    if (this.suspended) {
      return;
    }

    const clampedDelta = Math.min(deltaMs, 40);
    this.state.elapsedMs += clampedDelta;
    this.state.ship.fireCooldownMs = Math.max(
      0,
      this.state.ship.fireCooldownMs - clampedDelta,
    );
    this.state.ship.damageCooldownMs = Math.max(
      0,
      this.state.ship.damageCooldownMs - clampedDelta,
    );
    this.state.gameOverOverlayDelayMs = Math.max(
      0,
      this.state.gameOverOverlayDelayMs - clampedDelta,
    );

    this.updateShip(clampedDelta, input);
    this.updateProjectiles(clampedDelta);
    this.updateAsteroids(clampedDelta);
    this.updateExplosions(clampedDelta);
    this.resolveProjectileHits();
    this.resolveShipHits();
    this.spawnAsteroids(clampedDelta);
    this.removeExpiredEntities();
  }

  private createState(
    mode: GameMode,
    viewport: ViewportState = DEFAULT_VIEWPORT,
  ): InternalGameState {
    const spawnCooldownMs = mode === 'playing' ? 1350 : 520;
    const damageCooldownMs = mode === 'playing' ? 1800 : 0;

    return {
      asteroids: [],
      elapsedMs: 0,
      explosions: [],
      gameOverOverlayDelayMs: 0,
      lastScoreAt: null,
      mode,
      nextEntityId: 1,
      nextLifeScore: 100,
      projectiles: [],
      score: 0,
      ship: {
        angle: -Math.PI / 2,
        alive: true,
        angularVelocity: 0,
        damageCooldownMs,
        fireCooldownMs: 0,
        lives: 3,
        position: origin(),
        velocity: origin(),
      },
      spawnCooldownMs,
      spawnIntensity: 0,
      viewport: { ...viewport },
    };
  }

  private updateShip(deltaMs: number, input: UpdatePayload['input']): void {
    if (!this.state.ship.alive) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    let shouldFire = false;

    if (this.state.mode === 'menu') {
      shouldFire = this.applyAutoplay(deltaMs);
    } else if (this.state.mode === 'playing') {
      if (input.dragActive && input.dragPosition !== null) {
        const shipScreenPosition = {
          x: this.state.viewport.width / 2 + this.state.ship.position.x,
          y: this.state.viewport.height / 2 + this.state.ship.position.y,
        };
        const aimVector = {
          x: input.dragPosition.x - shipScreenPosition.x,
          y: input.dragPosition.y - shipScreenPosition.y,
        };

        if (aimVector.x !== 0 || aimVector.y !== 0) {
          this.state.ship.angle = Math.atan2(aimVector.y, aimVector.x);
        }

        this.state.ship.angularVelocity = 0;
      } else {
        const turnInput =
          Number(input.rotateRight) - Number(input.rotateLeft);
        const targetAngularVelocity = turnInput * SHIP_TURN_SPEED;
        const accelerationRate =
          turnInput === 0 ? SHIP_TURN_DRAG : SHIP_TURN_ACCELERATION;

        this.state.ship.angularVelocity = moveToward(
          this.state.ship.angularVelocity,
          targetAngularVelocity,
          accelerationRate * deltaSeconds,
        );
        this.state.ship.angle +=
          this.state.ship.angularVelocity * deltaSeconds;
      }

      if (input.thrust) {
        const heading = vectorFromAngle(this.state.ship.angle);

        this.state.ship.velocity.x +=
          heading.x * SHIP_THRUST_ACCELERATION * deltaSeconds;
        this.state.ship.velocity.y +=
          heading.y * SHIP_THRUST_ACCELERATION * deltaSeconds;
        this.state.ship.velocity = clampVectorMagnitude(
          this.state.ship.velocity,
          SHIP_MAX_SPEED,
        );
      }

      this.state.ship.position.x += this.state.ship.velocity.x * deltaSeconds;
      this.state.ship.position.y += this.state.ship.velocity.y * deltaSeconds;
      wrapPosition(
        this.state.ship.position,
        SHIP_COLLISION_RADIUS,
        this.state.viewport,
      );

      this.state.ship.angle = Phaser.Math.Angle.Wrap(this.state.ship.angle);
      shouldFire = input.fire;
    }

    if (shouldFire && this.state.ship.fireCooldownMs === 0) {
      this.fireProjectile();
      this.state.ship.fireCooldownMs = this.getFireIntervalMs();
    }
  }

  private getFireIntervalMs(): number {
    const scoreTier = Math.floor(
      this.state.score / SHIP_FIRE_INTERVAL_SCORE_STEP,
    );

    return Math.max(
      SHIP_FIRE_INTERVAL_MIN_MS,
      SHIP_FIRE_INTERVAL_MS - scoreTier * SHIP_FIRE_INTERVAL_STEP_MS,
    );
  }

  private applyAutoplay(deltaMs: number): boolean {
    const nearestAsteroid = this.state.asteroids.reduce<AsteroidState | null>(
      (closest, asteroid) => {
        if (!closest) {
          return asteroid;
        }

        const closestDistance = distanceSquared(closest.position, origin());
        const asteroidDistance = distanceSquared(asteroid.position, origin());

        return asteroidDistance < closestDistance ? asteroid : closest;
      },
      null,
    );

    const targetAngle = nearestAsteroid
      ? Math.atan2(nearestAsteroid.position.y, nearestAsteroid.position.x)
      : this.state.ship.angle + 0.45 * (deltaMs / 1000);

    this.state.ship.angle = rotateToward(
      this.state.ship.angle,
      targetAngle,
      SHIP_TURN_SPEED * 0.8 * (deltaMs / 1000),
    );
    this.state.ship.angularVelocity = 0;

    return nearestAsteroid
      ? Math.abs(Phaser.Math.Angle.Wrap(targetAngle - this.state.ship.angle)) <
          0.22
      : true;
  }

  private fireProjectile(): void {
    const heading = vectorFromAngle(this.state.ship.angle);
    const position = addVectors(
      this.state.ship.position,
      scaleVector(heading, 34),
    );

    this.state.projectiles.push({
      angle: this.state.ship.angle,
      id: this.state.nextEntityId++,
      position,
      radius: LASER_RADIUS,
      ttlMs: LASER_TTL_MS,
      velocity: addVectors(
        this.state.ship.velocity,
        scaleVector(heading, LASER_SPEED),
      ),
    });
  }

  private updateProjectiles(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    for (const projectile of this.state.projectiles) {
      projectile.position.x += projectile.velocity.x * deltaSeconds;
      projectile.position.y += projectile.velocity.y * deltaSeconds;
      wrapPosition(projectile.position, projectile.radius, this.state.viewport);
      projectile.ttlMs -= deltaMs;
    }
  }

  private updateAsteroids(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    for (const asteroid of this.state.asteroids) {
      asteroid.position.x += asteroid.velocity.x * deltaSeconds;
      asteroid.position.y += asteroid.velocity.y * deltaSeconds;
      asteroid.rotation += asteroid.rotationSpeed * deltaSeconds;
      wrapPosition(asteroid.position, asteroid.radius, this.state.viewport);
    }
  }

  private updateExplosions(deltaMs: number): void {
    for (const explosion of this.state.explosions) {
      explosion.ttlMs -= deltaMs;
    }
  }

  private resolveProjectileHits(): void {
    const projectileIdsToRemove = new Set<number>();
    const asteroidIdsToRemove = new Set<number>();

    for (const projectile of this.state.projectiles) {
      for (const asteroid of this.state.asteroids) {
        if (
          distanceSquared(projectile.position, asteroid.position) >
          (projectile.radius + asteroid.radius) ** 2
        ) {
          continue;
        }

        projectileIdsToRemove.add(projectile.id);
        asteroid.hp -= 1;

        if (asteroid.hp <= 0) {
          asteroidIdsToRemove.add(asteroid.id);
          this.spawnExplosion(
            asteroid.position,
            asteroid.radius * 1.5,
            'asteroid',
          );
          if (this.state.mode !== 'menu') {
            this.state.score += asteroid.points;
            this.state.lastScoreAt = this.state.elapsedMs;
            this.applyBonusLifeRule();
          }
        }

        break;
      }
    }

    if (projectileIdsToRemove.size > 0) {
      this.state.projectiles = this.state.projectiles.filter(
        (projectile) => !projectileIdsToRemove.has(projectile.id),
      );
    }

    if (asteroidIdsToRemove.size > 0) {
      this.state.asteroids = this.state.asteroids.filter(
        (asteroid) => !asteroidIdsToRemove.has(asteroid.id),
      );
    }
  }

  private applyBonusLifeRule(): void {
    while (this.state.score >= this.state.nextLifeScore) {
      if (this.state.ship.lives < 3) {
        this.state.ship.lives += 1;
      }

      this.state.nextLifeScore += 100;
    }
  }

  private resolveShipHits(): void {
    if (
      this.state.mode !== 'playing' ||
      !this.state.ship.alive ||
      this.state.ship.damageCooldownMs > 0
    ) {
      return;
    }

    const impactIndex = this.state.asteroids.findIndex(
      (asteroid) =>
        distanceSquared(asteroid.position, this.state.ship.position) <=
        (asteroid.radius + SHIP_COLLISION_RADIUS) ** 2,
    );

    if (impactIndex === -1) {
      return;
    }

    this.state.asteroids.splice(impactIndex, 1);
    this.state.ship.lives -= 1;

    if (this.state.ship.lives <= 0) {
      this.spawnExplosion(this.state.ship.position, 74, 'ship');
      this.state.ship.alive = false;
      this.state.gameOverOverlayDelayMs = GAME_OVER_OVERLAY_DELAY_MS;
      this.state.mode = 'gameover';
      this.state.ship.damageCooldownMs = 0;
      return;
    }

    this.state.ship.position = origin();
    this.state.ship.velocity = origin();
    this.state.ship.angle = -Math.PI / 2;
    this.state.ship.angularVelocity = 0;
    this.state.ship.damageCooldownMs = SHIP_DAMAGE_COOLDOWN_MS;
  }

  private spawnAsteroids(deltaMs: number): void {
    const director =
      this.state.mode === 'menu' ? ATTRACT_MODE_DIRECTOR : GAMEPLAY_DIRECTOR;
    const intensityFactor =
      this.state.mode === 'menu'
        ? 0.45 + 0.35 * Math.sin(this.state.elapsedMs / 2200)
        : clamp(this.state.elapsedMs / 180000, 0, 1);

    this.state.spawnIntensity = intensityFactor;
    this.state.spawnCooldownMs -= deltaMs;

    const maxAsteroids =
      this.state.mode === 'menu'
        ? MAX_MENU_ASTEROIDS
        : Math.round(lerp(10, MAX_PLAYING_ASTEROIDS, intensityFactor));

    while (
      this.state.spawnCooldownMs <= 0 &&
      this.state.asteroids.length < maxAsteroids
    ) {
      this.state.asteroids.push(
        this.createAsteroid(this.state.viewport, director, intensityFactor),
      );
      this.state.spawnCooldownMs += lerp(
        director.intervalMs.max,
        director.intervalMs.min,
        intensityFactor,
      );
    }

    if (
      this.state.spawnCooldownMs <= 0 &&
      this.state.asteroids.length >= maxAsteroids
    ) {
      this.state.spawnCooldownMs = SPAWN_COOLDOWN_WHEN_CAPPED_MS;
    }
  }

  private createAsteroid(
    viewport: ViewportState,
    director: SpawnDirectorConfig,
    intensityFactor: number,
  ): AsteroidState {
    const size = this.pickAsteroidSize(director, intensityFactor);
    const definition = ASTEROID_DEFINITIONS[size];
    const position = this.createEdgeSpawnPosition(viewport, definition.radius);
    const heading = this.createRandomScreenCrossingHeading(position, viewport);
    const speedScale = lerp(
      director.speedScale.min,
      director.speedScale.max,
      intensityFactor,
    );
    const speed = Phaser.Math.FloatBetween(
      definition.speedRange[0],
      definition.speedRange[1],
    );

    return {
      hp: definition.hp,
      id: this.state.nextEntityId++,
      points: definition.points,
      position,
      radius: definition.radius,
      rotation: Phaser.Math.FloatBetween(-Math.PI, Math.PI),
      rotationSpeed: Phaser.Math.FloatBetween(-0.6, 0.6),
      size,
      textureKey: definition.textureKey,
      velocity: scaleVector(heading, speed * speedScale),
    };
  }

  private pickAsteroidSize(
    director: SpawnDirectorConfig,
    intensityFactor: number,
  ): AsteroidSize {
    const largeWeight = lerp(
      director.largeWeight[0],
      director.largeWeight[1],
      intensityFactor,
    );
    const mediumWeight = lerp(
      director.mediumWeight[0],
      director.mediumWeight[1],
      intensityFactor,
    );
    const roll = Math.random();

    if (roll < largeWeight) {
      return 'large';
    }

    if (roll < largeWeight + mediumWeight) {
      return 'medium';
    }

    return 'small';
  }

  private removeExpiredEntities(): void {
    this.state.projectiles = this.state.projectiles.filter(
      (projectile) => projectile.ttlMs > 0,
    );
    this.state.explosions = this.state.explosions.filter(
      (explosion) => explosion.ttlMs > 0,
    );
  }

  private spawnExplosion(
    position: Vec2,
    maxRadius: number,
    type: ExplosionState['type'],
  ): void {
    this.state.explosions.push({
      id: this.state.nextEntityId++,
      maxRadius,
      position: { ...position },
      ttlMs:
        type === 'ship' ? SHIP_EXPLOSION_TTL_MS : ASTEROID_EXPLOSION_TTL_MS,
      type,
    });
  }

  private createEdgeSpawnPosition(
    viewport: ViewportState,
    radius: number,
  ): Vec2 {
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;
    const edgeInset = Math.max(6, radius - 6);
    const edge = Phaser.Math.Between(0, 3);

    if (edge === 0) {
      return {
        x: Phaser.Math.FloatBetween(-halfWidth, halfWidth),
        y: -halfHeight - edgeInset,
      };
    }

    if (edge === 1) {
      return {
        x: halfWidth + edgeInset,
        y: Phaser.Math.FloatBetween(-halfHeight, halfHeight),
      };
    }

    if (edge === 2) {
      return {
        x: Phaser.Math.FloatBetween(-halfWidth, halfWidth),
        y: halfHeight + edgeInset,
      };
    }

    return {
      x: -halfWidth - edgeInset,
      y: Phaser.Math.FloatBetween(-halfHeight, halfHeight),
    };
  }

  private createRandomScreenCrossingHeading(
    spawnPosition: Vec2,
    viewport: ViewportState,
  ): Vec2 {
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;
    const targetPadding = 80;
    const horizontalBias = Math.abs(spawnPosition.x) > Math.abs(spawnPosition.y);

    const target = horizontalBias
      ? {
          x:
            spawnPosition.x > 0
              ? -halfWidth - targetPadding
              : halfWidth + targetPadding,
          y: Phaser.Math.FloatBetween(
            -halfHeight - targetPadding,
            halfHeight + targetPadding,
          ),
        }
      : {
          x: Phaser.Math.FloatBetween(
            -halfWidth - targetPadding,
            halfWidth + targetPadding,
          ),
          y:
            spawnPosition.y > 0
              ? -halfHeight - targetPadding
              : halfHeight + targetPadding,
        };

    return normalizeVector({
      x: target.x - spawnPosition.x,
      y: target.y - spawnPosition.y,
    });
  }
}

function addVectors(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampVectorMagnitude(vector: Vec2, maxMagnitude: number): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude <= maxMagnitude) {
    return vector;
  }

  return scaleVector(vector, maxMagnitude / magnitude);
}

function distanceSquared(a: Vec2, b: Vec2): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
}

function normalizeVector(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);

  if (length === 0) {
    return origin();
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function origin(): Vec2 {
  return { x: 0, y: 0 };
}

function rotateToward(current: number, target: number, maxDelta: number): number {
  const delta = Phaser.Math.Angle.Wrap(target - current);

  if (Math.abs(delta) <= maxDelta) {
    return Phaser.Math.Angle.Wrap(target);
  }

  return Phaser.Math.Angle.Wrap(current + Math.sign(delta) * maxDelta);
}

function scaleVector(vector: Vec2, scale: number): Vec2 {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
  };
}

function vectorFromAngle(angle: number, scale = 1): Vec2 {
  return {
    x: Math.cos(angle) * scale,
    y: Math.sin(angle) * scale,
  };
}

function wrapPosition(
  position: Vec2,
  radius: number,
  viewport: ViewportState,
): void {
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const maxX = halfWidth + radius;
  const minX = -halfWidth - radius;
  const maxY = halfHeight + radius;
  const minY = -halfHeight - radius;

  if (position.x < minX) {
    position.x = maxX;
  } else if (position.x > maxX) {
    position.x = minX;
  }

  if (position.y < minY) {
    position.y = maxY;
  } else if (position.y > maxY) {
    position.y = minY;
  }
}
