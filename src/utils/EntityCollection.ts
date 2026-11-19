/**
 * Entities indexed by ID for O(1) lookups when applying server deltas, with a
 * cached array for drawing that is only rebuilt after a change.
 */
export class EntityCollection<T extends { id: string }> {
  private _items = new Map<string, T>();
  private _list: T[] | null = null;

  get(id: string): T | undefined {
    return this._items.get(id);
  }

  has(id: string): boolean {
    return this._items.has(id);
  }

  set(item: T): void {
    this._items.set(item.id, item);
    this._list = null;
  }

  delete(id: string): void {
    if (this._items.delete(id)) {
      this._list = null;
    }
  }

  get list(): T[] {
    if (!this._list) {
      this._list = Array.from(this._items.values());
    }
    return this._list;
  }
}
