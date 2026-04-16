import { shipSilhouettePoints } from '../game/assets/manifest.ts';
import type { GameSnapshot } from '../game/simulation/types.ts';
import type { LeaderboardEntry } from '../services/leaderboardClient.ts';

export type LeaderboardLoadStatus = 'disabled' | 'error' | 'loading' | 'ready';

export type LeaderboardSubmissionStatus =
  | 'error'
  | 'idle'
  | 'submitting'
  | 'success';

export type LeaderboardViewState = {
  enabled: boolean;
  entries: LeaderboardEntry[];
  loadMessage: string;
  loadStatus: LeaderboardLoadStatus;
  submissionLocked: boolean;
  submissionMessage: string;
  submissionStatus: LeaderboardSubmissionStatus;
};

type HudCallbacks = {
  onGameOver: (score: number) => void;
  onLaunch: () => void;
  onRelaunch: () => void;
  onRetryLeaderboardLoad: () => void;
  onSubmitScore: (initials: string) => void;
  onToggleAudio: () => void;
  onTogglePause: () => void;
};

export class GameHud {
  private static readonly titleMaxSizePx = 62.4;

  private static readonly titleMinSizePx = 28;

  private callbacks: HudCallbacks = {
    onGameOver: () => undefined,
    onLaunch: () => undefined,
    onRelaunch: () => undefined,
    onRetryLeaderboardLoad: () => undefined,
    onSubmitScore: () => undefined,
    onToggleAudio: () => undefined,
    onTogglePause: () => undefined,
  };

  private audioMuted = false;

  private readonly audioButton: HTMLButtonElement;

  private focusPaused = false;

  private gamePaused = false;

  private lastMode: GameSnapshot['mode'] | null = null;

  private lastSnapshot: GameSnapshot | null = null;

  private leaderboardState: LeaderboardViewState = {
    enabled: false,
    entries: [],
    loadMessage: 'Leaderboard is unavailable until Supabase is configured.',
    loadStatus: 'disabled',
    submissionLocked: true,
    submissionMessage: '',
    submissionStatus: 'idle',
  };

  private readonly button: HTMLButtonElement;

  private readonly controls: HTMLParagraphElement;

  private readonly kicker: HTMLParagraphElement;

  private readonly leaderboardEmpty: HTMLParagraphElement;

  private readonly leaderboardForm: HTMLFormElement;

  private readonly leaderboardInput: HTMLInputElement;

  private readonly leaderboardList: HTMLOListElement;

  private readonly leaderboardPanel: HTMLElement;

  private readonly leaderboardRetry: HTMLButtonElement;

  private readonly leaderboardSubmit: HTMLButtonElement;

  private readonly leaderboardSubmitState: HTMLParagraphElement;

  private readonly livesValue: HTMLDivElement;

  private readonly overlay: HTMLDivElement;

  private readonly overlayBody: HTMLParagraphElement;

  private readonly overlayPanel: HTMLDivElement;

  private readonly overlayScore: HTMLParagraphElement;

  private readonly pauseButton: HTMLButtonElement;

  private readonly resizeObserver: ResizeObserver;

  private readonly scoreValue: HTMLElement;

  private readonly title: HTMLHeadingElement;

