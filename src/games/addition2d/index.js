import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
import { byTier } from "@core/difficulty";
const W = 800;
const H = 600;
const MIN_A = 0;
class Addition2D {
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
        Object.defineProperty(this, "problemEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "answerEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "feedbackEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hintPanel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scoreEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "modeButtons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "newProblemBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "demoBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "checkBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hintBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "resetBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "numpad", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "learnPanel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "aSlider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bSlider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "aLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "play"
        });
        Object.defineProperty(this, "a", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "b", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "selected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        Object.defineProperty(this, "score", {
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
        Object.defineProperty(this, "raf", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "showCombined", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "maxSum", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.maxSum = byTier(ctx.tier, 9, 12, 15);
        this.problemEl = el("span", { style: { fontWeight: "700" } }, "Tap New Problem to start");
        this.answerEl = el("span", { style: { fontSize: "1.8rem", fontWeight: "800" } }, "—");
        this.feedbackEl = el("div", { class: "feedback" });
        this.hintPanel = el("div", { class: "hint-panel", style: { display: "none" } });
        this.scoreEl = el("span", { style: { color: "var(--accent-blue)" } }, "0");
        this.aLabel = el("span", {}, "2");
        this.bLabel = el("span", {}, "3");
        this.aSlider = el("input", {
            type: "range",
            min: "0",
            max: String(this.maxSum),
            value: "2",
            "aria-label": "Group A count",
            style: { accentColor: "var(--accent-orange)" },
            oninput: () => this.syncSliders(),
        });
        this.bSlider = el("input", {
            type: "range",
            min: "0",
            max: String(this.maxSum),
            value: "3",
            "aria-label": "Group B count",
            style: { accentColor: "var(--accent-blue)" },
            oninput: () => this.syncSliders(),
        });
        this.demoBtn = el("button", { class: "btn secondary", onclick: () => this.showDemonstration() }, "Show");
        this.newProblemBtn = el("button", { class: "btn", onclick: () => this.newProblem() }, "New Problem");
        this.checkBtn = el("button", { class: "btn", onclick: () => this.checkAnswer() }, "Check");
        this.hintBtn = el("button", { class: "btn secondary", onclick: () => this.showHint() }, "Hint");
        this.resetBtn = el("button", { class: "btn", onclick: () => this.resetAnswer() }, "Reset");
        this.numpad = el("div", {
            style: {
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "10px",
                marginTop: "12px",
            },
        });
        this.learnPanel = el("div", { style: { display: "none", flexDirection: "column", gap: "12px", marginTop: "12px" } }, el("div", { style: { fontWeight: "800" } }, "Try a demonstration"), el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } }, el("label", { style: { display: "grid", gap: "6px" } }, "Group A", this.aSlider, el("div", { style: { display: "flex", justifyContent: "space-between" } }, "A =", this.aLabel)), el("label", { style: { display: "grid", gap: "6px" } }, "Group B", this.bSlider, el("div", { style: { display: "flex", justifyContent: "space-between" } }, "B =", this.bLabel))), this.demoBtn);
        this.buildPanel();
        ctx.services.hints.setHints([
            "Count the objects in each group, then add the two amounts together.",
            "Learn mode lets you change both groups and watch the answer update.",
            "Use the number pad to choose the total that matches the objects.",
        ]);
        this.newProblem();
        this.renderNumpad();
        this.render();
        this.renderLoop();
    }
    buildPanel() {
        clear(this.ctx.panel);
        this.modeButtons = el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } }, el("button", { class: "btn secondary", onclick: () => this.setMode("learn") }, "Learn Mode"), el("button", { class: "btn", onclick: () => this.setMode("play") }, "Play Mode"), this.newProblemBtn, el("div", { style: { marginLeft: "auto", fontWeight: "700" } }, "Score: ", this.scoreEl));
        const problemRow = el("div", { class: "metric", style: { justifyContent: "space-between" } }, el("span", {}, "Problem"), this.problemEl);
        const answerRow = el("div", { class: "metric", style: { justifyContent: "space-between" } }, el("span", {}, "Answer"), this.answerEl);
        const buttons = el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" } }, this.checkBtn, this.hintBtn, this.resetBtn);
        clear(this.numpad);
        this.renderNumpad();
        this.ctx.panel.append(this.modeButtons, problemRow, answerRow, buttons, this.numpad, this.learnPanel, this.feedbackEl, this.hintPanel);
        this.syncModeVisuals();
    }
    syncModeVisuals() {
        if (this.mode === "learn") {
            this.learnPanel.style.display = "flex";
            this.hintPanel.style.display = "none";
            this.newProblemBtn.disabled = true;
        }
        else {
            this.learnPanel.style.display = "none";
            this.hintPanel.style.display = "none";
            this.newProblemBtn.disabled = false;
        }
        this.setModeButtons();
    }
    setModeButtons() {
        const buttons = this.modeButtons.querySelectorAll("button");
        buttons.forEach((button) => {
            if (button.textContent === "Learn Mode") {
                button.className = this.mode === "learn" ? "btn" : "btn secondary";
            }
            if (button.textContent === "Play Mode") {
                button.className = this.mode === "play" ? "btn" : "btn secondary";
            }
        });
    }
    setMode(mode) {
        this.mode = mode;
        if (mode === "learn") {
            this.a = Number(this.aSlider.value);
            this.b = Number(this.bSlider.value);
            this.feedbackEl.textContent = "";
            this.answerEl.textContent = "—";
            this.selected = -1;
            this.showCombined = false;
            this.renderProblem();
        }
        else {
            this.newProblem();
        }
        this.syncModeVisuals();
        this.render();
    }
    syncSliders() {
        this.aLabel.textContent = this.aSlider.value;
        this.bLabel.textContent = this.bSlider.value;
        if (this.mode === "learn") {
            this.a = Number(this.aSlider.value);
            this.b = Number(this.bSlider.value);
            this.renderProblem();
            this.render();
        }
    }
    newProblem() {
        this.mode = "play";
        this.setModeButtons();
        this.a = MIN_A + Math.floor(Math.random() * (this.maxSum - MIN_A));
        this.b = Math.floor(Math.random() * (this.maxSum - this.a + 1));
        this.selected = -1;
        this.showCombined = false;
        this.answerEl.textContent = "—";
        this.feedbackEl.textContent = "";
        this.hintPanel.style.display = "none";
        this.renderProblem();
        this.render();
    }
    renderProblem() {
        this.problemEl.textContent = `${this.a} + ${this.b} = ?`;
        this.answerEl.textContent = this.selected >= 0 ? String(this.selected) : "—";
    }
    renderNumpad() {
        clear(this.numpad);
        for (let i = 0; i <= this.maxSum; i += 1) {
            const button = el("button", {
                class: "btn secondary",
                style: { padding: "14px", fontSize: "1.1rem" },
                onclick: () => {
                    this.selected = i;
                    this.answerEl.textContent = String(i);
                },
            }, String(i));
            this.numpad.append(button);
        }
    }
    checkAnswer() {
        if (this.selected < 0) {
            this.feedbackEl.textContent = "Choose an answer from the number pad.";
            return;
        }
        const correct = this.a + this.b;
        if (this.selected === correct) {
            this.score += 10;
            this.scoreEl.textContent = String(this.score);
            this.feedbackEl.innerHTML = `<strong style="color:green">Great! ${this.a} + ${this.b} = ${correct}.</strong>`;
            this.ctx.services.audio.play("reward");
            this.ctx.services.outcome.succeed({
                message: `Great work! ${this.a} + ${this.b} = ${correct}.`,
                stars: 3,
                resources: { Power: 20 },
            });
            this.showCombined = true;
            this.render();
            this.resetAnswer();
        }
        else {
            this.feedbackEl.innerHTML = `<strong style="color:#d35454">Try again — ${this.selected} is not the total.</strong>`;
            this.score = Math.max(0, this.score - 2);
            this.scoreEl.textContent = String(this.score);
            this.ctx.services.audio.play("fail");
        }
    }
    showHint() {
        this.hintPanel.style.display = "block";
        this.hintPanel.textContent = `Think: ${this.a} plus ${this.b}. Count all objects in both groups to find the total.`;
    }
    resetAnswer() {
        this.selected = -1;
        this.answerEl.textContent = "—";
        this.feedbackEl.textContent = "";
        this.hintPanel.style.display = "none";
    }
    showDemonstration() {
        this.a = Number(this.aSlider.value);
        this.b = Number(this.bSlider.value);
        this.selected = this.a + this.b;
        this.showCombined = true;
        this.answerEl.textContent = String(this.selected);
        this.feedbackEl.innerHTML = `<strong style="color:green">Demo: ${this.a} + ${this.b} = ${this.selected}.</strong>`;
        this.renderProblem();
        this.render();
    }
    renderLoop() {
        const tick = () => {
            this.anim += 0.04;
            this.render();
            this.raf = requestAnimationFrame(tick);
        };
        tick();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#f7fbff";
        c.fillRect(0, 0, W, H);
        const offsetX = 120;
        const offsetY = 120;
        this.drawCombined(c, offsetX + 170, offsetY, this.a + this.b, "Group A + B", "#ecfdf5", this.anim * 0.2, this.showCombined);
        this.drawGroup(c, offsetX, offsetY + 220, this.a, "🍎", "Group A", "#fee2e2", this.anim * 0.3);
        this.drawGroup(c, offsetX + 340, offsetY + 220, this.b, "⭐", "Group B", "#dbeafe", this.anim * 0.3 + 1.7);
    }
    drawGroup(c, x, y, count, emoji, label, color, phase) {
        c.fillStyle = color;
        c.fillRect(x - 40, y - 40, 320, 220);
        c.fillStyle = "#0f172a";
        c.font = "bold 22px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(label, x + 120, y - 12);
        c.font = "40px serif";
        c.textBaseline = "middle";
        const cols = 5;
        for (let i = 0; i < count; i += 1) {
            const cx = x + (i % cols) * 58;
            const cy = y + Math.floor(i / cols) * 58 + 30 + Math.sin(phase + i * 0.5) * 4;
            c.fillText(emoji, cx, cy);
        }
        c.textAlign = "start";
        c.textBaseline = "alphabetic";
    }
    drawCombined(c, x, y, total, label, color, phase, showValue) {
        c.fillStyle = color;
        c.fillRect(x - 40, y - 40, 320, 180);
        c.strokeStyle = showValue ? "transparent" : "rgba(15, 23, 42, 0.32)";
        c.lineWidth = 3;
        if (!showValue) {
            c.setLineDash([10, 8]);
            c.strokeRect(x - 40 + 4, y - 40 + 4, 320 - 8, 180 - 8);
            c.setLineDash([]);
        }
        c.fillStyle = "#0f172a";
        c.font = "bold 22px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(label, x + 120, y + 12);
        c.font = "72px serif";
        c.fillText(showValue ? String(total) : "?", x + 120, y + 90 + Math.sin(phase) * 6);
        c.textAlign = "start";
    }
    start() {
        // no-op: rendering loop runs continuously
    }
    pause() {
        cancelAnimationFrame(this.raf);
    }
    resume() {
        this.renderLoop();
    }
    reset() {
        this.resetAnswer();
        this.newProblem();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
    }
}
export const addition2dGame = {
    meta: {
        id: "addition2d",
        conceptId: "phys-02",
        title: "Add It Up",
        stream: "physics",
        gradeBand: "K-2",
        emoji: "➕",
        blurb: "Add two groups of objects and find the total.",
        mission: "Combine both groups and choose the correct total from the number pad.",
        estMinutes: 3,
    },
    create: (ctx) => new Addition2D(ctx),
};
