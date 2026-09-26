export function solveLinear({ a, b }) {
  const A = Number(a);
  const B = Number(b);
  if (!Number.isFinite(A) || !Number.isFinite(B)) throw new Error('solveLinear requires finite a and b');
  if (A === 0) {
    if (B === 0) return { kind: 'infinite', roots: [] };
    return { kind: 'none', roots: [] };
  }
  return { kind: 'one', roots: [-B / A] };
}
