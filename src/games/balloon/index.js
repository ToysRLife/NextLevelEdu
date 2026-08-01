import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const BALLOON_RADIUS = 38;
const BALLOON_COLORS = ["#ff6b6b", "#4fb0c6", "#ffd93d", "#6bcf7f", "#a78bfa", "#ff8c42"];
const OPERATIONS = ["+", "-", "*", "/"];
const OPERATION_LABELS = {
    "+": "Addition",
    "-": "Subtraction",
    "*": "Multiplication",
    "/": "Division",
};
class ConfettiParticle {
    constructor(x, y, color) {
        Object.defineProperty(this, "x", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "vx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "vy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "life", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "decay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "size", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rotation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rotationSpeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "color", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 12;
        this.vy = (Math.random() - 0.5) * 12 - 3;
        this.decay = Math.random() * 0.02 + 0.01;
        this.size = Math.random() * 8 + 4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.25;
        this.color = color;
    }
    update() {
        this.vy += 0.35;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.life -= this.decay;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
    isDead() {
        return this.life <= 0;
    }
}
class SadParticle {
    constructor(x, y, color) {
        Object.defineProperty(this, "x", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "vx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "vy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "life", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "decay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.02
        });
        Object.defineProperty(this, "size", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "color", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "wobble", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = Math.random() * 3 + 2;
        this.size = Math.random() * 6 + 3;
        this.color = color;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update() {
        this.vy += 0.2;
        this.wobble += 0.1;
        this.x += this.vx + Math.sin(this.wobble);
        this.y += this.vy;
        this.life -= this.decay;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    isDead() {
        return this.life <= 0;
    }
}
class BalloonPop {
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
        Object.defineProperty(this, "scoreEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hitsEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "missesEl", {
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
        Object.defineProperty(this, "instructionEl", {
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
        Object.defineProperty(this, "startBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nextBtn", {
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
        Object.defineProperty(this, "opButtons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "raf", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "running", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "problemActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "currentOperation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "+"
        });
        Object.defineProperty(this, "score", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "correctClicks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "incorrectClicks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "balloons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "particles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "correctAnswer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "detachCanvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.scoreEl = el("span", { style: { color: "var(--accent-green)" } }, "0");
        this.hitsEl = el("span", { style: { color: "var(--accent-blue)" } }, "0");
        this.missesEl = el("span", { style: { color: "var(--accent-red)" } }, "0");
        this.problemEl = el("div", {
            class: "metric",
            style: {
                padding: "18px 16px",
                fontSize: "1.15rem",
                marginBottom: "12px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.96)",
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
            },
        });
        this.instructionEl = el("div", {
            class: "control-label",
            style: { marginTop: "4px", marginBottom: "12px", fontSize: "0.95rem" },
        }, "Tap the balloon with the correct answer before it floats away.");
        this.feedbackEl = el("div", { class: "feedback", style: { minHeight: "42px" } });
        this.startBtn = el("button", { class: "btn", onclick: () => this.start() }, "▶ Start");
        this.nextBtn = el("button", { class: "btn", style: { display: "none" }, onclick: () => this.nextProblem() }, "➡️ Next");
        this.resetBtn = el("button", { class: "btn secondary", onclick: () => this.resetGame() }, "Reset");
        this.buildPanel();
        this.attachCanvas();
        ctx.services.hints.setHints([
            "Pick the balloon with the right answer to complete the problem.",
            "Wrong balloons give you a chance to try again, but try to be quick.",
            "Use the operation buttons to practice different number facts.",
        ]);
        this.renderLoop();
    }
    attachCanvas() {
        const onClick = (event) => {
            if (!this.problemActive || !this.running)
                return;
            const rect = this.ctx.canvas.getBoundingClientRect();
            const scaleX = W / rect.width;
            const scaleY = H / rect.height;
            const mouseX = (event.clientX - rect.left) * scaleX;
            const mouseY = (event.clientY - rect.top) * scaleY;
            for (let i = this.balloons.length - 1; i >= 0; i -= 1) {
                const balloon = this.balloons[i];
                const dx = mouseX - balloon.x;
                const dy = mouseY - balloon.y;
                if (Math.sqrt(dx * dx + dy * dy) <= BALLOON_RADIUS) {
                    this.handleBalloonClick(balloon);
                    break;
                }
            }
        };
        this.ctx.canvas.addEventListener("click", onClick);
        this.detachCanvas = () => this.ctx.canvas.removeEventListener("click", onClick);
    }
    buildPanel() {
        const operationRow = el("div", { class: "chip-row", style: { gap: "10px", marginTop: "12px", marginBottom: "12px" } }, ...OPERATIONS.map((op) => {
            const button = el("button", {
                class: `chip${op === this.currentOperation ? " active" : ""}`,
                onclick: () => this.selectOperation(op),
            }, OPERATION_LABELS[op]);
            this.opButtons.push(button);
            return button;
        }));
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", {
            style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "10px",
            },
        }, el("div", { style: { fontSize: "1.2rem", fontWeight: 900 } }, "🎈 Balloon Pop"), el("div", { class: "metric", style: { flex: "0 0 auto", padding: "10px 14px", margin: 0 } }, el("span", {}, "Score"), this.scoreEl)), this.problemEl, this.instructionEl, el("div", { class: "control-label" }, "Operation"), operationRow, el("div", { class: "metric" }, el("span", {}, "✅ Correct"), this.hitsEl), el("div", { class: "metric" }, el("span", {}, "❌ Wrong"), this.missesEl), el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" } }, this.startBtn, this.nextBtn, this.resetBtn), this.feedbackEl);
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.score = 0;
        this.correctClicks = 0;
        this.incorrectClicks = 0;
        this.updateStats();
        this.generateProblem();
        this.startBtn.style.display = "none";
        this.nextBtn.style.display = "none";
    }
    selectOperation(operation) {
        this.currentOperation = operation;
        this.opButtons.forEach((button, index) => {
            button.className = `chip${OPERATIONS[index] === operation ? " active" : ""}`;
        });
        if (this.running) {
            this.generateProblem();
        }
        this.updateProblemText();
    }
    updateProblemText() {
        const sample = this.sampleProblem();
        this.problemEl.textContent = sample;
    }
    sampleProblem() {
        if (this.currentOperation === "+")
            return "8 + 3";
        if (this.currentOperation === "-")
            return "12 - 4";
        if (this.currentOperation === "*")
            return "5 × 6";
        return "24 ÷ 6";
    }
    nextProblem() {
        this.generateProblem();
    }
    resetGame() {
        this.running = false;
        this.problemActive = false;
        this.balloons = [];
        this.particles = [];
        this.score = 0;
        this.correctClicks = 0;
        this.incorrectClicks = 0;
        this.feedbackEl.textContent = "";
        this.feedbackEl.className = "feedback";
        this.startBtn.style.display = "block";
        this.nextBtn.style.display = "none";
        this.updateStats();
        this.updateProblemText();
    }
    generateProblem() {
        this.feedbackEl.textContent = "";
        this.feedbackEl.className = "feedback";
        let a;
        let b;
        let text;
        if (this.currentOperation === "+") {
            a = Math.floor(Math.random() * 8) + 1;
            b = Math.floor(Math.random() * 8) + 1;
            this.correctAnswer = a + b;
            text = `${a} + ${b}`;
        }
        else if (this.currentOperation === "-") {
            a = Math.floor(Math.random() * 12) + 1;
            b = Math.floor(Math.random() * (a + 1));
            this.correctAnswer = a - b;
            text = `${a} - ${b}`;
        }
        else if (this.currentOperation === "*") {
            a = Math.floor(Math.random() * 9) + 1;
            b = Math.floor(Math.random() * 9) + 1;
            this.correctAnswer = a * b;
            text = `${a} × ${b}`;
        }
        else {
            b = Math.floor(Math.random() * 8) + 1;
            const quotient = Math.floor(Math.random() * 9) + 1;
            a = quotient * b;
            this.correctAnswer = quotient;
            text = `${a} ÷ ${b}`;
        }
        this.renderProblemCard(text, this.correctAnswer);
        this.instructionEl.textContent = "Tap the balloon with the correct answer.";
        this.spawnBalloons();
        this.problemActive = true;
        this.nextBtn.style.display = "none";
    }
    renderProblemCard(problem, findValue) {
        clear(this.problemEl);
        this.problemEl.append(el("div", { style: { fontWeight: 900, marginBottom: "8px" } }, problem), el("div", { style: { fontWeight: 400, fontSize: "0.95rem", color: "var(--text-muted)" } }, `Find: ${findValue}`));
    }
    spawnBalloons() {
        this.balloons = [];
        const answers = [this.correctAnswer];
        while (answers.length < 4) {
            const wrongAnswer = Math.floor(Math.random() * 20) + 1;
            if (!answers.includes(wrongAnswer))
                answers.push(wrongAnswer);
        }
        for (let i = answers.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }
        const X_POSITIONS = [120, 280, 440, 600];
        const colorIndices = [...BALLOON_COLORS.keys()];
        for (let i = colorIndices.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [colorIndices[i], colorIndices[j]] = [colorIndices[j], colorIndices[i]];
        }
        this.balloons = answers.map((answer, idx) => ({
            x: X_POSITIONS[idx],
            y: H + 120,
            vx: (Math.random() - 0.5) * 0.4,
            speed: 1 + Math.random() * 0.25,
            answer,
            isCorrect: answer === this.correctAnswer,
            color: BALLOON_COLORS[colorIndices[idx] % BALLOON_COLORS.length],
            popping: false,
            popTime: 0,
        }));
    }
    handleBalloonClick(balloon) {
        balloon.popping = true;
        if (balloon.isCorrect) {
            this.score += 10;
            this.correctClicks += 1;
            this.feedbackEl.className = "feedback correct";
            this.feedbackEl.textContent = `Great! ${balloon.answer} is correct.`;
            this.ctx.services.audio.play("reward");
            this.ctx.services.outcome.succeed({
                message: `Nice pop! ${balloon.answer} is correct.`,
                stars: 3,
                resources: { Power: 20 },
            });
            this.spawnParticles(balloon.x, balloon.y, true);
            this.problemActive = false;
            this.nextBtn.style.display = "block";
        }
        else {
            this.incorrectClicks += 1;
            this.feedbackEl.className = "feedback incorrect";
            this.feedbackEl.textContent = `${balloon.answer} is not right. Try again.`;
            this.ctx.services.audio.play("fail");
            this.spawnParticles(balloon.x, balloon.y, false);
        }
        this.updateStats();
    }
    spawnParticles(x, y, success) {
        const count = success ? 16 : 8;
        for (let i = 0; i < count; i += 1) {
            if (success) {
                this.particles.push(new ConfettiParticle(x, y, BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)]));
            }
            else {
                this.particles.push(new SadParticle(x, y, "#777"));
            }
        }
    }
    updateStats() {
        this.scoreEl.textContent = String(this.score);
        this.hitsEl.textContent = String(this.correctClicks);
        this.missesEl.textContent = String(this.incorrectClicks);
    }
    renderLoop() {
        const tick = () => {
            this.render();
            this.raf = requestAnimationFrame(tick);
        };
        tick();
    }
    render() {
        const c = this.ctx2d;
        c.fillStyle = "#e8f4f8";
        c.fillRect(0, 0, W, H);
        this.drawSky(c);
        for (let i = this.balloons.length - 1; i >= 0; i -= 1) {
            const balloon = this.balloons[i];
            this.drawBalloon(c, balloon);
            this.updateBalloon(balloon, i);
        }
        for (let i = this.particles.length - 1; i >= 0; i -= 1) {
            const particle = this.particles[i];
            particle.update();
            particle.draw(c);
            if (particle.isDead())
                this.particles.splice(i, 1);
        }
    }
    drawSky(c) {
        c.fillStyle = "rgba(255,255,255,0.35)";
        for (let i = 0; i < 3; i += 1) {
            const offset = ((Date.now() / 200 + i * 250) % (W + 100)) - 50;
            c.beginPath();
            c.ellipse(offset, 50 + i * 100, 70, 25, 0, 0, Math.PI * 2);
            c.fill();
        }
    }
    drawBalloon(c, balloon) {
        if (balloon.popping) {
            const progress = balloon.popTime / 0.3;
            const radius = BALLOON_RADIUS * (1 - progress);
            c.save();
            c.globalAlpha = Math.max(0, 1 - progress);
            c.fillStyle = balloon.color;
            c.beginPath();
            c.arc(balloon.x, balloon.y, radius, 0, Math.PI * 2);
            c.fill();
            c.restore();
            return;
        }
        c.save();
        c.translate(balloon.x, balloon.y);
        c.fillStyle = balloon.color;
        c.beginPath();
        c.arc(0, 0, BALLOON_RADIUS, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `${balloon.color}99`;
        c.beginPath();
        c.arc(-12, -14, 12, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#333";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, BALLOON_RADIUS);
        c.lineTo(0, BALLOON_RADIUS + 22);
        c.stroke();
        c.fillStyle = "#fff";
        c.font = "bold 24px Arial";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(String(balloon.answer), 0, 0);
        c.restore();
    }
    updateBalloon(balloon, index) {
        if (balloon.popping) {
            balloon.popTime += 0.016;
            if (balloon.popTime >= 0.3)
                this.balloons.splice(index, 1);
            return;
        }
        balloon.y -= balloon.speed;
        balloon.x += balloon.vx;
        if (balloon.x < -BALLOON_RADIUS)
            balloon.x = W + BALLOON_RADIUS;
        if (balloon.x > W + BALLOON_RADIUS)
            balloon.x = -BALLOON_RADIUS;
        if (!balloon.popping && balloon.y < -BALLOON_RADIUS) {
            if (balloon.isCorrect) {
                this.incorrectClicks += 1;
                this.feedbackEl.className = "feedback incorrect";
                this.feedbackEl.textContent = "Missed the correct balloon. Try again.";
                this.updateStats();
            }
            this.balloons.splice(index, 1);
            if (balloon.isCorrect) {
                this.problemActive = false;
                this.nextBtn.style.display = "block";
            }
        }
    }
    pause() {
        cancelAnimationFrame(this.raf);
    }
    resume() {
        this.renderLoop();
    }
    reset() {
        this.ctx.services.hints.reset();
        this.start();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detachCanvas?.();
    }
}
export const balloonGame = {
    meta: {
        id: "balloon",
        conceptId: "phys-02",
        title: "Balloon Pop",
        stream: "physics",
        gradeBand: "K-2",
        emoji: "🎈",
        blurb: "Tap the balloon with the correct answer to solve the math problem.",
        mission: "Pop the right balloon before it floats away.",
        estMinutes: 3,
    },
    create: (ctx) => new BalloonPop(ctx),
};
