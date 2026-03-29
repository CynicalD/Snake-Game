// server/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { type GameState, type Player, type Point, BOARD_SIZE } from '../shared/type.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const MAX_PLAYERS = 2;

// Helper function to generate random X/Y coordinates for spawninglings
function getRandomPosition(): Point {
  return {
    x: Math.floor(Math.random() * BOARD_SIZE),
    y: Math.floor(Math.random() * BOARD_SIZE)
  };
}

function isPointOccupiedByAnySnake(point: Point): boolean {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player || !player.isAlive) continue;

    const occupiesPoint = player.body.some((segment) => {
      return segment.x === point.x && segment.y === point.y;
    });

    if (occupiesPoint) {
      return true;
    }
  }

  return false;
}

function getRandomApplePosition(): Point {
  // Try a bunch of random spots first to avoid spawning on top of snakes.
  for (let i = 0; i < 100; i += 1) {
    const candidate = getRandomPosition();
    if (!isPointOccupiedByAnySnake(candidate)) {
      return candidate;
    }
  }

  // Fallback scan if random attempts fail (very crowded board).
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const candidate = { x, y };
      if (!isPointOccupiedByAnySnake(candidate)) {
        return candidate;
      }
    }
  }

  // If the board is completely full, keep current position.
  return gameState.apple;
}

// 1. Server side in memory
let gameState: GameState = {
  players: {}, 
  apple: getRandomPosition(),
  status: 'WAITING',
  winnerId: null,
  gameOverReason: null
};

function getOtherPlayerId(playerId: string): string | null {
  for (const id in gameState.players) {
    if (id !== playerId) {
      return id;
    }
  }

  return null;
}

function endGame(winnerId: string | null, reason: GameState['gameOverReason']): void {
  gameState.status = 'GAME_OVER';
  gameState.winnerId = winnerId;
  gameState.gameOverReason = reason;
}

// 2. listen for connections
io.on('connection', (socket) => {
  console.log(`🟢 Player connected: ${socket.id}`);

  // Send current state so new clients can render lobby status immediately.
  socket.emit('gameStateUpdate', gameState);

  //Listen for the frontend "Ready Up" button
  socket.on('joinGame', () => {
    // Ignore duplicate joins from the same socket.
    if (gameState.players[socket.id]) {
      return;
    }

    const playerCount = Object.keys(gameState.players).length;

    if (playerCount >= MAX_PLAYERS) {
      socket.emit('lobbyFull');
      return;
    }

    gameState.players[socket.id] = {
      id: socket.id,
      body: [getRandomPosition()],
      direction: 'IDLE',
      isAlive: true,
      score: 0
    };

    console.log(` Player ready: ${socket.id}`);

    // Count how many players are in the dictionary
    const updatedPlayerCount = Object.keys(gameState.players).length;
    
    if (updatedPlayerCount === MAX_PLAYERS && gameState.status === 'WAITING') {
      gameState.status = 'PLAYING';
      gameState.winnerId = null;
      gameState.gameOverReason = null;
      console.log('🏁 2 Players ready! Game is PLAYING!');
    }

    io.emit('gameStateUpdate', gameState); // Force an immediate update
  });

  // listen for keystrokes from the frontend
  socket.on('changeDirection', (newDirection) => {
    const player = gameState.players[socket.id];
    
    // onky change direction if the player exists and isn't dead
    if (player && player.isAlive) {
      player.direction = newDirection;
    }
  });

  // 3. Listen for disconnects
  socket.on('disconnect', () => {
    console.log(`🔴 Player disconnected: ${socket.id}`);
    delete gameState.players[socket.id]; 
    
    // If someone leaves, pause the game
    if (Object.keys(gameState.players).length < 2) {
      gameState.status = 'WAITING';
      gameState.winnerId = null;
      gameState.gameOverReason = null;
    }

    io.emit('gameStateUpdate', gameState);
  });
});

// Start the server
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Snake Server running on http://localhost:${PORT}`);
});

/// The logic of the game:
const TICK_RATE = 85;

setInterval(() => {
  if (gameState.status === 'PLAYING') {
    // Loop through our Dictionary of players
    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];

      if (!player || !player.isAlive || player.direction === 'IDLE') continue;


      const currentHead = player.body[0];
      
      if (!currentHead) continue;
      
      // Create a copy for the new head
      const newHead: Point = { x: currentHead.x, y: currentHead.y };


      switch (player.direction) {
        case 'UP':
          newHead.y -= 1;
          break;
        case 'DOWN':
          newHead.y += 1;
          break;
        case 'LEFT':
          newHead.x -= 1;
          break;
        case 'RIGHT':
          newHead.x += 1;
          break;
      }

      const hitBorder =
        newHead.x < 0 ||
        newHead.y < 0 ||
        newHead.x >= BOARD_SIZE ||
        newHead.y >= BOARD_SIZE;

      if (hitBorder) {
        player.isAlive = false;
        const winnerId = getOtherPlayerId(playerId);
        endGame(winnerId, 'BORDER_COLLISION');
        break;
      }

      // 4. Add the new head to the front of the body array
      player.body.unshift(newHead);

      const ateApple = newHead.x === gameState.apple.x && newHead.y === gameState.apple.y;

      // 5. Remove tail unless apple was eaten. Skipping pop grows snake by 1.
      if (!ateApple) {
        player.body.pop();
      } else {
        player.score += 1;
        gameState.apple = getRandomApplePosition();

        if (player.score >= 10) {
          endGame(playerId, 'APPLE_TARGET_REACHED');
          break;
        }
      }
    }
  }

  // Broadcast the absolute latest state to every connected client
  io.emit('gameStateUpdate', gameState);

}, TICK_RATE);