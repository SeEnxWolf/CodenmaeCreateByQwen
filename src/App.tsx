import { useState, useEffect, useCallback } from 'react';
import { GameStore } from './store';
import { GameState, Player } from './types';
import { GameView } from './components/GameView';
import { motion, AnimatePresence } from 'framer-motion';

type Screen = 'home' | 'create' | 'join' | 'game';

interface PlayerSession {
  roomId: string;
  playerId: string;
  playerName: string;
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [store, setStore] = useState<GameStore | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('codename_session');
    if (session) {
      try {
        const parsed: PlayerSession = JSON.parse(session);
        const gameStore = new GameStore(parsed.roomId);
        setStore(gameStore);
        const state = gameStore.getState();
        setGameState(state);
        const player = state.players.find((p) => p.id === parsed.playerId);
        if (player) {
          setCurrentPlayer(player);
          setScreen('game');
        }
      } catch {
        localStorage.removeItem('codename_session');
      }
    }
  }, []);

  useEffect(() => {
    if (!store) return;
    const unsub = store.subscribe((state) => {
      setGameState({ ...state });
      if (currentPlayer) {
        const updated = state.players.find((p) => p.id === currentPlayer.id);
        if (updated) setCurrentPlayer({ ...updated });
      }
    });
    return unsub;
  }, [store, currentPlayer?.id]);

  const handleCreateRoom = useCallback(() => {
    if (!playerName.trim()) {
      setError('Введите имя');
      return;
    }
    const roomId = GameStore.createRoom();
    const gameStore = new GameStore(roomId);
    const player = gameStore.addPlayer(playerName.trim(), true, true);
    
    localStorage.setItem('codename_session', JSON.stringify({
      roomId,
      playerId: player.id,
      playerName: player.name,
    }));

    setStore(gameStore);
    setGameState(gameStore.getState());
    setCurrentPlayer(player);
    setScreen('game');
    setError('');
  }, [playerName]);

  const handleJoinRoom = useCallback(() => {
    if (!playerName.trim()) {
      setError('Введите имя');
      return;
    }
    if (!roomIdInput.trim()) {
      setError('Введите код комнаты');
      return;
    }
    if (!GameStore.roomExists(roomIdInput.trim())) {
      setError('Комната не найдена. Проверьте код.');
      return;
    }

    const gameStore = new GameStore(roomIdInput.trim());
    const player = gameStore.addPlayer(playerName.trim(), false, false);
    
    localStorage.setItem('codename_session', JSON.stringify({
      roomId: roomIdInput.trim(),
      playerId: player.id,
      playerName: player.name,
    }));

    setStore(gameStore);
    setGameState(gameStore.getState());
    setCurrentPlayer(player);
    setScreen('game');
    setError('');
  }, [playerName, roomIdInput]);

  const handleLeaveGame = useCallback(() => {
    if (store && currentPlayer) {
      store.removePlayer(currentPlayer.id);
      store.destroy();
    }
    localStorage.removeItem('codename_session');
    setStore(null);
    setGameState(null);
    setCurrentPlayer(null);
    setScreen('home');
    setPlayerName('');
  }, [store, currentPlayer]);

  return (
    <AnimatePresence mode="wait">
      {screen === 'home' && (
        <HomeScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          error={error}
          setError={setError}
          onCreateRoom={() => { setError(''); setScreen('create'); }}
          onJoinRoom={() => { setError(''); setScreen('join'); }}
        />
      )}
      {screen === 'create' && (
        <CreateScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          error={error}
          setError={setError}
          onBack={() => setScreen('home')}
          onCreate={handleCreateRoom}
        />
      )}
      {screen === 'join' && (
        <JoinScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          roomId={roomIdInput}
          setRoomId={setRoomIdInput}
          error={error}
          setError={setError}
          onBack={() => setScreen('home')}
          onJoin={handleJoinRoom}
        />
      )}
      {screen === 'game' && gameState && currentPlayer && store && (
        <GameView
          store={store}
          gameState={gameState}
          currentPlayer={currentPlayer}
          onLeave={handleLeaveGame}
        />
      )}
    </AnimatePresence>
  );
}

