import { GameRecord } from '@/types/models';
import { IStorageAdapter } from '@/types/storage';
import { generateUUID, getTimestamp, getTodayDate } from '@/utils/helpers';

const COLLECTION_NAME = 'records';

/**
 * Repository for managing game records
 */
export class RecordRepository {
  constructor(
    private storage: IStorageAdapter,
    private localId: string
  ) {}

  /**
   * Get all records
   */
  async getAll(): Promise<GameRecord[]> {
    return this.storage.getAll<GameRecord>(COLLECTION_NAME);
  }

  /**
   * Get records by date
   */
  async getByDate(date: string): Promise<GameRecord[]> {
    const records = await this.getAll();
    return records.filter(r => r.date === date && r.localId === this.localId);
  }

  /**
   * Get today's records
   */
  async getTodayRecords(): Promise<GameRecord[]> {
    const todayDate = getTodayDate();
    return this.getByDate(todayDate);
  }

  /**
   * Get record for a specific game and date
   */
  async getByGameAndDate(gameId: string, date: string): Promise<GameRecord | null> {
    const records = await this.getByDate(date);
    return records.find(r => r.gameId === gameId) || null;
  }

  /**
   * Get all records for a specific game
   */
  async getByGame(gameId: string): Promise<GameRecord[]> {
    const records = await this.getAll();
    return records.filter(r => r.gameId === gameId && r.localId === this.localId)
      .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
  }

  /**
   * Add a new record
   */
  async add(record: Omit<GameRecord, 'recordId' | 'localId' | 'createdAt' | 'updatedAt'>): Promise<GameRecord> {
    const records = await this.getAll();
    
    const newRecord: GameRecord = {
      ...record,
      recordId: generateUUID(),
      localId: this.localId,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    records.push(newRecord);
    await this.storage.setAll(COLLECTION_NAME, records);
    
    return newRecord;
  }

  /**
   * Update an existing record
   */
  async update(recordId: string, updates: Partial<GameRecord>): Promise<GameRecord | null> {
    const records = await this.getAll();
    const index = records.findIndex(r => r.recordId === recordId);
    
    if (index === -1) {
      return null;
    }

    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: getTimestamp(),
    };
    
    await this.storage.setAll(COLLECTION_NAME, records);
    return records[index];
  }

  /**
   * Delete a record
   */
  async delete(recordId: string): Promise<boolean> {
    const records = await this.getAll();
    const filtered = records.filter(r => r.recordId !== recordId);
    
    if (filtered.length === records.length) {
      return false; // Record not found
    }

    await this.storage.setAll(COLLECTION_NAME, filtered);
    return true;
  }
}
