// HomeScene.ts
import Phaser from 'phaser';

export class HomeScene extends Phaser.Scene {
  create() {
    this.add.text(100, 100, 'Дом - Система крафта', { fontSize: '32px' });
  }
}