// js/bioLab.js
window.bioLab = {
    isRunning: false,
    canvas: null,
    ctx: null,
    particles: [],
    
    // Updated background colors to complement the bright particles
    weatherProfiles: {
        spring:   { temp: 22, humidity: 0.60, sunlight: 0.80, bg: '#1e1b4b', name: 'Spring' }, // Deep Indigo
        heatwave: { temp: 42, humidity: 0.10, sunlight: 1.00, bg: '#450a0a', name: 'Heatwave' }, // Deep Red/Brown
        monsoon:  { temp: 26, humidity: 0.95, sunlight: 0.20, bg: '#0f172a', name: 'Monsoon' },  // Deep Slate
        night:    { temp: 15, humidity: 0.70, sunlight: 0.00, bg: '#020617', name: 'Night' }     // Pitch Black
    },
    
    env: null,
    state: { waterLevel: 100.0, storedCO2: 0.0, glucose: 0.0, stomataAperture: 0.5 },
    
    init: function() {
        this.canvas = document.getElementById('canvas-bio');
        this.ctx = this.canvas.getContext('2d');
        
        document.getElementById('bio-slider').addEventListener('input', (e) => { 
            this.state.stomataAperture = e.target.value / 100;
            this.updateDashboardText(); 
        });

        this.setWeather('spring');
    },

    reset: function() {
        this.state = { waterLevel: 100.0, storedCO2: 0.0, glucose: 0.0, stomataAperture: document.getElementById('bio-slider').value / 100 };
        this.particles = [];
        document.getElementById('bio-reset').style.display = 'none';
        document.getElementById('bio-slider').disabled = false;
        this.updateDashboardText();
        this.resume();
    },
    
    setWeather: function(key) {
        this.env = this.weatherProfiles[key];
        document.querySelectorAll('.btn-weather.bio-weather').forEach(b => b.classList.remove('active'));
        document.getElementById('btn-' + key).classList.add('active');
        document.getElementById('bio-canvas-bg').style.backgroundColor = this.env.bg;
        this.updateDashboardText();
    },
    
    resume: function() { if(!this.isRunning) { this.isRunning = true; this.tick(); } },
    pause: function() { this.isRunning = false; },

    updateDashboardText: function() {
        document.getElementById('bio-h2o').innerText = this.state.waterLevel.toFixed(1) + '%';
        document.getElementById('bio-glucose').innerText = this.state.glucose.toFixed(1) + '%';
        
        document.getElementById('bio-readout-temp').innerText = `${this.env.temp}°C`;
        document.getElementById('bio-readout-hum').innerText = `${Math.round(this.env.humidity * 100)}% Hum`;
        document.getElementById('bio-readout-sun').innerText = `${Math.round(this.env.sunlight * 100)}% Sun`;

        const insightBox = document.getElementById('bio-insight');
        let ap = this.state.stomataAperture;

        if (this.env.name === 'Night' && ap > 0.1) {
            insightBox.innerHTML = `⚠️ <strong>WARNING:</strong> No sunlight! Keeping stomata open wastes water without making food.`;
            insightBox.style.borderLeftColor = "#ef4444";
        } else if (this.env.name === 'Heatwave' && ap > 0.4) {
            insightBox.innerHTML = `🔥 <strong>DANGER:</strong> Heatwave detected! High aperture will cause fatal dehydration. Throttle down!`;
            insightBox.style.borderLeftColor = "#ef4444";
        } else if (this.env.name === 'Monsoon' && ap < 0.8) {
            insightBox.innerHTML = `🌧️ <strong>OPPORTUNITY:</strong> High humidity means you can open up wide to collect CO₂ without losing water.`;
            insightBox.style.borderLeftColor = "var(--accent-blue)";
        } else if (ap > 0.8) {
            insightBox.innerHTML = `<strong>Tropical State:</strong> Maximizing CO₂, but risking dehydration. <br/><span style="color:var(--text-muted); font-size:0.85rem; display:block; margin-top:5px;"><strong>Real World:</strong> Smart Greenhouses use sensors to artificially add humidity so plants can stay in this high-growth state.</span>`;
            insightBox.style.borderLeftColor = "var(--accent-green)";
        } else if (ap < 0.2) {
            insightBox.innerHTML = `<strong>Desert State:</strong> Conserving water, but glucose production stalls. <br/><span style="color:var(--text-muted); font-size:0.85rem; display:block; margin-top:5px;"><strong>Real World:</strong> Geneticists study cacti to engineer drought-resistant crops for climate change.</span>`;
            insightBox.style.borderLeftColor = "var(--accent-orange)";
        } else {
            insightBox.innerHTML = `✅ <strong>STABLE:</strong> Balancing inputs safely for the current weather.`;
            insightBox.style.borderLeftColor = "var(--accent-green)";
        }
    },
    
    tick: function() {
        if (!this.isRunning) return;
        
        let waterLoss = (this.state.stomataAperture + Math.pow(this.state.stomataAperture, 2)) * this.env.temp * (1 - this.env.humidity) * 0.015;
        let co2Gain = this.state.stomataAperture * 100 * 0.05;
        let co2Use = this.state.storedCO2 > 0 ? this.state.stomataAperture * this.env.sunlight * 0.1 : 0;
        let glucGain = this.state.storedCO2 > 0 ? this.state.stomataAperture * this.env.sunlight * 0.25 : 0;

        this.state.waterLevel = Math.max(0, this.state.waterLevel - waterLoss);
        this.state.storedCO2 = Math.max(0, this.state.storedCO2 + co2Gain - co2Use);
        this.state.glucose = Math.min(100, this.state.glucose + glucGain);

        this.updateDashboardText();
        this.render();

        if (this.state.waterLevel > 0 && this.state.glucose < 100) {
            requestAnimationFrame(() => this.tick());
        } else {
            document.getElementById('bio-insight').innerHTML = this.state.glucose >= 100 ? "<strong>🎉 SUCCESS: Plant fully synthesized!</strong>" : "<strong style='color:#ef4444'>💀 FAILED: The plant dried out.</strong>";
            document.getElementById('bio-slider').disabled = true;
            document.getElementById('bio-reset').style.display = 'block';
            this.isRunning = false;
        }
    },
    
    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cx = this.canvas.width / 2; const cy = this.canvas.height / 2;
        const openingWidth = this.state.stomataAperture * 40;
        
        let flowSpeed = 0.5 + (this.state.stomataAperture * 2.5);
        if (this.state.stomataAperture > 0.05 && Math.random() < this.state.stomataAperture * 1.5) {
            if (Math.random() > this.env.humidity) this.particles.push({ type: 'h2o', x: cx + (Math.random() - 0.5)*openingWidth, y: cy, vx: (Math.random() - 0.5)*4*flowSpeed, vy: -Math.random()*2*flowSpeed - 1, life: 1.0 });
            this.particles.push({ type: 'co2', x: cx + (Math.random() - 0.5)*200, y: cy - 200, vx: (Math.random() - 0.5)*2*flowSpeed, vy: 2*flowSpeed, life: 1.0 });
        }

        // DRAW PARTICLES
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.01;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            this.ctx.globalAlpha = p.life;
            
            if (p.type === 'h2o') {
                // Bright Cyan Water Droplet
                this.ctx.fillStyle = '#38bdf8';
                this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 8, 0, Math.PI, false); this.ctx.lineTo(p.x, p.y - 12); this.ctx.fill();
            } else {
                // Vibrant Pink CO2 Bubble
                this.ctx.fillStyle = '#ec4899';
                this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); this.ctx.fill();
                
                // Add a cute highlight to make it look like a glossy bubble
                this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
                this.ctx.beginPath(); this.ctx.arc(p.x - 3, p.y - 3, 2, 0, Math.PI * 2); this.ctx.fill();
            }
        }
        this.ctx.globalAlpha = 1.0;

        // DRAW GUARD CELLS
        const r = 52 + (100 - this.state.waterLevel) * 2; 
        this.ctx.fillStyle = `rgb(${r}, 211, 153)`; // Base green that turns yellow as it dies
        
        // Add a slight drop shadow to make the cells pop
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        this.ctx.beginPath(); this.ctx.ellipse(cx - openingWidth/2 - 20, cy, 30, 80, 0, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.ellipse(cx + openingWidth/2 + 20, cy, 30, 80, 0, 0, Math.PI * 2); this.ctx.fill();
        
        this.ctx.shadowBlur = 0; // Turn off shadow for the hole

        // Draw the inner Stomata Hole (very dark midnight blue, so pink bubbles pop out of it)
        this.ctx.fillStyle = '#0f172a';
        this.ctx.beginPath(); this.ctx.ellipse(cx, cy, openingWidth, 75, 0, 0, Math.PI * 2); this.ctx.fill();
    }
};