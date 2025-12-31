/**
 * Sound Effects for Trading Actions
 */

class SoundService {
  private audioContext: AudioContext | null = null;

  constructor() {
    // Initialize AudioContext on first use
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play buy sound - cash register "cha-ching" bell
   */
  playBuySound() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Create oscillators for bell-like sound
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Bell-like filter for bright, metallic sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 3;

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    osc3.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(ctx.destination);

    // Cash register "cha" - first bell strike
    osc1.frequency.setValueAtTime(1046.50, now); // C6
    osc2.frequency.setValueAtTime(1318.51, now); // E6
    osc3.frequency.setValueAtTime(1568.00, now); // G6

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'triangle';

    // Sharp attack, quick decay like a bell
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
    osc3.stop(now + 0.15);

    // Second "ching" sound - higher pitch
    setTimeout(() => {
      const osc4 = ctx.createOscillator();
      const osc5 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc4.connect(gain2);
      osc5.connect(gain2);
      gain2.connect(filter);

      osc4.frequency.setValueAtTime(1568.00, ctx.currentTime);
      osc5.frequency.setValueAtTime(2093.00, ctx.currentTime);
      osc4.type = 'sine';
      osc5.type = 'triangle';

      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.005);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc4.start(ctx.currentTime);
      osc5.start(ctx.currentTime);
      osc4.stop(ctx.currentTime + 0.2);
      osc5.stop(ctx.currentTime + 0.2);
    }, 80);
  }

  /**
   * Play sell sound - coins dropping/money received sound
   */
  playSellSound() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Create multiple coin bounce sounds
    const coinFrequencies = [800, 900, 750, 850]; // Metallic coin pitches

    coinFrequencies.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Metallic filter for coin sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 5;

        osc.connect(gainNode);
        gainNode.connect(filter);
        filter.connect(ctx.destination);

        // Quick pitch bend for coin bounce
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ctx.currentTime + 0.08);

        osc.type = 'square';

        // Quick attack and decay like a coin hitting surface
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15 - (i * 0.03), ctx.currentTime + 0.003);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      }, i * 45); // Stagger the coin sounds
    });

    // Add a satisfying low "thud" at the end
    setTimeout(() => {
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();

      bass.connect(bassGain);
      bassGain.connect(ctx.destination);

      bass.frequency.setValueAtTime(120, ctx.currentTime);
      bass.type = 'sine';

      bassGain.gain.setValueAtTime(0, ctx.currentTime);
      bassGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      bass.start(ctx.currentTime);
      bass.stop(ctx.currentTime + 0.15);
    }, 180);
  }

  /**
   * Play success sound - triumphant fanfare for buy completion
   */
  playSuccessSound() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Create a triumphant three-note ascending fanfare
    const notes = [
      { freq: 523.25, time: 0 },      // C5
      { freq: 659.25, time: 0.15 },   // E5
      { freq: 783.99, time: 0.3 }     // G5
    ];

    notes.forEach(note => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Bright filter for fanfare quality
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 2;

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(filter);
      filter.connect(ctx.destination);

      osc1.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);
      osc2.frequency.setValueAtTime(note.freq * 1.5, ctx.currentTime + note.time); // Perfect fifth above

      osc1.type = 'triangle';
      osc2.type = 'sine';

      // Bold attack and sustain for triumphant feel
      gainNode.gain.setValueAtTime(0, ctx.currentTime + note.time);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + note.time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + 0.25);

      osc1.start(ctx.currentTime + note.time);
      osc2.start(ctx.currentTime + note.time);
      osc1.stop(ctx.currentTime + note.time + 0.25);
      osc2.stop(ctx.currentTime + note.time + 0.25);
    });
  }

  /**
   * Play error sound - alert
   */
  playErrorSound() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Dissonant tone
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.setValueAtTime(180, now + 0.1);

    osc.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }
}

export const soundService = new SoundService();
