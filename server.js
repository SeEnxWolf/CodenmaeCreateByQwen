import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Словарь слов
const WORD_DICTIONARY = [
  "океан", "гора", "река", "лес", "пустыня", "вулкан", "остров", "водопад",
  "ледник", "долина", "болото", "каньон", "пещера", "озеро", "берег",
  "тигр", "слон", "жираф", "пингвин", "дельфин", "орёл", "акула", "лев",
  "медведь", "волк", "лиса", "крокодил", "черепаха", "попугай", "бабочка",
  "яблоко", "хлеб", "сыр", "мёд", "шоколад", "вино", "кофе", "пицца",
  "суши", "торт", "арбуз", "банан", "гриль", "салат", "суп",
  "робот", "спутник", "лазер", "компьютер", "интернет", "дрон", "ракета",
  "батарейка", "антенна", "экран", "процессор", "камера", "микроскоп",
  "доктор", "пилот", "шеф", "шпион", "архитектор", "музыкант", "художник",
  "учитель", "пожарный", "детектив", "астронавт", "фермер", "стюардесса",
  "футбол", "шахматы", "теннис", "бокс", "плавание", "велосипед", "лыжи",
  "серфинг", "карате", "стрельба", "фехтование", "гимнастика",
  "гитара", "барабан", "скрипка", "пианино", "труба", "флейта", "опера",
  "рок", "джаз", "симфония", "концерт", "мелодия",
  "поезд", "самолёт", "корабль", "автобус", "такси", "метро", "вокзал",
  "аэропорт", "чемодан", "паспорт", "карта", "компас", "маяк",
  "планета", "звезда", "луна", "комета", "галактика", "астероид", "орбита",
  "телескоп", "космос", "нептун", "марс", "юпитер",
  "зеркало", "книга", "ключ", "часы", "зонт", "свеча", "верёвка",
  "ножницы", "подушка", "лампа", "корона", "меч", "щит", "якорь",
  "время", "мечта", "тайна", "свобода", "память", "удача", "опасность",
  "победа", "секрет", "судьба", "любовь", "страх", "надежда",
  "замок", "больница", "школа", "библиотека", "театр", "музей", "парк",
  "рынок", "церковь", "стадион", "башня", "мост", "тоннель",
  "радуга", "молния", "туман", "ураган", "землетрясение", "рассвет",
  "закат", "затмение", "торнадо", "снег", "дождь", "ветер",
  "пират", "рыцарь", "принцесса", "колдун", "ниндзя", "ковбой", "самурай",
  "маг", "призрак", "дракон", "единорог", "фея",
  "алмаз", "золото", "серебро", "кристалл", "жемчуг", "рубин",
  "фонтан", "клумба", "роза", "кактус", "бамбук", "пальма",
  "костёр", "палатка", "рюкзак", "фонарь", "бинокль",
  "маска", "костюм", "перчатка", "шляпа", "очки", "галстук"
];

function generateGameCards() {
  const shuffled = [...WORD_DICTIONARY].sort(() => Math.random() - 0.5);
  const words = shuffled.slice(0, 25);
  const cards = [];
  
  const blackIndex = Math.floor(Math.random() * 25);
  
  const secretIndices = [];
  while (secretIndices.length < 9) {
    const idx = Math.floor(Math.random() * 25);
    if (idx !== blackIndex && !secretIndices.includes(idx)) {
      secretIndices.push(idx);
    }
  }
  
  for (let i = 0; i < 25; i++) {
    if (i === blackIndex) {
      cards.push({ id: uuidv4(), word: words[i], type: 'black', revealed: false });
    } else if (secretIndices.includes(i)) {
      cards.push({ id: uuidv4(), word: words[i], type: 'secret', revealed: false });
    } else {
      cards.push({ id: uuidv4(), word: words[i], type: 'normal', revealed: false });
    }
  }
  
  return cards;
}

function redistributeWords(players, cards) {
  const nonMasterPlayers = players.filter(p => !p.isMaster);
  const secretCards = cards.filter(c => c.type === 'secret');
  
  if (nonMasterPlayers.length === 0 || secretCards.length === 0) return;

  const shuffledSecrets = [...secretCards].sort(() => Math.random() - 0.5);
  const wordsPerPlayer = Math.floor(shuffledSecrets.length / nonMasterPlayers.length);
  const remainder = shuffledSecrets.length % nonMasterPlayers.length;
  
  let idx = 0;
  nonMasterPlayers.forEach((player, playerIdx) => {
    const count = wordsPerPlayer + (playerIdx < remainder ? 1 : 0);
    player.secretWords = shuffledSecrets.slice(idx, idx + count).map(c => c.id);
    idx += count;
  });
}

