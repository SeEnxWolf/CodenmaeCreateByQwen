export interface WordCard {
  id: string;
  word: string;
  type: 'normal' | 'secret' | 'black';
  revealed: boolean; // только для чёрного слова
  revealedBy?: string; // player id who revealed it (только для чёрного)
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isMaster: boolean;
  isEliminated: boolean;
  secretWords: string[]; // word ids assigned to this player
  revealedWords: string[]; // words this player has revealed
  selectedWords: string[]; // currently selected words (before confirm)
  score: number;
  finished: boolean;
  finishTime?: number;
  maxSelections: number; // max words player can select this round (from hints)
  hasConfirmed: boolean; // has player confirmed their selection this round
}

export interface Hint {
  word: string;
  count: number;
  round: number;
  timestamp: number;
  fromMaster: boolean;
}

export interface GameState {
  roomId: string;
  cards: WordCard[];
  players: Player[];
  currentRound: number;
  hints: Hint[];
  gameStarted: boolean;
  gameOver: boolean;
  winner?: string;
  masterMode: 'human' | 'ai';
  apiKey?: string;
  phase: 'lobby' | 'playing' | 'revealing' | 'gameover';
  roundPhase: 'thinking' | 'guessing'; // thinking = мастер думает, guessing = игроки угадывают
  phaseEndTime: number; // timestamp когда фаза закончится
  timerEnabled: boolean;
  masterScore: number; // очки мастера
}

export type SyncMessage =
  | { type: 'state_update'; state: GameState }
  | { type: 'player_join'; player: Player }
  | { type: 'player_leave'; playerId: string }
  | { type: 'selection_update'; playerId: string; selectedWords: string[] }
  | { type: 'confirm_selection'; playerId: string }
  | { type: 'hint_given'; hint: Hint }
  | { type: 'game_start' }
  | { type: 'game_over'; winnerId: string }
  | { type: 'player_eliminated'; playerId: string }
  | { type: 'next_round' };
