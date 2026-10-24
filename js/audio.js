/**
 * Audio Synthesizer & Visual FX Module
 * Web Audio API based - zero external MP3 dependencies
 */
(function(window) {
  'use strict';

  let audioCtx = null;
  let isSoundEnabled = true;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', gainVal = 0.1, delay = 0) {
    if (!isSoundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  const SoundFX = {
    setSoundEnabled(enabled) {
      isSoundEnabled = !!enabled;
    },
    isSoundEnabled() {
      return isSoundEnabled;
    },
    playCorrect() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        playTone(freq, 0.22, 'triangle', 0.2, idx * 0.1);
      });
    },
    playWrong() {
      playTone(160, 0.5, 'sawtooth', 0.25);
      playTone(130, 0.6, 'sawtooth', 0.2, 0.15);
    },
    playHalf() {
      playTone(440, 0.18, 'triangle', 0.18);
      playTone(554.37, 0.28, 'triangle', 0.18, 0.14);
    },
    playTileOpen() {
      playTone(392, 0.12, 'sine', 0.15);
      playTone(587.33, 0.22, 'sine', 0.15, 0.1);
    },
    playBuzzer() {
      playTone(320, 0.35, 'square', 0.3);
      playTone(280, 0.35, 'square', 0.3, 0.08);
    },
    playHeartbeat(rateFraction = 1) {
      // Lub-dub heartbeat sound
      playTone(55, 0.18, 'sine', 0.35);
      playTone(110, 0.1, 'sine', 0.15);
      playTone(48, 0.22, 'sine', 0.28, 0.18);
      playTone(96, 0.1, 'sine', 0.12, 0.18);
    },
    triggerConfetti() {
      const colors = ['#f43f5e', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
      
      for (let i = 0; i < 100; i++) {
        const piece = document.createElement('div');
        const color = colors[i % colors.length];
        const left = Math.random() * 100;
        const size = 8 + Math.random() * 10;
        const delay = Math.random() * 2;
        const duration = 3 + Math.random() * 3;
        
        piece.style.cssText = `
          position: absolute;
          top: -20px;
          left: ${left}%;
          width: ${size}px;
          height: ${size * 1.5}px;
          background: ${color};
          border-radius: 3px;
          opacity: 0.9;
          transform: rotate(${Math.random() * 360}deg);
          animation: confettiFall ${duration}s linear ${delay}s forwards;
        `;
        container.appendChild(piece);
      }
      
      const style = document.createElement('style');
      style.textContent = `
        @keyframes confettiFall {
          to {
            top: 110%;
            transform: rotate(${Math.random() * 720}deg) translateX(${Math.random() * 100 - 50}px);
            opacity: 0.2;
          }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(container);
      
      setTimeout(() => {
        container.remove();
        style.remove();
      }, 7000);
    }
  };

  window.SoundFX = SoundFX;
})(window);
