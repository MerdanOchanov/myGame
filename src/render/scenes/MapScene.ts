import Phaser from 'phaser';

export class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
  }

  preload() {
    // TODO: load assets
  }

  create() {
    this.add.text(100, 100, 'Survival Turkmenistan', { fontSize: '32px', color: '#fff' });
    // TODO: Leaflet integration + Phaser overlay
  }
}