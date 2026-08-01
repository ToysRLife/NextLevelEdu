export class UIManager {
    constructor() {
        // Grab the HTML elements
        this.slider = document.getElementById('stomata-slider');
        this.h2oText = document.getElementById('metric-h2o');
        this.glucoseText = document.getElementById('metric-glucose');
        
        // Setup the Canvas
        this.canvas = document.getElementById('simulation-core');
        this.ctx = this.canvas.getContext('2d');
    }

    bindEngine(engine) {
        // When the user moves the slider, update the math engine instantly
        this.slider.addEventListener('input', (event) => {
            engine.setAperture(event.target.value);
        });
    }

    updateDashboard(state) {
        // 1. Update the Text Metrics
        this.h2oText.innerText = `${state.waterLevel.toFixed(1)}%`;
        this.glucoseText.innerText = `${state.glucose.toFixed(1)}%`;
        
        // 2. Render the visual canvas
        this.renderCanvas(state);
    }

    renderCanvas(state) {
        // Clear the previous frame
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Draw a basic "Leaf" that shrinks as it loses water
        this.ctx.fillStyle = '#10B981'; // Emerald Green
        const leafSize = 100 + state.waterLevel; // Wilts if water hits 0
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, leafSize, leafSize / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw the "Stomata" opening based on the slider state
        this.ctx.fillStyle = '#0B0F19'; // Obsidian dark
        const stomataOpening = state.stomataAperture * 40; 
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, stomataOpening, 60, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }
}