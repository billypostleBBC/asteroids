import { shipSilhouettePoints } from '../game/assets/manifest.ts';
import type { GameSnapshot } from '../game/simulation/types.ts';

type HudCallbacks = {
  onLaunch: () => void;
  onRelaunch: () => void;
  onTogglePause: () => void;
};

export class GameHud {
  private static readonly titleMaxSizePx = 62.4;

  private static readonly titleMinSizePx = 28;

  private callbacks: HudCallbacks = {
    onLaunch: () => undefined,
    onRelaunch: () => undefined,
    onTogglePause: () => undefined,
  };

  private focusPaused = false;

  private gamePaused = false;

  private readonly button: HTMLButtonElement;

  private readonly controls: HTMLParagraphElement;

  private readonly kicker: HTMLParagraphElement;

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
    this.button = root.querySelector<HTMLButtonElement>('#overlay-button')!;
    this.controls = root.querySelector<HTMLParagraphElement>('#overlay-controls')!;
    this.pauseButton = root.querySelector<HTMLButtonElement>('#pause-toggle')!;
    this.scoreValue = root.querySelector<HTMLElement>('#score-value')!;
    this.livesValue = root.querySelector<HTMLDivElement>('#lives-value')!;

    this.button.addEventListener('click', this.handleButtonClick);
    this.pauseButton.addEventListener('click', this.handlePauseButtonClick);
    this.pauseButton.addEventListener('pointerdown', this.handlePauseButtonPointerDown);
    window.addEventListener('keydown', this.handleOverlayKeydown);
    this.resizeObserver = new ResizeObserver(() => {
      this.fitTitleToPanel();
    });
    this.resizeObserver.observe(this.overlayPanel);

    document.fonts.ready.then(() => {
      this.fitTitleToPanel();
    });
  }

  destroy(): void {
    this.button.removeEventListener('click', this.handleButtonClick);
    this.pauseButton.removeEventListener('click', this.handlePauseButtonClick);
    this.pauseButton.removeEventListener('pointerdown', this.handlePauseButtonPointerDown);
    window.removeEventListener('keydown', this.handleOverlayKeydown);
    this.resizeObserver.disconnect();
  }

  render(snapshot: GameSnapshot): void {
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

  setFocusPaused(value: boolean): void {
    this.focusPaused = value;
  }

  setGamePaused(value: boolean): void {
    this.gamePaused = value;
  }

  private renderGameOver(score: number): void {
    this.overlay.classList.add('screen-overlay--visible');
    this.kicker.textContent = 'Hull Breached';
    this.setOverlayTitle('Signal Lost');
    this.overlayBody.textContent =
      'Your score is locked. The field is still hot.';
    this.overlayScore.textContent = `Final score ${score.toString().padStart(4, '0')}`;
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

  private readonly handleButtonClick = (): void => {
    if (this.button.dataset.action === 'launch') {
      this.callbacks.onLaunch();
      return;
    }

    if (this.button.dataset.action === 'relaunch') {
      this.callbacks.onRelaunch();
    }
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

  private readonly handleOverlayKeydown = (event: KeyboardEvent): void => {
    if (!this.overlay.classList.contains('screen-overlay--visible')) {
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
}
