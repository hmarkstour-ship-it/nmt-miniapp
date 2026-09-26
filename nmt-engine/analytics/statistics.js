export function clamp(value, min = 0, max = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function mean(values = []) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function quantile(values = [], q = 0.5) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const pos = (nums.length - 1) * clamp(q, 0, 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  return nums[base + 1] === undefined ? nums[base] : nums[base] + rest * (nums[base + 1] - nums[base]);
}

export function pearsonCorrelation(xs = [], ys = []) {
  const pairs = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i += 1) {
    const x = Number(xs[i]);
    const y = Number(ys[i]);
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 2) return null;

  const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let numerator = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx;
    const dy = y - my;
    numerator += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 <= 0 || dy2 <= 0) return null;
  return numerator / Math.sqrt(dx2 * dy2);
}

export function round(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}