// Хранилище комнат
const rooms = new Map();

// MIME типы для раздачи статики
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// Создание HTTP сервера (раздаёт статику из dist/ и WebSocket)
const server = createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Убираем query string
  filePath = filePath.split('?')[0];
  filePath = join(__dirname, 'dist', filePath);
  
  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } else {
      // SPA fallback
      const indexPath = join(__dirname, 'dist', 'index.html');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not found. Run "npm run build" first.');
      }
    }
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Server error');
  }
});

// Создание WebSocket сервера
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📡 Новое подключение');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (err) {
      console.error('Ошибка обработки сообщения:', err);
    }
  });
  
  ws.on('close', () => {
    console.log('❌ Отключение');
    handleDisconnect(ws);
  });
});

function broadcast(roomId, message, excludeWs) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  const msgStr = JSON.stringify(message);
  room.players.forEach(player => {
    if (player.ws && player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(msgStr);
    }
  });
}

function handleMessage(ws, message) {
  switch (message.type) {
    case 'create_room': {
      const roomId = uuidv4().slice(0, 8);
      const cards = generateGameCards();
      
      const player = {
        id: uuidv4(),
        name: message.playerName,
        isHost: true,
        isMaster: true,
        isEliminated: false,
        secretWords: [],
        revealedWords: [],
        selectedWords: [],
        score: 0,
        finished: false,
        maxSelections: 0,
        ws
      };
      
      const state = {
        roomId,
        cards,
        players: [player],
        currentRound: 1,
        hints: [],
        gameStarted: false,
        gameOver: false,
        phase: 'lobby'
      };
      
      rooms.set(roomId, state);
      
      ws.send(JSON.stringify({
        type: 'room_created',
        roomId,
        playerId: player.id,
        state: sanitizeState(state, player.id)
      }));
      
      console.log(`✅ Комната ${roomId} создана игроком ${message.playerName}`);
      break;
    }
    
    case 'join_room': {
      const room = rooms.get(message.roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
        return;
      }
      
      const player = {
        id: uuidv4(),
        name: message.playerName,
        isHost: false,
        isMaster: false,
        isEliminated: false,
        secretWords: [],
        revealedWords: [],
        selectedWords: [],
        score: 0,
        finished: false,
        maxSelections: 0,
        ws
      };
      
      room.players.push(player);
      redistributeWords(room.players, room.cards);
      
      ws.send(JSON.stringify({
        type: 'room_joined',
        roomId: room.roomId,
        playerId: player.id,
        state: sanitizeState(room, player.id)
      }));
      
      broadcast(room.roomId, {
        type: 'state_update',
        state: room
      });
      
      console.log(`✅ ${message.playerName} присоединился к комнате ${room.roomId}`);
      break;
    }
    
    case 'start_game': {
      const room = rooms.get(message.roomId);
      if (!room) return;
      
      room.gameStarted = true;
      room.phase = 'playing';
      
      broadcast(room.roomId, {
        type: 'state_update',
        state: room
      });
      
      console.log(`🎮 Игра началась в комнате ${room.roomId}`);
      break;
    }
    
    case 'select_word': {
      const room = rooms.get(message.roomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === message.playerId);
      if (!player || player.isEliminated) return;
      
      if (player.selectedWords.includes(message.wordId)) {
        // Снимаем выделение
        player.selectedWords = player.selectedWords.filter(id => id !== message.wordId);
      } else {
        // Проверяем лимит
        if (player.selectedWords.length >= player.maxSelections) {
          // Лимит достигнут — не добавляем
          return;
        }
        player.selectedWords.push(message.wordId);
      }
      
      broadcast(room.roomId, {
        type: 'state_update',
        state: room
      });
      break;
    }
    
    case 'confirm_selection': {
      const room = rooms.get(message.roomId);
      if (!room) return;
      
      const player = room.players.find(p => p.id === message.playerId);
      if (!player || player.isEliminated) return;
      
      let correctCount = 0;
      
      for (const wordId of player.selectedWords) {
        const card = room.cards.find(c => c.id === wordId);
        if (!card) continue;
        
        if (card.type === 'black') {
          player.isEliminated = true;
          card.revealed = true;
          card.revealedBy = player.id;
          break;
        }
        
        if (player.secretWords.includes(wordId)) {
          if (!card.revealed) {
            card.revealed = true;
            card.revealedBy = player.id;
            player.revealedWords.push(wordId);
            player.score++;
            correctCount++;
          }
        }
      }
      
      // Уменьшаем maxSelections на количество правильных слов
      // (неправильные не тратят лимит — они просто не засчитываются)
      player.maxSelections = Math.max(0, player.maxSelections - correctCount);
      
      player.selectedWords = [];
      
      const allSecretRevealed = player.secretWords.length > 0 && 
        player.secretWords.every(id => {
          const card = room.cards.find(c => c.id === id);
          return card?.revealed;
        });
      
      if (allSecretRevealed && !player.isEliminated) {
        player.finished = true;
        player.finishTime = Date.now();
        
        const firstFinisher = room.players
          .filter(p => p.finished)
          .sort((a, b) => (a.finishTime || 0) - (b.finishTime || 0))[0];
        
        if (firstFinisher.id === player.id) {
          room.gameOver = true;
          room.winner = player.id;
          room.phase = 'gameover';
        }
      }
      
      broadcast(room.roomId, {
        type: 'state_update',
        state: room
      });
      
      console.log(`✅ ${player.name} подтвердил выбор в комнате ${room.roomId}`);
      break;
    }
    
    case 'give_hint': {
      const room = rooms.get(message.roomId);
      if (!room) return;
      
      room.hints.push({
        word: message.hint.word,
        count: message.hint.count,
        round: room.currentRound,
        timestamp: Date.now(),
        fromMaster: true
      });
      
      // Добавляем N к maxSelections каждого активного игрока
      room.players.forEach(p => {
        if (!p.isMaster && !p.isEliminated && !p.finished) {
          p.maxSelections += message.hint.count;
        }
      });
      
      broadcast(room.roomId, {
        type: 'state_update',
        state: room
      });
      
      console.log(`💡 Подсказка "${message.hint.word}" ${message.hint.count} в комнате ${room.roomId}`);
      break;
    }
    
    case 'next_round': {
      const room = rooms.get(message.roomId);
      if (!room) return;
      
      room.currentRound++;
      room.players.forEach(p => {
        p.selectedWords = [];
      });
      
      broadcast(room.roomId, {
        type: 'state_update',
        state: room
      });
      
      console.log(`🔄 Раунд ${room.currentRound} в комнате ${room.roomId}`);
      break;
    }
  }
}

