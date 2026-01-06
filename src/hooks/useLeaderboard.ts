import { useQuery } from '@tanstack/react-query';
import { leaderboardService } from '@/services/leaderboardService';

/**
 * Hook to fetch leaderboard data for a specific game
 */
export function useGameLeaderboard(gameId: string, limit: number = 100) {
  return useQuery({
    queryKey: ['gameLeaderboard', gameId, limit],
    queryFn: async () => {
      return await leaderboardService.getGameLeaderboard(gameId, limit);
    },
    enabled: !!gameId,
    staleTime: 2 * 60 * 1000, // 2 minutes - leaderboards update frequently
  });
}

/**
 * Hook to fetch all games leaderboard
 */
export function useAllGamesLeaderboard(limit: number = 50) {
  return useQuery({
    queryKey: ['allGamesLeaderboard', limit],
    queryFn: async () => {
      return await leaderboardService.getAllGamesLeaderboard(limit);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
