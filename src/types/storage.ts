import type { QueryFilter, SyncResult } from './models';
export type { QueryFilter, SyncResult } from './models';
import type { Game, GameRecord } from './models';

/**
 * Abstract storage interface for implementing different storage backends
 */
export interface IStorageAdapter {
  /**
   * Get a single item by key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a single item
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Remove a single item
   */
  remove(key: string): Promise<void>;

  /**
   * Query items from a collection with filters
   */
  query<T>(collection: string, filter?: QueryFilter): Promise<T[]>;

  /**
   * Get all items from a collection
   */
  getAll<T>(collection: string): Promise<T[]>;

  /**
   * Set all items in a collection (replace existing)
   */
  setAll<T>(collection: string, items: T[]): Promise<void>;

  /**
   * Clear all data (use with caution)
   */
  clear(): Promise<void>;

  /**
   * Sync data (optional, for future cloud sync)
   */
  sync?(): Promise<SyncResult>;

  /**
   * Get all games (convenience method for Supabase adapter)
   */
  getGames?(): Promise<Game[]>;

  /**
   * Save all games (convenience method for Supabase adapter)
   */
  saveGames?(games: Game[]): Promise<void>;

  /**
   * Get all records (convenience method for Supabase adapter)
   */
  getRecords?(): Promise<GameRecord[]>;

  /**
   * Save all records (convenience method for Supabase adapter)
   */
  saveRecords?(records: GameRecord[]): Promise<void>;
}
