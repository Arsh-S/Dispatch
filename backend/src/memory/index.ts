import type { MemoryStore } from './types.js';
import { createSqliteStore } from './sqlite-store.js';
import { resolveDbPath, MEMORY_ENABLED } from './config.js';

let store: MemoryStore | null = null;

export function getMemoryStore(targetDir?: string): MemoryStore | null {
  if (!MEMORY_ENABLED) return null;
  if (store) return store;

  try {
    const dbPath = resolveDbPath(targetDir);
    store = createSqliteStore(dbPath);
    console.log(`[Memory] Initialized store at ${dbPath}`);
    return store;
  } catch (e) {
    console.warn('[Memory] Cannot initialize store:', e);
    return null;
  }
}

export function closeMemoryStore(): void {
  if (store) {
    store.close();
    store = null;
  }
}

export { generateFindingFingerprint } from './fingerprint.js';
export { resolveTargetId } from './config.js';
export type { MemoryStore, FindingHistoryEntry, MemoryContextForPR } from './types.js';
