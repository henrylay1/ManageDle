import { supabase } from '@/lib/supabase';
import { Group, GroupMember, GroupOperationResult } from '@/types/social';

export class GroupService {
  /**
   * Get all groups for a user (both owned and member of)
   */
  async getUserGroups(userId: string): Promise<Group[]> {
    // Get groups where user is a member
    const { data: memberGroups, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (memberError) {
      console.error('Error fetching member groups:', memberError);
      return [];
    }

    const groupIds = memberGroups?.map(m => m.group_id) || [];

    if (groupIds.length === 0) {
      return [];
    }

    // Get group details
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('Error fetching groups:', groupsError);
      return [];
    }

    // Get member count for each group
    const groupsWithCount = await Promise.all(
      (groups || []).map(async (group) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);

        return {
          ...group,
          member_count: count || 0,
        };
      })
    );

    return groupsWithCount;
  }

  /**
   * Get members of a specific group
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        id,
        group_id,
        user_id,
        role,
        joined_at,
        users:user_id (
          display_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching group members:', error);
      return [];
    }

    // Transform the nested user data
    return (data || []).map((member: any) => ({
      id: member.id,
      group_id: member.group_id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      display_name: member.users?.display_name || null,
      avatar_url: member.users?.avatar_url || null,
    }));
  }

  /**
   * Create a new group
   */
  async createGroup(
    ownerId: string,
    name: string,
    description?: string,
    isPrivate: boolean = false
  ): Promise<GroupOperationResult> {
    // Validate name length
    if (name.length < 3 || name.length > 50) {
      return {
        success: false,
        message: 'Group name must be between 3 and 50 characters',
        error: 'INVALID_NAME',
      };
    }

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name,
        owner_id: ownerId,
        description: description || null,
        is_private: isPrivate,
      })
      .select()
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      return {
        success: false,
        message: 'Failed to create group',
        error: groupError.message,
      };
    }

    // Add owner as a member with 'owner' role
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: ownerId,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding owner as member:', memberError);
      // Rollback group creation
      await supabase.from('groups').delete().eq('id', group.id);
      return {
        success: false,
        message: 'Failed to create group membership',
        error: memberError.message,
      };
    }

    return {
      success: true,
      message: 'Group created successfully',
      data: group,
    };
  }

  /**
   * Add a member to a group
   */
  async addMember(
    groupId: string,
    userId: string,
    role: 'admin' | 'member' = 'member'
  ): Promise<GroupOperationResult> {
    // Check if user is already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return {
        success: false,
        message: 'User is already a member of this group',
        error: 'ALREADY_MEMBER',
      };
    }

    const { data, error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        role,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding member:', error);
      return {
        success: false,
        message: 'Failed to add member',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Member added successfully',
      data,
    };
  }

  /**
   * Remove a member from a group
   */
  async removeMember(groupId: string, userId: string): Promise<GroupOperationResult> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing member:', error);
      return {
        success: false,
        message: 'Failed to remove member',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Member removed successfully',
    };
  }

  /**
   * Delete a group (only owner can do this)
   */
  async deleteGroup(groupId: string, userId: string): Promise<GroupOperationResult> {
    // Verify ownership
    const { data: group } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== userId) {
      return {
        success: false,
        message: 'Only the group owner can delete this group',
        error: 'NOT_OWNER',
      };
    }

    // Delete the group (cascade will delete members)
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Error deleting group:', error);
      return {
        success: false,
        message: 'Failed to delete group',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Group deleted successfully',
    };
  }

  /**
   * Update group details
   */
  async updateGroup(
    groupId: string,
    userId: string,
    updates: { name?: string; description?: string; is_private?: boolean }
  ): Promise<GroupOperationResult> {
    // Verify ownership or admin role
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return {
        success: false,
        message: 'You do not have permission to edit this group',
        error: 'NO_PERMISSION',
      };
    }

    // Validate name if provided
    if (updates.name && (updates.name.length < 3 || updates.name.length > 50)) {
      return {
        success: false,
        message: 'Group name must be between 3 and 50 characters',
        error: 'INVALID_NAME',
      };
    }

    const { data, error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      console.error('Error updating group:', error);
      return {
        success: false,
        message: 'Failed to update group',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Group updated successfully',
      data,
    };
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string, userId: string): Promise<GroupOperationResult> {
    // Check if user is owner
    const { data: group } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (group?.owner_id === userId) {
      return {
        success: false,
        message: 'Owner cannot leave the group. Transfer ownership or delete the group instead.',
        error: 'OWNER_CANNOT_LEAVE',
      };
    }

    return this.removeMember(groupId, userId);
  }
}

export const groupService = new GroupService();
