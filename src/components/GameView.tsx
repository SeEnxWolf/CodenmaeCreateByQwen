import { useState, useEffect, useRef } from 'react';
import { GameState, Player } from '../types';
import { WebSocketClient } from '../websocket';
import { motion } from 'framer-motion';
import { Copy, LogOut, Users, Crown, MessageSquare, Check, History } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSelectSound, playConfirmSound, playHintSound, playWinSound, resumeAudioContext } from '../sounds';

interface Props {
  wsClient: WebSocketClient;
  gameState: GameState;
  currentPlayer: Player;
  onLeave: () => void;
}

export function GameView({ wsClient, gameState, currentPlayer, onLeave }: Props) {
  const [showCopied, setShowCopied] = useState(false);
  const [hintWord, setHintWord] = useState('');
  const [hintCount, setHintCount] = useState(1);
  const [notification, setNotification] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const prevHintCount = useRef(gameState.hints.length);
  const isThinking = gameState.roundPhase === 'thinking';

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

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameState.phaseEndTime > 0) {
        const remaining = Math.max(0, gameState.phaseEndTime - Date.now());
        setTimeLeft(Math.ceil(remaining / 1000));
      } else {
        setTimeLeft(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameState.phaseEndTime]);

  if (gameState.phase === 'gameover') {
    return <GameOverOverlay gameState={gameState} currentPlayer={currentPlayer} onLeave={onLeave} />;
  }

  if (gameState.phase === 'lobby') {
    return <LobbyView wsClient={wsClient} gameState={gameState} currentPlayer={currentPlayer} onLeave={onLeave} />;
  }

  const isMaster = currentPlayer.isMaster;
  const isEliminated = currentPlayer.isEliminated;

  const handleSelectWord = (wordId: string) => {
    if (isEliminated) return;
    
    // Блокируем выбор во время фазы thinking
    if (isThinking) return;
    
    // Блокируем после подтверждения
    if (currentPlayer.hasConfirmed) return;
    
    // Проверяем лимит выбора
    const isDeselecting = currentPlayer.selectedWords.includes(wordId);
    if (!isDeselecting && currentPlayer.selectedWords.length >= currentPlayer.maxSelections) {
      // Лимит достигнут — нельзя выбрать больше
      return;
    }
    
    playSelectSound();
    wsClient.selectWord(currentPlayer.id, wordId);
  };

  const handleConfirm = () => {
    playConfirmSound();
    wsClient.confirmSelection(currentPlayer.id);
  };

  const handleGiveHint = () => {
    if (hintWord.trim() && hintCount > 0) {
      wsClient.giveHint({ word: hintWord.trim(), count: hintCount });
      setHintWord('');
      setHintCount(1);
    }
  };

  const handleNextRound = () => {
    wsClient.nextRound();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const latestHint = gameState.hints[gameState.hints.length - 1];

  const getCardStyle = (cardId: string, cardType: string, revealed: boolean) => {
    if (isMaster) {
      // Мастер видит всё
      if (revealed) {
        // Определяем тип открытого слова
        if (cardType === 'black') return 'bg-gradient-to-br from-gray-900 to-black border-red-800 ring-2 ring-red-500/50 shadow-lg shadow-red-500/20 opacity-80';
        if (cardType === 'secret') return 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 shadow-lg shadow-green-500/20';
        // Белое слово открыто — серый с обводкой
        return 'bg-gradient-to-br from-slate-400 to-slate-500 border-slate-300 shadow-lg shadow-slate-400/20';
      }
      if (cardType === 'black') return 'bg-gradient-to-br from-gray-900 to-black border-red-800 ring-2 ring-red-500/50 shadow-lg shadow-red-500/20';
      if (cardType === 'secret') return 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400 shadow-lg shadow-blue-500/20';
      return 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600';
    }

    if (isEliminated) {
      // Дисквалифицированный видит только открытые
      if (revealed) {
        if (cardType === 'black') return 'bg-gradient-to-br from-gray-900 to-black border-red-800 opacity-80';
        if (cardType === 'secret') return 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 opacity-80';
        return 'bg-gradient-to-br from-slate-400 to-slate-500 border-slate-300 opacity-80';
      }
      return 'bg-gray-800/50 border-gray-700 cursor-not-allowed opacity-70';
    }

    // Обычный игрок — НЕ видит свои загаданные слова
    if (revealed && currentPlayer.revealedWords.includes(cardId)) {
      // Это слово игрок уже открыл (правильно) — зелёное
      return 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 scale-95 shadow-lg shadow-green-500/20';
    }
    if (revealed) {
      // Кто-то другой открыл (белое слово) — серое
      return 'bg-gradient-to-br from-slate-400 to-slate-500 border-slate-300 opacity-90';
    }

    // Выбранное слово
    if (currentPlayer.selectedWords.includes(cardId)) {
      return 'bg-gradient-to-br from-yellow-400 to-amber-500 border-yellow-300 scale-105 ring-2 ring-yellow-300 shadow-lg shadow-yellow-500/30';
    }
    
    // Обычное неоткрытое слово
    if (isThinking) {
      return 'bg-gradient-to-br from-gray-700/60 to-gray-800/60 border-gray-600/50 cursor-not-allowed opacity-60';
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
              {!p.isMaster && !p.isEliminated && !p.finished && ` (✓${p.score})`}
            </div>
          ))}
        </div>

        {/* Timer */}
        {gameState.phaseEndTime > 0 && timeLeft > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mb-3 rounded-xl p-3 text-center backdrop-blur-sm border ${
              isThinking 
                ? 'bg-gradient-to-r from-orange-800/40 to-red-800/40 border-orange-500/40' 
                : 'bg-gradient-to-r from-blue-800/40 to-cyan-800/40 border-blue-500/40'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-gray-300 text-sm">
                {isThinking ? '🧠 Мастер думает' : '🎯 Игроки угадывают'}
              </span>
              <span className={`text-2xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
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

        {/* Hints history */}
        {gameState.hints.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <History size={14} className="text-gray-400" />
              <span className="text-gray-400 text-xs font-medium">Предыдущие подсказки:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gameState.hints.slice(0, -1).map((h, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-700/40 px-2 py-1 rounded-lg text-xs">
                  <span className="text-gray-500">R{h.round}</span>
                  <span className="text-white font-medium">{h.word}</span>
                  <span className="text-yellow-300">{h.count}</span>
                </div>
              ))}
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
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
              <Crown size={14} className="text-yellow-400" />
              Панель мастера
            </h3>

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
                disabled={!hintWord.trim() || !isThinking}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Дать подсказку
              </button>
              {isThinking && gameState.hints.filter(h => h.round === gameState.currentRound).length === 0 && (
                <button
                  onClick={() => wsClient.startGuessing()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition"
                >
                  Пропустить →
                </button>
              )}
              {!isThinking && (() => {
                const activePlayers = gameState.players.filter(p => !p.isMaster && !p.isEliminated && !p.finished);
                const confirmedCount = activePlayers.filter(p => p.hasConfirmed).length;
                const allConfirmed = confirmedCount === activePlayers.length;
                return (
                  <button
                    onClick={handleNextRound}
                    disabled={!allConfirmed && activePlayers.length > 0}
                    className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!allConfirmed ? `Ожидайте всех игроков (${confirmedCount}/${activePlayers.length})` : ''}
                  >
                    Далее →
                  </button>
                );
              })()}
            </div>
            
            {/* Status of player answers during guessing phase */}
            {!isThinking && (
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <p className="text-gray-400 text-xs mb-2">Ответы игроков:</p>
                <div className="flex flex-wrap gap-2">
                  {gameState.players.filter(p => !p.isMaster).map(p => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${
                        p.isEliminated
                          ? 'bg-red-900/20 border-red-700/50 text-red-300'
                          : p.finished
                          ? 'bg-green-900/20 border-green-700/50 text-green-300'
                          : p.hasConfirmed
                          ? 'bg-green-900/20 border-green-600/50 text-green-300'
                          : 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300 animate-pulse'
                      }`}
                    >
                      {p.isEliminated ? '💀' : p.finished ? '🏆' : p.hasConfirmed ? '✅' : '⏳'}
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Thinking phase notice for players */}
        {!isMaster && isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 bg-orange-900/20 border border-orange-700/50 rounded-xl p-3 text-center"
          >
            <p className="text-orange-300 font-semibold text-sm">🧠 Мастер думает над подсказкой...</p>
            <p className="text-orange-400/70 text-xs">После подсказки начнётся время на угадывание</p>
          </motion.div>
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

        {/* Player info */}
        {!isMaster && !isEliminated && (
          <div className="max-w-sm mx-auto mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Угадано слов</span>
              <span className="text-green-400">{currentPlayer.score}</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2 border border-gray-700">
              <span className="text-gray-400 text-xs">Можно выбрать:</span>
              <span className={`text-lg font-bold ${currentPlayer.maxSelections > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                {currentPlayer.selectedWords.length} / {currentPlayer.maxSelections}
              </span>
            </div>
            {currentPlayer.maxSelections === 0 && (
              <p className="text-center text-gray-500 text-xs mt-1">Ожидайте подсказку от мастера</p>
            )}
          </div>
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

        {/* Selection limit warning */}
        {!isMaster && !isEliminated && currentPlayer.selectedWords.length >= currentPlayer.maxSelections && currentPlayer.maxSelections > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mb-2"
          >
            <span className="text-yellow-400 text-xs bg-yellow-900/20 px-3 py-1 rounded-full border border-yellow-700/30">
              ⚡ Лимит достигнут — подтвердите выбор или уберите лишнее
            </span>
          </motion.div>
        )}

        {/* Confirm button / waiting state */}
        {!isMaster && !isEliminated && !currentPlayer.finished && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            {currentPlayer.hasConfirmed ? (
              <div className="px-6 py-3 bg-green-900/30 border border-green-600/50 text-green-300 font-semibold rounded-xl flex items-center gap-2">
                ✅ Вы ответили! Ожидайте остальных...
              </div>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={currentPlayer.selectedWords.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-emerald-500 transition transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                ✓ Подтвердить ({currentPlayer.selectedWords.length}/{currentPlayer.maxSelections})
              </button>
            )}
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
                <div className="w-3 h-3 rounded bg-gradient-to-br from-green-500 to-emerald-600 border border-green-400"></div>
                <span className="text-gray-400">Угаданные</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-slate-400 to-slate-500 border border-slate-300"></div>
                <span className="text-gray-400">Белые (открыты зря)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-900 to-black border border-red-800"></div>
                <span className="text-gray-400">Чёрное</span>
              </div>
            </>
          ) : !isEliminated ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-yellow-400 to-amber-500 border border-yellow-300"></div>
                <span className="text-gray-400">Выбранные вами</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-green-500 to-emerald-600 border border-green-400"></div>
                <span className="text-gray-400">Угаданные</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-slate-400 to-slate-500 border border-slate-300"></div>
                <span className="text-gray-400">Открытые (не ваши)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600"></div>
                <span className="text-gray-400">Неоткрытые</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

// Lobby View
function LobbyView({ wsClient, gameState, currentPlayer, onLeave }: { wsClient: WebSocketClient; gameState: GameState; currentPlayer: Player; onLeave: () => void }) {
  const [showCopied, setShowCopied] = useState(false);

  const copyRoomId = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleStart = () => {
    if (gameState.players.length >= 2) {
      wsClient.startGame();
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
              Откройте игру в другой вкладке/устройстве → "Присоединиться" → введите код
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
function GameOverOverlay({ gameState, onLeave }: { gameState: GameState; currentPlayer: Player; onLeave: () => void }) {
  const winner = gameState.players.find((p) => p.id === gameState.winner);

  useEffect(() => {
    playWinSound();
    
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
            if (card.type === 'secret') {
              if (card.revealed) {
                bgColor = 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400';
                label = '✅';
              } else {
                bgColor = 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400';
                label = '🔵';
              }
            }
            if (card.type === 'black') { bgColor = 'bg-gradient-to-br from-gray-900 to-black border-red-800 ring-2 ring-red-500'; label = '⚫'; }
            if (card.type === 'normal' && card.revealed) {
              bgColor = 'bg-gradient-to-br from-slate-400 to-slate-500 border-slate-300';
              label = '⚪';
            }

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
            <div className="w-3 h-3 rounded bg-gradient-to-br from-green-500 to-emerald-600 border border-green-400"></div>
            <span className="text-gray-300">Угаданные</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-slate-400 to-slate-500 border border-slate-300"></div>
            <span className="text-gray-300">Белые (открыты зря)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-gray-900 to-black border border-red-800"></div>
            <span className="text-gray-300">Чёрное</span>
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
                  <span className="text-gray-300">✓ {p.score} слов</span>
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
