
import { io } from 'socket.io-client';
import { type GameState, BOARD_SIZE } from '../../shared/type';

//  DOM Elements & Canvas Setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;

// Calculate the pixel size of each grid square
const CELL_SIZE = canvas.width / BOARD_SIZE;

// Connect to server (override with ?server=https://... in URL for remote play)
const socketUrlParam = new URLSearchParams(window.location.search).get('server');
const serverUrl = socketUrlParam || 'http://localhost:3000';
const socket = io(serverUrl, {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('🟢 Connected to server with ID:', socket.id);
  joinBtn.innerText = 'Ready Up';
  joinBtn.disabled = false;
  joinBtn.style.display = 'inline-block';
});

// The Render Loop: Listen for the server's state and draw it
socket.on('gameStateUpdate', (gameState: GameState) => {
  drawGame(gameState);
});
// Drawing the Game
function drawGame(gameState: GameState) {
  const playerIds = Object.keys(gameState.players);
  const isJoinedPlayer = Boolean(socket.id && gameState.players[socket.id]);

  if (gameState.status === 'PLAYING') {
    joinBtn.style.display = 'none';
  } else if (gameState.status === 'GAME_OVER') {
    joinBtn.style.display = 'inline-block';
    joinBtn.innerText = 'Game Over';
    joinBtn.disabled = true;
  } else {
    joinBtn.style.display = 'inline-block';

    if (isJoinedPlayer) {
      joinBtn.innerText = 'Waiting for players...';
      joinBtn.disabled = true;
    } else if (playerIds.length >= 2) {
      joinBtn.innerText = 'Lobby full (2 players)';
      joinBtn.disabled = true;
    } else {
      joinBtn.innerText = 'Ready Up';
      joinBtn.disabled = false;
    }
  }

  // Wipe the canvas clean every single frame
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState.status === 'WAITING') {
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for 2 players to ready up...', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Draw the Apple (Red)
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(
    gameState.apple.x * CELL_SIZE, 
    gameState.apple.y * CELL_SIZE, 
    CELL_SIZE, 
    CELL_SIZE
  );

  // Draw the Players
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    
    // Skip if they are dead
    if (!player || !player.isAlive) continue;

    // Highlight our own snake in Neon Green, enemies in Blue
    ctx.fillStyle = playerId === socket.id ? '#00ff00' : '#0088ff';

    // Loop through every block in the snake's body and draw it
    player.body.forEach((segment) => {
      ctx.fillRect(
        segment.x * CELL_SIZE, 
        segment.y * CELL_SIZE, 
        CELL_SIZE - 1, 
        CELL_SIZE - 1
      );
    });
  }

  if (gameState.status === 'GAME_OVER') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const didCurrentPlayerWin = Boolean(socket.id && gameState.winnerId === socket.id);
    const didCurrentPlayerLose = Boolean(socket.id && isJoinedPlayer && gameState.winnerId && gameState.winnerId !== socket.id);

    let title = 'Game Over';
    if (didCurrentPlayerWin) {
      title = 'You won!';
    } else if (didCurrentPlayerLose) {
      title = 'You lost!';
    }

    const reasonText =
      gameState.gameOverReason === 'BORDER_COLLISION'
        ? 'A player hit the border.'
        : gameState.gameOverReason === 'APPLE_TARGET_REACHED'
          ? 'A player reached 10 apples.'
          : '';

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '14px sans-serif';
    if (reasonText) {
      ctx.fillText(reasonText, canvas.width / 2, canvas.height / 2 + 20);
    }
  }
}

socket.on('lobbyFull', () => {
  joinBtn.innerText = 'Lobby full (2 players)';
  joinBtn.disabled = true;
});

// User Input: Sending keystrokes to the server
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':
    case 'w':
      socket.emit('changeDirection', 'UP');
      break;
    case 'ArrowDown':
    case 's':
      socket.emit('changeDirection', 'DOWN');
      break;
    case 'ArrowLeft':
    case 'a':
      socket.emit('changeDirection', 'LEFT');
      break;
    case 'ArrowRight':
    case 'd':
      socket.emit('changeDirection', 'RIGHT');
      break;
  }
});

//  Ready Up Button
joinBtn.addEventListener('click', () => {
  socket.emit('joinGame');
  joinBtn.innerText = 'Waiting for players...';
  joinBtn.disabled = true;
});