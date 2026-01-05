import { supabase } from '@/lib/supabase';
import { getDatePart } from '@/utils/helpers';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gameId: string;
  gameName: string;
  totalWins: number;
  totalPlayed: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  averageScore: number | null;
  lastPlayed: string;
}

export interface GameLeaderboard {
  gameId: string;
  gameName: string;
  entries: LeaderboardEntry[];
}

export class LeaderboardService {
  /**
   * Get leaderboard for a specific game, optionally filtered by date
   */
  async getGameLeaderboard(gameId: string, limit: number = 100, sinceDate?: Date): Promise<LeaderboardEntry[]> {
    try {
      // Query game_records with user info
      let query = supabase
        .from('game_records')
        .select(`
          user_id,
          game_id,
          scores,
          failed,
          created_at,
          users!inner (
            display_name,
            avatar_url
          )
        `)
        .eq('game_id', gameId);

      // Add date filter if provided
      if (sinceDate) {
        const isoDate = sinceDate.toISOString();
        query = query.gte('created_at', isoDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[LeaderboardService] Failed to fetch leaderboard:', error);
        return [];
      }

      // Aggregate stats per user
      const userStatsMap = new Map<string, {
        userId: string;
        displayName: string;
        avatarUrl: string | null;
        totalWins: number;
        totalPlayed: number;
        scores: number[];
        dates: string[];
      }>();

      for (const record of data || []) {
        const userId = record.user_id;
        const displayName = (record.users as any)?.display_name || 'Unknown';
        const avatarUrl = (record.users as any)?.avatar_url || null;

        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            userId,
            displayName,
            avatarUrl,
            totalWins: 0,
            totalPlayed: 0,
            scores: [],
            dates: [],
          });
        }

        const userStats = userStatsMap.get(userId)!;
        userStats.totalPlayed++;
        
        if (!record.failed) {
          userStats.totalWins++;
          if (record.scores !== null) {
            userStats.scores.push(record.scores);
          }
        }
        
        userStats.dates.push(getDatePart(record.created_at));
      }

      // Convert to leaderboard entries
      const entries: LeaderboardEntry[] = Array.from(userStatsMap.values()).map(stats => {
        // Calculate streaks (simplified - just counts consecutive dates)
        const sortedDates = stats.dates.sort().reverse();
        let currentStreak = 0;
        let maxStreak = 0;
        let tempStreak = 0;

        for (let i = 0; i < sortedDates.length; i++) {
          if (i === 0 || this.isConsecutiveDay(sortedDates[i], sortedDates[i - 1])) {
            tempStreak++;
            maxStreak = Math.max(maxStreak, tempStreak);
            if (i === 0) currentStreak = tempStreak;
          } else {
            if (i === 1) currentStreak = 0;
            tempStreak = 1;
          }
        }

        return {
          userId: stats.userId,
          displayName: stats.displayName,
          avatarUrl: stats.avatarUrl,
          gameId,
          gameName: gameId, // Will be enriched with actual game name
          totalWins: stats.totalWins,
          totalPlayed: stats.totalPlayed,
          winRate: stats.totalPlayed > 0 ? (stats.totalWins / stats.totalPlayed) * 100 : 0,
          currentStreak,
          maxStreak,
          averageScore: stats.scores.length > 0 
            ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length 
            : null,
          lastPlayed: sortedDates[0] || '',
        };
      });

      // Sort by total wins (descending), then by win rate
      entries.sort((a, b) => {
        if (b.totalWins !== a.totalWins) {
          return b.totalWins - a.totalWins;
        }
        return b.winRate - a.winRate;
      });

      const finalEntries = entries.slice(0, limit);
      return finalEntries;
    } catch (error) {
      console.error('[LeaderboardService] Error fetching leaderboard:', error);
      return [];
    }
  }

  /**
   * Get leaderboard for all games, optionally filtered by date
   */
  async getAllGamesLeaderboard(limit: number = 50, sinceDate?: Date): Promise<GameLeaderboard[]> {
    try {
      // Get all unique games
      let query = supabase
        .from('game_records')
        .select('game_id')
        .limit(1000);

      // Add date filter if provided
      if (sinceDate) {
        const isoDate = sinceDate.toISOString();
        query = query.gte('created_at', isoDate);
      }

      const { data: gamesData, error: gamesError } = await query;

      if (gamesError) {
        console.error('[LeaderboardService] Failed to fetch games:', gamesError);
        return [];
      }

      const uniqueGameIds = [...new Set((gamesData || []).map(r => r.game_id))];
      // Fetch leaderboard for each game
      const leaderboards = await Promise.all(
        uniqueGameIds.map(async (gameId) => {
          const entries = await this.getGameLeaderboard(gameId, limit, sinceDate);
          return {
            gameId,
            gameName: gameId,
            entries,
          };
        })
      );

      const filtered = leaderboards.filter(lb => lb.entries.length > 0);
      return filtered;
    } catch (error) {
      console.error('Error fetching all leaderboards:', error);
      return [];
    }
  }

  /**
   * Get a user's ranking for a specific game
   */
  async getUserRanking(userId: string, gameId: string): Promise<{
    rank: number;
    totalUsers: number;
    entry: LeaderboardEntry | null;
  }> {
    const leaderboard = await this.getGameLeaderboard(gameId, 1000);
    const userIndex = leaderboard.findIndex(entry => entry.userId === userId);

    if (userIndex === -1) {
      return {
        rank: -1,
        totalUsers: leaderboard.length,
        entry: null,
      };
    }

    return {
      rank: userIndex + 1,
      totalUsers: leaderboard.length,
      entry: leaderboard[userIndex],
    };
  }

  /**
   * Check if two dates are consecutive days
   */
  private isConsecutiveDay(date1: string, date2: string): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }
}

export const leaderboardService = new LeaderboardService();
