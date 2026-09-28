export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д'];

export function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function pick(values) { return values[randInt(0, values.length - 1)]; }
export function shuffle(values) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function gcd(a, b) { let x = Math.abs(a); let y = Math.abs(b); while (y) [x, y] = [y, x % y]; return x || 1; }
export function ua(value, digits = 6) {
  const n = Number(value);
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(digits))).replace('.', ',');
}
export function math(value) { return `\\(${value}\\)`; }
export function frac(n, d) {
  const g = gcd(n, d); let nn = n / g; let dd = d / g;
  if (dd < 0) { nn = -nn; dd = -dd; }
  return dd === 1 ? math(String(nn)) : math(`\\frac{${nn}}{${dd}}`);
}
export function uniqueStrings(items) { return [...new Set(items.map((x) => String(x)))]; }
export function signedTerm(n, variable = '') {
  if (n === 0) return '';
  const sign = n > 0 ? '+' : '-';
  const abs = Math.abs(n);
  const coeff = variable && abs === 1 ? '' : abs;
  return `${sign}${coeff}${variable}`;
}
