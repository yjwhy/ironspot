// Jest-safe in-memory replacement for the native MMKV (Nitro) bridge.
// mmkv 4 replaced `new MMKV({ id })` with the `createMMKV({ id })` factory
// and renamed `.delete()` to `.remove()`. Instances created with the SAME
// id share a single backing map so production code that re-creates an
// instance inside a helper still observes prior writes, matching the real
// native module's behaviour.

const stores = new Map<string, Map<string, string | number | boolean>>();

function storeFor(id: string): Map<string, string | number | boolean> {
  let store = stores.get(id);
  if (store === undefined) {
    store = new Map();
    stores.set(id, store);
  }
  return store;
}

interface MMKVConfiguration {
  id?: string;
}

interface MockMMKV {
  set(key: string, value: string | number | boolean): void;
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  remove(key: string): boolean;
  contains(key: string): boolean;
  clearAll(): void;
}

function createMMKV(configuration: MMKVConfiguration = {}): MockMMKV {
  const store = storeFor(configuration.id ?? 'default');
  return {
    set(key, value) {
      store.set(key, value);
    },
    getString(key) {
      const value = store.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getNumber(key) {
      const value = store.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    getBoolean(key) {
      const value = store.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    remove(key) {
      return store.delete(key);
    },
    contains(key) {
      return store.has(key);
    },
    clearAll() {
      store.clear();
    },
  };
}

export { createMMKV };
