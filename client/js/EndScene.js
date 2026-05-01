/**
 * EndScene — polished win/lose card.
 */
class EndScene extends Phaser.Scene {
  constructor() {
    super('EndScene');
  }

  init(data) {
    this.winner = data.winner;
    this.reason = data.reason || '';
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0e1a');
    const won = this.winner === Net.role;

    const container = document.getElementById('game-container');
    const wrap = document.createElement('div');
    wrap.id = 'end-ui';
    wrap.innerHTML = `
      <style>
        #end-ui {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: min(420px, 92vw);
          background: linear-gradient(180deg, #161b2e 0%, #1f2540 100%);
          border: 1px solid ${won ? '#4ae28a' : '#ff6b4e'};
          border-radius: 20px;
          padding: 36px 28px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6),
                      0 0 60px ${won ? 'rgba(74,226,138,0.2)' : 'rgba(255,107,78,0.2)'};
          text-align: center;
          font-family: 'Inter', sans-serif;
        }
        .es-title {
          font-family: 'Bungee', sans-serif;
          font-size: 44px;
          letter-spacing: 2px;
          line-height: 1;
          margin: 0;
          color: ${won ? '#4ae28a' : '#ff6b4e'};
          text-shadow: 0 0 30px ${won ? 'rgba(74,226,138,0.5)' : 'rgba(255,107,78,0.5)'};
        }
        .es-sub {
          font-size: 14px;
          color: #8a92ad;
          margin-top: 6px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .es-reason {
          margin-top: 28px;
          padding: 16px;
          background: #0e1226;
          border-radius: 12px;
          font-size: 15px;
          color: #e8ecf5;
          line-height: 1.5;
        }
        .es-winner-row {
          margin-top: 18px;
          display: flex;
          justify-content: center;
          gap: 10px;
          align-items: center;
          font-size: 13px;
          color: #8a92ad;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .es-winner-pill {
          padding: 6px 14px;
          border-radius: 999px;
          font-weight: 700;
          ${this.winner === 'hunter'
            ? 'background: rgba(78,161,255,0.15); color: #7dc4ff; border: 1px solid #4ea1ff;'
            : 'background: rgba(255,107,78,0.15); color: #ffb070; border: 1px solid #ff6b4e;'}
        }
        .es-btn {
          margin-top: 28px;
          width: 100%;
          padding: 16px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 1px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(180deg, #6ab5ff 0%, #2680e8 100%);
          color: white;
          cursor: pointer;
          font-family: inherit;
          text-transform: uppercase;
          box-shadow: 0 4px 14px rgba(74,144,226,0.3);
          -webkit-appearance: none;
        }
        .es-btn:active { transform: scale(0.97); }
        .es-emoji {
          font-size: 64px;
          margin-bottom: 6px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      </style>
      <div class="es-emoji">${won ? '🏆' : '💀'}</div>
      <div class="es-title">${won ? 'YOU WIN' : 'YOU LOSE'}</div>
      <div class="es-sub">${won ? 'Victory' : 'Defeat'}</div>
      <div class="es-reason">${this.reason}</div>
      <div class="es-winner-row">
        Winner: <span class="es-winner-pill">${this.winner.toUpperCase()}</span>
      </div>
      <button class="es-btn" id="es-again">Play Again</button>
    `;
    container.appendChild(wrap);

    wrap.querySelector('#es-again').onclick = () => {
      if (Net.socket) {
        Net.socket.disconnect();
        Net.socket = null;
      }
      Net.role = null;
      Net.roomCode = null;
      Net.decoys = [];
      wrap.remove();
      this.scene.start('LobbyScene');
    };

    this.events.on('shutdown', () => wrap.remove());
  }
}
