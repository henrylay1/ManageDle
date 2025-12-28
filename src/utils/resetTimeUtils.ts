/**
 * Utility functions for calculating game reset times
 */

import { Game } from '@/types/models';

/**
 * Calculates time remaining until a game resets
 * @param game - The game with reset configuration
 * @returns Object with hours and minutes until reset
 */
export function getTimeUntilReset(game: Game): { hours: number; minutes: number } {
  const now = new Date();
  const [resetHour, resetMinute] = game.resetTime.split(':').map(Number);
  
  let resetDate: Date;
  
  if (game.isAsynchronous) {
    // Game resets based on user's local timezone
    resetDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      resetHour,
      resetMinute,
      0,
      0
    );
  } else {
    // Game resets based on UTC
    resetDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      resetHour,
      resetMinute,
      0,
      0
    ));
  }
  
  // If reset time has already passed today, move to tomorrow
  if (resetDate <= now) {
    resetDate.setDate(resetDate.getDate() + 1);
  }
  
  // Calculate time difference in milliseconds
  const diffMs = resetDate.getTime() - now.getTime();
  
  // Convert to hours and minutes
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return { hours, minutes };
}

/**
 * Formats the time until reset as a string (e.g., "5:30")
 * @param game - The game with reset configuration
 * @returns Formatted string "H:MM"
 */
export function formatTimeUntilReset(game: Game): string {
  const { hours, minutes } = getTimeUntilReset(game);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculates the last reset time for a game
 * @param game - The game with reset configuration
 * @returns Date object representing the last reset time
 */
export function getLastResetTime(game: Game): Date {
  const now = new Date();
  const [resetHour, resetMinute] = game.resetTime.split(':').map(Number);
  
  let resetDate: Date;
  
  if (game.isAsynchronous) {
    // Game resets based on user's local timezone
    resetDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      resetHour,
      resetMinute,
      0,
      0
    );
  } else {
    // Game resets based on UTC
    resetDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      resetHour,
      resetMinute,
      0,
      0
    ));
  }
  
  // If reset time is in the future, the last reset was yesterday
  if (resetDate > now) {
    resetDate.setDate(resetDate.getDate() - 1);
  }
  
  return resetDate;
}

/**
 * Determines if a record belongs to the current puzzle period
 * @param recordDate - ISO 8601 timestamp of the record
 * @param game - The game with reset configuration
 * @returns true if record is for current puzzle, false if for previous puzzle
 */
export function isCurrentPuzzle(recordDate: string, game: Game): boolean {
  const recordTime = new Date(recordDate);
  const lastReset = getLastResetTime(game);

  // If recordDate is date-only (YYYY-MM-DD), treat as current if it matches today in the game's reset timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    // Get today in the game's reset timezone
    let now = new Date();
    let todayStr;
    if (game.isAsynchronous) {
      // For async games with 00:00 reset, use UTC date
      todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
    } else {
      todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
    }
    return recordDate === todayStr;
  }
  // Otherwise, use timestamp comparison
  return recordTime >= lastReset;
}

/**
 * Gets the puzzle day (YYYY-MM-DD) for a given timestamp based on game reset time
 * For asynchronous games, this is in user's local timezone
 * For synchronous games, this is in UTC
 * @param timestamp - ISO 8601 timestamp
 * @param game - The game with reset configuration
 * @returns Puzzle day in YYYY-MM-DD format
 */
export function getPuzzleDay(timestamp: string, game: Game): string {
  const recordTime = new Date(timestamp);
  const [resetHour, resetMinute] = game.resetTime.split(':').map(Number);

  let year: number, month: number, day: number, hour: number, minute: number;

  if (game.isAsynchronous) {
    // Use local time
    year = recordTime.getFullYear();
    month = recordTime.getMonth();
    day = recordTime.getDate();
    hour = recordTime.getHours();
    minute = recordTime.getMinutes();
  } else {
    // Use UTC
    year = recordTime.getUTCFullYear();
    month = recordTime.getUTCMonth();
    day = recordTime.getUTCDate();
    hour = recordTime.getUTCHours();
    minute = recordTime.getUTCMinutes();
  }

  // If current time is before reset time, puzzle day is previous day
  if (hour < resetHour || (hour === resetHour && minute < resetMinute)) {
    const prevDay = new Date(year, month, day - 1);
    year = prevDay.getFullYear();
    month = prevDay.getMonth();
    day = prevDay.getDate();
  }

  // Format as YYYY-MM-DD
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const result = `${year}-${mm}-${dd}`;
  return result;
}
