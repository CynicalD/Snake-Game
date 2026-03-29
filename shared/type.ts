// shared/type.ts

//board size is 20x20 grid
export const BOARD_SIZE = 20;
// A simple coordinate on our grid
export interface Point {
  x: number;
  y: number;
}



// The directions a snake can travel + idle for when it restarts
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'IDLE';

// Everything we need to know about a single player
export interface Player {
  id: string;          // socket.io connection ID
  body: Point[];       // Array of points making up the snake (body[0] is the head)
  direction: Direction; 
  isAlive: boolean;
  score: number;
}

// The master state of the game that the server broadcasts
export interface GameState {
  players: Record<string, Player>; // A dictionary of players, keyed by their socket ID (a hash map to find player by id)
  apple: Point;                    // Where the food currently is
  status: 'WAITING' | 'PLAYING' | 'GAME_OVER';
}