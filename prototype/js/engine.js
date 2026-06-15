/**
 * The core mathematical state machine.
 * This engine is completely decoupled from the UI. It reads a JSON configuration
 * and continuously calculates the physical/biological state using a high-performance tick loop.
 */
export class SimulationEngine {
    constructor(config, onStateUpdate) {
        // Load parameters from the parsed JSON configuration
        this.env = config.environment;
        this.state = config.initialState;
        this.rules = config.tickRules;
        this.winCondition = config.winCondition;
        
        // The callback function that tells ui.js to update the screen
        this.onStateUpdate = onStateUpdate; 
        
        this.isRunning = false;
        
        // Pre-compile the string-based algebraic rules into executable JavaScript functions.
        // This ensures maximum 60fps performance without parsing strings on every frame.
        this.compiledRules = {
            getWaterLoss: new Function('state', 'env', `return ${this.rules.waterLoss};`),
            getCO2Intake: new Function('state', 'env', `return ${this.rules.co2Intake};`),
            getGlucoseGain: new Function('state', 'env', `return ${this.rules.glucoseGain};`),
            getCO2Consumption: new Function('state', 'env', `return ${this.rules.co2Consumption};`)
        };
    }

    /**
     * Public method called by ui.js when the user moves the slider.
     * @param {number} value - The slider value (0 to 100)
     */
    setAperture(value) {
        // Normalize the 0-100 UI value to a 0.0-1.0 mathematical ratio
        this.state.stomataAperture = value / 100; 
    }

    /**
     * Starts the simulation loop.
     */
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.tick();
        }
    }

    /**
     * Pauses or stops the simulation.
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * The core 60fps runtime loop.
     */
    tick() {
        if (!this.isRunning) return;

        // 1. Calculate the Deltas (How much should things change this frame?)
        const waterLoss = this.compiledRules.getWaterLoss(this.state, this.env);
        const co2Intake = this.compiledRules.getCO2Intake(this.state, this.env);
        const glucoseGain = this.compiledRules.getGlucoseGain(this.state, this.env);
        const co2Consumed = this.compiledRules.getCO2Consumption(this.state, this.env);

        // 2. Apply State Mutations (Update the actual numbers)
        // Math.max/min ensures we don't drop below 0% or go above 100%
        this.state.waterLevel = Math.max(0, this.state.waterLevel - waterLoss);
        this.state.storedCO2 = Math.max(0, this.state.storedCO2 + co2Intake - co2Consumed);
        this.state.glucose = Math.min(100, this.state.glucose + glucoseGain);

        // 3. Broadcast the new state to the UI layer
        this.onStateUpdate(this.state);

        // 4. Check End-Game Conditions
        if (this.state.waterLevel <= 0) {
            console.log("GAME OVER: Dehydration Critical.");
            this.stop();
            return; // Stop the loop
        }
        if (this.state.glucose >= this.winCondition.targetGlucose) {
            console.log("LEVEL CLEARED: Energy target reached!");
            this.stop();
            return; // Stop the loop
        }

        // 5. Loop to the next frame
        requestAnimationFrame(() => this.tick());
    }
}