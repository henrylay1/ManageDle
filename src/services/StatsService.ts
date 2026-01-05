import { GameRecord, GameStats, Game } from '@/types/models';
import { RecordRepository } from '@/repositories/RecordRepository';
import { getTimestamp, getYesterdayDate, getDatePart } from '@/utils/helpers';

/**
 * Service for computing game statistics
 */
export class StatsService {
  constructor(
    private recordRepo: RecordRepository,
    private localId: string
  ) {}

  /**
   * Compute statistics for a specific game
   */
  async computeStats(gameId: string, game?: Game): Promise<GameStats> {
    const records = await this.recordRepo.getByGame(gameId);
    
    const totalPlayed = records.length;
    const totalWon = records.filter(r => !r.failed).length;
    const totalFailed = records.filter(r => r.failed).length;
    
    // Calculate streaks
    const { playstreak, winstreak, maxWinstreak, streakAtRisk } = this.calculateStreaks(records);
    
    // Calculate average score (only for completed games)
    // Use the first score type in scores for calculations
    const getPrimaryScore = (r: GameRecord): number => {
      if (r.scores) {
        const puzzleKeys = Object.keys(r.scores);
        if (puzzleKeys.length > 0) {
          const scoreObj = r.scores[puzzleKeys[0]];
          const scoreTypeKeys = Object.keys(scoreObj);
          if (scoreTypeKeys.length > 0) {
            const val = scoreObj[scoreTypeKeys[0]];
            return typeof val === 'number' ? val : 0;
          }
        }
      }
      return 0;
    };

    const completedRecords = records.filter(r => !r.failed && getPrimaryScore(r) !== undefined);
    const averageScore = completedRecords.length > 0
      ? completedRecords.reduce((sum, r) => sum + getPrimaryScore(r), 0) / completedRecords.length
      : 0;

    // Score distribution with optional categorization
    const scoreDistribution: Record<string, number> = {};
    
    // Get or generate the score distribution config
    let scoreDistributionConfig = game?.scoreDistributionConfig;
    if (!scoreDistributionConfig && game?.scoreTypes) {
      // Generate default config from scoreTypes
      scoreDistributionConfig = this.generateDefaultScoreDistributionConfig(game.scoreTypes);
      // Update the game object with the generated config
      if (game) {
        game.scoreDistributionConfig = scoreDistributionConfig;
      }
    }
    
    // Get the primary score type key for categorization config
    let primaryScoreTypeKey = '';
    if (scoreDistributionConfig && Object.keys(scoreDistributionConfig).length > 0) {
      primaryScoreTypeKey = Object.keys(scoreDistributionConfig)[0];
    }
    
    completedRecords.forEach(r => {
      const score = getPrimaryScore(r);
      
      // Determine the category key for distribution
      let categoryKey: string;
      
      if (scoreDistributionConfig && primaryScoreTypeKey && primaryScoreTypeKey in scoreDistributionConfig) {
        // Use categorized distribution based on config
        const boundaries = scoreDistributionConfig[primaryScoreTypeKey];
        categoryKey = this.getCategoryKey(score, boundaries);
      } else {
        // Use score as-is (default behavior)
        categoryKey = String(score);
      }
      
      scoreDistribution[categoryKey] = (scoreDistribution[categoryKey] || 0) + 1;
    });
    // Include failures in the distribution under the 'X' bucket
    if (totalFailed > 0) {
      scoreDistribution['X'] = (scoreDistribution['X'] || 0) + totalFailed;
    }
    
    // Last played date
    const lastPlayedDate = records.length > 0 ? getDatePart(records[0].createdAt) : undefined;
    
    return {
      gameId,
      localId: this.localId,
      totalPlayed,
      totalWon,
      totalFailed,
      playstreak,
      winstreak,
      maxWinstreak,
      streakAtRisk,
      averageScore: Math.round(averageScore * 100) / 100,
      scoreDistribution,
      lastPlayedDate,
      computedAt: getTimestamp(),
    };
  }