function handleDisconnect(ws) {
  for (const [roomId, room] of rooms) {
    const playerIndex = room.players.findIndex(p => p.ws === ws);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      console.log(`❌ ${player.name} отключился от комнаты ${roomId}`);
      
      room.players.splice(playerIndex, 1);
      
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`🗑️ Комната ${roomId} удалена (нет игроков)`);
      } else {
        redistributeWords(room.players, room.cards);
        broadcast(roomId, {
          type: 'state_update',
          state: room
        });
      }
      break;
    }
  }
}

function sanitizeState(state, playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Мастер видит всё
  if (player.isMaster) {
    return {
      ...state,
      players: state.players.map(p => ({ ...p, ws: undefined }))
    };
  }
  
  // Для обычных игроков: скрываем secretWords (и свои, и чужие)
  const sanitized = {
    ...state,
    players: state.players.map(p => ({
      ...p,
      ws: undefined,
      secretWords: [] // Скрываем от всех игроков
    }))
  };
  
  return sanitized;
}

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🔐 КОДОВОЕ ИМЯ - СЕРВЕР                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

🎮 Сервер запущен!

📡 Адреса:
   🌐 Локально:   http://localhost:${PORT}
   🔌 WebSocket:  ws://localhost:${PORT}

📋 Инструкция для игроков:
   1. Откройте http://ВАШ_IP:${PORT} в браузере
   2. Один игрок создаёт комнату (мастер)
   3. Другие подключаются по коду комнаты

🌐 Для доступа из локальной сети:
   Узнайте IP вашего компьютера:
   • Windows: ipconfig → IPv4 Address
   • Mac/Linux: ifconfig или ip addr
   • Например: http://192.168.1.100:${PORT}

⏹️  Для остановки: Ctrl+C
`);
});
