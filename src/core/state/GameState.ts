import { PlayerState } from './Player';

export class GameState {
  playerState: PlayerState;

  constructor() {
    this.playerState = new PlayerState();
  }

  update() {
    // Main game loop update
  }
}