import { useState, useEffect } from 'react';
import { socialService } from '@/services/socialService';
import { useAppStore } from '@/store/appStore';
import '../styles/buttons.css';

interface FollowButtonProps {
  userId: string;
  displayName?: string;
  onFollowChange?: (isFollowing: boolean) => void;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ userId, onFollowChange }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const authUser = useAppStore(state => state.authUser);

  // Load follow status on mount
  useEffect(() => {
    if (!authUser) return;

    const loadFollowStatus = async () => {
      try {
        const following = await socialService.isFollowing(authUser.id, userId);
        setIsFollowing(following);
      } catch (err) {
        console.error('Error checking follow status:', err);
      }
    };

    loadFollowStatus();
  }, [authUser, userId]);

  const handleFollowClick = async () => {
    // Require authentication
    if (!authUser) {
      setError('You must be logged in to follow users');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = isFollowing
        ? await socialService.unfollowUser(authUser.id, userId)
        : await socialService.followUser(authUser.id, userId);

      if (result.success) {
        setIsFollowing(!isFollowing);
        onFollowChange?.(!isFollowing);
      } else {
        setError(result.message || 'Failed to update follow status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error in follow action:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show button for own profile
  if (authUser?.id === userId) {
    return null;
  }

  return (
    <div className="follow-button-container">
      <button
        onClick={handleFollowClick}
        disabled={isLoading || !authUser}
        className={`${isFollowing ? 'btn-secondary active' : 'btn-primary'}${isLoading ? ' loading' : ''}`}
        title={!authUser ? 'Sign in to follow users' : ''}
      >
        {isLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
      </button>
      {error && <span className="follow-error">{error}</span>}
    </div>
  );
};
