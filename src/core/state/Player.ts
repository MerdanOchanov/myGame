export interface Player {
  id: string;
  position: { lat: number; lng: number };
  homeCell: { lat: number; lng: number };
  health: number;
  inventory: any[];
  isAlive: boolean;
}

export class PlayerState {
  private player: Player;

  constructor() {
    this.player = {
      id: 'player1',
      position: { lat: 38.0, lng: 58.0 }, // Туркменистан
      homeCell: { lat: 38.0, lng: 58.0 },
      health: 100,
      inventory: [],
      isAlive: true
    };
  }

  moveTo(lat: number, lng: number) {
    this.player.position = { lat, lng };
    // TODO: check biome, events
  }

  getPlayer() {
    return this.player;
  }
}