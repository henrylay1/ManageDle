import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';

/**
 * Hook to fetch and cache user statistics for a specific game
 * Note: For now, this returns game stats. Extend as needed for user-wide stats.
 */
export function useGameStats(gameId: string) {
  const getStats = useAppStore(state => state.getStats);

  return useQuery({
    queryKey: ['gameStats', gameId],
    queryFn: async () => {
      return await getStats(gameId);
    },
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to invalidate game stats cache
 */
export function useInvalidateGameStats() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['gameStats'] });
  };
}
