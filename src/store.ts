import { GameState, Player, SyncMessage, WordCard } from './types';
import { generateGameCards } from './words';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_PREFIX = 'codename_game_';
const CHANNEL_PREFIX = 'codename_channel_';

export class GameStore {
  private roomId: string;
  private channel: BroadcastChannel;
  private listeners: ((state: GameState) => void)[] = [];
  private state: GameState;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.channel = new BroadcastChannel(CHANNEL_PREFIX + roomId);
    
    const saved = localStorage.getItem(STORAGE_PREFIX + roomId);
    if (saved) {
      this.state = JSON.parse(saved);
    } else {
      this.state = this.createInitialState();
    }
    
    this.channel.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_PREFIX + roomId && e.newValue) {
        this.state = JSON.parse(e.newValue);
        this.notifyListeners();
      }
    });
  }

  private createInitialState(): GameState {
    const rawCards = generateGameCards();
    const cards: WordCard[] = rawCards.map((c) => ({
      id: uuidv4(),
      word: c.word,
      type: c.type,
      revealed: false,
    }));

    return {
      roomId: this.roomId,
      cards,
      players: [],
      currentRound: 1,
      hints: [],
      gameStarted: false,
      gameOver: false,
      masterMode: 'human',
      phase: 'lobby',
    };
  }

  private saveState() {
    localStorage.setItem(STORAGE_PREFIX + this.roomId, JSON.stringify(this.state));
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  private broadcast(msg: SyncMessage) {
    this.channel.postMessage(msg);
  }

  private handleMessage(msg: SyncMessage) {
    switch (msg.type) {
      case 'state_update':
        this.state = msg.state;
        this.notifyListeners();
        break;
      default:
        const saved = localStorage.getItem(STORAGE_PREFIX + this.roomId);
        if (saved) {
          this.state = JSON.parse(saved);
          this.notifyListeners();
        }
    }
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: (state: GameState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Redistribute secret words among all non-master players
  private redistributeWords() {
    const nonMasterPlayers = this.state.players.filter((p) => !p.isMaster);
    const secretCards = this.state.cards.filter((c) => c.type === 'secret');
    
    if (nonMasterPlayers.length === 0 || secretCards.length === 0) return;

    // Shuffle secret cards
    const shuffledSecrets = [...secretCards].sort(() => Math.random() - 0.5);
    
    // Distribute evenly
    const wordsPerPlayer = Math.floor(shuffledSecrets.length / nonMasterPlayers.length);
    const remainder = shuffledSecrets.length % nonMasterPlayers.length;
    
    let idx = 0;
    nonMasterPlayers.forEach((player, playerIdx) => {
      const count = wordsPerPlayer + (playerIdx < remainder ? 1 : 0);
      player.secretWords = shuffledSecrets.slice(idx, idx + count).map((c) => c.id);
      idx += count;
    });
  }

  addPlayer(name: string, isHost: boolean, isMaster: boolean): Player {
    const player: Player = {
      id: uuidv4(),
      name,
      isHost,
      isMaster,
      isEliminated: false,
      secretWords: [],
      revealedWords: [],
      selectedWords: [],
      score: 0,
      finished: false,
    };

    this.state.players.push(player);
    
    // Redistribute words among all non-master players
    if (!isMaster) {
      this.redistributeWords();
    }
    
    this.saveState();
    this.broadcast({ type: 'state_update', state: this.state });
    this.notifyListeners();
    return player;
  }

  removePlayer(playerId: string) {
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    
    // Redistribute words if needed
    const nonMasterPlayers = this.state.players.filter((p) => !p.isMaster);
    if (nonMasterPlayers.length > 0) {
      this.redistributeWords();
    }
    
    this.saveState();
    this.broadcast({ type: 'state_update', state: this.state });
    this.notifyListeners();
  }

  startGame() {
    this.state.gameStarted = true;
    this.state.phase = 'playing';
    this.saveState();
    this.broadcast({ type: 'state_update', state: this.state });
    this.notifyListeners();
  }

  setMasterMode(mode: 'human' | 'ai') {
    this.state.masterMode = mode;
    this.saveState();
    this.notifyListeners();
  }

  setApiKey(key: string) {
    this.state.apiKey = key;
    this.saveState();
    this.notifyListeners();
  }

  selectWord(playerId: string, wordId: string) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.isEliminated) return;

    if (player.selectedWords.includes(wordId)) {
      player.selectedWords = player.selectedWords.filter((id) => id !== wordId);
    } else {
      player.selectedWords.push(wordId);
    }

    this.saveState();
    this.notifyListeners();
  }

  confirmSelection(playerId: string) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.isEliminated) return;

    let eliminated = false;

    for (const wordId of player.selectedWords) {
      const card = this.state.cards.find((c) => c.id === wordId);
      if (!card) continue;

      if (card.type === 'black') {
        player.isEliminated = true;
        eliminated = true;
        card.revealed = true;
        card.revealedBy = playerId;
        break;
      }

      if (player.secretWords.includes(wordId)) {
        if (!card.revealed) {
          card.revealed = true;
          card.revealedBy = playerId;
          player.revealedWords.push(wordId);
          player.score++;
        }
      }
      // Wrong guesses: not revealed on board, not counted
    }

    player.selectedWords = [];

    // Check if player won (all their secret words revealed)
    const allSecretRevealed = player.secretWords.length > 0 && player.secretWords.every((id) => {
      const card = this.state.cards.find((c) => c.id === id);
      return card?.revealed;
    });

    if (allSecretRevealed && !player.isEliminated) {
      player.finished = true;
      player.finishTime = Date.now();

      // First to finish wins
      const firstFinisher = this.state.players
        .filter((p) => p.finished)
        .sort((a, b) => (a.finishTime || 0) - (b.finishTime || 0))[0];

      if (firstFinisher.id === playerId) {
        this.state.gameOver = true;
        this.state.winner = playerId;
        this.state.phase = 'gameover';
      }
    }

    this.saveState();
    this.broadcast({ type: 'state_update', state: this.state });
    this.notifyListeners();
  }

  giveHint(hint: { word: string; count: number }) {
    this.state.hints.push({
      ...hint,
      round: this.state.currentRound,
      timestamp: Date.now(),
      fromMaster: true,
    });
    this.saveState();
    this.broadcast({ type: 'state_update', state: this.state });
    this.notifyListeners();
  }

  nextRound() {
    this.state.currentRound++;
    this.state.players.forEach((p) => {
      p.selectedWords = [];
    });
    this.saveState();
    this.broadcast({ type: 'state_update', state: this.state });
    this.notifyListeners();
  }

  destroy() {
    this.channel.close();
  }

  static createRoom(): string {
    return uuidv4().slice(0, 8);
  }

  static roomExists(roomId: string): boolean {
    return localStorage.getItem(STORAGE_PREFIX + roomId) !== null;
  }
}
