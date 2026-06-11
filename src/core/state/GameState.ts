// Core game data and state
export class GameState {
  player: any = {};
  world: any = {};
  // TODO: ECS, biomes, crafting system

  constructor() {
    this.initPlayer();
  }

  private initPlayer() {
    this.player = {
      position: { lat: 38.0, lng: 58.0 }, // Пример координат Ашхабада
      homeCell: null,
      inventory: [],
      health: 100,
    };
  }
}