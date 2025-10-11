type Item = {
  type: 'work' | 'chapter';
  slug: string;
  title: string;
  bucket?: string | null;
  filePath?: string | null;
  lastPage?: number | null;
  numPages?: number | null;
  updatedAt: string; // ISO string
  coverUrl?: string | null;
  authorName?: string | null;
  progressRatio?: number | null;
};

type CacheEntry = { data: Item[]; expiresAt: number };

// Cache en memoria por usuario (TTL configurable)
const store = new Map<string, CacheEntry>();

export function getUserCache(userId: string): CacheEntry | undefined {
  const entry = store.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(userId);
    return undefined;
  }
  return entry;
}

export function setUserCache(userId: string, data: Item[], ttlMs = 10_000): void {
  store.set(userId, { data, expiresAt: Date.now() + ttlMs });
}

export function clearUserCache(userId: string): void {
  store.delete(userId);
}