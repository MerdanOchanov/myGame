// Player.ts
export interface Player {
  id: string;
  position: { lat: number; lng: number };
  home?: { lat: number; lng: number };
  health: number;
  inventory: any[];
}

export class PlayerManager {
  private player: Player;

  constructor(id: string) {
    this.player = {
      id,
      position: { lat: 38.0, lng: 58.0 }, // default Turkmenistan
      health: 100,
      inventory: []
    };
  }

  setPosition(lat: number, lng: number) {
    this.player.position = { lat, lng };
  }

  claimHome(homeSystem: any) {
    const home = homeSystem.claimHome(this.player.id, this.player.position);
    if (home) {
      this.player.home = home.position;
      console.log('Дом успешно занят!');
    }
  }
}
