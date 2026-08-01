// Tiny canvas charting for the 5–8 "predict → run → reveal" games: a line plot
// (e.g. velocity vs time) and a bar group (e.g. kinetic vs potential energy).
// Stateless drawing helpers — a game calls them inside its own render() onto its
// own canvas region. No dependencies; nothing to host beyond the static bundle.
const AXIS = "#94a3b8";
const INK = "#334155";
export function drawLineGraph(c, x, y, w, h, o) {
    const padL = 34;
    const padB = 22;
    const padT = o.title ? 20 : 8;
    const gx = x + padL;
    const gy = y + padT;
    const gw = w - padL - 8;
    const gh = h - padT - padB;
    // panel
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(x, y, w, h);
    c.strokeStyle = "rgba(148,163,184,0.4)";
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (o.title) {
        c.fillStyle = INK;
        c.font = "bold 12px Nunito, sans-serif";
        c.textAlign = "left";
        c.fillText(o.title, x + 8, y + 14);
    }
    const sx = (v) => gx + (v / o.xMax) * gw;
    const sy = (v) => gy + gh - (v / o.yMax) * gh;
    // target band
    if (o.band) {
        c.fillStyle = "rgba(34,197,94,0.18)";
        const yHi = sy(Math.min(o.band.hi, o.yMax));
        const yLo = sy(Math.min(o.band.lo, o.yMax));
        c.fillRect(gx, yHi, gw, yLo - yHi);
    }
    // axes
    c.strokeStyle = AXIS;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(gx, gy);
    c.lineTo(gx, gy + gh);
    c.lineTo(gx + gw, gy + gh);
    c.stroke();
    // axis labels
    c.fillStyle = INK;
    c.font = "10px Nunito, sans-serif";
    c.textAlign = "right";
    c.fillText(String(o.yMax), gx - 4, gy + 8);
    c.fillText("0", gx - 4, gy + gh);
    c.textAlign = "center";
    if (o.xLabel)
        c.fillText(o.xLabel, gx + gw / 2, y + h - 4);
    if (o.yLabel) {
        c.save();
        c.translate(x + 10, gy + gh / 2);
        c.rotate(-Math.PI / 2);
        c.fillText(o.yLabel, 0, 0);
        c.restore();
    }
    // series
    if (o.points.length) {
        c.strokeStyle = o.color ?? "#7c3aed";
        c.lineWidth = 2.5;
        c.beginPath();
        o.points.forEach(([px, py], i) => {
            const X = sx(Math.min(px, o.xMax));
            const Y = sy(Math.min(py, o.yMax));
            if (i === 0)
                c.moveTo(X, Y);
            else
                c.lineTo(X, Y);
        });
        c.stroke();
        // head dot
        const [lx, ly] = o.points[o.points.length - 1];
        c.fillStyle = o.color ?? "#7c3aed";
        c.beginPath();
        c.arc(sx(Math.min(lx, o.xMax)), sy(Math.min(ly, o.yMax)), 3.5, 0, Math.PI * 2);
        c.fill();
    }
}
/** Vertical bar group, e.g. Kinetic / Potential / Total energy. */
export function drawBars(c, x, y, w, h, bars, max, title) {
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(x, y, w, h);
    c.strokeStyle = "rgba(148,163,184,0.4)";
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const padT = title ? 22 : 10;
    const padB = 20;
    if (title) {
        c.fillStyle = INK;
        c.font = "bold 12px Nunito, sans-serif";
        c.textAlign = "left";
        c.fillText(title, x + 8, y + 15);
    }
    const gh = h - padT - padB;
    const baseY = y + padT + gh;
    const slot = w / bars.length;
    const bw = Math.min(46, slot * 0.55);
    bars.forEach((b, i) => {
        const cx = x + slot * (i + 0.5);
        const bh = Math.max(0, Math.min(1, b.value / max)) * gh;
        c.fillStyle = b.color;
        c.fillRect(cx - bw / 2, baseY - bh, bw, bh);
        c.fillStyle = INK;
        c.font = "bold 11px Nunito, sans-serif";
        c.textAlign = "center";
        c.fillText(b.label, cx, y + h - 6);
        c.font = "10px Nunito, sans-serif";
        c.fillText(String(Math.round(b.value)), cx, baseY - bh - 4);
    });
}
