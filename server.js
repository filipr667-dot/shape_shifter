/**
 * Shape Shifter - Backend Server (multi-room version)
 */

console.log("FILE LOADED");

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.get('/', (req, res) => res.send('Shape Shifter server is running.'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ---------------------------------------------------------------
// Map config
// ---------------------------------------------------------------
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;
const WALL_T = 16;
const DOOR_W = 130;
const MID_X = MAP_WIDTH / 2;
const MID_Y = MAP_HEIGHT / 2;

const NUM_DECOYS_PER_ROOM = 5;

// ---------------------------------------------------------------
// Walls
// ---------------------------------------------------------------
function buildWalls() {
  const walls = [];

  walls.push({ x: 0, y: 0, w: MAP_WIDTH, h: WALL_T });
  walls.push({ x: 0, y: MAP_HEIGHT - WALL_T, w: MAP_WIDTH, h: WALL_T });
  walls.push({ x: 0, y: 0, w: WALL_T, h: MAP_HEIGHT });
  walls.push({ x: MAP_WIDTH - WALL_T, y: 0, w: WALL_T, h: MAP_HEIGHT });

  walls.push({
    x: MID_X - WALL_T / 2,
    y: WALL_T,
    w: WALL_T,
    h: MID_Y - WALL_T
  });

  const doorBotCenterY = MID_Y + (MID_Y - WALL_T) / 2;

  walls.push({
    x: MID_X - WALL_T / 2,
    y: MID_Y,
    w: WALL_T,
    h: doorBotCenterY - DOOR_W / 2 - MID_Y
  });

  walls.push({
    x: MID_X - WALL_T / 2,
    y: doorBotCenterY + DOOR_W / 2,
    w: WALL_T,
    h: MAP_HEIGHT - WALL_T - (doorBotCenterY + DOOR_W / 2)
  });

  const doorLeftCenterX = MID_X / 2;
  const doorRightCenterX = MID_X + MID_X / 2;

  walls.push({
    x: WALL_T,
    y: MID_Y - WALL_T / 2,
    w: doorLeftCenterX - DOOR_W / 2 - WALL_T,
    h: WALL_T
  });

  walls.push({
    x: doorLeftCenterX + DOOR_W / 2,
    y: MID_Y - WALL_T / 2,
    w: MID_X - (doorLeftCenterX + DOOR_W / 2) - WALL_T / 2,
    h: WALL_T
  });

  walls.push({
    x: MID_X + WALL_T / 2,
    y: MID_Y - WALL_T / 2,
    w: doorRightCenterX - DOOR_W / 2 - (MID_X + WALL_T / 2),
    h: WALL_T
  });

  walls.push({
    x: doorRightCenterX + DOOR_W / 2,
    y: MID_Y - WALL_T / 2,
    w: MAP_WIDTH - WALL_T - (doorRightCenterX + DOOR_W / 2),
    h: WALL_T
  });

  return walls;
}

const WALLS = buildWalls();

// ---------------------------------------------------------------
// Decoys
// ---------------------------------------------------------------
const DECOY_TYPES = 8;
const PADDING = 70;

function randomInRoom(roomIndex) {
  const left = roomIndex % 2 === 0 ? WALL_T : MID_X + WALL_T;
  const right = roomIndex % 2 === 0 ? MID_X - WALL_T : MAP_WIDTH - WALL_T;
  const top = roomIndex < 2 ? WALL_T : MID_Y + WALL_T;
  const bottom = roomIndex < 2 ? MID_Y - WALL_T : MAP_HEIGHT - WALL_T;

  return {
    x: left + PADDING + Math.random() * (right - left - PADDING * 2),
    y: top + PADDING + Math.random() * (bottom - top - PADDING * 2)
  };
}

function generateDecoys() {
  const decoys = [];
  let id = 0;
  for (let room = 0; room < 4; room++) {
    for (let i = 0; i < NUM_DECOYS_PER_ROOM; i++) {
      const pos = randomInRoom(room);
      decoys.push({
        id: id++,
        x: pos.x,
        y: pos.y,
        room,
        type: Math.floor(Math.random() * DECOY_TYPES)
      });
    }
  }
  return decoys;
}

// ---------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------
const rooms = {};
const GAME_DURATION_MS = 3 * 60 * 1000;

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? makeRoomCode() : code;
}

// ---------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('createRoom', () => {
    const code = makeRoomCode();
    rooms[code] = {
      players: {},
      decoys: generateDecoys(),
      startTime: null,
      gameOver: false
    };

    socket.join(code);
    socket.data.roomCode = code;

    const role = Math.random() < 0.5 ? 'hunter' : 'shifter';

    rooms[code].players[socket.id] = {
      role,
      x: 200,
      y: 200,
      disguiseId: null
    };

    socket.emit('roomCreated', { code, role });
  });

  socket.on('joinRoom', (code) => {
    code = (code || '').toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit('joinError', 'Room not found.');

    const existingRole = Object.values(room.players)[0].role;
    const role = existingRole === 'hunter' ? 'shifter' : 'hunter';

    room.players[socket.id] = {
      role,
      x: MAP_WIDTH - 200,
      y: MAP_HEIGHT - 200,
      disguiseId: null
    };

    socket.join(code);
    socket.data.roomCode = code;

    room.startTime = Date.now();

    socket.emit('roomJoined', { code, role });

    io.to(code).emit('gameStart', {
      decoys: room.decoys,
      walls: WALLS,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      duration: GAME_DURATION_MS,
      players: room.players
    });
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;

    delete rooms[code].players[socket.id];

    if (Object.keys(rooms[code].players).length === 0) {
      delete rooms[code];
    }
  });
});

// ---------------------------------------------------------------
// START SERVER (FIXED)
// ---------------------------------------------------------------
console.log("About to start server...");

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

