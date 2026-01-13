import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { socialService } from '@/services/socialService';
import { FollowButton } from './FollowButton';
import { GameIconTooltip } from './GameIconTooltip';
import { validateStreaks } from '@/utils/helpers';
import '../styles/modals.css';
import './UserProfileModal.css';

interface UserGameStats {
  gameId: string;
  gameName: string;
  wins: number;
  plays: number;
  icon: string;
  description?: string;
  playStreak: number;
  winStreak: number;
  maxWinStreak: number;
}

interface SocialConnection {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  isFriend: boolean; // mutual follow
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  onNavigateToGame?: (gameId: string) => void;
  onNavigateToProfile?: (userId: string, displayName: string, avatarUrl: string | null) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  displayName,
  avatarUrl,
  onNavigateToGame,
  onNavigateToProfile,
}) => {
  const [gameStats, setGameStats] = useState<UserGameStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [followersCount, setFollowersCount] = useState(0);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch follower count
      const followerCount = await socialService.getFollowersCount(userId);
      setFollowersCount(followerCount);

      // Fetch following list
      const followingList = await socialService.getFollowingList(userId, 50, 0);
      
      // Fetch mutual friends to determine friend status
      const mutualFriends = await socialService.getMutualFriends(userId, 50, 0);
      const mutualFriendIds = new Set(mutualFriends.map((f: any) => f.id));
      
      // Build social connections list
      const connections: SocialConnection[] = followingList.map((user: any) => {
        const isFriend = mutualFriendIds.has(user.id);
        return {
          id: user.id,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          isFriend,
        };
      });
      
      setSocialConnections(connections);

      // Fetch user's game records
      const { data: recordsData, error: recordsError } = await supabase
        .from('game_records')
        .select('game_id, failed, metadata, created_at')
        .eq('user_id', userId);

      if (recordsError) {
        console.error('Failed to fetch user records:', recordsError);
        setError('Failed to load user profile');
        return;
      }

      // Fetch all games metadata from Supabase
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('game_id, name, icon, description');

      if (gamesError) {
        console.error('Failed to fetch games metadata:', gamesError);
        setError('Failed to load games metadata');
        return;
      }

      // Aggregate stats by game_id - get latest record for each game to access play/win/maxWin streaks
      const statsMap = new Map<string, { wins: number; plays: number; playStreak: number; winStreak: number; maxWinStreak: number }>();
      const latestRecordsMap = new Map<string, any>(); // Track latest record per game
      
      (recordsData || []).forEach(record => {
        // Track latest record for this game (most recent by createdAt)
        const existingLatest = latestRecordsMap.get(record.game_id);
        if (!existingLatest || record.created_at > existingLatest.created_at) {
          latestRecordsMap.set(record.game_id, record);
        }
        
        if (!statsMap.has(record.game_id)) {
          statsMap.set(record.game_id, { wins: 0, plays: 0, playStreak: 0, winStreak: 0, maxWinStreak: 0 });
        }
        const stat = statsMap.get(record.game_id)!;
        stat.plays++;
        if (!record.failed) {
          stat.wins++;
        }
      });

      // Update play/win/max-win streaks from latest records (stored in record.metadata)
      // Use shared utility to validate streaks based on record date
      latestRecordsMap.forEach((latestRecord, gameId) => {
        const stat = statsMap.get(gameId);
        if (stat) {
          const { playStreak, winStreak, maxWinStreak } = validateStreaks(
            latestRecord.created_at,
            latestRecord.metadata
          );
          
          stat.playStreak = playStreak;
          stat.winStreak = winStreak;
          stat.maxWinStreak = maxWinStreak;
        }
      });

      // Build the stats with game info
      const stats: UserGameStats[] = [];
      statsMap.forEach((stat, gameId) => {
        const game = gamesData?.find(g => g.game_id === gameId);
        stats.push({
          gameId,
          gameName: game?.name || gameId,
          wins: stat.wins,
          plays: stat.plays,
          icon: game?.icon || '🎮',
          description: game?.description,
          playStreak: stat.playStreak ?? 0,
          winStreak: stat.winStreak ?? 0,
          maxWinStreak: stat.maxWinStreak ?? 0,
        });
      });

      // Sort by plays (highest first)
      stats.sort((a, b) => b.plays - a.plays);
      setGameStats(stats);
    } catch (err) {
      console.error('[UserProfileModal] Error loading user profile:', err);
      setError('Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isImage = typeof avatarUrl === 'string' && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'));
  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content user-profile-modal">
        <div className="modal-header">
          {isImage ? (
            <a
              href={`/profile/${encodeURIComponent(displayName)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View public profile"
              className="user-profile-avatar-link"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={avatarUrl!}
                alt="Profile"
                className="user-profile-avatar"
                title="Profile picture"
              />
            </a>
          ) : (
            <div className="user-profile-avatar-placeholder">
              No Image
            </div>
          )}

          <div>
            <h2 className="user-profile-name">{displayName}</h2>
            <div className="user-profile-stats-header">
              <span className="user-profile-followers">👥 {followersCount} followers</span>
            </div>
          </div>

          <FollowButton userId={userId} displayName={displayName} />

          <button
            onClick={onClose}
            className="modal-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="user-profile-body">

        {/* Games List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-gray-500">Loading profile...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          ) : gameStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No games played yet.</p>
            </div>
          ) : (
            <div>
              <h3 className="user-profile-games-title">Game Statistics</h3>
              <table className="user-profile-games-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Play Streak</th>
                    <th>Win Streak</th>
                    <th>Max Win Streak</th>
                    <th>Wins</th>
                    <th>Plays</th>
                  </tr>
                </thead>
                <tbody>
                  {gameStats.map(stat => (
                    <tr key={stat.gameId} className="user-profile-game-row">
                      <td className="user-profile-game-cell user-profile-game-cell-clickable">
                        <GameIconTooltip 
                          icon={stat.icon} 
                          description={stat.description} 
                          className="user-profile-game-icon" 
                        />
                        <button
                          className="user-profile-game-name-button"
                          onClick={() => onNavigateToGame?.(stat.gameId)}
                          title="Click to view game in dashboard"
                        >
                          {stat.gameName}
                        </button>
                      </td>
                      <td className="user-profile-game-cell">{stat.playStreak}</td>
                      <td className="user-profile-game-cell">{stat.winStreak}</td>
                      <td className="user-profile-game-cell">{stat.maxWinStreak}</td>
                      <td className="user-profile-game-cell">{stat.wins}</td>
                      <td className="user-profile-game-cell">{stat.plays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Friends & Following Section */}
          {!isLoading && (
            <div className="user-profile-social-section">
              <h3 className="user-profile-social-title">Friends & Following</h3>
              {socialConnections.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>No following</p>
              ) : (
                <div className="user-profile-social-list">
                  {socialConnections.map(connection => {
                  const isImage = typeof connection.avatar_url === 'string' && 
                    (connection.avatar_url.startsWith('http://') || connection.avatar_url.startsWith('https://'));
                  return (
                    <div key={connection.id} className="profile-social-item">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onNavigateToProfile?.(
                            connection.id,
                            connection.display_name || 'Unknown',
                            connection.avatar_url
                          );
                        }}
                        className="user-profile-social-avatar-button"
                        title={`View ${connection.display_name || 'Unknown'}'s profile`}
                      >
                        {isImage ? (
                          <img
                            src={connection.avatar_url!}
                            alt={connection.display_name || 'User'}
                            className="user-profile-social-avatar"
                          />
                        ) : (
                          <div className="user-profile-social-avatar-placeholder">👤</div>
                        )}
                      </button>
                      <div className="user-profile-social-info">
                        <span className="user-profile-social-name">{connection.display_name || 'Unknown'}</span>
                        <span className={`user-profile-social-badge ${connection.isFriend ? 'friend' : 'following'}`}>
                          {connection.isFriend ? '👥 Friend' : '➡️ Following'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

