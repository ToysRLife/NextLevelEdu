import { read, write } from "./storage";
// Tiny synth so we ship satisfying feedback with zero audio assets.
const TONES = {
    success: [
        { freq: 523, dur: 0.12, type: "triangle" },
        { freq: 659, dur: 0.12, type: "triangle" },
        { freq: 784, dur: 0.2, type: "triangle" },
    ],
    reward: [
        { freq: 659, dur: 0.1, type: "square" },
        { freq: 784, dur: 0.1, type: "square" },
        { freq: 1047, dur: 0.22, type: "square" },
    ],
    fail: [
        { freq: 311, dur: 0.18, type: "sawtooth" },
        { freq: 233, dur: 0.26, type: "sawtooth" },
    ],
    click: [{ freq: 440, dur: 0.05, type: "sine" }],
    tick: [{ freq: 880, dur: 0.03, type: "sine" }],
};
// Shared across every game's audio service so a mute toggle anywhere takes
// effect everywhere, live.
let ctx = null;
let muted = read("audio:muted", false);
function ensureCtx() {
    if (muted)
        return null;
    if (!ctx) {
        const Ctor = window.AudioContext ??
            window.webkitAudioContext;
        if (!Ctor)
            return null;
        ctx = new Ctor();
    }
    // Browsers start the context "suspended" until a user gesture — play() is
    // always called from a tap/click, so resuming here is safe and reliable.
    if (ctx.state === "suspended")
        void ctx.resume();
    return ctx;
}
export function isMuted() {
    return muted;
}
export function setMuted(m) {
    muted = m;
    write("audio:muted", m);
}
export function createAudioService() {
    return {
        play(sound) {
            const audio = ensureCtx();
            if (!audio)
                return;
            let t = audio.currentTime;
            for (const note of TONES[sound]) {
                const osc = audio.createOscillator();
                const gain = audio.createGain();
                osc.type = note.type;
                osc.frequency.value = note.freq;
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
                osc.connect(gain).connect(audio.destination);
                osc.start(t);
                osc.stop(t + note.dur);
                t += note.dur;
            }
        },
        tone(freq, durMs = 320, type = "sine") {
            const audio = ensureCtx();
            if (!audio)
                return;
            const t = audio.currentTime;
            const dur = durMs / 1000;
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            // Quick attack, gentle decay — a clear, audible musical note.
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(gain).connect(audio.destination);
            osc.start(t);
            osc.stop(t + dur);
        },
        setMuted,
        isMuted,
    };
}
