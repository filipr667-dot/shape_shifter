class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.image('floor_r1', 'assets/tile_401.png');
    this.load.image('floor_r2', 'assets/tile_398.png');
    this.load.image('floor_r3', 'assets/tile_385.png');
    this.load.image('floor_r4', 'assets/tile_72.png');

    this.load.image('hunter', 'assets/manBlue_gun.png');
    this.load.image('shifter', 'assets/manBrown_hold.png');
  }

  create() {
    const socket = Net.socket;

    this.MAP_W = Net.mapWidth;
    this.MAP_H = Net.mapHeight;

    this.physics.world.setBounds(0, 0, this.MAP_W, this.MAP_H);

    // ----- Floors -----
    const TILE = 64;
    const midX = this.MAP_W / 2;
    const midY = this.MAP_H / 2;

    const floorOf = (cx, cy) => {
      if (cx < midX && cy < midY) return 'floor_r1';
      if (cx >= midX && cy < midY) return 'floor_r2';
      if (cx < midX && cy >= midY) return 'floor_r3';
      return 'floor_r4';
    };

    for (let y = 0; y < this.MAP_H; y += TILE) {
      for (let x = 0; x < this.MAP_W; x += TILE) {
        this.add.image(x + TILE / 2, y + TILE / 2, floorOf(x, y)).setDepth(-10);
      }
    }

    // ----- Walls -----
    this.wallGroup = this.physics.add.staticGroup();
    Net.walls.forEach(w => {
      const rect = this.add.rectangle(w.x + w.w / 2, w.y + w.h / 2, w.w, w.h, 0x3a3f5a);
      this.physics.add.existing(rect, true);
      this.wallGroup.add(rect);
    });

    // ----- PLAYERS (FIXED + SAFE) -----
    this.players = {};
    const myId = socket.id;

    Net.players.forEach(p => {
      const key = p.role === 'hunter' ? 'hunter' : 'shifter';

      const sprite = this.physics.add.image(p.x, p.y, key);
      sprite.setDisplaySize(48, 48);
      sprite.body.setSize(36, 36);
      sprite.setDepth(10);
      sprite.body.setCollideWorldBounds(true);

      this.physics.add.collider(sprite, this.wallGroup);

      this.players[p.id] = sprite;

      if (p.id === myId) {
        this.me = sprite;
      }
    });

    // fallback (safety)
    if (!this.me) {
      this.me = this.physics.add.image(200, 200, Net.role === 'hunter' ? 'hunter' : 'shifter');
    }

    // camera
    this.cameras.main.startFollow(this.me);

    // controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // ----- Movement Sync -----
    socket.on("playerMoved", ({ id, x, y }) => {
      const player = this.players[id];
      if (!player) return;
      player.setPosition(x, y);
    });

    this.gameOver = false;
  }

  update() {
    if (!this.me || this.gameOver) return;

    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown) vx = -1;
    if (this.cursors.right.isDown) vx = 1;
    if (this.cursors.up.isDown) vy = -1;
    if (this.cursors.down.isDown) vy = 1;

    const speed = 220;
    this.me.setVelocity(vx * speed, vy * speed);

    // send movement
    Net.socket.emit('move', {
      x: this.me.x,
      y: this.me.y
    });
  }
}