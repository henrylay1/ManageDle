import { GameRecord } from '@/types/models';
import { IStorageAdapter } from '@/types/storage';
import { generateUUID, getTimestamp } from '@/utils/helpers';
import { isCurrentPuzzle, getPuzzleDay } from '@/utils/resetTimeUtils';
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
   * @param record - The record data to add
   * @param game - The game configuration (needed for streak calculation based on reset time)
   */
  async add(record: Omit<GameRecord, 'recordId' | 'localId' | 'createdAt' | 'updatedAt'>, game?: Game): Promise<GameRecord> {
    const records = await this.getAll();
    
    // Calculate streaks for this new record
    let playstreak = 1;
    let winstreak = 1;
    let maxWinstreak = 1;
    
    // Get previous record for this game (most recent record strictly before current puzzle day)
    const currentTimestamp = getTimestamp();
    
    // Determine puzzle day for current record
    let currentPuzzleDay: string;
    if (game) {
      currentPuzzleDay = getPuzzleDay(currentTimestamp, game);
    } else {
      // Fallback to UTC date if game not provided
      currentPuzzleDay = currentTimestamp.slice(0, 10);
    }
    
    // Find previous record that is from a different (earlier) puzzle day
    const prevRecord = records
      .filter(r => r.gameId === record.gameId)
      .filter(r => {
        if (!r.createdAt) return false;
        const recordPuzzleDay = game ? getPuzzleDay(r.createdAt, game) : r.createdAt.slice(0, 10);
        return recordPuzzleDay < currentPuzzleDay;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
    
    if (prevRecord?.metadata) {
      maxWinstreak = prevRecord.metadata.maxWinstreak ?? 1;
      
      // Calculate streak based on consecutive puzzle days
      const prevPuzzleDay = game ? getPuzzleDay(prevRecord.createdAt, game) : prevRecord.createdAt.slice(0, 10);
      
      // Calculate days difference using puzzle days (YYYY-MM-DD strings)
      const [py, pm, pd] = prevPuzzleDay.split('-').map(s => parseInt(s, 10));
      const [cy, cm, cd] = currentPuzzleDay.split('-').map(s => parseInt(s, 10));
      const prevUTC = Date.UTC(py, (pm || 1) - 1, pd || 1);
      const currentUTC = Date.UTC(cy, (cm || 1) - 1, cd || 1);
      const daysDiff = Math.round((currentUTC - prevUTC) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day - increment play streak
        playstreak = (prevRecord.metadata.playstreak ?? 1) + 1;
        
        // Win streak: only increment if current record is a win (!failed)
        if (!record.failed) {
          // Check if previous was also a win (!failed)
          if (!prevRecord.failed) {
            winstreak = (prevRecord.metadata?.winstreak ?? 1) + 1;
          } else {
            winstreak = 1; // Previous was not a win, reset to 1
          }
        } else {
          winstreak = 0; // Current is not a win, reset to 0
        }
      } else {
        // Missed day or same day - reset play streak to 1
        playstreak = 1;
        // Win streak: set to 1 if current is a win (!failed), otherwise 0
        winstreak = !record.failed ? 1 : 0;
      }
      
      // Update max win streak if current win streak is higher
      if (winstreak > maxWinstreak) {
        maxWinstreak = winstreak;
      }
    } else {
      // First record for this game
      // Win streak: 1 if win (!failed), 0 if loss
      winstreak = !record.failed ? 1 : 0;
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
