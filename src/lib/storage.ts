import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";

/** A typed key-value collection persisted in IndexedDB. */
export interface Collection<T> {
  get(key: string): Promise<T | undefined>;
  put(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  all(): Promise<T[]>;
  /** Every stored value with its key. */
  entries(): Promise<[string, T][]>;
}

const DATABASE = "tab-trainer";

export function collection<T>(name: string): Collection<T> {
  // idb-keyval keeps one object store per database, so each collection gets its own database.
  const store: UseStore = createStore(`${DATABASE}-${name}`, name);
  return {
    get: (key) => get<T>(key, store),
    put: (key, value) => set(key, value, store),
    remove: (key) => del(key, store),
    all: async () => (await entries<string, T>(store)).map(([, value]) => value),
    entries: () => entries<string, T>(store),
  };
}
