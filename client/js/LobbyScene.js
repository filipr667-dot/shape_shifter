/**
 * LobbyScene — card-style lobby. Stores walls and map dimensions
 * from the server's gameStart event before transitioning to GameScene.
 */
class LobbyScene extends Phaser.Scene {
  constructor() { super('LobbyScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#0a0e1a');
    this.buildDOM();

    const socket = Net.connect();

    socket.on('connect', () => this.setStatus('Connected'));
    socket.on('connect_error', () => this.setStatus('Cannot reach server'));

    socket.on('roomCreated', ({ code, role }) => {
      Net.roomCode = code;
      Net.role = role;
      this.showWaitingRoom(code, role);
    });

    socket.on('roomJoined', ({ code, role }) => {
      Net.roomCode = code;
      Net.role = role;
    });

    socket.on('joinError', (msg) => this.setStatus('⚠ ' + msg, true));

    socket.on('gameStart', ({ decoys, walls, mapWidth, mapHeight, duration }) => {
      Net.decoys = decoys;
      Net.walls = walls || [];
      Net.mapWidth = mapWidth || 1200;
      Net.mapHeight = mapHeight || 900;
      Net.gameDuration = duration;
      this.cleanupDOM();
      this.scene.start('GameScene');
    });

    this.events.on('shutdown', () => {
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('joinError');
      socket.off('gameStart');
    });
  }

