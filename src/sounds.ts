// Simple sound effects using Web Audio API
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1) {
  if (!audioCtx) return;
  
  try {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
  } catch {
    // Ignore audio errors
  }
}

export function playSelectSound() {
  playTone(440, 0.1, 'sine', 0.05);
}

export function playConfirmSound() {
  playTone(523, 0.1, 'sine', 0.08);
  setTimeout(() => playTone(659, 0.1, 'sine', 0.08), 100);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.08), 200);
}

export function playErrorSound() {
  playTone(200, 0.2, 'sawtooth', 0.05);
  setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.05), 150);
}

export function playWinSound() {
  const notes = [523, 587, 659, 784, 880, 1047];
  notes.forEach((note, i) => {
    setTimeout(() => playTone(note, 0.2, 'sine', 0.06), i * 100);
  });
}

export function playHintSound() {
  playTone(660, 0.15, 'triangle', 0.06);
  setTimeout(() => playTone(880, 0.2, 'triangle', 0.06), 120);
}

export function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
