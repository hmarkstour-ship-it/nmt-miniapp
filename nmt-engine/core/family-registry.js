export class FamilyRegistry {
  constructor() {
    this.families = new Map();
  }

  register(family) {
    if (!family || typeof family.id !== 'string' || !family.id.trim()) {
      throw new Error('Family must have a non-empty id');
    }
    if (this.families.has(family.id)) {
      throw new Error(`Family already registered: ${family.id}`);
    }
    this.families.set(family.id, family);
    return family;
  }

  registerMany(families = []) {
    for (const family of families) this.register(family);
    return this;
  }

  get(id) {
    return this.families.get(id) ?? null;
  }

  has(id) {
    return this.families.has(id);
  }

  list({ topic = null } = {}) {
    const all = [...this.families.values()];
    return topic ? all.filter((family) => family.topic === topic) : all;
  }

  get size() {
    return this.families.size;
  }
}
