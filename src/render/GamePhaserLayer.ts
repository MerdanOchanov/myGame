import Phaser from 'phaser';
import { OverlayScene } from './scenes/OverlayScene';
import { MapView } from './MapView';

// Transparent, pointer-events:none Phaser canvas layered over the Leaflet
// div — decorative only. Repositions its objects via Leaflet's own
// projection (map.latLngToContainerPoint) on every move/zoom; it never
// simulates its own camera or owns geography (ARCHITECTURE §5 narrowing).
export class GamePhaserLayer {
  readonly game: Phaser.Game;
  private readonly scene: OverlayScene;

  constructor(containerId: string) {
    this.scene = new OverlayScene();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerId,
      width: window.innerWidth,
      height: window.innerHeight,
      transparent: true,
      scene: [this.scene],
    });

    window.addEventListener('resize', () => {
      this.game.scale.resize(window.innerWidth, window.innerHeight);
    });
  }

  // Декоративные эффекты никогда не должны ломать игровой поток — любые
  // сбои Phaser (не загрузился, нет WebGL) молча игнорируются.
  syncGlowToPosition(mapView: MapView, latLng: { lat: number; lng: number } | null): void {
    try {
      if (!latLng) {
        this.scene.hideGlow();
        return;
      }
      const point = mapView.containerPointFor(latLng.lat, latLng.lng);
      this.scene.setGlowPosition(point.x, point.y);
    } catch {
      // ignore decorative failures
    }
  }

  playCollectBurst(mapView: MapView, lat: number, lng: number): void {
    try {
      const point = mapView.containerPointFor(lat, lng);
      this.scene.burstAt(point.x, point.y);
    } catch {
      // ignore decorative failures
    }
  }
}
