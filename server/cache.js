/** LRU nhỏ gọn dựa trên thứ tự chèn của Map. */
export function createCache(maxSize = 500) {
  const store = new Map();

  return {
    get(key) {
      if (!store.has(key)) return undefined;
      const value = store.get(key);
      store.delete(key);
      store.set(key, value); // đẩy lên "mới dùng gần nhất"
      return value;
    },
    set(key, value) {
      if (store.has(key)) store.delete(key);
      store.set(key, value);
      while (store.size > maxSize) {
        store.delete(store.keys().next().value);
      }
    },
    get size() {
      return store.size;
    },
    clear() {
      store.clear();
    },
  };
}
