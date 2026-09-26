export function solveQuadratic({ a, b, c }) {
  const A = Number(a), B = Number(b), C = Number(c);
  if (![A, B, C].every(Number.isFinite)) throw new Error('solveQuadratic requires finite coefficients');
  if (A === 0) throw new Error('a must be non-zero for a quadratic equation');
  const D = B * B - 4 * A * C;
  if (D < 0) return { discriminant: D, roots: [] };
  if (D === 0) return { discriminant: D, roots: [-B / (2 * A)] };
  const s = Math.sqrt(D);
  return { discriminant: D, roots: [(-B - s) / (2 * A), (-B + s) / (2 * A)].sort((x, y) => x - y) };
}
