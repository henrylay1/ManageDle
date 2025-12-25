import { GameRecord, GameStats } from '@/types/models';
import { RecordRepository } from '@/repositories/RecordRepository';
import { getTodayDate, getYesterdayDate, getTimestamp } from '@/utils/helpers';

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
  async computeStats(gameId: string): Promise<GameStats> {
    const records = await this.recordRepo.getByGame(gameId);
    
    const totalPlayed = records.length;
    const totalWon = records.filter(r => r.completed && !r.failed).length;
    const totalFailed = records.filter(r => r.failed).length;
    
    // Calculate streaks
    const { currentStreak, maxStreak } = this.calculateStreaks(records);
    
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

    const completedRecords = records.filter(r => r.completed && !r.failed && getPrimaryScore(r) !== undefined);
    const averageScore = completedRecords.length > 0
      ? completedRecords.reduce((sum, r) => sum + getPrimaryScore(r), 0) / completedRecords.length
      : 0;

    // Score distribution
    const scoreDistribution: Record<string, number> = {};
    completedRecords.forEach(r => {
      const score = String(getPrimaryScore(r));
      scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
    });
    
    // Last played date
    const lastPlayedDate = records.length > 0 ? records[0].date : undefined;
    
    return {
      gameId,
      localId: this.localId,
      totalPlayed,
      totalWon,
      totalFailed,
      currentStreak,
      maxStreak,
      averageScore: Math.round(averageScore * 100) / 100,
      scoreDistribution,
      lastPlayedDate,
      computedAt: getTimestamp(),
    };
  }

  /**
   * Calculate current and max streaks
   */
  private calculateStreaks(records: GameRecord[]): { currentStreak: number; maxStreak: number } {
    if (records.length === 0) {
      return { currentStreak: 0, maxStreak: 0 };
    }

    // Sort records by date (most recent first)
    const sortedRecords = [...records]
      .filter(r => r.completed && !r.failed)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (sortedRecords.length === 0) {
      return { currentStreak: 0, maxStreak: 0 };
    }

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    let expectedDate = getTodayDate();

    // Check if played today or yesterday to start current streak
    const mostRecentDate = sortedRecords[0].date;
    const today = getTodayDate();
    const yesterday = getYesterdayDate();

    if (mostRecentDate === today || mostRecentDate === yesterday) {
      currentStreak = 1;
      expectedDate = mostRecentDate === today ? yesterday : this.getPreviousDate(yesterday);
      tempStreak = 1;

      // Continue counting backwards
      for (let i = 1; i < sortedRecords.length; i++) {
        const record = sortedRecords[i];
        if (record.date === expectedDate) {
          currentStreak++;
          tempStreak++;
          expectedDate = this.getPreviousDate(expectedDate);
        } else {
          break;
        }
      }
    }

    // Calculate max streak
    maxStreak = currentStreak;
    tempStreak = 0;

    for (let i = 0; i < sortedRecords.length; i++) {
      if (i === 0) {
        tempStreak = 1;
        expectedDate = this.getPreviousDate(sortedRecords[i].date);
      } else {
        if (sortedRecords[i].date === expectedDate) {
          tempStreak++;
          expectedDate = this.getPreviousDate(sortedRecords[i].date);
        } else {
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 1;
          expectedDate = this.getPreviousDate(sortedRecords[i].date);
        }
      }
    }
    maxStreak = Math.max(maxStreak, tempStreak);

    return { currentStreak, maxStreak };
  }

  /**
   * Get the previous date (YYYY-MM-DD format)
   */
  private getPreviousDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
}
