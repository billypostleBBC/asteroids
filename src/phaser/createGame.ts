import Phaser from 'phaser';

import type { InputBindings } from '../game/input/bindings.ts';
import type { GameController } from '../game/simulation/gameController.ts';
import type { GameHud } from '../ui/GameHud.ts';
import { BootScene } from './scenes/BootScene.ts';
import { GameScene } from './scenes/GameScene.ts';
import { MenuScene } from './scenes/MenuScene.ts';
import { setGameServices } from './services.ts';

type CreateGameParams = {
  controller: GameController;
  host: HTMLElement;
  hud: GameHud;
  input: InputBindings;
  reducedMotion: boolean;
};

export function createGame({
  controller,
  host,
  hud,
  input,
  reducedMotion,
}: CreateGameParams): Phaser.Game {
  setGameServices({
    controller,
    hud,
    input,
    reducedMotion,
  });

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    backgroundColor: '#000000',
    disableContextMenu: true,
    fps: {
      target: 60,
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance',
    },
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height: host.clientHeight || window.innerHeight,
      mode: Phaser.Scale.RESIZE,
      width: host.clientWidth || window.innerWidth,
    },
    scene: [BootScene, MenuScene, GameScene],
  });
}
