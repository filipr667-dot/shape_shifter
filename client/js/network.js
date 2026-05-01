/**
 * Shared Socket.IO connection + cross-scene state.
 */
window.Net = {
  socket: null,
  role: null,
  roomCode: null,
  decoys: [],
  walls: [],
  mapWidth: 1200,
  mapHeight: 900,
  gameDuration: 180000,

  connect() {
    if (this.socket) return this.socket;
    this.socket = io({
      transports: ['websocket', 'polling']
    });
    return this.socket;
  }
};
