// Jest-safe in-memory replacement for the native MMKV bridge. New MMKV
// instances start empty; tests that need isolation should re-instantiate.

class MMKV {
  private store = new Map<string, string>();

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.store.get(key);
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
