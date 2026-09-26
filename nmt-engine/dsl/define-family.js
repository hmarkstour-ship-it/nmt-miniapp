export function defineFamily({ id, topic, title = id, variants = [], generate = null, metadata = {} }) {
  if (!id || !topic) throw new Error('Family requires id and topic');
  if (generate != null && typeof generate !== 'function') throw new Error('generate must be a function or null');
  return Object.freeze({ id, topic, title, variants: Object.freeze([...variants]), generate, metadata: Object.freeze({ ...metadata }) });
}
