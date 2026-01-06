import { QueryClient } from '@tanstack/react-query';

/**
 * Global query client reference for use outside React components
 * This is set in main.tsx when the QueryClient is created
 */
let queryClientRef: QueryClient | null = null;

export function setQueryClient(client: QueryClient) {
  queryClientRef = client;
}

export function getQueryClient(): QueryClient | null {
  return queryClientRef;
}

/**
 * Invalidate game stats cache for a specific game
 * Can be called from Zustand store or other non-React contexts
 */
export function invalidateGameStats(gameId?: string) {
  if (!queryClientRef) return;
  
  if (gameId) {
    queryClientRef.invalidateQueries({ queryKey: ['gameStats', gameId] });
  } else {
    queryClientRef.invalidateQueries({ queryKey: ['gameStats'] });
  }
}

/**
 * Invalidate all stats-related caches
 */
export function invalidateAllStats() {
  if (!queryClientRef) return;
  
  queryClientRef.invalidateQueries({ queryKey: ['gameStats'] });
  queryClientRef.invalidateQueries({ queryKey: ['gameLeaderboard'] });
  queryClientRef.invalidateQueries({ queryKey: ['allGamesLeaderboard'] });
}

/**
 * Invalidate user profile caches
 */
export function invalidateUserProfile() {
  if (!queryClientRef) return;
  
  queryClientRef.invalidateQueries({ queryKey: ['currentUserProfile'] });
}

/**
 * Invalidate social-related caches
 */
export function invalidateSocialData(userId?: string) {
  if (!queryClientRef) return;
  
  if (userId) {
    queryClientRef.invalidateQueries({ queryKey: ['followersList', userId] });
    queryClientRef.invalidateQueries({ queryKey: ['followingList', userId] });
    queryClientRef.invalidateQueries({ queryKey: ['followersCount', userId] });
  } else {
    queryClientRef.invalidateQueries({ queryKey: ['followersList'] });
    queryClientRef.invalidateQueries({ queryKey: ['followingList'] });
    queryClientRef.invalidateQueries({ queryKey: ['followersCount'] });
  }
}
