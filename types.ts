export enum GameState {
  IDLE = 'IDLE',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  RESULT = 'RESULT',
  GAME_OVER = 'GAME_OVER'
}

export enum Gesture {
  NONE = 'NONE',
  ROCK = 'ROCK',
  PAPER = 'PAPER',
  SCISSORS = 'SCISSORS'
}

export interface Score {
  player: number;
  bot: number;
}

export interface GameResult {
  winner: 'player' | 'bot' | 'draw' | 'invalid' | null;
  message: string;
}
