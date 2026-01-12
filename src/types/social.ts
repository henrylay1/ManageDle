// Social feature types for groups and friends

/**
 * Represents a group that users can create and join
 */
export interface Group {
  id: string;
  name: string;
  owner_id: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

/**
 * Represents a member of a group
 */
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  // Joined user data
  display_name?: string | null;
  avatar_url?: string | null;
}

/**
 * Represents a friend (mutual follow)
 */
export interface Friend {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
}

/**
 * Result type for group operations
 */
export interface GroupOperationResult {
  success: boolean;
  message: string;
  error?: string;
  data?: Group | GroupMember;
}
