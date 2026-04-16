import type { AudioSystem } from '../game/audio/audioSystem.ts';
import type { InputBindings } from '../game/input/bindings.ts';
import type { GameController } from '../game/simulation/gameController.ts';
import type { GameHud } from '../ui/GameHud.ts';

type GameServices = {
  audio: AudioSystem;
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
