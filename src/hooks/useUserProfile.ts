import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';

/**
 * Hook to fetch current user profile
 */
export function useCurrentUserProfile() {
  const user = useAppStore(state => state.user);

  return useQuery({
    queryKey: ['currentUserProfile', user?.localId],
    queryFn: async () => {
      return user;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes - profiles don't change often
  });
}

/**
 * Hook to update current user profile
 */
export function useUpdateCurrentProfile() {
  const queryClient = useQueryClient();
  const updateProfile = useAppStore(state => state.updateProfile);

  return useMutation({
    mutationFn: async ({ displayName, avatarUrl }: { displayName: string; avatarUrl?: string }) => {
      return await updateProfile(displayName, avatarUrl);
    },
    onSuccess: () => {
      // Invalidate the profile cache
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['gameStats'] });
    },
  });
}
