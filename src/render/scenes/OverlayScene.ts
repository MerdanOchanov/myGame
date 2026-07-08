import Phaser from 'phaser';

// Purely decorative — never owns geography or projection (see MapView.ts /
// GamePhaserLayer.ts for the Leaflet+Phaser split rationale).
export class OverlayScene extends Phaser.Scene {
  private glow?: Phaser.GameObjects.Arc;

  constructor() {
    super('OverlayScene');
  }

  create(): void {
    this.glow = this.add.circle(0, 0, 14, 0xffd700, 0.35);
    this.glow.setVisible(false);
    this.tweens.add({
      targets: this.glow,
      scale: { from: 0.8, to: 1.3 },
      alpha: { from: 0.5, to: 0.1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  /** Сцена может быть ещё не создана (Phaser грузится асинхронно). */
  private get booted(): boolean {
    return Boolean(this.glow && this.add && this.tweens);
  }

  setGlowPosition(x: number, y: number): void {
    this.glow?.setPosition(x, y);
    this.glow?.setVisible(true);
  }

  hideGlow(): void {
    this.glow?.setVisible(false);
  }

  burstAt(x: number, y: number): void {
    if (!this.booted) return;
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particle = this.add.circle(x, y, 3, 0x00e5ff, 0.9);
      const angle = (i / particleCount) * Math.PI * 2;
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        duration: 500,
        onComplete: () => particle.destroy(),
      });
    }
  }
}
