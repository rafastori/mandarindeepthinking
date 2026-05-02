// PolyQuest — sistema de áudio (WebAudio puro, sem assets externos)
// Gera SFX programaticamente. Inicializa só após primeiro gesto do usuário.

class GameAudio {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private enabled = true;
    private muted = false;

    constructor() {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('polyquest_muted');
            this.muted = stored === '1';
        }
    }

    private ensureContext(): AudioContext | null {
        if (!this.enabled || this.muted) return null;
        if (!this.ctx) {
            try {
                const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (!Ctor) {
                    this.enabled = false;
                    return null;
                }
                this.ctx = new Ctor();
                this.master = this.ctx!.createGain();
                this.master.gain.value = 0.4;
                this.master.connect(this.ctx!.destination);
            } catch {
                this.enabled = false;
                return null;
            }
        }
        // Browsers podem suspender o contexto antes do primeiro gesto
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        if (typeof window !== 'undefined') {
            localStorage.setItem('polyquest_muted', muted ? '1' : '0');
        }
    }
    isMuted() { return this.muted; }

    setVolume(v: number) {
        if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
    }

    // Tom puro com envelope ADSR rápido
    private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, attack = 0.005, release = 0.05) {
        const ctx = this.ensureContext();
        if (!ctx || !this.master) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + attack);
        gain.gain.linearRampToValueAtTime(0, now + dur + release);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + dur + release + 0.01);
    }

    // Sweep (frequency over time)
    private sweep(from: number, to: number, dur: number, type: OscillatorType = 'sine', vol = 0.5) {
        const ctx = this.ensureContext();
        if (!ctx || !this.master) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, to), now + dur);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + dur + 0.01);
    }

    // Noise burst (whoosh, hit)
    private noise(dur: number, vol = 0.3, filterFreq = 1500) {
        const ctx = this.ensureContext();
        if (!ctx || !this.master) return;
        const now = ctx.currentTime;
        const bufSize = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) out[i] = (Math.random() * 2 - 1);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.linearRampToValueAtTime(0, now + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        src.start(now);
        src.stop(now + dur + 0.01);
    }

    // ─── SFX nominais ───────────────────────────

    correct() {
        // arpeggio ascendente curto
        this.tone(523.25, 0.08, 'triangle', 0.4);
        setTimeout(() => this.tone(659.25, 0.08, 'triangle', 0.4), 70);
        setTimeout(() => this.tone(783.99, 0.12, 'triangle', 0.5), 140);
    }

    wrong() {
        this.sweep(440, 110, 0.25, 'sawtooth', 0.35);
    }

    cardLock() {
        this.tone(880, 0.04, 'square', 0.2);
    }

    hint() {
        this.tone(880, 0.06, 'sine', 0.3);
        setTimeout(() => this.tone(1320, 0.08, 'sine', 0.3), 60);
    }

    bossHit() {
        this.noise(0.18, 0.45, 800);
        this.sweep(220, 80, 0.3, 'sawtooth', 0.4);
    }

    bossAttack() {
        // Aviso ameaçador
        this.tone(110, 0.5, 'sawtooth', 0.4);
        setTimeout(() => this.tone(165, 0.4, 'sawtooth', 0.35), 250);
    }

    bossDefeat() {
        this.sweep(220, 30, 1.2, 'sawtooth', 0.5);
        setTimeout(() => this.noise(0.6, 0.35, 400), 200);
    }

    intruderAlert() {
        // Sirene curta
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.sweep(440, 880, 0.18, 'square', 0.3);
            }, i * 200);
        }
    }

    victory() {
        // Fanfarra
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.15, 'triangle', 0.4), i * 100));
        setTimeout(() => this.tone(1318.51, 0.4, 'triangle', 0.5), 450);
    }

    defeat() {
        // Descenso triste
        const notes = [440, 392, 349.23, 293.66];
        notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.25, 'sine', 0.35), i * 200));
    }

    combo(level: number) {
        // Chime ascendente que sobe com o combo
        const baseFreq = 660 + level * 80;
        this.tone(baseFreq, 0.08, 'triangle', 0.35);
        setTimeout(() => this.tone(baseFreq * 1.5, 0.12, 'triangle', 0.4), 60);
    }

    classPerk() {
        // Magia
        this.tone(880, 0.05, 'sine', 0.3);
        setTimeout(() => this.tone(1320, 0.05, 'sine', 0.3), 40);
        setTimeout(() => this.tone(1760, 0.08, 'sine', 0.4), 80);
        setTimeout(() => this.tone(2640, 0.15, 'sine', 0.4), 130);
    }

    heal() {
        // Suave ascendente
        this.tone(523.25, 0.12, 'sine', 0.3);
        setTimeout(() => this.tone(659.25, 0.12, 'sine', 0.3), 80);
    }

    pickUp() {
        this.tone(987.77, 0.05, 'square', 0.2);
        setTimeout(() => this.tone(1318.51, 0.08, 'square', 0.25), 40);
    }

    tick() {
        this.tone(440, 0.02, 'square', 0.1);
    }

    countdown() {
        this.tone(330, 0.08, 'square', 0.3);
    }
}

export const audio = new GameAudio();
