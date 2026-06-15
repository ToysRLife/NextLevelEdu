// Generalized particle system, extracted from the prototype's bioLab H2O/CO2
// effects. Games push particles; the system integrates motion and culls dead ones.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 -> 0
  kind: string;
  size: number;
}

export class ParticleSystem {
  readonly particles: Particle[] = [];

  spawn(p: Omit<Particle, "life"> & { life?: number }): void {
    this.particles.push({ life: 1, ...p });
  }

  /** Advance one step; `decay` is life lost per step. */
  update(decay = 0.01): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  clear(): void {
    this.particles.length = 0;
  }

  get count(): number {
    return this.particles.length;
  }
}
