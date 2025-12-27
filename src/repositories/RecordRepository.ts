import { GameRecord } from '@/types/models';
import { IStorageAdapter } from '@/types/storage';
import { generateUUID, getTimestamp } from '@/utils/helpers';
import { isCurrentPuzzle } from '@/utils/resetTimeUtils';
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
    return records.filter(r => r.createdAt.split('T')[0] === date && r.localId === this.localId);
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
   */
  async add(record: Omit<GameRecord, 'recordId' | 'localId' | 'createdAt' | 'updatedAt'>): Promise<GameRecord> {
    const records = await this.getAll();
    
    // Calculate streaks for this new record
    let playstreak = 1;
    let winstreak = 1;
    let maxWinstreak = 1;
    
    // Get previous record for this game
    const prevRecord = records
      .filter(r => r.gameId === record.gameId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    
    if (prevRecord?.metadata) {
      maxWinstreak = prevRecord.metadata.maxWinstreak ?? 1;
      
      // Calculate streak based on consecutive days
      const prevDate = new Date(prevRecord.createdAt).toISOString().slice(0, 10);
      const currentDate = new Date(getTimestamp()).toISOString().slice(0, 10);
      const prevDateObj = new Date(prevDate);
      const currentDateObj = new Date(currentDate);
      const daysDiff = (currentDateObj.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff === 1) {
        // Consecutive day - increment play streak
        playstreak = (prevRecord.metadata.playstreak ?? 1) + 1;
        
        // Win streak: only increment if current record is a win
        if (record.completed && !record.failed) {
          // Check if previous was also a win
          if (prevRecord.completed && !prevRecord.failed) {
            winstreak = (prevRecord.metadata.winstreak ?? 1) + 1;
          } else {
            winstreak = 1; // Previous was not a win, reset to 1
          }
        } else {
          winstreak = 0; // Current is not a win, reset to 0
        }
      } else {
        // Missed day or same day - reset play streak to 1
        playstreak = 1;
        // Win streak: set to 1 if current is a win, otherwise 0
        winstreak = (record.completed && !record.failed) ? 1 : 0;
      }
      
      // Update max win streak if current win streak is higher
      if (winstreak > maxWinstreak) {
        maxWinstreak = winstreak;
      }
    } else {
      // First record for this game
      // Win streak: 1 if win, 0 if loss
      winstreak = (record.completed && !record.failed) ? 1 : 0;
      maxWinstreak = winstreak;
    }
    
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
