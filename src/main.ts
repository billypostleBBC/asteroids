import './style.css';

import Phaser from 'phaser';

import { InputBindings } from './game/input/bindings.ts';
import { GameController } from './game/simulation/gameController.ts';
import { themeTokens } from './game/theme/tokens.ts';
import { createGame } from './phaser/createGame.ts';
import { SCENE_KEYS } from './phaser/sceneKeys.ts';
import { GameHud } from './ui/GameHud.ts';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

applyThemeTokens();

app.innerHTML = `
  <div id="game-shell" class="game-shell">
    <div id="game-canvas" class="game-canvas" aria-hidden="true"></div>
    <div id="game-hud" class="hud">
      <button
        id="pause-toggle"
        class="hud__pause-button"
        type="button"
        aria-label="Pause game"
        hidden
      >
        <span class="hud__pause-icon" aria-hidden="true">
          <span></span>
          <span></span>
        </span>
      </button>
      <div class="hud__cluster">
        <section class="hud__panel" aria-label="Current score">
          <span class="hud__label">Score</span>
          <strong id="score-value" class="hud__value">0</strong>
        </section>
        <section class="hud__panel" aria-label="Remaining lives">
          <span class="hud__label">Lives</span>
          <div id="lives-value" class="hud__lives"></div>
        </section>
      </div>
    </div>
    <div id="screen-overlay" class="screen-overlay">
      <div class="screen-overlay__panel">
        <p id="overlay-kicker" class="screen-overlay__kicker"></p>
        <h1 id="overlay-title" class="screen-overlay__title"></h1>
        <p id="overlay-body" class="screen-overlay__body"></p>
        <p id="overlay-score" class="screen-overlay__score"></p>
        <button id="overlay-button" class="screen-overlay__button" type="button"></button>
        <p id="overlay-controls" class="screen-overlay__controls"></p>
      </div>
    </div>
  </div>
`;

const shell = document.querySelector<HTMLElement>('#game-shell');
const canvasHost = document.querySelector<HTMLElement>('#game-canvas');

if (!shell || !canvasHost) {
  throw new Error('Game shell failed to mount.');
}

const input = new InputBindings(shell);
const hud = new GameHud(shell);
const controller = new GameController();

hud.render(controller.getSnapshot());

let menuReady = false;

window.addEventListener(
  'asteroids:menu-ready',
  () => {
    menuReady = true;
    flushPendingLaunch();
  },
  { once: true },
);

const phaserGame = createGame({
  host: canvasHost,
  controller,
  hud,
  input,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

let gameReady = phaserGame.isBooted;
let launchQueued = false;
let pendingLaunch = false;
let focusPaused = false;
let escapePaused = false;

const startGameplayScene = (): void => {
  phaserGame.scene.stop(SCENE_KEYS.MENU);
  phaserGame.scene.start(SCENE_KEYS.GAME);
};

const syncPauseState = (): void => {
  const suspended = focusPaused || escapePaused;

  controller.setSuspended(suspended);
  hud.setFocusPaused(focusPaused);
  hud.setGamePaused(escapePaused);
};

const flushPendingLaunch = (): void => {
  if (!gameReady || !menuReady || !pendingLaunch || launchQueued) {
    return;
  }

  pendingLaunch = false;
  launchQueued = true;
  focusPaused = false;
  escapePaused = false;
  input.reset();
  syncPauseState();

  window.requestAnimationFrame(() => {
    launchQueued = false;
    startGameplayScene();
  });
};

if (!gameReady) {
  phaserGame.events.once(Phaser.Core.Events.READY, () => {
    gameReady = true;
    flushPendingLaunch();
  });
}

const launchGame = (): void => {
  if (controller.getSnapshot().mode === 'playing') {
    return;
  }

  pendingLaunch = true;
  flushPendingLaunch();
};

const toggleGamePause = (): void => {
  if (controller.getSnapshot().mode !== 'playing') {
    return;
  }

  escapePaused = !escapePaused;
  input.reset();
  syncPauseState();
};

hud.setCallbacks({
  onLaunch: launchGame,
  onRelaunch: launchGame,
  onTogglePause: toggleGamePause,
});

const handleVisibilityChange = (): void => {
  focusPaused =
    document.hidden && controller.getSnapshot().mode === 'playing';
  syncPauseState();
};

window.addEventListener('blur', () => {
  if (controller.getSnapshot().mode !== 'playing') {
    return;
  }

  focusPaused = true;
  input.reset();
  syncPauseState();
});

window.addEventListener('focus', () => {
  focusPaused = false;
  syncPauseState();
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape' || controller.getSnapshot().mode !== 'playing') {
    return;
  }

  event.preventDefault();
  toggleGamePause();
});

document.addEventListener('visibilitychange', handleVisibilityChange);

function applyThemeTokens(): void {
  const root = document.documentElement;

  root.style.setProperty('--color-bg', themeTokens.colors.background);
  root.style.setProperty('--color-bg-soft', themeTokens.colors.backgroundSoft);
  root.style.setProperty('--color-panel', themeTokens.colors.panel);
  root.style.setProperty('--color-panel-border', themeTokens.colors.panelBorder);
  root.style.setProperty('--color-text', themeTokens.colors.text);
  root.style.setProperty('--color-text-dim', themeTokens.colors.textDim);
  root.style.setProperty('--color-accent', themeTokens.colors.accent);
  root.style.setProperty('--color-warning', themeTokens.colors.warning);
  root.style.setProperty('--color-ship', themeTokens.colors.ship);
  root.style.setProperty('--color-laser', themeTokens.colors.laser);
  root.style.setProperty('--color-life-empty', themeTokens.colors.lifeEmpty);
  root.style.setProperty('--overlay-duration', `${themeTokens.motion.overlayMs}ms`);
  root.style.setProperty('--pulse-duration', `${themeTokens.motion.pulseMs}ms`);
  root.style.setProperty('--stroke-main', `${themeTokens.stroke.main}px`);
  root.style.setProperty('--safe-top', 'max(1rem, env(safe-area-inset-top))');
  root.style.setProperty('--safe-right', 'max(1rem, env(safe-area-inset-right))');
  root.style.setProperty('--safe-bottom', 'max(1rem, env(safe-area-inset-bottom))');
  root.style.setProperty('--font-display', themeTokens.fonts.display);
  root.style.setProperty('--font-body', themeTokens.fonts.body);
}
