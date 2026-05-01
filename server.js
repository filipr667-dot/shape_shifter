/**
 * Shape Shifter - Backend Server (multi-room version)
 * ----------------------------------------------------
 * Arena is a 2x2 grid of rooms with these doorways:
 *   - Room 1 <-> Room 3 (vertical doorway in left half of horizontal middle wall)
 *   - Room 2 <-> Room 4 (vertical doorway in right half of horizontal middle wall)
 *   - Room 3 <-> Room 4 (horizontal doorway in bottom half of vertical middle wall)
 * NO door between Room 1 and Room 2.
 *
 * Walls block both player movement (collisions client-side) AND
 * the hunter's flashlight scan (line-of-sight check on the server).
 */
try {
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
// Map dimensions (must match client config)
// ---------------------------------------------------------------
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;
const WALL_T = 16;            // wall thickness
const DOOR_W = 130;           // doorway width
const MID_X = MAP_WIDTH / 2;
const MID_Y = MAP_HEIGHT / 2;

// 5 decoys per room x 4 rooms = 20 total
const NUM_DECOYS_PER_ROOM = 5;

// ---------------------------------------------------------------
// Wall layout
// Each wall is { x, y, w, h } — top-left x/y, width, height.
// We expose this list to the client so it can draw + collide against it.
// ---------------------------------------------------------------
function buildWalls() {
  const walls = [];

  // -------- Outer border walls --------
  walls.push({ x: 0, y: 0, w: MAP_WIDTH, h: WALL_T });                       // top
  walls.push({ x: 0, y: MAP_HEIGHT - WALL_T, w: MAP_WIDTH, h: WALL_T });     // bottom
  walls.push({ x: 0, y: 0, w: WALL_T, h: MAP_HEIGHT });                      // left
  walls.push({ x: MAP_WIDTH - WALL_T, y: 0, w: WALL_T, h: MAP_HEIGHT });     // right

  // -------- Vertical middle wall (separates 1|2 and 3|4) --------
  // Top half: SOLID (no door between 1 and 2)
  walls.push({
    x: MID_X - WALL_T / 2,
    y: WALL_T,
    w: WALL_T,
    h: MID_Y - WALL_T
  });
  // Bottom half: doorway between 3 and 4
  // Doorway is centered vertically inside the bottom half.
  const doorBotCenterY = MID_Y + (MID_Y - WALL_T) / 2;
  // Segment above the door
  walls.push({
    x: MID_X - WALL_T / 2,
    y: MID_Y,
    w: WALL_T,
    h: doorBotCenterY - DOOR_W / 2 - MID_Y
  });
  // Segment below the door
  walls.push({
    x: MID_X - WALL_T / 2,
    y: doorBotCenterY + DOOR_W / 2,
    w: WALL_T,
    h: MAP_HEIGHT - WALL_T - (doorBotCenterY + DOOR_W / 2)
  });

  // -------- Horizontal middle wall (separates 1,2 from 3,4) --------
  // Left half has a doorway (1<->3); right half has a doorway (2<->4).
  // Each doorway is centered horizontally inside its half.
  const doorLeftCenterX = MID_X / 2;
  const doorRightCenterX = MID_X + MID_X / 2;

  // Left of left-doorway
  walls.push({
    x: WALL_T,
    y: MID_Y - WALL_T / 2,
    w: doorLeftCenterX - DOOR_W / 2 - WALL_T,
    h: WALL_T
  });
  // Between left-doorway and the central column
  walls.push({
    x: doorLeftCenterX + DOOR_W / 2,
    y: MID_Y - WALL_T / 2,
    w: MID_X - (doorLeftCenterX + DOOR_W / 2) - WALL_T / 2,
    h: WALL_T
  });
  // Between central column and right-doorway
  walls.push({
    x: MID_X + WALL_T / 2,
    y: MID_Y - WALL_T / 2,
    w: doorRightCenterX - DOOR_W / 2 - (MID_X + WALL_T / 2),
    h: WALL_T
  });
  // Right of right-doorway
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
// Decoy generation — 5 per room, evenly distributed
// ---------------------------------------------------------------
const DECOY_TYPES = 8; // 8 different sprite variants
const PADDING = 70;    // keep decoys away from walls

function randomInRoom(roomIndex) {
  // roomIndex: 0=R1 (top-left), 1=R2 (top-right), 2=R3 (bot-left), 3=R4 (bot-right)
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
// Line-of-sight check (used to block scans through walls)
// Returns true if the segment from (x1,y1) to (x2,y2) hits any wall.
// ---------------------------------------------------------------
function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  // Liang-Barsky style clip — quick check if the line segment
  // intersects the axis-aligned rectangle.
  const { x, y, w, h } = rect;
  const minX = x;
  const minY = y;
  const maxX = x + w;
  const maxY = y + h;

  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const clip = (p, q) => {
    if (p === 0) return q >= 0; // parallel
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (
    clip(-dx, x1 - minX) &&
    clip(dx, maxX - x1) &&
    clip(-dy, y1 - minY) &&
    clip(dy, maxY - y1)
  ) {
    return true;
  }
  return false;
}

function hasLineOfSight(x1, y1, x2, y2) {
  for (const w of WALLS) {
    if (segmentIntersectsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}

// ---------------------------------------------------------------
// Rooms (in-memory)
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
// Socket.IO handlers
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
    console.log(`Room ${code} created by ${socket.id} as ${role}`);
  });

  socket.on('joinRoom', (code) => {
    code = (code || '').toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit('joinError', 'Room not found.');
    if (Object.keys(room.players).length >= 2) return socket.emit('joinError', 'Room is full.');

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
    console.log(`${socket.id} joined ${code} as ${role}`);
  });

  socket.on('move', (pos) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.gameOver) return;
    const player = room.players[socket.id];
    if (!player) return;

    player.x = Math.max(20, Math.min(MAP_WIDTH - 20, pos.x));
    player.y = Math.max(20, Math.min(MAP_HEIGHT - 20, pos.y));

    io.to(code).emit('playerMoved', {
      id: socket.id,
      x: player.x,
      y: player.y
    });
  });

  socket.on('disguise', (decoyId) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.gameOver) return;
    const player = room.players[socket.id];
    if (!player || player.role !== 'shifter') return;

    player.disguiseId = decoyId;
    const decoy = room.decoys.find((d) => d.id === decoyId);
    if (decoy) {
      player.x = decoy.x;
      player.y = decoy.y;
    }
    socket.emit('disguised', { decoyId });
  });

  // Hunter scan — checks distance AND line-of-sight (walls block scans)
  socket.on('scan', ({ x, y, radius }) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.gameOver) return;
    const hunter = room.players[socket.id];
    if (!hunter || hunter.role !== 'hunter') return;

    const shifterEntry = Object.entries(room.players).find(([, p]) => p.role === 'shifter');
    if (!shifterEntry) return;
    const [, shifter] = shifterEntry;

    const dx = shifter.x - x;
    const dy = shifter.y - y;
    const inRange = Math.sqrt(dx * dx + dy * dy) <= radius;
    const visible = inRange && hasLineOfSight(x, y, shifter.x, shifter.y);

    socket.emit('scanResult', {
      x,
      y,
      radius,
      hit: visible,
      shifterX: visible ? shifter.x : null,
      shifterY: visible ? shifter.y : null
    });
  });

  socket.on('accuse', (targetDecoyId) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.gameOver) return;
    const hunter = room.players[socket.id];
    if (!hunter || hunter.role !== 'hunter') return;

    const shifterEntry = Object.entries(room.players).find(([, p]) => p.role === 'shifter');
    if (!shifterEntry) return;
    const [, shifter] = shifterEntry;

    const correct = shifter.disguiseId === targetDecoyId;
    room.gameOver = true;

    io.to(code).emit('gameOver', {
      winner: correct ? 'hunter' : 'shifter',
      reason: correct ? 'Hunter identified the Shape Shifter!' : 'Hunter guessed wrong!'
    });
  });

  // Per-socket timer (shifter wins if 3 minutes pass)
  const tick = setInterval(() => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.gameOver || !room.startTime) return;
    if (Date.now() - room.startTime >= GAME_DURATION_MS) {
      room.gameOver = true;
      io.to(code).emit('gameOver', {
        winner: 'shifter',
        reason: 'Shape Shifter survived 3 minutes!'
      });
      clearInterval(tick);
    }
  }, 1000);

  socket.on('disconnect', () => {
    clearInterval(tick);
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;

    delete rooms[code].players[socket.id];

    if (Object.keys(rooms[code].players).length === 0) {
      delete rooms[code];
      console.log(`Room ${code} closed (empty).`);
    } else if (!rooms[code].gameOver) {
      io.to(code).emit('opponentLeft');
      delete rooms[code];
    }
  });
});

console.log("About to start server...");


const PORT = process.env.PORT || 3000;

server.listen(PORT,  () => {
  console.log("Server started on port:" PORT);
});

} catch (err) {
  console.error("CRASH:", err);
}
