import { useEffect, useState } from 'react';
import { leaderboardService, type LeaderboardEntry } from '@/services/leaderboardService';
import { useAppStore } from '@/store/appStore';
import { UserProfileModal } from './UserProfileModal';
import './LeaderboardModal.css';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId?: string;
}

interface SelectedUserProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose, gameId }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedGame, setSelectedGame] = useState<string>(gameId || 'all');
  const [selectedUser, setSelectedUser] = useState<SelectedUserProfile | null>(null);
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  
  const games = useAppStore(state => state.games);
  const authUser = useAppStore(state => state.authUser);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen, selectedGame, timePeriod]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError('');

    // Calculate date range based on timePeriod
    const now = new Date();
    let sinceDate: Date | undefined;
    
    if (timePeriod === 'week') {
      sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timePeriod === 'month') {
      sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timePeriod === 'year') {
      sinceDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    try {
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

  const getUserRank = () => {
    if (!authUser) return null;
    const index = leaderboard.findIndex(entry => entry.userId === authUser.id);
    return index >= 0 ? index + 1 : null;
  };

  if (!isOpen) return null;

  return (
    <div className="leaderboard-backdrop" onClick={onClose}>
      <div className="leaderboard-container" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">🏆 Leaderboard</h2>
        </div>

        {/* Time period filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Time Period:</label>
          <div className="flex gap-2">
            {(['week', 'month', 'year', 'all'] as const).map(period => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
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
          <label className="block text-sm font-medium mb-2">Filter by game:</label>
          <select
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Games</option>
            {games.map(game => (
              <option key={game.gameId} value={game.gameId}>
                {game.icon} {game.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* User's rank */}
        {authUser && getUserRank() && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-md">
            <p className="text-sm font-semibold">
              Your rank: #{getUserRank()} out of {leaderboard.length} players
            </p>
          </div>
        )}

        {/* Leaderboard table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-gray-500">Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No leaderboard data yet.</p>
              <p className="text-sm mt-2">Be the first to set a record!</p>
            </div>
          ) : (
            <table className="leaderboard-table">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Rank</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Player</th>
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
                      <td className="px-4 py-3 text-sm text-center">{entry.totalWins}</td>
                      <td className="px-4 py-3 text-sm text-center">{entry.totalPlayed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>

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
  );
};
