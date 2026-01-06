import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialService } from '@/services/socialService';

/**
 * Hook to fetch followers list
 */
export function useFollowersList(userId: string, limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['followersList', userId, limit, offset],
    queryFn: async () => {
      return await socialService.getFollowersList(userId, limit, offset);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch following list
 */
export function useFollowingList(userId: string, limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['followingList', userId, limit, offset],
    queryFn: async () => {
      return await socialService.getFollowingList(userId, limit, offset);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch followers count
 */
export function useFollowersCount(userId: string) {
  return useQuery({
    queryKey: ['followersCount', userId],
    queryFn: async () => {
      return await socialService.getFollowersCount(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to follow a user
 */
export function useFollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, targetUserId }: { userId: string; targetUserId: string }) => {
      return await socialService.followUser(userId, targetUserId);
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['followingList', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['followersList', variables.targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['followersCount', variables.targetUserId] });
    },
  });
}

/**
 * Hook to unfollow a user
 */
export function useUnfollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, targetUserId }: { userId: string; targetUserId: string }) => {
      return await socialService.unfollowUser(userId, targetUserId);
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['followingList', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['followersList', variables.targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['followersCount', variables.targetUserId] });
    },
  });
}
