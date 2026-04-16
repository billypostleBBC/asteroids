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
    const { audio, controller, hud, input, reducedMotion } = getGameServices();

    controller.startRun({
      width: this.scale.width,
      height: this.scale.height,
    });

    input.reset();
    this.gameRenderer = new GameRenderer(this, reducedMotion);
    audio.syncState({
      input: input.getFrameState(),
      mode: controller.getSnapshot().mode,
      shipAlive: controller.getSnapshot().ship.alive,
    });
    hud.setFocusPaused(false);
    hud.render(controller.getSnapshot());

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_: number, delta: number): void {
    const { audio, controller, hud, input } = getGameServices();
    const frameInput = input.getFrameState();

    controller.update({
      deltaMs: delta,
      input: frameInput,
      viewport: {
        width: this.scale.width,
        height: this.scale.height,
      },
    });

    const snapshot = controller.getSnapshot();
    audio.syncState({
      input: frameInput,
      mode: snapshot.mode,
      shipAlive: snapshot.ship.alive,
    });
    audio.playEvents(controller.consumeAudioEvents());
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