  setStatus(text, isError) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
      this.statusEl.style.color = isError ? '#ff7766' : 'var(--text-dim)';
    }
  }

  buildDOM() {
    const container = document.getElementById('game-container');
    const wrap = document.createElement('div');
    wrap.id = 'lobby-ui';
    wrap.innerHTML = `
      <style>
        #lobby-ui {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: min(420px, 92vw);
          background: linear-gradient(180deg, #161b2e 0%, #1f2540 100%);
          border: 1px solid #2a3252;
          border-radius: 20px;
          padding: 32px 28px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset;
        }
        .ll-title {
          font-family: 'Bungee', sans-serif;
          font-size: 38px; line-height: 1;
          text-align: center; letter-spacing: 1px;
          background: linear-gradient(180deg, #ffffff 0%, #7dc4ff 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 4px 20px rgba(125, 196, 255, 0.3);
        }
        .ll-sub { text-align: center; color: #8a92ad; font-size: 13px; margin: 6px 0 24px; letter-spacing: 0.5px; }
        .ll-btn {
          width: 100%; padding: 14px;
          font-size: 15px; font-weight: 700; letter-spacing: 1px;
          border: none; border-radius: 12px; cursor: pointer;
          font-family: inherit; transition: transform 0.12s;
          -webkit-appearance: none; text-transform: uppercase;
        }
        .ll-btn:active { transform: scale(0.97); }
        .ll-btn.green {
          background: linear-gradient(180deg, #5fe89e 0%, #2bb46a 100%);
          color: #062a18; box-shadow: 0 4px 14px rgba(74, 226, 138, 0.3);
        }
        .ll-btn.blue {
          background: linear-gradient(180deg, #6ab5ff 0%, #2680e8 100%);
          color: white; box-shadow: 0 4px 14px rgba(74, 144, 226, 0.3);
        }
        .ll-row { display: flex; gap: 10px; }
        .ll-input {
          flex: 1; padding: 14px; font-size: 18px;
          border: 2px solid #2a3252; border-radius: 12px;
          background: #0e1226; color: white;
          text-align: center; letter-spacing: 6px;
          font-weight: 700; font-family: 'Bungee', sans-serif;
          outline: none; text-transform: uppercase;
        }
        .ll-input:focus { border-color: #4ea1ff; }
        .ll-input::placeholder { color: #4a5278; letter-spacing: 2px; font-family: 'Inter'; font-weight: 400; }
        .ll-label { font-size: 11px; color: #8a92ad; letter-spacing: 2px; margin: 18px 0 8px; text-transform: uppercase; }
        .ll-divider { height: 1px; background: linear-gradient(90deg, transparent, #2a3252, transparent); margin: 18px 0; }
        .ll-status { text-align: center; font-size: 13px; color: #8a92ad; margin-top: 14px; min-height: 16px; }
        .ll-code-card {
          background: #0e1226; border: 2px dashed #4ea1ff;
          border-radius: 12px; padding: 18px; text-align: center;
          margin: 12px 0 4px;
        }
        .ll-code-label { font-size: 11px; color: #8a92ad; letter-spacing: 2px; text-transform: uppercase; }
        .ll-code-value {
          font-family: 'Bungee', sans-serif;
          font-size: 36px; letter-spacing: 8px;
          color: #ffd24a; margin-top: 6px;
          text-shadow: 0 0 20px rgba(255, 210, 74, 0.4);
        }
        .ll-role-pill {
          display: inline-block; padding: 6px 14px; border-radius: 999px;
          font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
          margin-top: 12px; text-transform: uppercase;
        }
        .ll-role-pill.hunter { background: rgba(78,161,255,0.15); color: #7dc4ff; border: 1px solid #4ea1ff; }
        .ll-role-pill.shifter { background: rgba(255,107,78,0.15); color: #ffb070; border: 1px solid #ff6b4e; }
        .ll-spinner {
          display: inline-block; width: 12px; height: 12px;
          border: 2px solid #4ea1ff; border-top-color: transparent;
          border-radius: 50%; animation: spin 0.8s linear infinite;
          vertical-align: middle; margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ll-version { position: absolute; bottom: 10px; right: 14px; font-size: 10px; color: #4a5278; letter-spacing: 1px; }
      </style>
      <div class="ll-title">SHAPE<br>SHIFTER</div>
      <div class="ll-sub">HUNTER vs SHIFTER · 3 MIN · 4 ROOMS</div>
      <div id="ll-main">
        <button class="ll-btn green" id="ll-create">Create Room</button>
        <div class="ll-divider"></div>
        <div class="ll-label">Have a code?</div>
        <div class="ll-row">
          <input class="ll-input" id="ll-code" placeholder="ENTER CODE" maxlength="4" autocapitalize="characters" autocomplete="off" />
          <button class="ll-btn blue" id="ll-join" style="width: auto; padding: 14px 24px;">Join</button>
        </div>
      </div>
      <div id="ll-waiting" style="display: none;">
        <div class="ll-code-card">
          <div class="ll-code-label">Room Code</div>
          <div class="ll-code-value" id="ll-code-display">----</div>
        </div>
        <div style="text-align: center; margin-top: 12px;">
          <span class="ll-spinner"></span>
          <span style="color: #8a92ad; font-size: 14px;">Waiting for opponent...</span>
        </div>
        <div style="text-align: center;">
          <span class="ll-role-pill" id="ll-role-pill">HUNTER</span>
        </div>
      </div>
      <div class="ll-status" id="ll-status">Connecting...</div>
      <div class="ll-version">v2.0</div>
    `;
    container.appendChild(wrap);
    this.lobbyUI = wrap;
    this.statusEl = wrap.querySelector('#ll-status');

    wrap.querySelector('#ll-create').onclick = () => Net.socket.emit('createRoom');
    const codeInput = wrap.querySelector('#ll-code');
    const join = () => {
      const code = codeInput.value.trim().toUpperCase();
      if (code.length === 4) Net.socket.emit('joinRoom', code);
      else this.setStatus('⚠ Code must be 4 letters', true);
    };
    wrap.querySelector('#ll-join').onclick = join;
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase(); });
  }

  showWaitingRoom(code, role) {
    const wrap = this.lobbyUI;
    wrap.querySelector('#ll-main').style.display = 'none';
    wrap.querySelector('#ll-waiting').style.display = 'block';
    wrap.querySelector('#ll-code-display').textContent = code;
    const pill = wrap.querySelector('#ll-role-pill');
    pill.textContent = '🎯 ' + role.toUpperCase();
    pill.className = 'll-role-pill ' + role;
    this.setStatus('Share the code with a friend');
  }

  cleanupDOM() {
    if (this.lobbyUI && this.lobbyUI.parentNode) this.lobbyUI.parentNode.removeChild(this.lobbyUI);
  }
}