  constructor(root: HTMLElement) {
    this.overlay = root.querySelector<HTMLDivElement>('#screen-overlay')!;
    this.overlayPanel = root.querySelector<HTMLDivElement>('.screen-overlay__panel')!;
    this.kicker = root.querySelector<HTMLParagraphElement>('#overlay-kicker')!;
    this.title = root.querySelector<HTMLHeadingElement>('#overlay-title')!;
    this.overlayBody = root.querySelector<HTMLParagraphElement>('#overlay-body')!;
    this.overlayScore = root.querySelector<HTMLParagraphElement>('#overlay-score')!;
    this.leaderboardPanel = root.querySelector<HTMLElement>('#leaderboard-panel')!;
    this.leaderboardList = root.querySelector<HTMLOListElement>('#leaderboard-list')!;
    this.leaderboardEmpty = root.querySelector<HTMLParagraphElement>('#leaderboard-empty')!;
    this.leaderboardRetry = root.querySelector<HTMLButtonElement>('#leaderboard-retry')!;
    this.leaderboardForm = root.querySelector<HTMLFormElement>('#leaderboard-form')!;
    this.leaderboardInput = root.querySelector<HTMLInputElement>('#leaderboard-initials')!;
    this.leaderboardSubmit = root.querySelector<HTMLButtonElement>('#leaderboard-submit')!;
    this.leaderboardSubmitState = root.querySelector<HTMLParagraphElement>(
      '#leaderboard-submit-state',
    )!;
    this.button = root.querySelector<HTMLButtonElement>('#overlay-button')!;
    this.controls = root.querySelector<HTMLParagraphElement>('#overlay-controls')!;
    this.pauseButton = root.querySelector<HTMLButtonElement>('#pause-toggle')!;
    this.audioButton = root.querySelector<HTMLButtonElement>('#audio-toggle')!;
    this.scoreValue = root.querySelector<HTMLElement>('#score-value')!;
    this.livesValue = root.querySelector<HTMLDivElement>('#lives-value')!;

    this.button.addEventListener('click', this.handleButtonClick);
    this.pauseButton.addEventListener('click', this.handlePauseButtonClick);
    this.pauseButton.addEventListener('pointerdown', this.handlePauseButtonPointerDown);
    this.audioButton.addEventListener('click', this.handleAudioButtonClick);
    this.audioButton.addEventListener('pointerdown', this.handleAudioButtonPointerDown);
    this.leaderboardRetry.addEventListener('click', this.handleRetryClick);
    this.leaderboardForm.addEventListener('submit', this.handleLeaderboardSubmit);
    this.leaderboardInput.addEventListener('input', this.handleInitialsInput);
    window.addEventListener('keydown', this.handleOverlayKeydown);
    this.resizeObserver = new ResizeObserver(() => {
      this.fitTitleToPanel();
    });
    this.resizeObserver.observe(this.overlayPanel);

    document.fonts.ready.then(() => {
      this.fitTitleToPanel();
    });
    this.renderAudioButton();
  }

  clearLeaderboardEntry(): void {
    this.leaderboardInput.value = '';
    this.leaderboardInput.setCustomValidity('');

    if (this.lastSnapshot) {
      this.render(this.lastSnapshot);
    }
  }

  destroy(): void {
    this.button.removeEventListener('click', this.handleButtonClick);
    this.pauseButton.removeEventListener('click', this.handlePauseButtonClick);
    this.pauseButton.removeEventListener('pointerdown', this.handlePauseButtonPointerDown);
    this.audioButton.removeEventListener('click', this.handleAudioButtonClick);
    this.audioButton.removeEventListener('pointerdown', this.handleAudioButtonPointerDown);
    this.leaderboardRetry.removeEventListener('click', this.handleRetryClick);
    this.leaderboardForm.removeEventListener('submit', this.handleLeaderboardSubmit);
    this.leaderboardInput.removeEventListener('input', this.handleInitialsInput);
    window.removeEventListener('keydown', this.handleOverlayKeydown);
    this.resizeObserver.disconnect();
  }

  render(snapshot: GameSnapshot): void {
    if (this.lastMode !== 'gameover' && snapshot.mode === 'gameover') {
      this.callbacks.onGameOver(snapshot.score);
    }

    this.lastMode = snapshot.mode;
    this.lastSnapshot = snapshot;
    this.scoreValue.textContent = snapshot.score.toString().padStart(4, '0');
    this.renderLives(snapshot.ship.lives);
    this.renderPauseButton(snapshot);

    if (this.gamePaused && snapshot.mode === 'playing') {
      this.renderGamePaused();
      return;
    }

    if (this.focusPaused && snapshot.mode === 'playing') {
      this.renderPaused();
      return;
    }

    if (snapshot.mode === 'menu') {
      this.renderMenu();
      return;
    }

    if (
      snapshot.mode === 'gameover' &&
      snapshot.gameOverOverlayDelayMs === 0
    ) {
      this.renderGameOver(snapshot.score);
      return;
    }

    this.overlay.classList.remove('screen-overlay--visible');
  }

  setCallbacks(callbacks: HudCallbacks): void {
    this.callbacks = callbacks;
  }

  setAudioMuted(value: boolean): void {
    this.audioMuted = value;
    this.renderAudioButton();
  }

  setFocusPaused(value: boolean): void {
    this.focusPaused = value;
  }

  setGamePaused(value: boolean): void {
    this.gamePaused = value;
  }