// Home Screen
function HomeScreen({ playerName, setPlayerName, error, setError, onCreateRoom, onJoinRoom }: {
  playerName: string;
  setPlayerName: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}) {
  const [showRules, setShowRules] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/80 to-gray-900 flex items-center justify-center p-4"
    >
      <div className="max-w-lg w-full space-y-6">
        {/* Title */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-3">🔐</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 mb-2">
            Кодовое Имя
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">
            Расшифруй подсказку мастера. Найди свои слова первым.
          </p>
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 space-y-4 shadow-xl"
        >
          <input
            type="text"
            placeholder="Ваше имя..."
            value={playerName}
            onChange={(e) => { setPlayerName(e.target.value); setError(''); }}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg"
            >
              {error}
            </motion.p>
          )}

          <div className="space-y-3">
            <button
              onClick={onCreateRoom}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
            >
              🎮 Создать комнату (Мастер)
            </button>
            <button
              onClick={onJoinRoom}
              className="w-full py-3.5 bg-gray-700/50 text-white font-semibold rounded-xl hover:bg-gray-600/50 transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-gray-600/50"
            >
              🚪 Присоединиться (Игрок)
            </button>
          </div>
        </motion.div>

        {/* Rules toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full text-center text-gray-500 hover:text-gray-300 transition text-sm py-2"
          >
            {showRules ? '▲ Скрыть правила' : '▼ Как играть?'}
          </button>
          
          <AnimatePresence>
            {showRules && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30 text-sm text-gray-300 space-y-2 mt-2">
                  <div className="flex gap-2">
                    <span className="text-purple-400 font-bold">1.</span>
                    <span>Мастер даёт подсказку: одно слово + количество (напр. «еда 3»)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-purple-400 font-bold">2.</span>
                    <span>Каждый игрок видит только свои загаданные слова (подсвечены)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-purple-400 font-bold">3.</span>
                    <span>Игроки выбирают слова по подсказке и нажимают «Подтвердить»</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-purple-400 font-bold">4.</span>
                    <span>Правильные слова становятся зелёными, неправильные — невидимы</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-purple-400 font-bold">5.</span>
                    <span>⚫ Чёрное слово — мгновенная дисквалификация!</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-purple-400 font-bold">6.</span>
                    <span>🏆 Побеждает тот, кто первым откроет все свои слова</span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-700/30 text-gray-400 text-xs">
                    💡 Для мультиплеера: откройте несколько вкладок или поделитесь кодом комнаты
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Create Screen
function CreateScreen({ playerName, setPlayerName, error, setError, onBack, onCreate }: {
  playerName: string;
  setPlayerName: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/80 to-gray-900 flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full space-y-6">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition flex items-center gap-2 text-sm"
        >
          ← Назад
        </button>
        
        <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 space-y-4 shadow-xl">
          <div className="text-center">
            <div className="text-4xl mb-2">👑</div>
            <h2 className="text-2xl font-bold text-white">Создать комнату</h2>
            <p className="text-gray-400 text-sm mt-1">Вы будете мастером игры</p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-gray-300 text-sm mb-1.5 block">Ваше имя:</label>
              <input
                type="text"
                placeholder="Имя мастера"
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); setError(''); }}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={onCreate}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
            >
              🎲 Создать комнату
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Join Screen
function JoinScreen({ playerName, setPlayerName, roomId, setRoomId, error, setError, onBack, onJoin }: {
  playerName: string;
  setPlayerName: (v: string) => void;
  roomId: string;
  setRoomId: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  onBack: () => void;
  onJoin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/80 to-gray-900 flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full space-y-6">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition flex items-center gap-2 text-sm"
        >
          ← Назад
        </button>
        
        <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 space-y-4 shadow-xl">
          <div className="text-center">
            <div className="text-4xl mb-2">🚪</div>
            <h2 className="text-2xl font-bold text-white">Присоединиться</h2>
            <p className="text-gray-400 text-sm mt-1">Введите код комнаты от мастера</p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-gray-300 text-sm mb-1.5 block">Ваше имя:</label>
              <input
                type="text"
                placeholder="Ваше имя"
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); setError(''); }}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1.5 block">Код комнаты:</label>
              <input
                type="text"
                placeholder="Введите код (напр. a1b2c3d4)"
                value={roomId}
                onChange={(e) => { setRoomId(e.target.value); setError(''); }}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition font-mono"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={onJoin}
              className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/20"
            >
              🚪 Войти в комнату
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default App;
