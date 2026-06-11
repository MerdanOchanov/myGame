import Phaser from 'phaser';
import { GameState } from './core/state/GameState';
import { MapScene } from './render/scenes/MapScene';

// Инициализация игры
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  scene: [MapScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

const game = new Phaser.Game(config);

export { game, GameState };