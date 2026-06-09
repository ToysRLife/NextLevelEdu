// js/physicsLab.js
window.physicsLab = {
    isRunning: false, level: 1,
    planet: { x: 400, y: 300, radius: 45, gm: 3500 },
    moon: { x: 700, y: 300, radius: 25, gm: 150 }, 
    sun: { x: -100, y: 300, radius: 80 },
    sat: { x: 400, y: 150, vx: 5.0, vy: 0, angle: 0, path: [] },
    state: 'setup', frames: 0,
    assets: { earth: new Image(), moon: new Image(), rocket: new Image() },

    init: function() {
        this.canvas = document.getElementById('canvas-physics');
        this.ctx = this.canvas.getContext('2d');
        
        // Ensure the canvas knows its own drawing resolution
        this.canvas.width = 1200;
        this.canvas.height = 600;
        // Pre-load assets
        this.assets.earth.src = 'assets/earth.png';
        this.assets.moon.src = 'assets/moon.png';
        this.assets.rocket.src = 'assets/rocket.png';

        document.getElementById('phys-alt').addEventListener('input', (e) => this.setParams(e.target.value, document.getElementById('phys-vel').value));
        document.getElementById('phys-vel').addEventListener('input', (e) => this.setParams(document.getElementById('phys-alt').value, e.target.value));
        this.setLevel(1);
    },

    setLevel: function(lvl) {
        this.level = lvl;
        document.querySelectorAll('.phys-mission').forEach(b => b.classList.remove('active'));
        document.getElementById('btn-lvl' + lvl).classList.add('active');
        this.reset();
    },

    setParams: function(alt, vel) {
        if (this.state !== 'setup') return;
        this.sat.x = this.planet.x; this.sat.y = this.planet.y - parseFloat(alt);
        this.sat.vx = parseFloat(vel); this.sat.vy = 0;
        
        document.getElementById('label-alt-val').innerText = alt + ' km';
        document.getElementById('label-vel-val').innerText = parseFloat(vel).toFixed(2) + ' km/s';
        document.getElementById('phys-metric-alt').innerText = alt + ' km';
        document.getElementById('phys-metric-vel').innerText = vel + ' km/s';
        this.render();
    },

    launch: function() {
        this.state = 'flying'; this.sat.path = []; this.frames = 0;
        document.getElementById('phys-launch').style.display = 'none';
        document.getElementById('phys-reset').style.display = 'block';
        this.isRunning = true; this.tick();
    },

    reset: function() {
        this.isRunning = false; this.state = 'setup'; this.sat.path = []; this.frames = 0;
        document.getElementById('phys-launch').style.display = 'block';
        document.getElementById('phys-reset').style.display = 'none';
        
        // Update Briefing
        const brief = document.getElementById('phys-insight');
        if (this.level === 1) brief.innerHTML = "<strong>Objective:</strong> Circular Orbit at 150km. <em>Hint: v ≈ 4.8 km/s</em>";
        else if (this.level === 2) brief.innerHTML = "<strong>Objective:</strong> Sync at 200km. <em>Hint: Precision is key.</em>";
        else brief.innerHTML = "<strong>Objective:</strong> Lunar Transfer. <em>Hint: Aim for Moon's path.</em>";
        
        this.setParams(document.getElementById('phys-alt').value, document.getElementById('phys-vel').value);
    },

    tick: function() {
        if (!this.isRunning) return;

        // 1. Physics Calculations
        let dx = this.planet.x - this.sat.x; 
        let dy = this.planet.y - this.sat.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        // Gravity update
        this.sat.vx += (this.planet.gm * dx / Math.pow(dist, 3));
        this.sat.vy += (this.planet.gm * dy / Math.pow(dist, 3));
        this.sat.x += this.sat.vx; 
        this.sat.y += this.sat.vy;
        this.sat.angle = Math.atan2(this.sat.vy, this.sat.vx);

        // 2. LIVE TELEMETRY UPDATE
        // We only update every 5 frames to keep the text readable
        if (this.frames % 5 === 0) {
            let currentVel = Math.sqrt(this.sat.vx**2 + this.sat.vy**2);
            let gForce = (this.planet.gm / Math.pow(dist, 2)) / 100; // Scaled for display

            document.getElementById('phys-metric-alt').innerText = Math.round(dist) + ' km';
            document.getElementById('phys-metric-vel').innerText = currentVel.toFixed(2) + ' km/s';
            document.getElementById('phys-metric-g').innerText = gForce.toFixed(2) + ' G';
        }

        // 3. Logic & State management
        this.sat.path.push({x: this.sat.x, y: this.sat.y});
        if (this.sat.path.length > 2000) this.sat.path.shift();
        this.frames++;

        // Win/Loss conditions
        if (dist < this.planet.radius) this.state = 'crashed';
        else if (this.level === 3 && Math.sqrt(Math.pow(this.moon.x-this.sat.x,2)+Math.pow(this.moon.y-this.sat.y,2)) < 30) this.state = 'lunar_capture';
        else if (this.frames > 2000) {
             if (this.level === 1 && Math.abs(dist - 150) < 20) this.state = 'orbit_success';
             else if (this.level === 2 && Math.abs(dist - 200) < 15) this.state = 'geo_success';
             else this.state = 'failed';
        }

        this.render();
        if (this.state === 'flying') requestAnimationFrame(() => this.tick());
        else this.endMission();
    },

    endMission: function() {
        this.isRunning = false;
        const brief = document.getElementById('phys-insight');
        if (this.state === 'crashed') brief.innerHTML = "💥 <strong>CRASHED!</strong> Impact detected.";
        else if (this.state === 'failed') brief.innerHTML = "⚠️ <strong>FAILED:</strong> Orbit unstable.";
        else brief.innerHTML = "🎉 <strong>SUCCESS:</strong> Mission Accomplished!";
        
        document.getElementById('phys-launch').style.display = 'block';
        document.getElementById('phys-reset').style.display = 'none';
    },

    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#a9b4f6'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save(); this.ctx.scale(0.7, 0.7); this.ctx.translate(250, 150);

        // Sun
        let grad = this.ctx.createRadialGradient(this.sun.x, this.sun.y, 20, this.sun.x, this.sun.y, 100);
        grad.addColorStop(0, '#fbbf24'); grad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = grad; this.ctx.beginPath(); this.ctx.arc(this.sun.x, this.sun.y, 100, 0, Math.PI*2); this.ctx.fill();

        // Bodies
        if (this.assets.earth.complete) this.ctx.drawImage(this.assets.earth, this.planet.x - 45, this.planet.y - 45, 90, 90);
        if (this.level === 3 && this.assets.moon.complete) this.ctx.drawImage(this.assets.moon, this.moon.x - 25, this.moon.y - 25, 50, 50);

        // Trail
        this.ctx.beginPath(); this.ctx.strokeStyle = '#fbbf24'; this.ctx.lineWidth = 3;
        for(let p of this.sat.path) this.ctx.lineTo(p.x, p.y);
        this.ctx.stroke();

        // Rocket
        this.ctx.save();
        this.ctx.translate(this.sat.x, this.sat.y);
        this.ctx.rotate(this.sat.angle + Math.PI/2);
        if (this.assets.rocket.complete) this.ctx.drawImage(this.assets.rocket, -15, -15, 30, 30);
        else { this.ctx.fillStyle = '#fff'; this.ctx.fillRect(-8,-4,16,8); }
        this.ctx.restore();
        
        this.ctx.restore();
    }
};