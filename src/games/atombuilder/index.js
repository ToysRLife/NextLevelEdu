import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { readout, slider } from "@core/controls";
// Atoms (MS-PS1-1): an atom is protons + neutrons in a nucleus, with electrons
// around it. The PROTON count decides which element it is; neutrons set the mass
// (isotope); electrons set the charge. Build each target atom.
const W = 800;
const H = 600;
// First 20 elements — proton count → symbol.
const ELEMENTS = [
    "",
    "H",
    "He",
    "Li",
    "Be",
    "B",
    "C",
    "N",
    "O",
    "F",
    "Ne",
    "Na",
    "Mg",
    "Al",
    "Si",
    "P",
    "S",
    "Cl",
    "Ar",
    "K",
    "Ca",
];
const symbolFor = (z) => (z >= 1 && z < ELEMENTS.length ? ELEMENTS[z] : "?");
const ROUNDS = [
    { name: "Carbon-12", z: 6, mass: 12 },
    { name: "Oxygen-16", z: 8, mass: 16 },
    { name: "Sodium-23", z: 11, mass: 23 },
];
class AtomBuilder {
    constructor(ctx) {
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ctx
        });
        Object.defineProperty(this, "ctx2d", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "raf", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "anim", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "ended", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "protons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "neutrons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "electrons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "idx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "hits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "misses", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "pCtl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nCtl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "eCtl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "elRead", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "statusEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "coachEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.buildPanel();
        ctx.services.hints.setHints([
            "An atom has a nucleus of protons and neutrons, with electrons whizzing around it.",
            "The number of PROTONS is what makes an element what it is — 6 protons is always carbon, 8 is always oxygen.",
            "Neutrons add mass without changing the element. Match protons = electrons to keep the atom neutral (no charge).",
        ]);
        this.renderLoop();
    }
    round() {
        return ROUNDS[this.idx];
    }
    charge() {
        return this.protons - this.electrons;
    }
    buildPanel() {
        this.pCtl = slider({
            label: "🔴 Protons",
            min: 1,
            max: 20,
            value: this.protons,
            step: 1,
            color: "var(--accent-red)",
            onInput: (v) => {
                this.protons = v;
                this.updateReadout();
            },
        });
        this.nCtl = slider({
            label: "⚪ Neutrons",
            min: 0,
            max: 25,
            value: this.neutrons,
            step: 1,
            color: "var(--accent-blue)",
            onInput: (v) => {
                this.neutrons = v;
                this.updateReadout();
            },
        });
        this.eCtl = slider({
            label: "🟡 Electrons",
            min: 0,
            max: 25,
            value: this.electrons,
            step: 1,
            color: "var(--accent-yellow)",
            onInput: (v) => {
                this.electrons = v;
                this.updateReadout();
            },
        });
        this.elRead = readout("🔬 You built");
        this.statusEl = el("span", { style: { color: "var(--accent-green)" } }, `${this.hits} / ${ROUNDS.length}`);
        this.coachEl = el("div", {
            class: "hint-panel",
            style: { borderLeftColor: "var(--accent-purple)", background: "#f5f3ff" },
        });
        this.coachEl.textContent = "Set protons, neutrons, and electrons to build the target atom.";
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", { class: "metric", style: { background: "#1e293b", color: "#fff" } }, el("span", {}, "🎯 Build"), el("span", {}, `${this.round().name} (${symbolFor(this.round().z)})`)), this.pCtl.el, this.nCtl.el, this.eCtl.el, this.elRead.el, el("button", {
            class: "btn",
            style: { background: "var(--accent-purple)" },
            onclick: () => this.check(),
        }, "✅ Check atom"), el("div", { class: "metric" }, el("span", {}, "✅ Atoms built"), this.statusEl), this.coachEl);
        this.updateReadout();
    }
    updateReadout() {
        const sym = symbolFor(this.protons);
        const ch = this.charge();
        const chStr = ch === 0 ? "neutral" : ch > 0 ? `${ch}+` : `${-ch}−`;
        this.elRead.set(`${sym} · mass ${this.protons + this.neutrons} · ${chStr}`);
    }
    check() {
        if (this.ended)
            return;
        const r = this.round();
        const okEl = this.protons === r.z;
        const okMass = this.protons + this.neutrons === r.mass;
        const okNeutral = this.charge() === 0;
        if (okEl && okMass && okNeutral) {
            this.hits += 1;
            this.statusEl.textContent = `${this.hits} / ${ROUNDS.length}`;
            this.ctx.services.audio.play("reward");
            if (this.hits >= ROUNDS.length)
                this.win();
            else {
                this.idx += 1;
                this.coachEl.textContent = "⚛️ Atom built! On to the next element.";
                this.buildPanel();
            }
        }
        else {
            this.misses += 1;
            this.ctx.services.audio.play("fail");
            this.coachEl.textContent = !okEl
                ? `That's ${symbolFor(this.protons)}, not ${symbolFor(r.z)}. Change the PROTONS — they set the element.`
                : !okNeutral
                    ? "Right element, but it's charged. Match electrons to protons to make it neutral."
                    : `Right element, but the mass is ${this.protons + this.neutrons}, not ${r.mass}. Adjust the neutrons.`;
        }
    }
    win() {
        this.ended = true;
        const stars = this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1;
        this.ctx.services.score.event("atombuilder_done", { misses: this.misses });
        this.ctx.services.outcome.succeed({
            message: "Atom architect! Protons decide the element, neutrons set its mass, and matching electrons keep it neutral. That's how every atom is built.",
            stars,
            resources: { Elements: 60 },
        });
    }
    renderLoop() {
        const draw = () => {
            this.anim += 0.02;
            this.render();
            this.raf = requestAnimationFrame(draw);
        };
        draw();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#0b1026";
        c.fillRect(0, 0, W, H);
        if (this.ended) {
            c.fillStyle = "#a78bfa";
            c.font = "bold 30px Nunito, sans-serif";
            c.textAlign = "center";
            c.fillText("Atoms mastered! ⚛️", W / 2, H / 2);
            return;
        }
        const cx = W / 2;
        const cy = 300;
        // nucleus: protons (red) + neutrons (grey) clustered
        const total = this.protons + this.neutrons;
        for (let i = 0; i < total; i++) {
            const a = (i / Math.max(1, total)) * Math.PI * 2 + this.anim;
            const rad = total > 1 ? 6 + (i % 5) * 5 : 0;
            const x = cx + Math.cos(a) * rad;
            const y = cy + Math.sin(a) * rad;
            c.fillStyle = i < this.protons ? "#ef4444" : "#94a3b8";
            c.beginPath();
            c.arc(x, y, 8, 0, Math.PI * 2);
            c.fill();
        }
        // electron shells (2, then 8, then rest)
        let remaining = this.electrons;
        const shells = [2, 8, 8, 2];
        let shellR = 70;
        for (const cap of shells) {
            if (remaining <= 0)
                break;
            const inShell = Math.min(cap, remaining);
            remaining -= inShell;
            c.strokeStyle = "rgba(250,204,21,0.3)";
            c.lineWidth = 1.5;
            c.beginPath();
            c.arc(cx, cy, shellR, 0, Math.PI * 2);
            c.stroke();
            for (let i = 0; i < inShell; i++) {
                const a = (i / inShell) * Math.PI * 2 + this.anim * (shellR / 50);
                c.fillStyle = "#facc15";
                c.beginPath();
                c.arc(cx + Math.cos(a) * shellR, cy + Math.sin(a) * shellR, 6, 0, Math.PI * 2);
                c.fill();
            }
            shellR += 45;
        }
        c.fillStyle = "#e9d5ff";
        c.font = "bold 18px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(`Build a ${this.round().name} atom ⚛️`, W / 2, 44);
        c.font = "bold 40px Nunito, sans-serif";
        c.fillStyle = "#fff";
        c.fillText(symbolFor(this.protons), cx, cy + 200);
    }
    start() { }
    pause() { }
    resume() { }
    reset() {
        this.ended = false;
        this.protons = 1;
        this.neutrons = 0;
        this.electrons = 1;
        this.idx = 0;
        this.hits = 0;
        this.misses = 0;
        this.ctx.services.hints.reset();
        this.buildPanel();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const atomBuilderGame = {
    meta: {
        id: "atombuilder",
        conceptId: "chem-26",
        title: "Atom Builder",
        stream: "chemistry",
        gradeBand: "6-8",
        emoji: "⚛️",
        blurb: "Place protons, neutrons, and electrons to build real atoms — and discover what makes each element.",
        mission: "Build each target atom with the right protons, neutrons, and electrons.",
        estMinutes: 4,
    },
    create: (ctx) => new AtomBuilder(ctx),
};
