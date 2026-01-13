import { useEffect, useState } from 'react';
import { leaderboardService, type LeaderboardEntry } from '@/services/leaderboardService';
import { socialService } from '@/services/socialService';
import { groupService } from '@/services/groupService';
import { useAppStore } from '@/store/appStore';
import { UserProfileModal } from './UserProfileModal';
import { type Group } from '@/types/social';
import '../styles/modals.css';
import '../styles/button-groups.css';
import '../styles/forms.css';
import './LeaderboardModal.css';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId?: string;
  onNavigateToGame?: (gameId: string) => void;
}

interface SelectedUserProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose, gameId, onNavigateToGame }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedGame, setSelectedGame] = useState<string>(gameId || 'all');
  const [selectedUser, setSelectedUser] = useState<SelectedUserProfile | null>(null);
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [filterByFollowing, setFilterByFollowing] = useState(false);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  
  const games = useAppStore(state => state.games);
  const authUser = useAppStore(state => state.authUser);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen, selectedGame, timePeriod, filterByFollowing, selectedGroupId]);

  useEffect(() => {
    if (filterByFollowing && authUser) {
      loadUserGroups();
    } else {
      setUserGroups([]);
      setSelectedGroupId(null);
    }
  }, [filterByFollowing, authUser]);

  const loadUserGroups = async () => {
    if (!authUser) return;
    setGroupsLoading(true);
    try {
      const groups = await groupService.getUserGroups(authUser.id);
      setUserGroups(groups);
    } catch (error) {
      console.error('Error loading user groups:', error);
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      const members = await groupService.getGroupMembers(groupId);
      setGroupMembers(members);
    } catch (error) {
      console.error('Error loading group members:', error);
      setGroupMembers([]);
    }
  };

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Calculate date range based on timePeriod early so following-filter can use it
      const now = new Date();
      let sinceDate: Date | undefined;
      if (timePeriod === 'week') {
        sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timePeriod === 'month') {
        sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timePeriod === 'year') {
        sinceDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      }

      // If filtering by following, use socialService instead (no follower counts shown)
      if (filterByFollowing && authUser) {
        try {
          let userIds: Set<string>;

          if (selectedGroupId) {
            // Filter by selected group members
            if (groupMembers.length === 0) {
              await loadGroupMembers(selectedGroupId);
            }
            userIds = new Set<string>(groupMembers.map((m: any) => m.user_id));
            userIds.add(authUser.id);
          } else {
            // Filter by followed users
            const followingLeaderboard = await socialService.getLeaderboardByFollowers(100, 0, authUser.id);
            userIds = new Set<string>(followingLeaderboard.map((u: any) => u.id));
            userIds.add(authUser.id);
          }

          // Get leaderboard data - either specific game or all games
          let leaderboardData: any[] = [];
          
          if (selectedGame === 'all') {
            // Get all game leaderboards within date range and aggregate only followed/group users
            const allLeaderboards = await leaderboardService.getAllGamesLeaderboard(50, sinceDate);
            const userMap = new Map<string, LeaderboardEntry>();

            for (const lb of allLeaderboards) {
              for (const entry of lb.entries) {
                if (!userIds.has(entry.userId)) continue;

                if (!userMap.has(entry.userId)) {
                  userMap.set(entry.userId, { ...entry, gameId: 'all', gameName: 'All Games' });
                } else {
                  const agg = userMap.get(entry.userId)!;
                  agg.totalWins += entry.totalWins;
                  agg.totalPlayed += entry.totalPlayed;
                  agg.winRate = agg.totalPlayed > 0 ? (agg.totalWins / agg.totalPlayed) * 100 : 0;
                  agg.currentStreak = Math.max(agg.currentStreak, entry.currentStreak);
                  agg.maxStreak = Math.max(agg.maxStreak, entry.maxStreak);
                  if (agg.averageScore !== null && entry.averageScore !== null) {
                    agg.averageScore = (agg.averageScore + entry.averageScore) / 2;
                  } else if (entry.averageScore !== null) {
                    agg.averageScore = entry.averageScore;
                  }
                  if (entry.lastPlayed > agg.lastPlayed) {
                    agg.lastPlayed = entry.lastPlayed;
                  }
                }
              }
            }

            // Ensure current user exists in map (add zeroed entry if no records)
            if (!userMap.has(authUser.id)) {
              userMap.set(authUser.id, {
                userId: authUser.id,
                displayName: authUser.displayName || 'You',
                avatarUrl: authUser.avatarUrl,
                gameId: 'all',
                gameName: 'All Games',
                totalWins: 0,
                totalPlayed: 0,
                winRate: 0,
                currentStreak: 0,
                maxStreak: 0,
                averageScore: null,
                lastPlayed: new Date().toISOString(),
              });
            }

            const aggregated = Array.from(userMap.values());
            aggregated.sort((a, b) => {
              if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
              return b.winRate - a.winRate;
            });

            leaderboardData = aggregated.slice(0, 100);
          } else {
            // Get specific game leaderboard and filter by followed/group users
            const gameLeaderboard = await leaderboardService.getGameLeaderboard(selectedGame, 100, sinceDate);
            leaderboardData = gameLeaderboard.filter(entry => userIds.has(entry.userId));
          }

          setLeaderboard(leaderboardData);
        } catch (err) {
          console.error('Error loading following leaderboard:', err);
          setError('Failed to load following leaderboard');
        }
        setIsLoading(false);
        return;
      }

      if (selectedGame === 'all') {
        const allLeaderboards = await leaderboardService.getAllGamesLeaderboard(50, sinceDate);
        // Aggregate by userId across all games
        const userMap = new Map<string, LeaderboardEntry>();
        for (const lb of allLeaderboards) {
          for (const entry of lb.entries) {
            if (!userMap.has(entry.userId)) {
              userMap.set(entry.userId, { ...entry });
            } else {
              const agg = userMap.get(entry.userId)!;
              agg.totalWins += entry.totalWins;
              agg.totalPlayed += entry.totalPlayed;
              agg.winRate = agg.totalPlayed > 0 ? (agg.totalWins / agg.totalPlayed) * 100 : 0;
              agg.currentStreak = Math.max(agg.currentStreak, entry.currentStreak);
              agg.maxStreak = Math.max(agg.maxStreak, entry.maxStreak);
              // For averageScore, combine scores if available
              if (agg.averageScore !== null && entry.averageScore !== null) {
                agg.averageScore = (agg.averageScore + entry.averageScore) / 2;
              } else if (entry.averageScore !== null) {
                agg.averageScore = entry.averageScore;
              }
              // For lastPlayed, use the most recent
              if (entry.lastPlayed > agg.lastPlayed) {
                agg.lastPlayed = entry.lastPlayed;
              }
            }
          }
        }
        // Convert to array and sort by totalWins, then winRate
        const aggregated = Array.from(userMap.values());
        aggregated.sort((a, b) => {
          if (b.totalWins !== a.totalWins) {
            return b.totalWins - a.totalWins;
          }
          return b.winRate - a.winRate;
        });
        const sliced = aggregated.slice(0, 100);
        setLeaderboard(sliced);
      } else {
        const entries = await leaderboardService.getGameLeaderboard(selectedGame, 100, sinceDate);
        setLeaderboard(entries);
      }
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error('[LeaderboardModal] Error loading leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay leaderboard-overlay" onClick={onClose}>
      <div className="modal-content leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏆 Leaderboard</h2>
          <button
            onClick={onClose}
            className="modal-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="leaderboard-content">

          {/* Time period filter */}
          <div className="mb-4">
            <label className="form-label">Time Period:</label>
            <div className="button-group">
              {(['week', 'month', 'year', 'all'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={`btn-group-item ${timePeriod === period ? 'active' : ''}`}
                >
                {period === 'week' && 'This Week'}
                {period === 'month' && 'This Month'}
                {period === 'year' && 'This Year'}
                {period === 'all' && 'All Time'}
              </button>
            ))}
          </div>
        </div>

          {/* Game selector */}
          <div className="mb-4">
            <label className="form-label">Filter by game:</label>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="form-select"
            >
            <option value="all">All Games</option>
            {games.map(game => (
              <option key={game.gameId} value={game.gameId}>
                {game.icon} {game.displayName}
              </option>
            ))}
          </select>
        </div>

          {/* Following filter */}
          {authUser && (
            <div className="mb-4 flex items-center justify-center">
              <button
                aria-pressed={filterByFollowing}
                onClick={() => setFilterByFollowing(prev => !prev)}
                className={`toggle-switch ${filterByFollowing ? 'on' : 'off'}`}
              >
                <span className="toggle-switch-label left">Global</span>
                <span className="toggle-switch-label right">Following</span>
                <span className="toggle-switch-knob" />
              </button>
            </div>
          )}

          {/* Group filter - only show when in following mode */}
          {filterByFollowing && authUser && (
            <div className="mb-4">
              <label className="form-label">Filter by group (optional):</label>
              {groupsLoading ? (
                <div style={{ padding: '8px', color: 'var(--text-secondary)' }}>Loading groups...</div>
              ) : (
                <div className="groups-filter-list">
                  <div
                    key="all"
                    className={`group-filter-item ${selectedGroupId === null ? 'active' : ''}`}
                    onClick={() => setSelectedGroupId(null)}
                  >
                    <div className="group-filter-icon">🌐</div>
                    <div className="group-filter-info">
                      <div className="group-filter-name">All Following</div>
                    </div>
                  </div>
                  {userGroups.map(group => (
                    <div
                      key={group.id}
                      className={`group-filter-item ${selectedGroupId === group.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        loadGroupMembers(group.id);
                      }}
                    >
                      <div className="group-filter-icon">🏠</div>
                      <div className="group-filter-info">
                        <div className="group-filter-name">{group.name}</div>
                        <div className="group-filter-meta">{group.member_count || 0} member{(group.member_count || 0) !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Leaderboard table */}
          <div className="flex-1 overflow-auto">
          {error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          ) : leaderboard.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <p>No leaderboard data yet.</p>
              <p className="text-sm mt-2">Be the first to set a record!</p>
            </div>
          ) : (
            <div className="leaderboard-table-container">
              {isLoading && (
                <div className="leaderboard-loading-overlay">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="spinner"></div>
                    <p className="text-gray-600 text-sm">Loading leaderboard...</p>
                  </div>
                </div>
              )}
              <table className="leaderboard-table">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Rank</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Player</th>
                    {/* Followers column removed */}
                    <th className="px-4 py-2 text-center text-sm font-semibold">Wins</th>
                    <th className="px-4 py-2 text-center text-sm font-semibold">Played</th>
                  </tr>
                </thead>
                <tbody>
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = authUser && entry.userId === authUser.id;
                  return (
                    <tr
                      key={`${entry.userId}-${entry.gameId}`}
                      className={`border-b hover:bg-gray-50 ${isCurrentUser ? 'current-user' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        {index + 1}
                        {index === 0 && ' 🥇'}
                        {index === 1 && ' 🥈'}
                        {index === 2 && ' 🥉'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => setSelectedUser({
                            userId: entry.userId,
                            displayName: entry.displayName,
                            avatarUrl: entry.avatarUrl,
                          })}
                          className="leaderboard-player-button"
                        >
                          {typeof entry.avatarUrl === 'string' && (entry.avatarUrl.startsWith('http://') || entry.avatarUrl.startsWith('https://')) ? (
                            <img
                              src={entry.avatarUrl}
                              alt="Profile"
                              className="leaderboard-avatar"
                              title="Profile picture"
                            />
                          ) : (
                            <div className="leaderboard-avatar-placeholder">
                              No Image
                            </div>
                          )}
                          <span className={`leaderboard-player-name ${isCurrentUser ? 'current-user' : ''}`}>
                            {entry.displayName}
                            {isCurrentUser && ' (You)'}
                          </span>
                        </button>
                      </td>
                      {/* Followers cell removed */}
                      <td className="px-4 py-3 text-sm text-center">{entry.totalWins}</td>
                      <td className="px-4 py-3 text-sm text-center">{entry.totalPlayed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserProfileModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.userId}
          displayName={selectedUser.displayName}
          avatarUrl={selectedUser.avatarUrl}
          onNavigateToGame={onNavigateToGame}
          onNavigateToProfile={(userId, displayName, avatarUrl) => {
            setSelectedUser({ userId, displayName, avatarUrl });
          }}
        />
      )}
    </div>
  );
};

