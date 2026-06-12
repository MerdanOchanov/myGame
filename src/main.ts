import Phaser from 'phaser';
import { MapScene } from './render/scenes/MapScene';
import { GameState } from './core/state/GameState';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  scene: [MapScene],
  parent: 'game-container',
  backgroundColor: '#000000'
};

export const game = new Phaser.Game(config);
export const gameState = new GameState();

// Responsive
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});