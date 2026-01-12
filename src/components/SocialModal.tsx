import { useState, useEffect, useMemo } from 'react';
import { socialService } from '@/services/socialService';
import { groupService } from '@/services/groupService';
import { useAppStore } from '@/store/appStore';
import { UserProfileModal } from './UserProfileModal';
import { Group, Friend } from '@/types/social';
import '../styles/modals.css';
import '../styles/buttons.css';
import './SocialModal.css';

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedUserProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface SelectedGroup extends Group {
  members?: any[];
}

type TabType = 'friends' | 'groups';

export function SocialModal({ isOpen, onClose }: SocialModalProps) {
  const { authUser, isAuthenticated } = useAppStore();
  const userId = authUser?.id;
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUserProfile | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());

  // Load data when modal opens or tab changes
  useEffect(() => {
    if (isOpen && userId && isAuthenticated) {
      loadData();
      loadRelations();
    }
  }, [isOpen, userId, isAuthenticated, activeTab]);

  const loadRelations = async () => {
    if (!userId) return;
    try {
      const following = await socialService.getFollowingList(userId, 200, 0);
      const mutual = await socialService.getMutualFriends(userId, 200, 0);
      setFollowingIds(new Set((following || []).map((u: any) => u.id)));
      setMutualIds(new Set((mutual || []).map((u: any) => u.id)));
    } catch (err) {
      console.error('Error loading relations:', err);
    }
  };

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (activeTab === 'friends') {
        const friendsData = await socialService.getMutualFriends(userId);
        setFriends(friendsData);
      } else {
        const groupsData = await groupService.getUserGroups(userId);
        setGroups(groupsData);
      }
    } catch (error) {
      console.error('Error loading social data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!userId || !newGroupName.trim()) return;

    setCreating(true);
    try {
      const result = await groupService.createGroup(
        userId,
        newGroupName.trim(),
        newGroupDescription.trim() || undefined,
        newGroupPrivate
      );

      if (result.success) {
        // Reset form and reload groups
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupPrivate(false);
        setShowCreateGroup(false);
        loadData();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    } finally {
      setCreating(false);
    }
  };
  const handleFriendClick = (friend: Friend) => {
    setSelectedUser({
      userId: friend.id,
      displayName: friend.display_name || 'Anonymous',
      avatarUrl: friend.avatar_url,
    });
  };

  const handleGroupClick = (group: Group) => {
    setSelectedGroup(group);
    loadGroupMembers(group.id);
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      const members = await groupService.getGroupMembers(groupId);
      setGroupMembers(members);
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  const handleAddFriendToGroup = async (friendId: string) => {
    if (!selectedGroup) return;
    setAddingMember(true);
    try {
      const result = await groupService.addMember(selectedGroup.id, friendId);
      if (result.success) {
        // Reload group members
        loadGroupMembers(selectedGroup.id);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member to group');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string, displayName: string) => {
    if (!selectedGroup || !authUser) return;
    
    const confirmed = window.confirm(`Remove ${displayName} from ${selectedGroup.name}?`);
    if (!confirmed) return;
    
    setAddingMember(true); // Reuse this state for removing
    try {
      const result = await groupService.removeMember(selectedGroup.id, userId);
      if (result.success) {
        // Reload group members
        loadGroupMembers(selectedGroup.id);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member from group');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateDescription = async (description: string): Promise<boolean> => {
    if (!selectedGroup || !authUser) return false;
    
    setAddingMember(true); // Reuse this state for updating
    try {
      const result = await groupService.updateGroup(selectedGroup.id, authUser.id, { description });
      if (result.success) {
        // Update local state
        setSelectedGroup({ ...selectedGroup, description });
        return true;
      } else {
        alert(result.message);
        return false;
      }
    } catch (error) {
      console.error('Error updating description:', error);
      alert('Failed to update group description');
      return false;
    } finally {
      setAddingMember(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay social-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Social</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="social-tabs">
          <button
            className={`social-tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            👥 Friends
          </button>
          <button
            className={`social-tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            🏠 Groups
          </button>
        </div>

        <div className="modal-body">
          {!isAuthenticated ? (
            <div className="social-empty-state">
              <div className="empty-icon">🔒</div>
              <h3>Sign in to access social features</h3>
              <p>Create an account or sign in to see your friends and groups.</p>
            </div>
          ) : loading ? (
            <div className="social-loading">Loading...</div>
          ) : (
            <div className="social-tab-content">
              {activeTab === 'friends' ? (
                <FriendsTab friends={friends} onFriendClick={handleFriendClick} />
              ) : (
                <GroupsTab
                  groups={groups}
                  onGroupClick={handleGroupClick}
                  selectedGroup={selectedGroup}
                  onBackFromGroup={() => setSelectedGroup(null)}
                  friends={friends}
                  groupMembers={groupMembers}
                  onAddFriendToGroup={handleAddFriendToGroup}
                  onRemoveMember={handleRemoveMember}
                  onUpdateDescription={handleUpdateDescription}
                  onMemberClick={(member) => setSelectedUser({
                    userId: member.user_id,
                    displayName: member.display_name || 'Anonymous',
                    avatarUrl: member.avatar_url,
                  })}
                  followingIds={followingIds}
                  mutualIds={mutualIds}
                  addingMember={addingMember}
                  showCreateGroup={showCreateGroup}
                  setShowCreateGroup={setShowCreateGroup}
                  newGroupName={newGroupName}
                  setNewGroupName={setNewGroupName}
                  newGroupDescription={newGroupDescription}
                  setNewGroupDescription={setNewGroupDescription}
                  newGroupPrivate={newGroupPrivate}
                  setNewGroupPrivate={setNewGroupPrivate}
                  creating={creating}
                  onCreateGroup={handleCreateGroup}
                />
              )}
            </div>
          )}
        </div>

        {/* User Profile Modal */}
        {selectedUser && (
          <UserProfileModal
            isOpen={!!selectedUser}
            onClose={() => setSelectedUser(null)}
            userId={selectedUser.userId}
            displayName={selectedUser.displayName}
            avatarUrl={selectedUser.avatarUrl}
          />
        )}
      </div>
    </div>
  );
}

// Friends Tab Component
function FriendsTab({
  friends,
  onFriendClick,
}: {
  friends: Friend[];
  onFriendClick: (friend: Friend) => void;
}) {
  
  if (friends.length === 0) {
    return (
      <div className="social-empty-state">
        <div className="empty-icon">👥</div>
        <h3>No friends yet</h3>
        <p>Friends are people who follow you and you follow back. Start following others to make friends!</p>
      </div>
    );
  }

  return (
    <div className="friends-list">
      {friends.map((friend) => (
        <div
          key={friend.id}
          className="friend-item"
          onClick={() => onFriendClick(friend)}
        >
          {friend.avatar_url ? (
            <img src={friend.avatar_url} alt="" className="friend-avatar" />
          ) : (
            <div className="friend-avatar-placeholder">
              {(friend.display_name || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="friend-info">
            <div className="friend-name">{friend.display_name || 'Anonymous'}</div>
            <div className="friend-followers">
              {friend.followers_count} follower{friend.followers_count !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Groups Tab Component
function GroupsTab({
  groups,
  onGroupClick,
  selectedGroup,
  onBackFromGroup,
  friends,
  groupMembers,
  onAddFriendToGroup,
  onRemoveMember,
  onUpdateDescription,
  onMemberClick,
  followingIds,
  mutualIds,
  addingMember,
  showCreateGroup,
  setShowCreateGroup,
  newGroupName,
  setNewGroupName,
  newGroupDescription,
  setNewGroupDescription,
  newGroupPrivate,
  setNewGroupPrivate,
  creating,
  onCreateGroup,
}: {
  groups: Group[];
  onGroupClick: (group: Group) => void;
  selectedGroup: SelectedGroup | null;
  onBackFromGroup: () => void;
  friends: Friend[];
  groupMembers: any[];
  onAddFriendToGroup: (friendId: string) => void;
  onRemoveMember: (userId: string, displayName: string) => void;
  onUpdateDescription: (description: string) => Promise<boolean>;
  onMemberClick: (member: any) => void;
  followingIds: Set<string>;
  mutualIds: Set<string>;
  addingMember: boolean;
  showCreateGroup: boolean;
  setShowCreateGroup: (show: boolean) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  newGroupDescription: string;
  setNewGroupDescription: (desc: string) => void;
  newGroupPrivate: boolean;
  setNewGroupPrivate: (priv: boolean) => void;
  creating: boolean;
  onCreateGroup: () => void;
}) {
  const authUser = useAppStore(state => state.authUser);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionText, setEditDescriptionText] = useState('');
  
  // Determine if current user is the owner
  const isOwner = useMemo(() => {
    if (!authUser || !groupMembers) return false;
    const currentUserMember = groupMembers.find(m => m.user_id === authUser.id);
    return currentUserMember?.role === 'owner';
  }, [authUser, groupMembers]);

  const handleSaveDescription = async () => {
    const success = await onUpdateDescription(editDescriptionText);
    if (success) {
      setEditingDescription(false);
    }
  };
  // Show group detail view if a group is selected
  if (selectedGroup) {
    const memberIds = new Set(groupMembers.map(m => m.user_id));
    const nonMemberFriends = friends.filter(f => !memberIds.has(f.id));

    return (
      <>
        <button className="btn-secondary btn-small" onClick={onBackFromGroup} style={{ marginBottom: '16px' }}>
          ← Back to Groups
        </button>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedGroup.name}
          </h3>
          
          {editingDescription ? (
            <div style={{ marginTop: '12px' }}>
              <textarea
                value={editDescriptionText}
                onChange={(e) => setEditDescriptionText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  minHeight: '60px',
                  fontFamily: 'inherit'
                }}
                placeholder="Group description..."
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  className="btn-primary btn-small"
                  onClick={handleSaveDescription}
                  disabled={addingMember}
                >
                  {addingMember ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn-secondary btn-small"
                  onClick={() => {
                    setEditingDescription(false);
                    setEditDescriptionText(selectedGroup.description || '');
                  }}
                  disabled={addingMember}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {selectedGroup.description && (
                <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {selectedGroup.description}
                </p>
              )}
              {isOwner && (
                <button
                  className="btn-secondary btn-small"
                  onClick={() => {
                    setEditingDescription(true);
                    setEditDescriptionText(selectedGroup.description || '');
                  }}
                  style={{ fontSize: '0.85rem', marginTop: '8px' }}
                >
                  ✏️ Edit Description
                </button>
              )}
            </>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Members ({groupMembers.length})
          </h4>
          <div className="social-members-grid">
            {groupMembers.map((member) => {
              const isImage = typeof member.avatar_url === 'string' && 
                (member.avatar_url.startsWith('http://') || member.avatar_url.startsWith('https://'));
              const canRemove = isOwner && member.role !== 'owner';
              return (
                <div key={member.id} className="profile-social-item">
                  <button
                    onClick={() => onMemberClick(member)}
                    className="user-profile-social-avatar-button"
                    title={`View ${member.display_name || 'Anonymous'}'s profile`}
                  >
                    {isImage ? (
                      <img
                        src={member.avatar_url}
                        alt={member.display_name || 'User'}
                        className="user-profile-social-avatar"
                      />
                    ) : (
                      <div className="user-profile-social-avatar-placeholder">{(member.display_name || '?')[0].toUpperCase()}</div>
                    )}
                  </button>
                  <div className="user-profile-social-info">
                    <span className="user-profile-social-name">{member.display_name || 'Anonymous'}</span>
                    {(() => {
                      const uid = member.user_id;
                      const isYou = authUser && uid === authUser.id;
                      const isFriend = mutualIds && mutualIds.has(uid);
                      const isFollowingOnly = followingIds && followingIds.has(uid) && !isFriend;
                      const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member';
                      return (
                        <div className="member-badges">
                          <span className="group-role-badge">{roleLabel}</span>
                          {isYou ? (
                            <span className={`user-profile-social-badge you`}>🙋 You</span>
                          ) : isFriend ? (
                            <span className={`user-profile-social-badge friend`}>👥 Friend</span>
                          ) : isFollowingOnly ? (
                            <span className={`user-profile-social-badge following`}>➡️ Following</span>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                  {canRemove && (
                    <button
                      className="modal-close"
                      onClick={() => onRemoveMember(member.user_id, member.display_name || 'this user')}
                      disabled={addingMember}
                      title="Remove member"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {nonMemberFriends.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Add Friends
            </h4>
            <div className="groups-list">
              {nonMemberFriends.map((friend) => (
                <div key={friend.id} className="friend-item" style={{ cursor: 'auto', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="" className="friend-avatar" />
                    ) : (
                      <div className="friend-avatar-placeholder">
                        {(friend.display_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="friend-info">
                      <div className="friend-name">{friend.display_name || 'Anonymous'}</div>
                    </div>
                  </div>
                  <button
                    className="btn-primary btn-small"
                    onClick={() => onAddFriendToGroup(friend.id)}
                    disabled={addingMember}
                    style={{ marginLeft: '8px' }}
                  >
                    {addingMember ? '...' : '+'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {nonMemberFriends.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            All friends are already members!
          </p>
        )}
      </>
    );
  }

  // Show groups list when no group is selected
  return (
    <>
      {/* Create Group Section */}
      {showCreateGroup ? (
        <div className="create-group-form">
          <input
            type="text"
            placeholder="Group name (3-50 characters)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            maxLength={50}
          />
          <textarea
            placeholder="Description (optional)"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
            rows={2}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={newGroupPrivate}
              onChange={(e) => setNewGroupPrivate(e.target.checked)}
            />
            Private group (invite only)
          </label>
          <div className="create-group-actions">
            <button
              className="btn-secondary btn-small"
              onClick={() => {
                setShowCreateGroup(false);
                setNewGroupName('');
                setNewGroupDescription('');
                setNewGroupPrivate(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary btn-small"
              onClick={onCreateGroup}
              disabled={creating || newGroupName.trim().length < 3}
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="create-group-btn"
          onClick={() => setShowCreateGroup(true)}
        >
          <span>+</span> Create New Group
        </button>
      )}

      {/* Groups List */}
      {groups.length === 0 && !showCreateGroup ? (
        <div className="social-empty-state">
          <div className="empty-icon">🏠</div>
          <h3>No groups yet</h3>
          <p>Create a group to share your game progress with friends!</p>
        </div>
      ) : (
        <div className="groups-list">
          {groups.map((group) => (
            <div
              key={group.id}
              className="group-item"
              onClick={() => onGroupClick(group)}
            >
              <div className="group-icon">🏠</div>
              <div className="group-info">
                <div className="group-name">{group.name}</div>
                <div className="group-meta">
                  <span>{group.member_count || 0} member{(group.member_count || 0) !== 1 ? 's' : ''}</span>
                  {group.is_private && (
                    <span className="group-private-badge">Private</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Floating Action Button Component
export function SocialFAB({ onClick }: { onClick: () => void }) {
  return (
    <button className="social-fab" onClick={onClick} title="Social">
      <span className="social-fab-icon">👥</span>
    </button>
  );
}

export default SocialModal;
