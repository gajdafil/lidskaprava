/**
 * audio.js
 * Procedurální zvuková odezva úředního prostředí (Web Audio API, bez externích souborů).
 */

const MUTE_STORAGE_KEY = 'letat_cest_moi_audio_muted_v1';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = this._loadMuteState();
  }

  _loadMuteState() {
    try {
      return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  _saveMuteState() {
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted));
    } catch {
      // Ignorovat v prostředí bez přístupu k localStorage
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    this._saveMuteState();
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  _ensureContext() {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _playTone({ freq = 440, endFreq = null, duration = 0.09, type = 'sine', gain = 0.04, delay = 0 }) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /** Jemné kliknutí ovládacího prvku */
  playClick() {
    this._playTone({ freq: 520, endFreq: 380, duration: 0.045, type: 'triangle', gain: 0.03 });
  }

  /** Šustnutí spisové složky při otevření dokumentu v archivu */
  playDocumentOpen() {
    this._playTone({ freq: 260, endFreq: 420, duration: 0.075, type: 'sine', gain: 0.025 });
  }

  /** Potvrzení správné právní úvahy (dvoutónový souzvuk) */
  playSuccess() {
    this._playTone({ freq: 523.25, duration: 0.12, type: 'sine', gain: 0.045, delay: 0 });
    this._playTone({ freq: 659.25, duration: 0.18, type: 'sine', gain: 0.045, delay: 0.08 });
  }

  /** Upozornění na chybnou odpověď či námitku Komise */
  playError() {
    this._playTone({ freq: 220, endFreq: 165, duration: 0.18, type: 'sawtooth', gain: 0.03 });
  }

  /** Úřední pečeť při uzamčení strategického rozhodnutí nebo dokončení kapitoly */
  playSeal() {
    this._playTone({ freq: 392.0, duration: 0.11, type: 'triangle', gain: 0.045, delay: 0 });
    this._playTone({ freq: 493.88, duration: 0.12, type: 'triangle', gain: 0.045, delay: 0.08 });
    this._playTone({ freq: 587.33, duration: 0.22, type: 'triangle', gain: 0.05, delay: 0.16 });
  }
}
