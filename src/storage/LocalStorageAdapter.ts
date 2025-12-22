import { IStorageAdapter, QueryFilter } from '@/types/storage';

/**
 * Local Storage implementation of the storage adapter
 * Uses localStorage with collection prefixes for organization
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private prefix: string;

  constructor(prefix: string = 'managedle') {
    this.prefix = prefix;
  }

  /**
   * Generate a storage key with prefix and collection
   */
  private getKey(collection: string, id?: string): string {
    return id ? `${this.prefix}:${collection}:${id}` : `${this.prefix}:${collection}`;
  }

  /**
   * Get a single item by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = localStorage.getItem(this.getKey(key));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting item from localStorage:', error);
      return null;
    }
  }

  /**
   * Set a single item
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch (error) {
      console.error('Error setting item in localStorage:', error);
      throw error;
    }
  }

  /**
   * Remove a single item
   */
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.error('Error removing item from localStorage:', error);
      throw error;
    }
  }

  /**
   * Query items from a collection with filters
   */
  async query<T>(collection: string, filter?: QueryFilter): Promise<T[]> {
    try {
      const allItems = await this.getAll<T>(collection);
      
      if (!filter || Object.keys(filter).length === 0) {
        return allItems;
      }

      // Simple filter implementation
      return allItems.filter(item => {
        return Object.entries(filter).every(([key, value]) => {
          return (item as Record<string, unknown>)[key] === value;
        });
      });
    } catch (error) {
      console.error('Error querying items from localStorage:', error);
      return [];
    }
  }

  /**
   * Get all items from a collection
   */
  async getAll<T>(collection: string): Promise<T[]> {
    try {
      const collectionKey = this.getKey(collection);
      const data = localStorage.getItem(collectionKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting all items from localStorage:', error);
      return [];
    }
  }

  /**
   * Save all items to a collection (helper method)
   */
  async setAll<T>(collection: string, items: T[]): Promise<void> {
    try {
      const collectionKey = this.getKey(collection);
      localStorage.setItem(collectionKey, JSON.stringify(items));
    } catch (error) {
      console.error('Error setting all items in localStorage:', error);
      throw error;
    }
  }

  /**
   * Clear all data with this prefix
   */
  async clear(): Promise<void> {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.prefix}:`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      throw error;
    }
  }

}
