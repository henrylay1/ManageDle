// Core data models for the ManageDle application

/**
 * Represents a wordle-style game that can be tracked
 */
export interface Game {
  gameId: string; // Unique identifier (e.g., "wordle", "quordle")
  displayName: string; // Display name (e.g., "Wordle")
  url: string; // URL to the game
  category: string; // Category (e.g., "word", "number", "geography")
  trackingType: 'manual' | 'automatic'; // How scores are tracked
  isActive: boolean; // Whether the game is in the user's active roster
  isFailable: boolean; // Whether the game can be failed (e.g., Wordle can fail, Connections cannot)
  addedAt: string; // ISO 8601 timestamp
  icon?: string; // Optional emoji or icon
  description?: string; // Optional description shown as tooltip on hover
  customData?: Record<string, unknown>; // Extensible metadata
  resetTime: string; // UTC time when game resets in HH:MM format (e.g., "00:00")
  isAsynchronous: boolean; // Whether game resets based on user's local timezone (true) or UTC (false)
  scoreTypes: Record<string, Record<string, number>>; // Score types and their max values e.g., {"puzzle1": {"attempts": 6}} or {"puzzle1": {"time": -1, "grade": -1}}
  scoreDistributionConfig?: Record<string, number[]>; // Optional score categorization for distribution display. e.g., {"attempts": [0,1,2,3,4,5,6]} creates ranges 0-1, 2-2, 3-3, etc. If null/undefined, scores are distributed as-is.
}

/**
 * Represents a subtask/share text within a game record
 */
export interface ShareTextEntry {
  name: string; // Name of the subtask (e.g., "main", "classic", "quote")
  shareText?: string; // The emoji grid/share text
  failed: boolean;
  // score?: number; // Legacy field removed, use scores in GameRecord
  scores?: Record<string, Record<string, number | string | undefined>>; // Optional parsed scores for this share text entry
  additionalScores?: { label: string; value: number; maxValue?: number }[]; // For games with multiple score metrics (e.g., Pokedoku uniqueness)
  // Parsed data from shareTextParser (stored once, read many times)
  maxAttempts?: number; // Total attempts allowed (e.g., 6 for Wordle)
  puzzleNumber?: string; // The puzzle number
  grid?: string; // The emoji grid
  maxGuessNumber?: number; // For Quordle: the highest numbered emoji found
  percentage?: number; // For Worldle: the proximity percentage
  guessCount?: number; // For Worldle: the number of guesses used
  uniqueness?: number; // For Pokedoku: uniqueness score
  maxUniqueness?: number; // For Pokedoku: max uniqueness value
  grade?: string; // For Wantedle: letter grade (A-F)
  // additionalScores?: { label: string; value: number; maxValue?: number }[]; // For games with multiple score metrics (e.g., Pokedoku uniqueness)
}

/**
 * Represents a single game play record for a specific date
 */
export interface GameRecord {
  recordId: string; // UUID for sync conflict resolution
  gameId: string; // References Game.gameId
  localId: string; // Owner device/user identifier
  userId?: string; // Backend user ID (populated after migration)
  // completed: boolean; // Removed - record existence indicates played; use `failed` to determine loss
  // score?: number; // Legacy score field removed, use scores instead
  scores?: Record<string, Record<string, number>>; // Structured scores matching game's scoreTypes e.g., {"puzzle1": {"attempts": 5}}
  failed: boolean; // Whether the user failed to solve
  metadata?: {
    shareTexts?: ShareTextEntry[]; // Multiple share texts for games with subtasks
    streakDay?: number;
    playstreak?: number; // Current consecutive days played (resets on missed day)
    winstreak?: number; // Current consecutive days won (resets on missed day or loss)
    maxWinstreak?: number; // All-time max consecutive days won
    notes?: string;
    hasInvalidShareText?: boolean; // Flag to indicate share text doesn't match expected game format
  };
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp (for sync conflict resolution)
  syncStatus?: 'pending' | 'synced' | 'conflict'; // Future sync status
}

/**
 * User/Device identity for local storage and future cloud sync
 */
export interface UserIdentity {
  localId: string; // UUID generated on first use
  userId?: string; // Backend user ID (added post-migration)
  email?: string; // Email (added after account creation)
  displayName?: string; // User's display name
  createdAt: string; // ISO 8601 timestamp
  lastSyncedAt?: string; // Last sync timestamp
}

/**
 * Aggregated statistics for a specific game
 */
export interface GameStats {
  gameId: string;
  localId: string;
  userId?: string;
  totalPlayed: number;
  totalWon: number;
  totalFailed: number;
  playstreak: number;
  winstreak: number;
  maxWinstreak: number;
  streakAtRisk: boolean; // True if latest record is from yesterday (streak needs to be saved today)
  averageScore: number;
  scoreDistribution: Record<string, number>; // {"1": 5, "2": 20, ...}
  lastPlayedDate?: string; // YYYY-MM-DD
  computedAt: string; // ISO 8601 timestamp
}

/**
 * Query filter for storage operations
 */
export interface QueryFilter {
  [key: string]: unknown;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  errors?: string[];
}
