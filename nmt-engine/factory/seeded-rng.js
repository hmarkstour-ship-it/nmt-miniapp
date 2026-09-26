function hashSeed(input) {
  const text = String(input ?? '0');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed) || 0x6D2B79F5;
  return function random() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function withSeededRandom(seed, fn) {
  const original = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

export function deriveSeed(baseSeed, ...parts) {
  return hashSeed([baseSeed, ...parts].join('|'));
}
