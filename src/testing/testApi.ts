import type { AudioDebugState, AudioSystem } from '../game/audio/audioSystem.ts';
import type { InputBindings } from '../game/input/bindings.ts';
import type { GameController } from '../game/simulation/gameController.ts';
import type {
  AsteroidState,
  GameSnapshot,
  InternalGameState,
  ProjectileState,
  ShipState,
} from '../game/simulation/types.ts';
import {
  resetTestLeaderboard,
  setTestLeaderboardFailure,
} from './testLeaderboard.ts';

type TestUiState = {
  leaderboardFormVisible: boolean;
  overlayButtonLabel: string;
  overlayButtonVisible: boolean;
  overlayTitle: string;
  overlayVisible: boolean;
  pauseButtonState: string;
  pauseButtonVisible: boolean;
};

export type AsteroidsTestApi = {
  clearEntities: () => void;
  clearInput: () => void;
  freezeSpawns: () => void;
  getAudioState: () => AudioDebugState;
  getSnapshot: () => GameSnapshot;
  getUiState: () => TestUiState;
  isReady: () => boolean;
  refreshLeaderboard: () => Promise<void>;
  setDragInput: (patch: {
    active: boolean;
    x?: number;
    y?: number;
  }) => void;
  setLeaderboardEntries: (entries: Array<{ initials: string; score: number }>) => void;
  setLeaderboardFailure: (patch: { failLoad?: boolean; failSubmit?: boolean }) => void;
  queueProjectileHit: (points?: number) => void;
  queueShipCollision: () => void;
  setGameOverOverlayDelay: (delayMs: number) => void;
  setScoreState: (patch: {
    lives?: number;
    nextLifeScore?: number;
    score?: number;
  }) => void;
  setShipState: (patch: Partial<ShipState>) => void;
};

type RegisterTestApiParams = {
  audio: AudioSystem;
  controller: GameController;
  input: InputBindings;
  isReady: () => boolean;
  refreshLeaderboard: () => Promise<void>;
  root: HTMLElement;
};

export function registerTestApi({
  audio,
  controller,
  input,
  isReady,
  refreshLeaderboard,
  root,
}: RegisterTestApiParams): void {
  const overlay = root.querySelector<HTMLDivElement>('#screen-overlay');
  const overlayTitle = root.querySelector<HTMLHeadingElement>('#overlay-title');
  const overlayButton = root.querySelector<HTMLButtonElement>('#overlay-button');
  const pauseButton = root.querySelector<HTMLButtonElement>('#pause-toggle');
  const leaderboardForm = root.querySelector<HTMLFormElement>('#leaderboard-form');

  if (
    !overlay ||
    !overlayTitle ||
    !overlayButton ||
    !pauseButton ||
    !leaderboardForm
  ) {
    throw new Error('Test API failed to bind the HUD elements.');
  }

  const api: AsteroidsTestApi = {
    clearEntities: () => {
      const state = getInternalState(controller);

      state.asteroids = [];
      state.explosions = [];
      state.projectiles = [];
    },
    clearInput: () => {
      input.reset();
    },
    freezeSpawns: () => {
      getInternalState(controller).spawnCooldownMs = Number.POSITIVE_INFINITY;
    },
    getAudioState: () => audio.getDebugState(),
    getSnapshot: () => controller.getSnapshot(),
    getUiState: () => ({
      leaderboardFormVisible: !leaderboardForm.hidden,
      overlayButtonLabel: overlayButton.textContent?.trim() ?? '',
      overlayButtonVisible: !overlayButton.hidden,
      overlayTitle: overlayTitle.textContent?.trim() ?? '',
      overlayVisible: overlay.classList.contains('screen-overlay--visible'),
      pauseButtonState: pauseButton.dataset.state ?? 'hidden',
      pauseButtonVisible: !pauseButton.hidden,
    }),
    isReady,
    refreshLeaderboard,
    setDragInput: ({ active, x = 0, y = 0 }) => {
      const bindings = input as any;

      bindings.dragPointerId = active ? 1 : null;
      bindings.dragPosition = active ? { x, y } : null;
    },
    setLeaderboardEntries: (entries) => {
      resetTestLeaderboard(entries);
    },
    setLeaderboardFailure: (patch) => {
      setTestLeaderboardFailure(patch);
    },
    queueProjectileHit: (points = 1) => {
      const state = getInternalState(controller);
      const position = {
        x: state.ship.position.x + 120,
        y: state.ship.position.y,
      };
      const asteroid = createAsteroid(state, {
        hp: 1,
        points,
        position,
        radius: 12,
        velocity: { x: 0, y: 0 },
      });
      const projectile = createProjectile(state, position);

      state.asteroids.push(asteroid);
      state.projectiles.push(projectile);
    },
    queueShipCollision: () => {
      const state = getInternalState(controller);

      state.asteroids.push(
        createAsteroid(state, {
          hp: 1,
          points: 1,
          position: { ...state.ship.position },
          radius: 24,
          velocity: { x: 0, y: 0 },
        }),
      );
    },
    setGameOverOverlayDelay: (delayMs: number) => {
      getInternalState(controller).gameOverOverlayDelayMs = Math.max(0, delayMs);
    },
    setScoreState: ({ lives, nextLifeScore, score }) => {
      const state = getInternalState(controller);

      if (typeof lives === 'number') {
        state.ship.lives = lives;
      }

      if (typeof nextLifeScore === 'number') {
        state.nextLifeScore = nextLifeScore;
      }

      if (typeof score === 'number') {
        state.score = score;
      }
    },
    setShipState: (patch) => {
      const ship = getInternalState(controller).ship;

      if (patch.position) {
        ship.position = { ...patch.position };
      }

      if (patch.velocity) {
        ship.velocity = { ...patch.velocity };
      }

      if (typeof patch.angle === 'number') {
        ship.angle = patch.angle;
      }

      if (typeof patch.alive === 'boolean') {
        ship.alive = patch.alive;
      }

      if (typeof patch.angularVelocity === 'number') {
        ship.angularVelocity = patch.angularVelocity;
      }

      if (typeof patch.damageCooldownMs === 'number') {
        ship.damageCooldownMs = patch.damageCooldownMs;
      }

      if (typeof patch.fireCooldownMs === 'number') {
        ship.fireCooldownMs = patch.fireCooldownMs;
      }

      if (typeof patch.lives === 'number') {
        ship.lives = patch.lives;
      }
    },
  };

  window.__ASTEROIDS_TEST_API__ = api;
}

function getInternalState(controller: GameController): InternalGameState {
  return (controller as any).state as InternalGameState;
}

function createAsteroid(
  state: InternalGameState,
  patch: Pick<AsteroidState, 'hp' | 'points' | 'position' | 'radius' | 'velocity'>,
): AsteroidState {
  return {
    hp: patch.hp,
    id: state.nextEntityId++,
    points: patch.points,
    position: { ...patch.position },
    radius: patch.radius,
    rotation: 0,
    rotationSpeed: 0,
    size: 'small',
    textureKey: 'asteroidSmall',
    velocity: { ...patch.velocity },
  };
}

function createProjectile(
  state: InternalGameState,
  position: ProjectileState['position'],
): ProjectileState {
  return {
    angle: -Math.PI / 2,
    id: state.nextEntityId++,
    position: { ...position },
    radius: 8,
    ttlMs: 500,
    velocity: { x: 0, y: 0 },
  };
}
