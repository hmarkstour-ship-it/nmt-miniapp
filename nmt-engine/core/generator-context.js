export class GeneratorContext {
  constructor({ seed = Date.now(), topic = null, difficulty = 'medium', metadata = {} } = {}) {
    this.seed = Number(seed) >>> 0;
    this.topic = topic;
    this.difficulty = difficulty;
    this.metadata = metadata;
  }

  random() {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error('int(min, max) requires integer bounds with max >= min');
    }
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('pick(values) requires a non-empty array');
    }
    return values[Math.floor(this.random() * values.length)];
  }

  shuffle(values) {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  chance(probability) {
    return this.random() < probability;
  }
}
