// Jest-safe in-memory replacement for the native MMKV bridge. New MMKV
// instances on the SAME id share a single backing map so production code
// that re-instantiates MMKV inside helpers (each call to `new MMKV({ id })`)
// still observes prior writes — matching the real native module's behaviour.

const stores = new Map<string, Map<string, string | number | boolean>>();

function storeFor(id: string): Map<string, string | number | boolean> {
  let store = stores.get(id);
  if (store === undefined) {
    store = new Map();
    stores.set(id, store);
  }
  return store;
}

interface MMKVOptions {
  id?: string;
}

class MMKV {
  private readonly store: Map<string, string | number | boolean>;

  constructor(options: MMKVOptions = {}) {
    this.store = storeFor(options.id ?? 'default');
  }

  set(key: string, value: string | number | boolean): void {
    this.store.set(key, value);
  }

  getString(key: string): string | undefined {
    const value = this.store.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  getNumber(key: string): number | undefined {
    const value = this.store.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.store.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  contains(key: string): boolean {
    return this.store.has(key);
  }

  clearAll(): void {
    this.store.clear();
  }
}

export { MMKV };
