import { SolverRegistry } from './solver-registry.js';
import { solveNumeric } from './numeric-solver.js';
import { solveLinear } from './linear-solver.js';
import { solveQuadratic } from './quadratic-solver.js';

export const defaultSolverRegistry = new SolverRegistry()
  .register('numeric', solveNumeric)
  .register('linear', solveLinear)
  .register('quadratic', solveQuadratic);

export function solve(name, payload, registry = defaultSolverRegistry) {
  return registry.solve(name, payload);
}
