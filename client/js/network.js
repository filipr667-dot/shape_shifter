window.Net = {
  socket: null,
  role: null,
  roomCode: null,
  decoys: [],
  walls: [],
  mapWidth: 1200,
  mapHeight: 900,
  gameDuration: 180000,
  players: [],

  connect() {
    if (this.socket) return this.socket;

    this.socket = io({
      transports: ['websocket', 'polling']
    });

    this.socket.on("connect", () => {
      console.log("Connected:", this.socket.id);
    });

    this.socket.on("roomCreated", (data) => {
      this.roomCode = data.code;
      this.role = data.role;
    });

    this.socket.on("roomJoined", (data) => {
      this.roomCode = data.code;
      this.role = data.role;
    });

    // 🔥 IMPORTANT FIX
    this.socket.on("gameStart", (data) => {
      console.log("GAME START:", data);

      this.decoys = data.decoys;
      this.walls = data.walls;
      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.gameDuration = data.duration;

      // ✅ Convert players object → usable array
      this.players = Object.entries(data.players).map(([id, p]) => ({
        id,
        ...p
      }));
    });

    return this.socket;
  }
};