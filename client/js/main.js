/**
 * main.js — Phaser entry point.
 * The game world is 1200x900. Phaser.Scale.FIT scales it down on small screens.
 * The camera follows the player so the bigger map remains playable on phones.
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.GAME_CONFIG.MAP_WIDTH,
  height: window.GAME_CONFIG.MAP_HEIGHT,
  backgroundColor: '#0a0e1a',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [LobbyScene, GameScene, EndScene]
};

new Phaser.Game(config);
