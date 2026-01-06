import { socialRepository } from '@/repositories/SocialRepository';
import { supabase } from '@/lib/supabase';

export interface SocialOperationResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface UserInfo {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
}

export class SocialService {
  /**
   * Get user info for validation
   */
  private async getUserInfo(userId: string): Promise<UserInfo | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, followers_count')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user info:', error);
      return null;
    }

    return data;
  }

  /**
   * Follow a user with business rule validation
   * - Cannot follow self
   * - Can only follow registered users (not guests)
   * - Follower must be registered (authenticated users only)
   *
   * @param currentUserId - The user doing the following
   * @param userIdToFollow - The user to follow
   * @returns Operation result with success status
   */
  async followUser(currentUserId: string, userIdToFollow: string): Promise<SocialOperationResult> {
    // Validate IDs are provided
    if (!currentUserId || !userIdToFollow) {
      return {
        success: false,
        message: 'User IDs are required',
        error: 'MISSING_IDS',
      };
    }

    // Validate not self-follow
    if (currentUserId === userIdToFollow) {
      return {
        success: false,
        message: 'You cannot follow yourself',
        error: 'SELF_FOLLOW',
      };
    }

    // Validate current user is registered (authenticated)
    const currentUserInfo = await this.getUserInfo(currentUserId);
    if (!currentUserInfo || !currentUserInfo.email) {
      return {
        success: false,
        message: 'Only registered users can follow others',
        error: 'NOT_REGISTERED',
      };
    }

    // Validate target user is registered (cannot follow guests)
    const targetUserInfo = await this.getUserInfo(userIdToFollow);
    if (!targetUserInfo || !targetUserInfo.email) {
      return {
        success: false,
        message: 'Cannot follow guest users',
        error: 'TARGET_NOT_REGISTERED',
      };
    }

    // Check if already following
    const isAlreadyFollowing = await socialRepository.isFollowing(currentUserId, userIdToFollow);
    if (isAlreadyFollowing) {
      return {
        success: false,
        message: 'You are already following this user',
        error: 'ALREADY_FOLLOWING',
      };
    }

    // Attempt to follow
    try {
      const result = await socialRepository.followUser(currentUserId, userIdToFollow);

      if (!result) {
        return {
          success: false,
          message: 'Failed to follow user',
          error: 'DATABASE_ERROR',
        };
      }

      return {
        success: true,
        message: `Successfully followed ${targetUserInfo.display_name || 'user'}`,
      };
    } catch (error: any) {
      console.error('Error in followUser:', error);
      return {
        success: false,
        message: 'An error occurred while following the user',
        error: error.message || 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Unfollow a user
   * @param currentUserId - The user doing the unfollowing
   * @param userIdToUnfollow - The user to unfollow
   * @returns Operation result with success status
   */
  async unfollowUser(currentUserId: string, userIdToUnfollow: string): Promise<SocialOperationResult> {
    // Validate IDs are provided
    if (!currentUserId || !userIdToUnfollow) {
      return {
        success: false,
        message: 'User IDs are required',
        error: 'MISSING_IDS',
      };
    }

    // Validate not trying to unfollow self
    if (currentUserId === userIdToUnfollow) {
      return {
        success: false,
        message: 'You cannot unfollow yourself',
        error: 'SELF_UNFOLLOW',
      };
    }

    // Check if actually following
    const isFollowing = await socialRepository.isFollowing(currentUserId, userIdToUnfollow);
    if (!isFollowing) {
      return {
        success: false,
        message: 'You are not following this user',
        error: 'NOT_FOLLOWING',
      };
    }

    // Attempt to unfollow
    try {
      const result = await socialRepository.unfollowUser(currentUserId, userIdToUnfollow);

      if (!result) {
        return {
          success: false,
          message: 'Failed to unfollow user',
          error: 'DATABASE_ERROR',
        };
      }

      return {
        success: true,
        message: 'Successfully unfollowed user',
      };
    } catch (error: any) {
      console.error('Error in unfollowUser:', error);
      return {
        success: false,
        message: 'An error occurred while unfollowing the user',
        error: error.message || 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get follower count for a user
   * @param userId - The user ID
   * @returns Follower count
   */
  async getFollowersCount(userId: string): Promise<number> {
    if (!userId) {
      return 0;
    }

    try {
      return await socialRepository.getFollowersCount(userId);
    } catch (error: any) {
      console.error('Error getting followers count:', error);
      return 0;
    }
  }

  /**
   * Get list of followers for a user
   * @param userId - The user ID
   * @param limit - Number of results to return
   * @param offset - Pagination offset
   * @returns Array of followers
   */
  async getFollowersList(userId: string, limit: number = 50, offset: number = 0) {
    if (!userId) {
      return [];
    }

    try {
      return await socialRepository.getFollowersList(userId, limit, offset);
    } catch (error: any) {
      console.error('Error getting followers list:', error);
      return [];
    }
  }

  /**
   * Get list of users that a user is following
   * @param userId - The user ID
   * @param limit - Number of results to return
   * @param offset - Pagination offset
   * @returns Array of following
   */
  async getFollowingList(userId: string, limit: number = 50, offset: number = 0) {
    if (!userId) {
      return [];
    }

    try {
      return await socialRepository.getFollowingList(userId, limit, offset);
    } catch (error: any) {
      console.error('Error getting following list:', error);
      return [];
    }
  }

  /**
   * Get mutual friends (bidirectional follows)
   * @param userId - The user ID
   * @param limit - Number of results to return
   * @param offset - Pagination offset
   * @returns Array of mutual friends
   */
  async getMutualFriends(userId: string, limit: number = 50, offset: number = 0) {
    if (!userId) {
      return [];
    }

    try {
      return await socialRepository.getMutualFriends(userId, limit, offset);
    } catch (error: any) {
      console.error('Error getting mutual friends:', error);
      return [];
    }
  }

  /**
   * Get leaderboard sorted by follower count
   * Only shows registered users (no guests)
   * Optionally filter to show only users followed by a specific user
   *
   * @param limit - Number of results to return
   * @param offset - Pagination offset
   * @param filterByFollowing - Optional: user ID to filter by their following list
   * @returns Array of users sorted by follower count
   */
  async getLeaderboardByFollowers(
    limit: number = 100,
    offset: number = 0,
    filterByFollowing?: string
  ) {
    try {
      return await socialRepository.getLeaderboardByFollowers(limit, offset, filterByFollowing);
    } catch (error: any) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Check if current user is following another user
   * @param currentUserId - The current user ID
   * @param userIdToCheck - The user to check if being followed
   * @returns true if following, false otherwise
   */
  async isFollowing(currentUserId: string, userIdToCheck: string): Promise<boolean> {
    if (!currentUserId || !userIdToCheck) {
      return false;
    }

    try {
      return await socialRepository.isFollowing(currentUserId, userIdToCheck);
    } catch (error: any) {
      console.error('Error checking follow status:', error);
      return false;
    }
  }
}

export const socialService = new SocialService();
