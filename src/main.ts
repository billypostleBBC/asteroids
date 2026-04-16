import './style.css';

import Phaser from 'phaser';

import { AudioSystem } from './game/audio/audioSystem.ts';
import { InputBindings } from './game/input/bindings.ts';
import { GameController } from './game/simulation/gameController.ts';
import { themeTokens } from './game/theme/tokens.ts';
import { createGame } from './phaser/createGame.ts';
import { SCENE_KEYS } from './phaser/sceneKeys.ts';
import {
  createLeaderboardClient,
  type LeaderboardClient,
  type LeaderboardEntry,
} from './services/leaderboardClient.ts';
import {
  GameHud,
  type LeaderboardLoadStatus,
  type LeaderboardViewState,
} from './ui/GameHud.ts';
import { registerTestApi } from './testing/testApi.ts';

const app = document.querySelector<HTMLDivElement>('#app');
const AUDIO_MUTED_STORAGE_KEY = 'asteroids.audio-muted';

if (!app) {
  throw new Error('App root was not found.');
}

applyThemeTokens();

app.innerHTML = `
  <div id="game-shell" class="game-shell">
    <div class="game-shell__viewport">
      <div id="game-canvas" class="game-canvas" aria-hidden="true"></div>
      <div id="game-hud" class="hud">
        <div class="hud__controls">
          <button
            id="pause-toggle"
            class="hud__control-button"
            type="button"
            aria-label="Pause game"
            hidden
          >
            <span class="hud__pause-icon" aria-hidden="true">
              <span></span>
              <span></span>
            </span>
          </button>
          <button
            id="audio-toggle"
            class="hud__control-button hud__audio-button"
            type="button"
            aria-label="Mute audio"
          >
            SND
          </button>
        </div>
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
          <section id="leaderboard-panel" class="leaderboard" aria-live="polite">
            <div class="leaderboard__header">
              <h2 class="leaderboard__title">Top Pilots</h2>
              <button
                id="leaderboard-retry"
                class="leaderboard__retry"
                type="button"
                hidden
              >
                Retry
              </button>
            </div>
            <ol id="leaderboard-list" class="leaderboard__list"></ol>
            <p id="leaderboard-empty" class="leaderboard__empty"></p>
          </section>
          <form id="leaderboard-form" class="leaderboard-form" novalidate>
            <label class="leaderboard-form__label" for="leaderboard-initials">
              Transmit your initials
            </label>
            <div class="leaderboard-form__row">
              <input
                id="leaderboard-initials"
                class="leaderboard-form__input"
                type="text"
                inputmode="text"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                maxlength="3"
                pattern="[A-Za-z]{3}"
                placeholder="AAA"
                aria-label="Enter 3 initials"
              />
              <button
                id="leaderboard-submit"
                class="leaderboard-form__button"
                type="submit"
              >
                Submit Score
              </button>
            </div>
            <p id="leaderboard-submit-state" class="leaderboard-form__status"></p>
          </form>
          <button id="overlay-button" class="screen-overlay__button" type="button"></button>
          <p id="overlay-controls" class="screen-overlay__controls"></p>
        </div>
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
const audio = new AudioSystem({ muted: readStoredAudioMuted() });
const leaderboardClient: LeaderboardClient = createLeaderboardClient();

let leaderboardEntries: LeaderboardEntry[] = [];
let leaderboardLoadStatus: LeaderboardLoadStatus = leaderboardClient.isConfigured
  ? 'loading'
  : 'disabled';
let leaderboardLoadMessage = leaderboardClient.isConfigured
  ? 'Loading leaderboard...'
  : 'Leaderboard is unavailable until Supabase is configured.';
let submissionStatus: LeaderboardViewState['submissionStatus'] = 'idle';
let submissionMessage = '';
let currentRunScore: number | null = null;
let hasSubmittedCurrentRun = false;

const syncLeaderboardUi = (): void => {
  hud.setLeaderboardState({
    enabled: leaderboardClient.isConfigured,
    entries: leaderboardEntries,
    loadMessage: leaderboardLoadMessage,
    loadStatus: leaderboardLoadStatus,
    submissionLocked:
      !leaderboardClient.isConfigured ||
      submissionStatus === 'submitting' ||
      hasSubmittedCurrentRun,
    submissionMessage,
    submissionStatus,
  });
};

const refreshLeaderboard = async (): Promise<void> => {
  if (!leaderboardClient.isConfigured) {
    leaderboardLoadStatus = 'disabled';
    leaderboardLoadMessage =
      'Leaderboard is unavailable until Supabase is configured.';
    syncLeaderboardUi();
    return;
  }

  leaderboardLoadStatus = 'loading';
  leaderboardLoadMessage = 'Loading leaderboard...';
  syncLeaderboardUi();

  try {
    leaderboardEntries = await leaderboardClient.getTopScores();
    leaderboardLoadStatus = 'ready';
    leaderboardLoadMessage = leaderboardEntries.length === 0
      ? 'No scores transmitted yet.'
      : '';
  } catch (error) {
    leaderboardLoadStatus = 'error';
    leaderboardLoadMessage = error instanceof Error
      ? error.message
      : 'Leaderboard load failed. Check Supabase access.';
  }

  syncLeaderboardUi();
};

const handleGameOver = (score: number): void => {
  currentRunScore = score;
  hasSubmittedCurrentRun = false;
  submissionStatus = 'idle';
  submissionMessage = '';
  hud.clearLeaderboardEntry();
  syncLeaderboardUi();
};

const submitScore = async (initials: string): Promise<void> => {
  if (
    currentRunScore === null ||
    hasSubmittedCurrentRun
  ) {
    return;
  }

  if (!leaderboardClient.isConfigured) {
    return;
  }

  submissionStatus = 'submitting';
  submissionMessage = 'Transmitting score...';
  syncLeaderboardUi();

  try {
    await leaderboardClient.submitScore({
      initials,
      score: currentRunScore,
    });
    hasSubmittedCurrentRun = true;
    submissionStatus = 'success';
    submissionMessage = 'Score transmitted.';
    syncLeaderboardUi();
    await refreshLeaderboard();
  } catch (error) {
    submissionStatus = 'error';
    submissionMessage = error instanceof Error
      ? error.message
      : 'Score submission failed. Check Supabase access.';
    syncLeaderboardUi();
  }
};

syncLeaderboardUi();

hud.setAudioMuted(audio.getDebugState().muted);
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
  audio,
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
  audio.setSuspended(suspended);
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

  void audio.unlock();
  currentRunScore = null;
  hasSubmittedCurrentRun = false;
  submissionStatus = 'idle';
  submissionMessage = '';
  hud.clearLeaderboardEntry();
  syncLeaderboardUi();
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

const toggleAudioMute = (): void => {
  const nextMuted = !audio.getDebugState().muted;

  void audio.unlock();
  audio.setMuted(nextMuted);
  hud.setAudioMuted(nextMuted);
  writeStoredAudioMuted(nextMuted);
};

hud.setCallbacks({
  onGameOver: handleGameOver,
  onLaunch: launchGame,
  onRelaunch: launchGame,
  onRetryLeaderboardLoad: () => {
    void refreshLeaderboard();
  },
  onSubmitScore: (initials) => {
    void submitScore(initials);
  },
  onToggleAudio: toggleAudioMute,
  onTogglePause: toggleGamePause,
});

if (import.meta.env.MODE === 'test') {
  registerTestApi({
    audio,
    controller,
    input,
    isReady: () => gameReady && menuReady,
    refreshLeaderboard,
    root: shell,
  });
}

void refreshLeaderboard();

const unlockAudioFromGesture = (): void => {
  void audio.unlock();
};

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

shell.addEventListener('pointerdown', unlockAudioFromGesture);

window.addEventListener('keydown', (event) => {
  if (isEditingText(event.target)) {
    return;
  }

  if (
    event.code === 'ArrowLeft' ||
    event.code === 'ArrowRight' ||
    event.code === 'ArrowUp' ||
    event.code === 'Enter' ||
    event.code === 'Escape' ||
    event.code === 'KeyA' ||
    event.code === 'KeyD' ||
    event.code === 'KeyW' ||
    event.code === 'Space'
  ) {
    unlockAudioFromGesture();
  }

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
  root.style.setProperty('--safe-left', 'max(1rem, env(safe-area-inset-left))');
  root.style.setProperty('--safe-right', 'max(1rem, env(safe-area-inset-right))');
  root.style.setProperty('--safe-bottom', 'max(1rem, env(safe-area-inset-bottom))');
  root.style.setProperty('--font-display', themeTokens.fonts.display);
  root.style.setProperty('--font-body', themeTokens.fonts.body);
}

function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function readStoredAudioMuted(): boolean {
  try {
    return window.localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredAudioMuted(value: boolean): void {
  try {
    window.localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, String(value));
  } catch {
    // Local storage failures should not block the game.
  }
}
