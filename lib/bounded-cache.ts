/**
 * A map that refuses new keys once it is full. In-flight entries stay until
 * the caller deletes them; nothing is evicted to make room.
 */
export function createBoundedMap<K, V>(max: number) {
  const map = new Map<K, V>();
  return {
    get max() { return max; },
    get size() { return map.size; },
    has: (key: K) => map.has(key),
    get: (key: K) => map.get(key),
    set(key: K, value: V) {
      if (map.has(key)) {
        map.set(key, value);
        return true;
      }
      if (map.size >= max) return false;
      map.set(key, value);
      return true;
    },
    delete: (key: K) => map.delete(key),
    clear() { map.clear(); },
  };
}
