export class SessionHistory {
  constructor(maxItems = 100) {
    this.maxItems = maxItems;
    this.items = [];
  }

  add(item) {
    this.items.push(item);
    if (this.items.length > this.maxItems) this.items.splice(0, this.items.length - this.maxItems);
    return item;
  }

  recent(limit = this.maxItems) {
    return this.items.slice(-limit);
  }

  clear() {
    this.items.length = 0;
  }

  get length() {
    return this.items.length;
  }
}
