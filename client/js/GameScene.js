/**
 * GameScene
 * ---------
 * Multi-room arena (2x2 grid):
 *   Room 1 (top-left)    floor: tile_401
 *   Room 2 (top-right)   floor: tile_398
 *   Room 3 (bot-left)    floor: tile_385
 *   Room 4 (bot-right)   floor: tile_72  (existing wood)
 *
 * Doors: 1<->3, 2<->4, 3<->4. NO door between 1<->2.
 * Walls block movement and the hunter's flashlight.
 * 8 different crate sprites scattered as decoys.
 *
 * The camera follows the local player so the bigger map is comfortable
 * to play on small screens.
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    // Per-room floor tiles
    this.load.image('floor_r1', 'assets/tile_401.png');
    this.load.image('floor_r2', 'assets/tile_398.png');
    this.load.image('floor_r3', 'assets/tile_385.png');
    this.load.image('floor_r4', 'assets/tile_72.png');

    // 8 decoy crate variants
    this.load.image('crate_0', 'assets/tile_51.png');
    this.load.image('crate_1', 'assets/tile_52.png');
    this.load.image('crate_2', 'assets/tile_483.png');
    this.load.image('crate_3', 'assets/tile_538.png');
    this.load.image('crate_4', 'assets/tile_528.png');
    this.load.image('crate_5', 'assets/tile_419.png');
    this.load.image('crate_6', 'assets/tile_406.png');
    this.load.image('crate_7', 'assets/tile_337.png');

    // Players
    this.load.image('hunter', 'assets/manBlue_gun.png');
    this.load.image('shifter', 'assets/manBrown_hold.png');
  }

  create() {
    const { PLAYER_SPEED, SCAN_RADIUS, SCAN_COOLDOWN_MS } = window.GAME_CONFIG;
    this.PLAYER_SPEED = PLAYER_SPEED;
    this.SCAN_RADIUS = SCAN_RADIUS;
    this.SCAN_COOLDOWN_MS = SCAN_COOLDOWN_MS;

    // Server tells us the actual map size + walls
    this.MAP_W = Net.mapWidth || window.GAME_CONFIG.MAP_WIDTH;
    this.MAP_H = Net.mapHeight || window.GAME_CONFIG.MAP_HEIGHT;

    this.cameras.main.setBackgroundColor('#0a0e1a');
    this.physics.world.setBounds(0, 0, this.MAP_W, this.MAP_H);

    // ----- Per-room tiled floors -----
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
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        this.add.image(cx, cy, floorOf(cx, cy)).setDepth(-10);
      }
    }

    // Subtle dark overlay for atmosphere
    this.add.rectangle(this.MAP_W / 2, this.MAP_H / 2, this.MAP_W, this.MAP_H, 0x000000, 0.25).setDepth(-5);

    // ----- Walls -----
    // Walls are static physics bodies. We draw them with a stone-grey gradient.
    this.wallGroup = this.physics.add.staticGroup();
    (Net.walls || []).forEach((w) => {
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h / 2;
      const rect = this.add.rectangle(cx, cy, w.w, w.h, 0x3a3f5a);
      rect.setStrokeStyle(2, 0x1a1d2e);
      rect.setDepth(2);
      // Drop shadow effect
      this.add.rectangle(cx + 2, cy + 3, w.w, w.h, 0x000000, 0.3).setDepth(1);
      this.physics.add.existing(rect, true); // true = static
      this.wallGroup.add(rect);
    });

    // ----- Decoys -----
    this.decoyGfx = {};
    Net.decoys.forEach((d) => {
      const key = 'crate_' + (d.type !== undefined ? d.type : (d.id % 8));
      const crate = this.add.image(d.x, d.y, key);
      crate.setDisplaySize(52, 52);
      crate.setDepth(3);
      crate.setInteractive({ useHandCursor: true });
      crate.decoyId = d.id;
      this.decoyGfx[d.id] = crate;

      crate.on('pointerdown', () => {
        if (Net.role === 'hunter' && !this.gameOver) this.confirmAccuse(d.id);
      });
    });

    // ----- Local player -----
    const myKey = Net.role === 'hunter' ? 'hunter' : 'shifter';
    const startX = Net.role === 'hunter' ? 200 : this.MAP_W - 200;
    const startY = Net.role === 'hunter' ? 200 : this.MAP_H - 200;
    this.me = this.physics.add.image(startX, startY, myKey);
    this.me.setDisplaySize(48, 48);
    this.me.body.setSize(36, 36);
    this.me.setDepth(10);
    this.me.body.setCollideWorldBounds(true);
    // Walls block the player
    this.physics.add.collider(this.me, this.wallGroup);

    // ----- Opponent -----
    const oppKey = Net.role === 'hunter' ? 'shifter' : 'hunter';
    this.opponent = this.add.image(0, 0, oppKey);
    this.opponent.setDisplaySize(48, 48);
    this.opponent.setDepth(9);
    this.opponent.setVisible(Net.role === 'shifter');
    this.revealedTimer = 0;

    // ----- Camera follows player -----
    this.cameras.main.setBounds(0, 0, this.MAP_W, this.MAP_H);
    this.cameras.main.startFollow(this.me, true, 0.12, 0.12);
    this.cameras.main.setZoom(1);

    // ----- HUD (fixed to camera) -----
    this.actionLabel = this.add.text(this.scale.width / 2, 12,
      Net.role === 'hunter' ? '🔦 HUNTER' : '🎭 SHIFTER',
      {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: Net.role === 'hunter' ? '#7dc4ff' : '#ffb070',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);

    this.hud = this.add.text(10, 10, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 }
    }).setScrollFactor(0).setDepth(1000);

    // Beam graphic (world-space, follows camera)
    this.beamGfx = this.add.graphics().setDepth(900);
    this.disguiseGlow = this.add.circle(0, 0, 30, 0x00ff88, 0.3).setVisible(false).setDepth(5);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,SPACE');
    this.wasd.SPACE.on('down', () => this.useAbility());

    this.buildMobileControls();

    this.startTime = Date.now();
    this.scanReadyAt = 0;
    this.gameOver = false;

    const socket = Net.socket;

    this.onPlayerMoved = ({ id, x, y }) => {
      if (id === socket.id) return;
      if (this.lastOppX !== undefined) {
        const dx = x - this.lastOppX;
        const dy = y - this.lastOppY;
        if (dx * dx + dy * dy > 0.1) {
          this.opponent.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        }
      }
      this.opponent.setPosition(x, y);
      this.lastOppX = x;
      this.lastOppY = y;
    };

    this.onScanResult = ({ x, y, radius, hit, shifterX, shifterY }) => {
      this.drawBeam(x, y, radius);
      if (hit && Net.role === 'hunter') {
        this.opponent.setPosition(shifterX, shifterY);
        this.opponent.setVisible(true);
        this.revealedTimer = 1500;
        this.tweens.add({
          targets: this.opponent,
          alpha: { from: 1, to: 0.3 },
          duration: 200, yoyo: true, repeat: 2
        });
      }
    };

    this.onDisguised = ({ decoyId }) => {
      this.disguiseId = decoyId;
      const d = Net.decoys.find((x) => x.id === decoyId);
      if (d) {
        this.me.setPosition(d.x, d.y);
        this.disguiseGlow.setPosition(d.x, d.y).setVisible(true);
      }
    };

    this.onGameOver = ({ winner, reason }) => {
      this.gameOver = true;
      this.scene.start('EndScene', { winner, reason });
    };

    this.onOpponentLeft = () => {
      this.scene.start('EndScene', {
        winner: Net.role,
        reason: 'Opponent left the game.'
      });
    };

    socket.on('playerMoved', this.onPlayerMoved);
    socket.on('scanResult', this.onScanResult);
    socket.on('disguised', this.onDisguised);
    socket.on('gameOver', this.onGameOver);
    socket.on('opponentLeft', this.onOpponentLeft);

    this.events.on('shutdown', () => {
      socket.off('playerMoved', this.onPlayerMoved);
      socket.off('scanResult', this.onScanResult);
      socket.off('disguised', this.onDisguised);
      socket.off('gameOver', this.onGameOver);
      socket.off('opponentLeft', this.onOpponentLeft);
      this.cleanupMobileControls();
    });
  }

  update(time, delta) {
    if (this.gameOver) return;

    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    if (this.joystick && this.joystick.active) {
      vx += this.joystick.dx;
      vy += this.joystick.dy;
    }

    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) {
      vx = (vx / len) * this.PLAYER_SPEED;
      vy = (vy / len) * this.PLAYER_SPEED;
      this.me.rotation = Math.atan2(vy, vx) + Math.PI / 2;

      if (Net.role === 'shifter' && this.disguiseId !== undefined && this.disguiseId !== null) {
        this.disguiseId = null;
        this.disguiseGlow.setVisible(false);
      }
    }
    this.me.body.setVelocity(vx, vy);

    this.lastSent = this.lastSent || 0;
    if (time - this.lastSent > 50) {
      Net.socket.emit('move', { x: this.me.x, y: this.me.y });
      this.lastSent = time;
    }

    if (this.revealedTimer > 0) {
      this.revealedTimer -= delta;
      if (this.revealedTimer <= 0 && Net.role === 'hunter') {
        this.opponent.setVisible(false);
        this.opponent.setAlpha(1);
      }
    }

    const remaining = Math.max(0, Net.gameDuration - (Date.now() - this.startTime));
    const sec = Math.ceil(remaining / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');

    let hudText = `⏱  ${mm}:${ss}`;
    if (Net.role === 'hunter') {
      const cd = Math.max(0, this.scanReadyAt - time);
      hudText += `\n🔦 ${cd <= 0 ? 'READY' : (cd / 1000).toFixed(1) + 's'}`;
      hudText += `\nTap a crate to ACCUSE`;
    } else {
      hudText += `\n🎭 ${this.disguiseId != null ? 'DISGUISED' : 'EXPOSED'}`;
      hudText += `\nStop on a crate to hide`;
    }
    this.hud.setText(hudText);
  }

  useAbility() {
    if (this.gameOver) return;
    if (Net.role === 'hunter') {
      const now = this.time.now;
      if (now < this.scanReadyAt) return;
      this.scanReadyAt = now + this.SCAN_COOLDOWN_MS;
      Net.socket.emit('scan', {
        x: this.me.x,
        y: this.me.y,
        radius: this.SCAN_RADIUS
      });
      this.drawBeam(this.me.x, this.me.y, this.SCAN_RADIUS);
    } else {
      let nearest = null;
      let nearestDist = 35;
      for (const d of Net.decoys) {
        const dist = Phaser.Math.Distance.Between(this.me.x, this.me.y, d.x, d.y);
        if (dist < nearestDist) {
          nearest = d;
          nearestDist = dist;
        }
      }
      if (nearest) Net.socket.emit('disguise', nearest.id);
    }
  }

  drawBeam(x, y, radius) {
    this.beamGfx.clear();
    this.beamGfx.alpha = 1;
    this.beamGfx.fillStyle(0xffeaa0, 0.15);
    this.beamGfx.fillCircle(x, y, radius * 1.2);
    this.beamGfx.fillStyle(0xffe04a, 0.3);
    this.beamGfx.fillCircle(x, y, radius);
    this.beamGfx.lineStyle(3, 0xffeaa0, 0.9);
    this.beamGfx.strokeCircle(x, y, radius);
    this.tweens.add({
      targets: this.beamGfx,
      alpha: 0,
      duration: 700,
      onComplete: () => this.beamGfx.clear()
    });
  }

  confirmAccuse(decoyId) {
    if (this.pendingAccuseId === decoyId) {
      Net.socket.emit('accuse', decoyId);
      this.pendingAccuseId = null;
    } else {
      this.pendingAccuseId = decoyId;
      const r = this.decoyGfx[decoyId];
      this.tweens.add({
        targets: r,
        scale: { from: r.scale, to: r.scale * 1.2 },
        duration: 200, yoyo: true, repeat: 2
      });
      this.time.delayedCall(1500, () => {
        if (this.pendingAccuseId === decoyId) this.pendingAccuseId = null;
      });
    }
  }

  // Mobile controls -------------------------------------------------
  buildMobileControls() {
    const container = document.getElementById('game-container');

    const base = document.createElement('div');
    base.id = 'joystick-base';
    base.style.cssText = `
      position: absolute; left: 30px; bottom: 30px;
      width: 130px; height: 130px; border-radius: 65px;
      background: radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0.05));
      border: 2px solid rgba(255,255,255,0.3);
      box-shadow: 0 4px 16px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.4);
      touch-action: none; z-index: 10;
    `;
    const thumb = document.createElement('div');
    thumb.style.cssText = `
      position: absolute; left: 40px; top: 40px;
      width: 50px; height: 50px; border-radius: 25px;
      background: radial-gradient(circle at 30% 30%, #fff, #aaa);
      box-shadow: 0 2px 8px rgba(0,0,0,0.6);
      pointer-events: none;
    `;
    base.appendChild(thumb);

    const action = document.createElement('div');
    action.id = 'action-btn';
    const isHunter = Net.role === 'hunter';
    action.innerHTML = isHunter
      ? '<div style="font-size:28px">🔦</div><div style="font-size:13px;margin-top:2px">SCAN</div>'
      : '<div style="font-size:28px">🎭</div><div style="font-size:13px;margin-top:2px">HIDE</div>';
    action.style.cssText = `
      position: absolute; right: 30px; bottom: 50px;
      width: 100px; height: 100px; border-radius: 50px;
      background: ${isHunter
        ? 'radial-gradient(circle at 30% 30%, #ffe98a, #f0a020)'
        : 'radial-gradient(circle at 30% 30%, #ffb380, #d8602e)'};
      color: #1a0e00; font-weight: bold; font-family: Georgia, serif;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      touch-action: none; user-select: none; z-index: 10;
      box-shadow: 0 6px 18px rgba(0,0,0,0.7), inset 0 -4px 8px rgba(0,0,0,0.3);
      cursor: pointer;
    `;

    container.appendChild(base);
    container.appendChild(action);
    this.mobileBase = base;
    this.mobileAction = action;

    this.joystick = { active: false, dx: 0, dy: 0, startX: 0, startY: 0 };
    const onStart = (e) => {
      e.preventDefault();
      const rect = base.getBoundingClientRect();
      this.joystick.startX = rect.left + rect.width / 2;
      this.joystick.startY = rect.top + rect.height / 2;
      this.joystick.active = true;
    };
    const onMove = (e) => {
      if (!this.joystick.active) return;
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - this.joystick.startX;
      const dy = t.clientY - this.joystick.startY;
      const max = 55;
      const len = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(len, max);
      const nx = len === 0 ? 0 : (dx / len) * clamped;
      const ny = len === 0 ? 0 : (dy / len) * clamped;
      thumb.style.left = (40 + nx) + 'px';
      thumb.style.top = (40 + ny) + 'px';
      this.joystick.dx = nx / max;
      this.joystick.dy = ny / max;
    };
    const onEnd = (e) => {
      if (e) e.preventDefault();
      this.joystick.active = false;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
      thumb.style.left = '40px';
      thumb.style.top = '40px';
    };

    base.addEventListener('touchstart', onStart, { passive: false });
    base.addEventListener('touchmove', onMove, { passive: false });
    base.addEventListener('touchend', onEnd, { passive: false });
    base.addEventListener('touchcancel', onEnd, { passive: false });

    const onAction = (e) => { e.preventDefault(); this.useAbility(); };
    action.addEventListener('touchstart', onAction, { passive: false });
    action.addEventListener('click', onAction);
  }

  cleanupMobileControls() {
    if (this.mobileBase && this.mobileBase.parentNode) this.mobileBase.parentNode.removeChild(this.mobileBase);
    if (this.mobileAction && this.mobileAction.parentNode) this.mobileAction.parentNode.removeChild(this.mobileAction);
  }
}
