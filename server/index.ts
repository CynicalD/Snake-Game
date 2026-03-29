// server/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
// Removed the 'type' keyword so we can import the actual BOARD_SIZE value
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

// 1. Server side in memory
let gameState: GameState = {
  players: {}, 
  apple: { x: 10, y: 10 },
  status: 'WAITING'
};

// 2. Listen for connections
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
    
    // If we have exactly 2 players, start the game!
    if (updatedPlayerCount === MAX_PLAYERS && gameState.status === 'WAITING') {
      gameState.status = 'PLAYING';
      console.log('🏁 2 Players ready! Game is PLAYING!');
    }

    io.emit('gameStateUpdate', gameState); // Force an immediate update
  });

  //  Listen for keystrokes from the frontend
  socket.on('changeDirection', (newDirection) => {
    const player = gameState.players[socket.id];
    
    // Only change direction if the player exists and isn't dead
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
const TICK_RATE = 50;

setInterval(() => {
  if (gameState.status === 'PLAYING') {
    // Loop through our Dictionary of players
    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];

      if (!player || !player.isAlive || player.direction === 'IDLE') continue;

      // 1. Find the current head
      const currentHead = player.body[0];
      
      if (!currentHead) continue;
      
      // 2. Create a copy for the new head
      const newHead: Point = { x: currentHead.x, y: currentHead.y };

      // 3. Modify the new head's X or Y based on direction
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

      // 4. Add the new head to the front of the body array
      player.body.unshift(newHead);

      // 5. Remove the tail block so the snake stays the same length
      // (Later, we will skip this step if newHead coordinates match the apple!)
      player.body.pop();

      // TODO: Check for wall collisions
      // TODO: Check for snake collisions
      // TODO: Check for apple collisions
    }
  }

  // Broadcast the absolute latest state to every connected client
  io.emit('gameStateUpdate', gameState);

}, TICK_RATE);