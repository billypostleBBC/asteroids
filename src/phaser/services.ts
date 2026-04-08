import type { InputBindings } from '../game/input/bindings.ts';
import type { GameController } from '../game/simulation/gameController.ts';
import type { GameHud } from '../ui/GameHud.ts';

type GameServices = {
  controller: GameController;
  hud: GameHud;
  input: InputBindings;
  reducedMotion: boolean;
};

let services: GameServices | null = null;

export function getGameServices(): GameServices {
  if (!services) {
    throw new Error('Game services have not been initialized.');
  }

  return services;
}

export function setGameServices(value: GameServices): void {
  services = value;
}
