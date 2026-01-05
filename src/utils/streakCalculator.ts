/**
 * Centralized streak calculation utilities
 */

import { GameRecord, Game } from '@/types/models';
import { getDatePart } from './helpers';
import { getPuzzleDay } from './resetTimeUtils';

export interface StreakResult {
  playstreak: number;
  winstreak: number;
  maxWinstreak: number;
}

/**
 * Calculate streaks for a new record based on previous records
 * @param newRecord - The new record being added (with failed status and gameId)
 * @param previousRecords - All previous records for this game, sorted by date descending
 * @param game - Optional game configuration for timezone-aware puzzle day calculation
 * @returns Calculated streaks
 */
export function calculateStreaks(
  newRecord: { failed: boolean; createdAt: string; gameId: string },
  previousRecords: GameRecord[],
  game?: Game
): StreakResult {
  let playstreak = 1;
  let winstreak = !newRecord.failed ? 1 : 0;
  let maxWinstreak = winstreak;

  // Determine puzzle day for current record
  const currentPuzzleDay = game 
    ? getPuzzleDay(newRecord.createdAt, game) 
    : getDatePart(newRecord.createdAt);

  // Find previous record from a different (earlier) puzzle day
  const prevRecord = previousRecords
    .filter(r => r.gameId === newRecord.gameId)
    .filter(r => {
      if (!r.createdAt) return false;
      const recordPuzzleDay = game ? getPuzzleDay(r.createdAt, game) : getDatePart(r.createdAt);
      return recordPuzzleDay < currentPuzzleDay;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;

  if (prevRecord?.metadata) {
    maxWinstreak = prevRecord.metadata.maxWinstreak ?? 1;
    
    // Calculate streak based on consecutive puzzle days
    const prevPuzzleDay = game ? getPuzzleDay(prevRecord.createdAt, game) : getDatePart(prevRecord.createdAt);
    
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
      if (!newRecord.failed) {
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
      winstreak = !newRecord.failed ? 1 : 0;
    }
    
    // Update max win streak if current win streak is higher
    if (winstreak > maxWinstreak) {
      maxWinstreak = winstreak;
    }
  }

  return { playstreak, winstreak, maxWinstreak };
}
