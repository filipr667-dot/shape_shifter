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

    // ✅ Correct connection (important)
    this.socket = io({
      transports: ['websocket', 'polling']
    });

    // ✅ Debug: confirm connection
    this.socket.on("connect", () => {
      console.log("Connected to server:", this.socket.id);
    });

    // ✅ Store game data when game starts
    this.socket.on("gameStart", (data) => {
      console.log("GAME START DATA:", data);

      this.decoys = data.decoys;
      this.walls = data.walls;
      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.gameDuration = data.duration;
    });

    return this.socket;
  }
};