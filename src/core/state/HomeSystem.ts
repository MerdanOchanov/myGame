// HomeSystem.ts - Система дома и claim клеток
export interface Home {
  id: string;
  playerId: string;
  position: { lat: number; lng: number };
  claimedAt: Date;
  radius: number; // 100 метров
}

export class HomeSystem {
  private homes: Map<string, Home> = new Map();

  claimHome(playerId: string, position: { lat: number; lng: number }): Home | null {
    // Проверка на свободную клетку (упрощённо)
    const home: Home = {
      id: `home_${playerId}`,
      playerId,
      position,
      claimedAt: new Date(),
      radius: 100
    };
    this.homes.set(playerId, home);
    return home;
  }

  isInHome(playerPos: { lat: number; lng: number }, playerId: string): boolean {
    const home = this.homes.get(playerId);
    if (!home) return false;
    // Простой расчёт расстояния (в метрах)
    const distance = this.calculateDistance(playerPos, home.position);
    return distance <= home.radius;
  }

  private calculateDistance(pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }): number {
    const R = 6371e3; // метров
    const φ1 = pos1.lat * Math.PI/180;
    const φ2 = pos2.lat * Math.PI/180;
    const Δφ = (pos2.lat - pos1.lat) * Math.PI/180;
    const Δλ = (pos2.lng - pos1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}
