import { GameRecord } from '@/types/models';
import { IStorageAdapter } from '@/types/storage';
import { generateUUID, getTimestamp, getDatePart } from '@/utils/helpers';
import { isCurrentPuzzle } from '@/utils/resetTimeUtils';
import { calculateStreaks } from '@/utils/streakCalculator';
import type { Game } from '@/types/models';

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
    return records.filter(r => getDatePart(r.createdAt) === date && r.localId === this.localId);
  }

  /**
   * Get today's records (for current puzzle period)
   * @param games - Array of games with reset time configuration
   */
  async getTodayRecords(games: Game[]): Promise<GameRecord[]> {
    const records = await this.getAll();
    const userRecords = records.filter(r => r.localId === this.localId);
    // Create a map of gameId -> game for quick lookup
    const gameMap = new Map(games.map(g => [g.gameId, g]));
    // Filter records that belong to the current puzzle period
    const todayRecords = userRecords.filter(record => {
      const game = gameMap.get(record.gameId);
      if (!game) return false; // Game not found, exclude record
      const isCurrent = isCurrentPuzzle(record.createdAt, game);
      return isCurrent;
    });
    return todayRecords;
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
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // Most recent first
  }

  /**
   * Add a new record
   * @param record - The record data to add
   * @param game - The game configuration (needed for streak calculation based on reset time)
   */
  async add(record: Omit<GameRecord, 'recordId' | 'localId' | 'createdAt' | 'updatedAt'>, game?: Game): Promise<GameRecord> {
    const records = await this.getAll();
    
    // Calculate streaks using centralized function
    const currentTimestamp = getTimestamp();
    const { playstreak, winstreak, maxWinstreak } = calculateStreaks(
      { failed: record.failed, createdAt: currentTimestamp, gameId: record.gameId },
      records,
      game
    );
    
    const newRecord: GameRecord = {
      ...record,
      recordId: generateUUID(),
      localId: this.localId,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
      metadata: {
        ...record.metadata,
        playstreak: playstreak,
        winstreak: winstreak,
        maxWinstreak: maxWinstreak,
      },
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
    // If using SupabaseStorageAdapter, call its deleteRecord method
    if (typeof (this.storage as any).deleteRecord === 'function') {
      return await (this.storage as any).deleteRecord(recordId);
    }
    // Otherwise, remove locally
    const records = await this.getAll();
    const filtered = records.filter(r => r.recordId !== recordId);
    if (filtered.length === records.length) {
      return false; // Record not found
    }
    await this.storage.setAll(COLLECTION_NAME, filtered);
    return true;
  }
}
