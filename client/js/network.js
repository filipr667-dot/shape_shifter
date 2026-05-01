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

    // 🔥 CONNECTION
    this.socket.on("connect", () => {
      console.log("✅ Connected:", this.socket.id);
    });

    // 🔥 ROOM EVENTS
    this.socket.on("roomCreated", (data) => {
      console.log("🏠 Room created:", data);
      this.roomCode = data.code;
      this.role = data.role;
    });

    this.socket.on("roomJoined", (data) => {
      console.log("👥 Room joined:", data);
      this.roomCode = data.code;
      this.role = data.role;
    });

    // 🔥 GAME START
    this.socket.on("gameStart", (data) => {
      console.log("🚀 GAME START RECEIVED:", data);

      this.decoys = data.decoys;
      this.walls = data.walls;
      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.gameDuration = data.duration;
    });

    // 🔥 MOVEMENT
    this.socket.on("playerMoved", (data) => {
      console.log("Player moved:", data);
    });

    return this.socket;
  }
};