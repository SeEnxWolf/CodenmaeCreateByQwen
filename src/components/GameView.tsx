import { useState, useEffect, useRef } from 'react';
import { GameStore } from '../store';
import { GameState, Player } from '../types';
import { motion } from 'framer-motion';
import { Copy, LogOut, Users, Crown, MessageSquare, Check, Bot, Key, History } from 'lucide-react';
import { generateAIHint } from '../ai';
import confetti from 'canvas-confetti';
import { playSelectSound, playConfirmSound, playHintSound, playWinSound, resumeAudioContext } from '../sounds';

interface Props {
  store: GameStore;
  gameState: GameState;
  currentPlayer: Player;
  onLeave: () => void;
}

export function GameView({ store, gameState, currentPlayer, onLeave }: Props) {
  const [showCopied, setShowCopied] = useState(false);
  const [hintWord, setHintWord] = useState('');
  const [hintCount, setHintCount] = useState(1);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(gameState.apiKey || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const prevHintCount = useRef(gameState.hints.length);

  // Resume audio context on first interaction
  useEffect(() => {
    const handler = () => resumeAudioContext();
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, []);

  // Show notification when new hint arrives
  useEffect(() => {
    if (gameState.hints.length > prevHintCount.current) {
      const latest = gameState.hints[gameState.hints.length - 1];
      setNotification(`Новая подсказка: «${latest.word}» — ${latest.count}`);
      playHintSound();
      setTimeout(() => setNotification(null), 3000);
    }
    prevHintCount.current = gameState.hints.length;
  }, [gameState.hints.length]);

  if (gameState.phase === 'gameover') {
    return <GameOverOverlay gameState={gameState} currentPlayer={currentPlayer} onLeave={onLeave} />;
  }

  if (gameState.phase === 'lobby') {
    return <LobbyView store={store} gameState={gameState} currentPlayer={currentPlayer} onLeave={onLeave} />;
  }

  const isMaster = currentPlayer.isMaster;
  const isEliminated = currentPlayer.isEliminated;

  const handleSelectWord = (wordId: string) => {
    if (isEliminated) return;
    playSelectSound();
    store.selectWord(currentPlayer.id, wordId);
  };

  const handleConfirm = () => {
    playConfirmSound();
    store.confirmSelection(currentPlayer.id);
  };

  const handleGiveHint = () => {
    if (hintWord.trim() && hintCount > 0) {
      store.giveHint({ word: hintWord.trim(), count: hintCount });
      setHintWord('');
      setHintCount(1);
    }
  };

  const handleAIHint = async () => {
    if (!apiKey) {
      setShowApiKey(true);
      return;
    }
    setAiLoading(true);
    try {
      const secretWords = gameState.cards.filter(c => c.type === 'secret').map(c => c.word);
      const allWords = gameState.cards.map(c => c.word);
      const blackWord = gameState.cards.find(c => c.type === 'black')?.word || '';
      const previousHints = gameState.hints.map(h => h.word);
      
      const hint = await generateAIHint(secretWords, allWords, blackWord, gameState.currentRound, previousHints, apiKey);
      setHintWord(hint.word);
      setHintCount(hint.count);
      
      // Save API key
      if (apiKey !== gameState.apiKey) {
        store.setApiKey(apiKey);
      }
    } catch (err) {
      console.error('AI hint error:', err);
      alert('Ошибка при получении подсказки от ИИ. Проверьте API ключ.');
    }
    setAiLoading(false);
  };

  const handleSaveApiKey = () => {
    store.setApiKey(apiKey);
    setShowApiKey(false);
  };

  const handleNextRound = () => {
    store.nextRound();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const latestHint = gameState.hints[gameState.hints.length - 1];

  const getCardStyle = (cardId: string, cardType: string, revealed: boolean) => {
    if (isMaster) {
      if (revealed) return 'bg-gray-600 border-gray-500 opacity-50';
      if (cardType === 'black') return 'bg-gradient-to-br from-gray-900 to-black border-red-800 ring-2 ring-red-500/50 shadow-lg shadow-red-500/20';
      if (cardType === 'secret') return 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400 shadow-lg shadow-blue-500/20';
      return 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600';
    }

    if (isEliminated) {
      if (revealed) return 'bg-gray-600 border-gray-500 opacity-50';
      return 'bg-gray-800/50 border-gray-700 cursor-not-allowed opacity-70';
    }

    if (revealed && currentPlayer.revealedWords.includes(cardId)) {
      return 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 scale-95 shadow-lg shadow-green-500/20';
    }
    if (revealed) {
      return 'bg-gray-600 border-gray-500 opacity-60';
    }

    if (currentPlayer.secretWords.includes(cardId)) {
      if (currentPlayer.selectedWords.includes(cardId)) {
        return 'bg-gradient-to-br from-yellow-400 to-amber-500 border-yellow-300 scale-105 ring-2 ring-yellow-300 shadow-lg shadow-yellow-500/30';
      }
      return 'bg-gradient-to-br from-blue-900/80 to-indigo-950/80 border-blue-500/50 ring-1 ring-blue-400/40 shadow-inner';
    }

    if (currentPlayer.selectedWords.includes(cardId)) {
      return 'bg-gradient-to-br from-yellow-400 to-amber-500 border-yellow-300 scale-105 ring-2 ring-yellow-300 shadow-lg shadow-yellow-500/30';
    }
    return 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 hover:border-purple-500 hover:from-gray-600 hover:to-gray-700 cursor-pointer hover:shadow-lg hover:shadow-purple-500/10';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-3 sm:p-4"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              🔐 Кодовое Имя
            </h1>
            <div className="flex items-center gap-1.5 bg-gray-800/60 px-2.5 py-1 rounded-full border border-gray-700">
              <span className="text-gray-400 text-xs">Код:</span>
              <span className="text-purple-400 font-mono font-bold text-sm">{gameState.roomId}</span>
              <button onClick={copyRoomId} className="text-gray-400 hover:text-white transition">
                {showCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-800/60 px-2.5 py-1 rounded-full border border-gray-700">
              <Users size={12} className="text-gray-400" />
              <span className="text-white text-xs font-medium">{gameState.players.length}</span>
            </div>
            <div className="bg-gray-800/60 px-2.5 py-1 rounded-full border border-gray-700">
              <span className="text-gray-400 text-xs">Раунд </span>
              <span className="text-purple-400 font-bold text-sm">{gameState.currentRound}</span>
            </div>
            <button onClick={onLeave} className="p-1.5 text-gray-400 hover:text-red-400 transition rounded-lg hover:bg-red-900/20">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Players bar */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {gameState.players.map((p) => (
            <div
              key={p.id}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                p.id === currentPlayer.id
                  ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                  : p.isEliminated
                  ? 'bg-red-900/30 border-red-700 text-red-300 line-through'
                  : p.finished
                  ? 'bg-green-900/30 border-green-600 text-green-300'
                  : 'bg-gray-800/50 border-gray-700 text-gray-300'
              }`}
            >
              {p.isMaster && '👑 '}
              {p.name}
              {p.finished && ' 🏆'}
              {p.isEliminated && ' 💀'}
              {!p.isMaster && !p.isEliminated && !p.finished && ` (${p.score}/${p.secretWords.length})`}
            </div>
          ))}
        </div>

        {/* Notification toast */}
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 z-50 bg-purple-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl shadow-lg border border-purple-400/30 text-sm font-medium"
          >
            🔔 {notification}
          </motion.div>
        )}

        {/* Current hint */}
        {latestHint && (
          <motion.div
            key={latestHint.timestamp}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mb-3 bg-gradient-to-r from-purple-800/40 to-pink-800/40 border border-purple-500/40 rounded-xl p-3 sm:p-4 text-center backdrop-blur-sm"
          >
            <div className="flex items-center justify-center gap-2 text-purple-200">
              <MessageSquare size={16} />
              <span className="text-base sm:text-lg font-bold">
                «<span className="text-white text-xl sm:text-2xl">{latestHint.word}</span>»
                {' — '}
                <span className="text-yellow-300 text-xl sm:text-2xl">{latestHint.count}</span>
              </span>
            </div>
          </motion.div>
        )}

        {/* Master panel */}
        {isMaster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 bg-gray-800/40 border border-gray-700 rounded-xl p-3 sm:p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Crown size={14} className="text-yellow-400" />
                Панель мастера
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1.5 text-gray-400 hover:text-white transition rounded-lg hover:bg-gray-700"
                  title="История подсказок"
                >
                  <History size={14} />
                </button>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1.5 text-gray-400 hover:text-white transition rounded-lg hover:bg-gray-700"
                  title="API ключ"
                >
                  <Key size={14} />
                </button>
              </div>
            </div>

            {/* API Key input */}
            {showApiKey && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700"
              >
                <label className="text-gray-300 text-xs block mb-1">DeepSeek API ключ:</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 transition"
                  >
                    Сохранить
                  </button>
                </div>
              </motion.div>
            )}

            {/* History */}
            {showHistory && gameState.hints.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700 max-h-32 overflow-y-auto"
              >
                <p className="text-gray-400 text-xs mb-2">История подсказок:</p>
                {gameState.hints.map((h, i) => (
                  <div key={i} className="text-sm text-gray-300 py-0.5">
                    <span className="text-gray-500">R{h.round}:</span>{' '}
                    <span className="text-white font-medium">{h.word}</span>
                    {' — '}
                    <span className="text-yellow-300">{h.count}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Hint input */}
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="text-gray-400 text-xs block mb-1">Слово</label>
                <input
                  type="text"
                  value={hintWord}
                  onChange={(e) => setHintWord(e.target.value)}
                  placeholder="Например: еда"
                  className="w-full px-3 py-2 bg-gray-700/70 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="w-16">
                <label className="text-gray-400 text-xs block mb-1">Кол-во</label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={hintCount}
                  onChange={(e) => setHintCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-gray-700/70 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleGiveHint}
                disabled={!hintWord.trim()}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Дать
              </button>
              <button
                onClick={handleAIHint}
                disabled={aiLoading}
                className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm rounded-lg hover:from-indigo-500 hover:to-purple-500 transition disabled:opacity-50 flex items-center gap-1"
              >
                <Bot size={14} />
                {aiLoading ? '...' : 'ИИ'}
              </button>
              <button
                onClick={handleNextRound}
                className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-500 transition"
              >
                Далее →
              </button>
            </div>
          </motion.div>
        )}

        {/* AI hint button for players (if master is AI) */}
        {!isMaster && gameState.masterMode === 'ai' && (
          <div className="mb-3 text-center text-gray-400 text-sm">
            <Bot size={14} className="inline mr-1" />
            Мастер — ИИ. Ожидайте подсказку.
          </div>
        )}

        {/* Eliminated notice */}
        {isEliminated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 bg-red-900/20 border border-red-700/50 rounded-xl p-3 text-center"
          >
            <p className="text-red-300 font-semibold text-sm">💀 Вы дисквалифицированы!</p>
            <p className="text-red-400/70 text-xs">Вы выбрали чёрное слово. Теперь вы наблюдатель.</p>
          </motion.div>
        )}

        {/* Game Board */}
        <div className="game-board grid grid-cols-5 gap-1.5 sm:gap-2 max-w-2xl mx-auto mb-4">
          {gameState.cards.map((card, idx) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.02 }}
              whileHover={!isEliminated && !card.revealed ? { scale: 1.05, y: -2 } : {}}
              whileTap={!isEliminated && !card.revealed ? { scale: 0.95 } : {}}
              onClick={() => handleSelectWord(card.id)}
              disabled={isEliminated || card.revealed}
              className={`aspect-square rounded-lg sm:rounded-xl border-2 flex items-center justify-center p-1 sm:p-2 transition-all duration-200 ${getCardStyle(
                card.id,
                card.type,
                card.revealed
              )}`}
            >
              <span className="text-white font-medium text-center text-[10px] sm:text-xs leading-tight drop-shadow-sm">
                {card.word}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Player progress */}
        {!isMaster && !isEliminated && (
          <div className="max-w-xs mx-auto mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Ваш прогресс</span>
              <span>{currentPlayer.score}/{currentPlayer.secretWords.length}</span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentPlayer.score / Math.max(currentPlayer.secretWords.length, 1)) * 100}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Confirm button */}
        {!isMaster && !isEliminated && currentPlayer.selectedWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button
              onClick={handleConfirm}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-emerald-500 transition transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
            >
              ✓ Подтвердить выбор ({currentPlayer.selectedWords.length})
            </button>
          </motion.div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs">
          {isMaster ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400"></div>
                <span className="text-gray-400">Загаданные</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-900 to-black border border-red-800"></div>
                <span className="text-gray-400">Чёрное</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600"></div>
                <span className="text-gray-400">Обычные</span>
              </div>
            </>
          ) : !isEliminated ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-900/80 to-indigo-950/80 border border-blue-500/50"></div>
                <span className="text-gray-400">Ваши слова</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-yellow-400 to-amber-500 border border-yellow-300"></div>
                <span className="text-gray-400">Выбранные</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-green-500 to-emerald-600 border border-green-400"></div>
                <span className="text-gray-400">Угаданные</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

// Lobby View
function LobbyView({ store, gameState, currentPlayer, onLeave }: { store: GameStore; gameState: GameState; currentPlayer: Player; onLeave: () => void }) {
  const [showCopied, setShowCopied] = useState(false);

  const copyRoomId = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleStart = () => {
    if (gameState.players.length >= 2) {
      store.startGame();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full space-y-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 space-y-5">
          <h2 className="text-2xl font-bold text-white text-center">🏠 Лобби</h2>
          
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">Код комнаты:</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-mono font-bold text-purple-400 tracking-wider">{gameState.roomId}</span>
              <button onClick={copyRoomId} className="p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-gray-700">
                {showCopied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Откройте новую вкладку → "Присоединиться" → введите код
            </p>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
              <Users size={14} />
              Игроки ({gameState.players.length})
            </h3>
            <div className="space-y-2">
              {gameState.players.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    p.id === currentPlayer.id ? 'bg-purple-600/20 border border-purple-500/50' : 'bg-gray-700/30 border border-transparent'
                  }`}
                >
                  {p.isMaster ? <span className="text-yellow-400">👑</span> : <span className="text-gray-500">🎮</span>}
                  <span className="text-white">{p.name}</span>
                  {p.id === currentPlayer.id && <span className="text-xs text-purple-300 ml-auto">(вы)</span>}
                </motion.div>
              ))}
            </div>
          </div>

          {currentPlayer.isMaster && (
            <>
              <button
                onClick={handleStart}
                disabled={gameState.players.length < 2}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95"
              >
                {gameState.players.length < 2 ? '⏳ Нужен ещё 1 игрок' : '🎮 Начать игру!'}
              </button>
              <p className="text-gray-500 text-xs text-center">
                Минимум 2 участника (мастер + игрок)
              </p>
            </>
          )}

          {!currentPlayer.isMaster && (
            <div className="text-center">
              <div className="animate-pulse text-gray-400 text-sm">⏳ Ожидание начала игры...</div>
            </div>
          )}

          <button
            onClick={onLeave}
            className="w-full py-2 text-gray-500 hover:text-red-400 transition text-sm"
          >
            ← Покинуть комнату
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Game Over Overlay
function GameOverOverlay({ gameState, currentPlayer, onLeave }: { gameState: GameState; currentPlayer: Player; onLeave: () => void }) {
  const winner = gameState.players.find((p) => p.id === gameState.winner);

  useEffect(() => {
    // Play win sound
    playWinSound();
    
    // Fire confetti
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#a855f7', '#ec4899', '#f59e0b', '#10b981'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#a855f7', '#ec4899', '#f59e0b', '#10b981'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 flex flex-col items-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="text-center mt-8 mb-6"
      >
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-2">
          Игра окончена!
        </h1>
        <p className="text-xl sm:text-2xl text-white">
          Победитель: <span className="text-yellow-400 font-bold">{winner?.name || 'Неизвестно'}</span>
        </p>
      </motion.div>

      {/* Full board reveal */}
      <div className="max-w-2xl w-full">
        <h2 className="text-lg text-white font-semibold text-center mb-3">📋 Все слова на поле:</h2>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {gameState.cards.map((card, idx) => {
            let bgColor = 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600';
            let label = '';
            if (card.type === 'secret') { bgColor = 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400'; label = '🔵'; }
            if (card.type === 'black') { bgColor = 'bg-gradient-to-br from-gray-900 to-black border-red-800 ring-2 ring-red-500'; label = '⚫'; }

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.5, rotateY: 180 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ delay: idx * 0.05, type: 'spring' }}
                className={`aspect-square rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center p-1 sm:p-2 ${bgColor}`}
              >
                <span className="text-white font-medium text-center text-[10px] sm:text-xs leading-tight">{card.word}</span>
                {label && <span className="text-[10px] mt-0.5">{label}</span>}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400"></div>
            <span className="text-gray-300">Загаданные</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-900 to-black border border-red-800"></div>
            <span className="text-gray-300">Чёрное</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600"></div>
            <span className="text-gray-300">Обычные</span>
          </div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="mt-6 max-w-md w-full">
        <h3 className="text-white font-semibold text-center mb-3">📊 Результаты:</h3>
        <div className="space-y-2">
          {gameState.players
            .sort((a, b) => {
              if (a.finished && !b.finished) return -1;
              if (!a.finished && b.finished) return 1;
              if (a.isEliminated) return 1;
              if (b.isEliminated) return -1;
              return b.score - a.score;
            })
            .map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${
                  p.id === gameState.winner
                    ? 'bg-yellow-600/20 border border-yellow-500'
                    : p.isEliminated
                    ? 'bg-red-900/20 border border-red-700'
                    : 'bg-gray-800/50 border border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-5">#{i + 1}</span>
                  {p.isMaster && <span className="text-yellow-400 text-xs">👑</span>}
                  <span className="text-white text-sm">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-300">{p.score}/{p.secretWords.length}</span>
                  {p.finished && <span className="text-green-400">🏆</span>}
                  {p.isEliminated && <span className="text-red-400">💀</span>}
                </div>
              </motion.div>
            ))}
        </div>
      </div>

      <button
        onClick={onLeave}
        className="mt-8 mb-8 px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition transform hover:scale-105 active:scale-95"
      >
        Выйти из игры
      </button>
    </motion.div>
  );
}
