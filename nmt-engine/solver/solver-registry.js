export class SolverRegistry {
  constructor() {
    this.solvers = new Map();
  }

  register(name, solver) {
    if (!name || typeof solver !== 'function') throw new Error('register(name, solver) requires a function');
    this.solvers.set(name, solver);
    return this;
  }

  has(name) {
    return this.solvers.has(name);
  }

  solve(name, payload) {
    const solver = this.solvers.get(name);
    if (!solver) throw new Error(`Unknown solver: ${name}`);
    return solver(payload);
  }
}