  setLeaderboardState(value: LeaderboardViewState): void {
    this.leaderboardState = value;

    if (this.lastSnapshot) {
      this.render(this.lastSnapshot);
    }
  }

  private renderGameOver(score: number): void {
    this.overlay.classList.add('screen-overlay--visible');
    this.kicker.textContent = 'Hull Breached';
    this.setOverlayTitle('Signal Lost');
    this.overlayBody.textContent =
      'Your score is locked. The field is still hot.';
    this.overlayScore.textContent = `Final score ${score.toString().padStart(4, '0')}`;
    this.renderLeaderboard(true);
    this.controls.textContent = 'Tap Relaunch or press Enter to restart.';
    this.button.hidden = false;
    this.button.textContent = 'Relaunch';
    this.button.dataset.action = 'relaunch';
    this.button.dataset.pulse = 'false';
  }

  private renderLives(lives: number): void {
    this.livesValue.innerHTML = Array.from({ length: 3 }, (_, index) => {
      const isEmpty = index >= lives;
      const className = isEmpty ? 'hud__life hud__life--empty' : 'hud__life';

      return `
        <span class="${className}" aria-hidden="true">
          <svg viewBox="0 0 36 38" fill="currentColor" role="presentation">
            <polygon points="${shipSilhouettePoints}" />
          </svg>
        </span>
      `;
    }).join('');
  }

  private renderMenu(): void {
    this.overlay.classList.add('screen-overlay--visible');
    this.kicker.textContent = 'Arcade Intercept';
    this.setOverlayTitle('Asteroids');
    this.overlayBody.textContent = 'Tap to launch';
    this.overlayScore.textContent = '';
    this.renderLeaderboard(false);
    this.controls.textContent =
      'Desktop: up/W thrusts, left/A and right/D turn, space fires. Mobile: drag from the ship to aim and fire.';
    this.button.hidden = false;
    this.button.textContent = 'Tap to launch';
    this.button.dataset.action = 'launch';
    this.button.dataset.pulse = 'true';
  }

  private renderPaused(): void {
    this.overlay.classList.add('screen-overlay--visible');
    this.kicker.textContent = 'Input Paused';
    this.setOverlayTitle('Stand By');
    this.overlayBody.textContent =
      'Focus left the game, so the simulation is frozen until you return.';
    this.overlayScore.textContent = '';
    this.hideLeaderboard();
    this.controls.textContent = 'Return to the tab or window to continue.';
    this.button.hidden = true;
    this.button.dataset.action = '';
    this.button.dataset.pulse = 'false';
  }

  private renderGamePaused(): void {
    this.overlay.classList.add('screen-overlay--visible');
    this.kicker.textContent = 'Game Paused';
    this.setOverlayTitle('Stand By');
    this.overlayBody.textContent =
      'The run is frozen until you tap the pause icon or press Escape again.';
    this.overlayScore.textContent = '';
    this.hideLeaderboard();
    this.controls.textContent = 'Tap the pause icon to resume on mobile, or press Escape on desktop.';
    this.button.hidden = true;
    this.button.dataset.action = '';
    this.button.dataset.pulse = 'false';
  }

  private renderPauseButton(snapshot: GameSnapshot): void {
    const visible = snapshot.mode === 'playing';

    this.pauseButton.hidden = !visible;
    this.pauseButton.setAttribute(
      'aria-label',
      this.gamePaused ? 'Resume game' : 'Pause game',
    );
    this.pauseButton.dataset.state = this.gamePaused ? 'paused' : 'playing';
  }

  private renderAudioButton(): void {
    this.audioButton.dataset.state = this.audioMuted ? 'muted' : 'audible';
    this.audioButton.setAttribute(
      'aria-label',
      this.audioMuted ? 'Unmute audio' : 'Mute audio',
    );
    this.audioButton.textContent = this.audioMuted ? 'MUTE' : 'SND';
  }

  private readonly handleButtonClick = (): void => {
    if (this.button.dataset.action === 'launch') {
      this.callbacks.onLaunch();
      return;
    }

    if (this.button.dataset.action === 'relaunch') {
      this.callbacks.onRelaunch();
    }
  };

  private readonly handleInitialsInput = (): void => {
    this.leaderboardInput.value = sanitizeInitials(this.leaderboardInput.value);
    this.leaderboardInput.setCustomValidity('');
  };

