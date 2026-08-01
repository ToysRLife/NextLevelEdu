import { fitCanvas } from "@core/canvas";
import { clear, el } from "@core/dom";
const W = 800;
const H = 600;
const MAX_ROUNDS = 5;
const MAX_MISSES = 5;
const OPERATIONS = [
    { key: "+", label: "Addition", symbol: "+" },
    { key: "-", label: "Subtraction", symbol: "-" },
    { key: "*", label: "Multiplication", symbol: "×" },
    { key: "/", label: "Division", symbol: "÷" },
];
const COLORS = ["#00aacc", "#ff6b6b", "#ffd93d", "#6bcf7f", "#a78bfa", "#ff8c42"];
class Shooting {
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
        Object.defineProperty(this, "rounds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "actionKeys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "airplanes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "bullets", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "detachKeyboard", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
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
        Object.defineProperty(this, "gunX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: W / 2
        });
        this.ctx2d = fitCanvas(ctx.canvas, W, H);
        this.scoreEl = el("span", { style: { color: "var(--accent-green)" } }, "0");
        this.hitsEl = el("span", { style: { color: "var(--accent-orange)" } }, "0");
        this.missesEl = el("span", { style: { color: "var(--accent-red)" } }, "0");
        this.problemEl = el("div", { class: "metric", style: { fontSize: "1.25rem", padding: "16px" } }, "Ready to start");
        this.feedbackEl = el("div", { class: "feedback" });
        this.startBtn = el("button", { class: "btn", onclick: () => this.start() }, "▶ Start");
        this.nextBtn = el("button", { class: "btn", style: { display: "none" }, onclick: () => this.nextProblem() }, "➡️ Next Problem");
        this.resetBtn = el("button", { class: "btn", onclick: () => this.reset() }, "Reset");
        this.buildPanel();
        this.attachKeyboard();
        ctx.services.hints.setHints([
            "Pick the operation and shoot the plane with the right answer.",
            "Move left and right with the arrow keys, then press up to fire.",
            "Each round has one correct airplane — hit it before the planes escape.",
        ]);
        this.renderLoop();
    }
    attachKeyboard() {
        const down = (e) => {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                if (this.running && this.problemActive)
                    this.fireBullet();
            }
            this.actionKeys[e.key] = true;
        };
        const up = (e) => {
            this.actionKeys[e.key] = false;
        };
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        this.detachKeyboard = () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }
    buildPanel() {
        this.opButtons.length = 0;
        const operationRow = el("div", { class: "chip-row", style: { flexWrap: "wrap", gap: "8px", marginBottom: "12px" } }, ...OPERATIONS.map((op) => {
            const button = el("button", {
                class: `chip${op.key === this.currentOperation ? " active" : ""}`,
                onclick: () => this.selectOperation(op.key),
            }, op.label);
            this.opButtons.push(button);
            return button;
        }));
        clear(this.ctx.panel);
        this.ctx.panel.append(el("div", {
            class: "metric",
            style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
        }, el("span", {}, "🎯 Problem"), this.problemEl), el("div", { class: "control-label" }, "Select operation"), operationRow, el("div", { class: "metric" }, el("span", {}, "💥 Score"), this.scoreEl), el("div", { class: "metric" }, el("span", {}, "🎯 Hits"), this.hitsEl), el("div", { class: "metric" }, el("span", {}, "❌ Misses"), this.missesEl), el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" } }, this.startBtn, this.nextBtn, this.resetBtn), this.feedbackEl);
        this.updateProblemPreview();
        this.updateStats();
    }
    selectOperation(operation) {
        this.currentOperation = operation;
        this.opButtons.forEach((button, idx) => {
            button.classList.toggle("active", OPERATIONS[idx].key === operation);
        });
        if (this.running) {
            this.generateProblem();
        }
        else {
            this.updateProblemPreview();
        }
    }
    updateProblemPreview() {
        const sample = this.sampleProblem();
        this.problemEl.textContent = sample.text;
    }
    sampleProblem() {
        if (this.currentOperation === "+")
            return { text: "8 + 3" };
        if (this.currentOperation === "-")
            return { text: "12 - 5" };
        if (this.currentOperation === "*")
            return { text: "7 × 6" };
        return { text: "24 ÷ 6" };
    }
    generateProblem() {
        this.problemActive = true;
        this.rounds += 1;
        this.feedbackEl.className = "feedback";
        this.feedbackEl.textContent = "";
        const problem = this.makeProblem();
        this.problemEl.textContent = problem.text;
        const answers = [problem.answer];
        while (answers.length < 4) {
            const wrong = this.makeWrongAnswer(problem.answer);
            if (!answers.includes(wrong))
                answers.push(wrong);
        }
        for (let i = answers.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }
        const xPositions = [100, 250, 400, 550];
        this.airplanes = answers.map((answer, index) => ({
            x: xPositions[index],
            y: -60,
            width: 80,
            height: 48,
            answer,
            isCorrect: answer === problem.answer,
            color: COLORS[index % COLORS.length],
            vx: (Math.random() - 0.5) * 0.8,
        }));
        this.bullets = [];
        this.startBtn.style.display = "none";
        this.nextBtn.style.display = "none";
    }
    makeProblem() {
        let a;
        let b;
        let answer;
        let text;
        if (this.currentOperation === "+") {
            a = Math.floor(Math.random() * 8) + 1;
            b = Math.floor(Math.random() * 8) + 1;
            answer = a + b;
            text = `${a} + ${b}`;
        }
        else if (this.currentOperation === "-") {
            a = Math.floor(Math.random() * 12) + 2;
            b = Math.floor(Math.random() * (a - 1)) + 1;
            answer = a - b;
            text = `${a} - ${b}`;
        }
        else if (this.currentOperation === "*") {
            a = Math.floor(Math.random() * 8) + 2;
            b = Math.floor(Math.random() * 8) + 2;
            answer = a * b;
            text = `${a} × ${b}`;
        }
        else {
            b = Math.floor(Math.random() * 8) + 2;
            answer = Math.floor(Math.random() * 8) + 2;
            a = answer * b;
            text = `${a} ÷ ${b}`;
        }
        return { a, b, answer, text };
    }
    makeWrongAnswer(correct) {
        const delta = Math.max(1, Math.round(Math.abs(correct) * 0.3));
        let wrong = correct + (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * delta) + 1);
        if (wrong <= 0)
            wrong = correct + delta + 1;
        return wrong;
    }
    fireBullet() {
        this.bullets.push({ x: this.gunX, y: H - 85, width: 12, height: 18, speed: 12 });
    }
    updateGame() {
        if (!this.running || !this.problemActive)
            return;
        const moveSpeed = 15;
        let isMoving = false;
        if (this.actionKeys["ArrowLeft"]) {
            this.gunX = Math.max(40, this.gunX - moveSpeed);
            isMoving = true;
        }
        if (this.actionKeys["ArrowRight"]) {
            this.gunX = Math.min(W - 40, this.gunX + moveSpeed);
            isMoving = true;
        }
        this.ctx.canvas.style.cursor = isMoving ? "grabbing" : "default";
        for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
            const bullet = this.bullets[i];
            bullet.y -= bullet.speed;
            if (bullet.y + bullet.height < 0)
                this.bullets.splice(i, 1);
        }
        for (let i = this.airplanes.length - 1; i >= 0; i -= 1) {
            const plane = this.airplanes[i];
            plane.y += 1;
            plane.x += plane.vx;
            if (plane.x < 20)
                plane.x = 20;
            if (plane.x > W - plane.width - 20)
                plane.x = W - plane.width - 20;
            for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
                const bullet = this.bullets[j];
                const bulletLeft = bullet.x - bullet.width / 2;
                const bulletRight = bulletLeft + bullet.width;
                if (bulletRight >= plane.x &&
                    bulletLeft <= plane.x + plane.width &&
                    bullet.y >= plane.y &&
                    bullet.y <= plane.y + plane.height) {
                    this.bullets.splice(j, 1);
                    this.handleHit(plane);
                    this.airplanes.splice(i, 1);
                    break;
                }
            }
            if (plane.y > H) {
                this.handleEscape(plane);
                this.airplanes.splice(i, 1);
            }
        }
    }
    handleHit(plane) {
        if (!plane.isCorrect) {
            this.misses += 1;
            this.feedbackEl.className = "feedback incorrect";
            this.feedbackEl.textContent = "✗ Wrong plane!";
            this.ctx.services.audio.play("fail");
        }
        else {
            this.score += 10;
            this.hits += 1;
            this.feedbackEl.className = "feedback correct";
            this.feedbackEl.textContent = "✓ Correct hit! +10 points.";
            this.ctx.services.audio.play("tick");
        }
        this.updateStats();
        this.problemActive = false;
        this.nextBtn.style.display = "inline-flex";
        if (this.hits >= MAX_ROUNDS || this.misses >= MAX_MISSES) {
            this.endGame();
        }
    }
    handleEscape(plane) {
        if (plane.isCorrect) {
            this.misses += 1;
            this.feedbackEl.className = "feedback incorrect";
            this.feedbackEl.textContent = "✗ You missed the correct plane.";
            this.ctx.services.audio.play("fail");
        }
        else {
            this.feedbackEl.className = "feedback";
            this.feedbackEl.textContent = "";
        }
        this.updateStats();
        this.problemActive = false;
        this.nextBtn.style.display = "inline-flex";
        if (this.misses >= MAX_MISSES) {
            this.endGame();
        }
    }
    nextProblem() {
        if (!this.running)
            return;
        this.generateProblem();
    }
    endGame() {
        this.running = false;
        this.nextBtn.style.display = "none";
        this.startBtn.style.display = "none";
        if (this.hits >= MAX_ROUNDS) {
            const stars = this.hits >= 5 ? 3 : this.hits >= 4 ? 2 : 1;
            this.ctx.services.outcome.succeed({
                message: `All done! You shot ${this.hits} correct planes and learned to solve problems fast.`,
                stars,
                resources: { Knowledge: 30 },
            });
        }
        else {
            this.ctx.services.outcome.fail({
                message: `Game over — the correct planes escaped. Try again to beat your score.`,
                stars: 1,
                score: this.score,
            });
        }
    }
    updateStats() {
        this.scoreEl.textContent = String(this.score);
        this.hitsEl.textContent = String(this.hits);
        this.missesEl.textContent = String(this.misses);
    }
    renderLoop() {
        const step = () => {
            this.anim += 0.03;
            this.updateGame();
            this.render();
            this.raf = requestAnimationFrame(step);
        };
        step();
    }
    render() {
        const c = this.ctx2d;
        c.clearRect(0, 0, W, H);
        c.fillStyle = "#bce7ff";
        c.fillRect(0, 0, W, H);
        // sky and clouds
        for (let i = 0; i < 4; i += 1) {
            const cloudX = ((this.anim * 40 + i * 180) % (W + 150)) - 80;
            c.fillStyle = "rgba(255,255,255,0.9)";
            c.beginPath();
            c.ellipse(cloudX, 100 + i * 40, 50, 24, 0, 0, Math.PI * 2);
            c.ellipse(cloudX + 40, 100 + i * 40, 38, 18, 0, 0, Math.PI * 2);
            c.ellipse(cloudX - 40, 100 + i * 40, 38, 18, 0, 0, Math.PI * 2);
            c.fill();
        }
        c.strokeStyle = "rgba(255,255,255,0.35)";
        c.lineWidth = 1;
        for (let y = 0; y <= H; y += 80) {
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(W, y);
            c.stroke();
        }
        for (const plane of this.airplanes) {
            c.save();
            c.fillStyle = plane.color;
            c.fillRect(plane.x, plane.y, plane.width, plane.height);
            c.fillStyle = plane.color;
            c.fillRect(plane.x - 12, plane.y + 18, 12, 8);
            c.fillRect(plane.x + plane.width, plane.y + 18, 12, 8);
            c.fillStyle = "#1f2937";
            c.fillRect(plane.x + 12, plane.y + 8, 12, 10);
            c.fillStyle = "#fff";
            c.font = "bold 20px sans-serif";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(String(plane.answer), plane.x + plane.width / 2, plane.y + plane.height / 2);
            c.restore();
        }
        for (const bullet of this.bullets) {
            c.fillStyle = "#ff7a59";
            c.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
        }
        this.drawGun(c);
        if (!this.running) {
            c.fillStyle = "rgba(0, 0, 0, 0.5)";
            c.fillRect(0, 0, W, H);
            c.fillStyle = "white";
            c.font = "bold 28px sans-serif";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText("Press Start and shoot the correct airplane!", W / 2, H / 2);
        }
    }
    drawGun(c) {
        c.save();
        c.fillStyle = "#111827";
        c.fillRect(this.gunX - 16, H - 80, 32, 50);
        c.fillStyle = "#374151";
        c.fillRect(this.gunX - 6, H - 110, 12, 40);
        c.fillStyle = "#111827";
        c.beginPath();
        c.arc(this.gunX - 10, H - 30, 6, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(this.gunX + 10, H - 30, 6, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.startBtn.style.display = "none";
        this.nextBtn.style.display = "none";
        this.generateProblem();
    }
    pause() {
        this.running = false;
    }
    resume() {
        if (this.running)
            return;
        this.running = true;
    }
    reset() {
        this.running = false;
        this.problemActive = false;
        this.score = 0;
        this.hits = 0;
        this.misses = 0;
        this.rounds = 0;
        this.airplanes = [];
        this.bullets = [];
        this.startBtn.style.display = "inline-flex";
        this.nextBtn.style.display = "none";
        this.feedbackEl.className = "feedback";
        this.feedbackEl.textContent = "";
        this.updateStats();
        this.updateProblemPreview();
        this.buildPanel();
        this.ctx.services.hints.reset();
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.detachKeyboard?.();
    }
}
export const shootingGame = {
    meta: {
        id: "shooting",
        conceptId: "phys-02",
        title: "Airplane Shooter",
        stream: "physics",
        gradeBand: "3-5",
        emoji: "✈️",
        blurb: "Shoot the plane with the correct answer before it flies away.",
        mission: "Solve the problem and hit the matching airplane to score points.",
        estMinutes: 3,
    },
    create: (ctx) => new Shooting(ctx),
};
