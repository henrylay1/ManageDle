import { supabase } from '../lib/supabase';

export interface Follow {
  id: string;
  user_id: string;
  follower_id: string;
  created_at: string;
}

export interface Follower {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  followed_at: string;
}

export interface Following {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  followed_at: string;
}

export interface MutualFriend {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
}

export class SocialRepository {
  /**
   * Follow a user (create a follow relationship)
   * @param followerUserId - The ID of the user doing the following
   * @param userToFollowId - The ID of the user to follow
   * @returns Follow object or error
   */
  async followUser(followerUserId: string, userToFollowId: string): Promise<Follow | null> {
    const { data, error } = await supabase
      .from('follows')
      .insert({
        user_id: userToFollowId,
        follower_id: followerUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error following user:', error);
      return null;
    }

    return data as Follow;
  }

  /**
   * Unfollow a user (delete a follow relationship)
   * @param followerUserId - The ID of the user doing the unfollowing
   * @param userToUnfollowId - The ID of the user to unfollow
   * @returns Success boolean
   */
  async unfollowUser(followerUserId: string, userToUnfollowId: string): Promise<boolean> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('user_id', userToUnfollowId)
      .eq('follower_id', followerUserId);

    if (error) {
      console.error('Error unfollowing user:', error);
      return false;
    }

    return true;
  }

  /**
   * Check if a user follows another user
   * @param followerUserId - The ID of the potential follower
   * @param userIdToCheck - The ID of the user to check if being followed
   * @returns true if followerUserId follows userIdToCheck
   */
  async isFollowing(followerUserId: string, userIdToCheck: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('user_id', userIdToCheck)
      .eq('follower_id', followerUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking follow status:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Get follower count for a user
   * @param userId - The ID of the user
   * @returns Follower count
   */
  async getFollowersCount(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('users')
      .select('followers_count')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error getting followers count:', error);
      return 0;
    }

    return data?.followers_count || 0;
  }

  /**
   * Get list of followers for a user with pagination
   * @param userId - The ID of the user
   * @param limit - Number of results to return (default 50)
   * @param offset - Number of results to skip (default 0)
   * @returns Array of followers
   */
  async getFollowersList(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Follower[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(
        `
        follower_id,
        created_at,
        users!follows_follower_id_fkey (
          id,
          display_name,
          avatar_url,
          followers_count
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error getting followers list:', error);
      return [];
    }

    return (data || []).map((follow: any) => ({
      id: follow.users.id,
      display_name: follow.users.display_name,
      avatar_url: follow.users.avatar_url,
      followers_count: follow.users.followers_count,
      followed_at: follow.created_at,
    }));
  }

  /**
   * Get list of users that a user is following (with pagination)
   * @param userId - The ID of the user
   * @param limit - Number of results to return (default 50)
   * @param offset - Number of results to skip (default 0)
   * @returns Array of users being followed
   */
  async getFollowingList(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Following[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(
        `
        user_id,
        created_at,
        users!follows_user_id_fkey (
          id,
          display_name,
          avatar_url,
          followers_count
        )
      `
      )
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error getting following list:', error);
      return [];
    }

    return (data || []).map((follow: any) => ({
      id: follow.users.id,
      display_name: follow.users.display_name,
      avatar_url: follow.users.avatar_url,
      followers_count: follow.users.followers_count,
      followed_at: follow.created_at,
    }));
  }

  /**
   * Get mutual friends (bidirectional follows)
   * @param userId - The ID of the user
   * @param limit - Number of results to return (default 50)
   * @param offset - Number of results to skip (default 0)
   * @returns Array of mutual friends
   */
  async getMutualFriends(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MutualFriend[]> {
    // Get users that userId is following
    const { data: following, error: followingError } = await supabase
      .from('follows')
      .select('user_id')
      .eq('follower_id', userId);

    if (followingError) {
      console.error('Error getting following list:', followingError);
      return [];
    }

    if (!following || following.length === 0) {
      return [];
    }

    const followingIds = following.map(f => f.user_id);

    // Get users that are following userId back (mutual follows)
    const { data: followers, error: followersError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('user_id', userId)
      .in('follower_id', followingIds);

    if (followersError) {
      console.error('Error getting followers list:', followersError);
      return [];
    }

    if (!followers || followers.length === 0) {
      return [];
    }

    const mutualIds = followers.map(f => f.follower_id);

    // Get user details for mutual friends
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', mutualIds)
      .range(offset, offset + limit - 1);

    if (usersError) {
      console.error('Error getting mutual friends details:', usersError);
      return [];
    }

    if (!users) {
      return [];
    }

    // Add followers_count for each user
    const usersWithFollowers = await Promise.all(
      users.map(async (user) => {
        const followersCount = await this.getFollowersCount(user.id);
        return {
          ...user,
          followers_count: followersCount,
        };
      })
    );

    return usersWithFollowers;
  }

  /**
   * Get leaderboard sorted by follower count (registered users only)
   * Optionally filter by users followed by a specific user
   * @param limit - Number of results to return (default 100)
   * @param offset - Number of results to skip (default 0)
   * @param filterByFollowing - If provided, only show users followed by this user
   * @returns Array of users sorted by follower count
   */
  async getLeaderboardByFollowers(
    limit: number = 100,
    offset: number = 0,
    filterByFollowing?: string
  ) {
    let query = supabase
      .from('users')
      .select(
        `
        id,
        display_name,
        avatar_url,
        followers_count,
        email
      `
      )
      .not('email', 'is', null)
      .order('followers_count', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filterByFollowing) {
      // Only show users that filterByFollowing is following
      const { data: followingIds, error: followError } = await supabase
        .from('follows')
        .select('user_id')
        .eq('follower_id', filterByFollowing);

      if (followError) {
        console.error('Error fetching following list for filter:', followError);
        return [];
      }

      const userIds = followingIds?.map((f: any) => f.user_id) || [];
      if (userIds.length === 0) {
        return [];
      }

      query = query.in('id', userIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }

    return data || [];
  }
}

export const socialRepository = new SocialRepository();