  /**
   * Get the category key for a score based on config format [start, end, interval]
   * e.g., [0, 500, 100] generates buckets: "0-100", "100-200", ..., "400-500"
   * For interval of 1, displays as single numbers: "1", "2", "3", etc.
   * e.g., [1, 6, 1] generates: "1", "2", "3", "4", "5", "6"
   */
  private getCategoryKey(score: number, boundaries: number[]): string {
    // New format: [start, end, interval]
    if (boundaries.length === 3) {
      const [start, end, interval] = boundaries;
      
      // Find which bucket the score falls into
      for (let current = start; current <= end; current += interval) {
        const nextBucket = current + interval;
        if (score >= current && score < nextBucket) {
          // If interval is 1, just show the single value
          if (interval === 1) {
            return String(current);
          }
          return `${current}-${nextBucket}`;
        }
      }
      
      // If score is at or beyond the end
      if (score >= end) {
        if (interval === 1) {
          return String(end);
        }
        return `${end}+`;
      }
      
      return String(score);
    }
    
    // Fallback for old format (array of boundary values)
    const sorted = [...boundaries].sort((a, b) => a - b);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const lower = sorted[i];
      const upper = sorted[i + 1];
      if (score >= lower && score < upper) {
        return `${lower}-${upper}`;
      }
    }
    
    // If score is beyond the last boundary
    if (sorted.length > 0 && score >= sorted[sorted.length - 1]) {
      return `${sorted[sorted.length - 1]}+`;
    }
    
    return String(score);
  }

  /**
   * Calculate play streak, win streak, and max win streak
   */
  private calculateStreaks(records: GameRecord[]): { playstreak: number; winstreak: number; maxWinstreak: number; streakAtRisk: boolean } {
    if (records.length === 0) {
      return { playstreak: 0, winstreak: 0, maxWinstreak: 0, streakAtRisk: false };
    }

    // Get the latest record (most recent by date)
    const sortedRecords = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latestRecord = sortedRecords[0];

    // Extract date part (YYYY-MM-DD) from the record date
    const recordDatePart = getDatePart(latestRecord.createdAt);
    const yesterday = getYesterdayDate();

    // Get streaks from metadata
    let playstreak = latestRecord.metadata?.playstreak ?? 0;
    let winstreak = latestRecord.metadata?.winstreak ?? 0;
    const maxWinstreak = latestRecord.metadata?.maxWinstreak ?? 0;

    // Determine streak status based on record date
    let streakAtRisk = false;
    
    if (recordDatePart === yesterday) {
      // Latest record is from yesterday - streaks are at risk (need to play today to maintain)
      streakAtRisk = true;
    } else if (recordDatePart < yesterday) {
      // Latest record is 2 or more days old - streaks are broken
      playstreak = 0;
      winstreak = 0;
    }
    // If recordDatePart >= today, show streaks normally

    return { playstreak, winstreak, maxWinstreak, streakAtRisk };
  }
  /**
   * Generate default score distribution config from scoreTypes
   * Uses 0 to max value with interval of ceiling(max/10)
   */
  private generateDefaultScoreDistributionConfig(scoreTypes: Record<string, Record<string, number>>): Record<string, number[]> {
    const config: Record<string, number[]> = {};
    
    // Get the first puzzle key and its first score type
    const puzzleKeys = Object.keys(scoreTypes);
    if (puzzleKeys.length === 0) return config;
    
    const firstPuzzle = puzzleKeys[0];
    const scoreTypeKeys = Object.keys(scoreTypes[firstPuzzle]);
    if (scoreTypeKeys.length === 0) return config;
    
    const scoreTypeKey = scoreTypeKeys[0];
    const maxValue = scoreTypes[firstPuzzle][scoreTypeKey];
    
    // Generate [start, end, interval] format
    if (maxValue === -1 || maxValue === undefined) {
      // If max is undefined or -1, use a default interval
      config[scoreTypeKey] = [0, 10, 1];
    } else {
      // Calculate interval as ceiling(max/10), minimum 1
      const interval = Math.max(1, Math.ceil(maxValue / 10));
      config[scoreTypeKey] = [0, maxValue, interval];
    }
    
    return config;
  }
}
