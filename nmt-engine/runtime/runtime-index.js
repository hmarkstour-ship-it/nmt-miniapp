function addToMapArray(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

export class RuntimeBankIndex {
  constructor(items = []) {
    this.items = items;
    this.byId = new Map();
    this.byText = new Map();
    this.byTopic = new Map();
    this.training = [];
    this.trainingPlain = [];
    this.trainingVisual = [];
    this.mockBySlot = new Map();

    for (const item of items) {
      this.byId.set(item.id, item);
      if (item.question) this.byText.set(item.question, item);
      addToMapArray(this.byTopic, item.topic, item);

      const usage = item.bank_meta?.usage ?? {};
      if (usage.training) this.training.push(item);
      if (usage.training_plain) this.trainingPlain.push(item);
      if (usage.training_visual) this.trainingVisual.push(item);

      if (usage.mock) {
        for (const slot of item.bank_meta?.mock_slots ?? []) {
          addToMapArray(this.mockBySlot, Number(slot), item);
        }
      }
    }
  }

  trainingPool({ topic = 'mixed', visualMode = 'plain' } = {}) {
    let source = this.training;
    if (visualMode === 'plain') source = this.trainingPlain;
    else if (visualMode === 'visual') source = this.trainingVisual;

    if (topic === 'mixed') return source;
    return source.filter((item) => item.topic === topic);
  }

  mockPool(slot, type = null) {
    const pool = this.mockBySlot.get(Number(slot)) ?? [];
    return type ? pool.filter((item) => item.type === type) : pool;
  }
}
