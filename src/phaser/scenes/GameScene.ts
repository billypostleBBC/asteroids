import Phaser from 'phaser';

import { GameRenderer } from '../view/GameRenderer.ts';
import { SCENE_KEYS } from '../sceneKeys.ts';
import { getGameServices } from '../services.ts';

export class GameScene extends Phaser.Scene {
  private gameRenderer: GameRenderer | null = null;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    const { controller, hud, input, reducedMotion } = getGameServices();

    controller.startRun({
      width: this.scale.width,
      height: this.scale.height,
    });

    input.reset();
    this.gameRenderer = new GameRenderer(this, reducedMotion);
    hud.setFocusPaused(false);
    hud.render(controller.getSnapshot());

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_: number, delta: number): void {
    const { controller, hud, input } = getGameServices();

    controller.update({
      deltaMs: delta,
      input: input.getFrameState(),
      viewport: {
        width: this.scale.width,
        height: this.scale.height,
      },
    });

    const snapshot = controller.getSnapshot();
    this.gameRenderer?.render(snapshot);
    hud.render(snapshot);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.gameRenderer?.resize(
      gameSize.width,
      gameSize.height,
    );
  }

  private handleShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.gameRenderer?.destroy();
    this.gameRenderer = null;
  }
}
