export function chooseInt(ctx, { min, max, exclude = [] }) {
  const banned = new Set(exclude);
  const candidates = [];
  for (let value = min; value <= max; value += 1) {
    if (!banned.has(value)) candidates.push(value);
  }
  if (candidates.length === 0) throw new Error('No valid integer candidates');
  return ctx.pick(candidates);
}

export function chooseFrom(ctx, values) {
  return ctx.pick(values);
}

export function constrainedGenerate(factory, predicate, { attempts = 100, error = 'Unable to satisfy generation constraint' } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const value = factory(i);
    if (predicate(value)) return value;
  }
  throw new Error(error);
}
