// Generalized particle system, extracted from the prototype's bioLab H2O/CO2
// effects. Games push particles; the system integrates motion and culls dead ones.
export class ParticleSystem {
    constructor() {
        Object.defineProperty(this, "particles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    spawn(p) {
        this.particles.push({ life: 1, ...p });
    }
    /** Advance one step; `decay` is life lost per step. */
    update(decay = 0.01) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= decay;
            if (p.life <= 0)
                this.particles.splice(i, 1);
        }
    }
    clear() {
        this.particles.length = 0;
    }
    get count() {
        return this.particles.length;
    }
}