  private readonly handleLeaderboardSubmit = (event: SubmitEvent): void => {
    event.preventDefault();

    if (this.leaderboardState.submissionLocked) {
      return;
    }

    const initials = sanitizeInitials(this.leaderboardInput.value);
    this.leaderboardInput.value = initials;

    if (initials.length !== 3) {
      this.leaderboardInput.setCustomValidity('Enter exactly 3 letters.');
      this.leaderboardInput.reportValidity();
      return;
    }

    this.leaderboardInput.setCustomValidity('');
    this.callbacks.onSubmitScore(initials);
  };

  private readonly handlePauseButtonClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.callbacks.onTogglePause();
  };

  private readonly handlePauseButtonPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleAudioButtonClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.callbacks.onToggleAudio();
  };

  private readonly handleAudioButtonPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleRetryClick = (): void => {
    this.callbacks.onRetryLeaderboardLoad();
  };

  private readonly handleOverlayKeydown = (event: KeyboardEvent): void => {
    if (!this.overlay.classList.contains('screen-overlay--visible')) {
      return;
    }

    if (document.activeElement === this.leaderboardInput) {
      return;
    }

    if (event.code !== 'Enter' && event.code !== 'Space') {
      return;
    }

    if (this.button.hidden) {
      return;
    }

    event.preventDefault();
    this.handleButtonClick();
  };

  private setOverlayTitle(value: string): void {
    this.title.textContent = value;
    this.fitTitleToPanel();
  }

  private fitTitleToPanel(): void {
    const availableWidth = this.overlayPanel.clientWidth;

    if (availableWidth === 0 || !this.title.textContent) {
      return;
    }

    let nextSize = GameHud.titleMaxSizePx;
    this.title.style.fontSize = `${nextSize}px`;

    while (
      this.title.scrollWidth > this.title.clientWidth &&
      nextSize > GameHud.titleMinSizePx
    ) {
      nextSize -= 1;
      this.title.style.fontSize = `${nextSize}px`;
    }
  }

  private getSubmissionMessage(): string {
    if (!this.leaderboardState.enabled) {
      return 'Set the Supabase public env vars to submit scores.';
    }

    if (this.leaderboardState.submissionStatus === 'idle') {
      return 'Use 3 letters. Scores transmit once per run.';
    }

    return this.leaderboardState.submissionMessage;
  }

  private hideLeaderboard(): void {
    this.leaderboardPanel.hidden = true;
    this.leaderboardForm.hidden = true;
    this.leaderboardSubmitState.textContent = '';
  }

  private renderLeaderboard(showSubmission: boolean): void {
    this.leaderboardPanel.hidden = false;
    this.renderLeaderboardList();

    if (!showSubmission) {
      this.leaderboardForm.hidden = true;
      this.leaderboardSubmitState.textContent = '';
      return;
    }

    this.leaderboardForm.hidden = false;
    this.leaderboardInput.disabled = this.leaderboardState.submissionLocked;
    this.leaderboardSubmit.disabled = this.leaderboardState.submissionLocked;
    this.leaderboardInput.placeholder = this.leaderboardState.enabled
      ? 'AAA'
      : 'N/A';
    this.leaderboardSubmitState.textContent = this.getSubmissionMessage();
  }

  private renderLeaderboardList(): void {
    const { entries, loadMessage, loadStatus } = this.leaderboardState;

    this.leaderboardRetry.hidden = loadStatus !== 'error';

    if (loadStatus === 'loading') {
      this.leaderboardList.innerHTML = '';
      this.leaderboardEmpty.textContent = loadMessage;
      return;
    }

    if (loadStatus === 'error' || loadStatus === 'disabled') {
      this.leaderboardList.innerHTML = '';
      this.leaderboardEmpty.textContent = loadMessage;
      return;
    }

    if (entries.length === 0) {
      this.leaderboardList.innerHTML = '';
      this.leaderboardEmpty.textContent = loadMessage;
      return;
    }

    this.leaderboardList.innerHTML = entries
      .map(
        (entry, index) => `
          <li class="leaderboard__item">
            <span class="leaderboard__rank">${String(index + 1).padStart(2, '0')}</span>
            <span class="leaderboard__initials">${entry.initials}</span>
            <span class="leaderboard__score">${entry.score.toString().padStart(4, '0')}</span>
          </li>
        `,
      )
      .join('');
    this.leaderboardEmpty.textContent = '';
  }
}

function sanitizeInitials(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}
