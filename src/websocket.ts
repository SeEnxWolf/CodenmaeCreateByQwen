import { GameState, Player } from './types';

type MessageHandler = (message: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private roomId: string | null = null;
  private playerId: string | null = null;

  constructor() {
    // Определяем URL WebSocket сервера
    // В продакшене можно изменить на реальный адрес сервера
    this.connect();
  }

  private connect() {
    // WebSocket сервер на том же хосте, что и страница
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket подключен');
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('Ошибка парсинга сообщения:', err);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket отключен');
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
      };
    } catch (err) {
      console.error('Ошибка подключения:', err);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      setTimeout(() => this.connect(), 2000);
    }
  }

  private handleMessage(message: any) {
    // Сохраняем roomId и playerId при получении
    if (message.type === 'room_created' || message.type === 'room_joined') {
      this.roomId = message.roomId;
      this.playerId = message.playerId;
    }
    
    // Уведомляем всех подписчиков
    this.handlers.forEach(handler => handler(message));
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket не подключен');
    }
  }

  createRoom(playerName: string) {
    this.send({
      type: 'create_room',
      playerName
    });
  }

  joinRoom(roomId: string, playerName: string) {
    this.send({
      type: 'join_room',
      roomId,
      playerName
    });
  }

  startGame() {
    if (!this.roomId) return;
    this.send({
      type: 'start_game',
      roomId: this.roomId
    });
  }

  selectWord(playerId: string, wordId: string) {
    if (!this.roomId) return;
    this.send({
      type: 'select_word',
      roomId: this.roomId,
      playerId,
      wordId
    });
  }

  confirmSelection(playerId: string) {
    if (!this.roomId) return;
    this.send({
      type: 'confirm_selection',
      roomId: this.roomId,
      playerId
    });
  }

  giveHint(hint: { word: string; count: number }) {
    if (!this.roomId) return;
    this.send({
      type: 'give_hint',
      roomId: this.roomId,
      hint
    });
  }

  nextRound() {
    if (!this.roomId) return;
    this.send({
      type: 'next_round',
      roomId: this.roomId
    });
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
let clientInstance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!clientInstance) {
    clientInstance = new WebSocketClient();
  }
  return clientInstance;
}
