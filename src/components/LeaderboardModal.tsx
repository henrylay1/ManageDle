import React, { useEffect, useState } from 'react';
import { leaderboardService, type LeaderboardEntry } from '@/services/leaderboardService';
import { useAppStore } from '@/store/appStore';
import { UserProfileModal } from './UserProfileModal';

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
  
  const games = useAppStore(state => state.games);
  const authUser = useAppStore(state => state.authUser);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen, selectedGame]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (selectedGame === 'all') {
        const allLeaderboards = await leaderboardService.getAllGamesLeaderboard(50);
        // Flatten and combine all entries
        const combined = allLeaderboards.flatMap(lb => lb.entries);
        // Sort by total wins
        combined.sort((a, b) => b.totalWins - a.totalWins);
        setLeaderboard(combined.slice(0, 100));
      } else {
        const entries = await leaderboardService.getGameLeaderboard(selectedGame, 100);
        setLeaderboard(entries);
      }
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error(err);
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }} onClick={onClose}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '56rem',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          color: 'black'
        }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">🏆 Leaderboard</h2>
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
            <table className="w-full table-fixed">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="w-1/6 px-4 py-2 text-left text-sm font-semibold">Rank</th>
                  <th className="w-1/2 px-4 py-2 text-left text-sm font-semibold">Player</th>
                  <th className="w-1/6 px-4 py-2 text-center text-sm font-semibold">Wins</th>
                  <th className="w-1/6 px-4 py-2 text-center text-sm font-semibold">Played</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = authUser && entry.userId === authUser.id;
                  return (
                    <tr
                      key={`${entry.userId}-${entry.gameId}`}
                      className={`border-b hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50' : ''}`}
                    >
                      <td className="w-1/6 px-4 py-3 text-sm font-medium">
                        {index + 1}
                        {index === 0 && ' 🥇'}
                        {index === 1 && ' 🥈'}
                        {index === 2 && ' 🥉'}
                      </td>
                      <td className="w-1/2 px-4 py-3 text-sm">
                        <button
                          onClick={() => setSelectedUser({
                            userId: entry.userId,
                            displayName: entry.displayName,
                            avatarUrl: entry.avatarUrl,
                          })}
                          className="flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 hover:bg-blue-100 hover:scale-110 active:scale-95 font-medium"
                        >
                          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-lg flex-shrink-0">
                            {entry.avatarUrl || '😊'}
                          </div>
                          <span className={isCurrentUser ? 'font-semibold' : ''}>
                            {entry.displayName}
                            {isCurrentUser && ' (You)'}
                          </span>
                        </button>
                      </td>
                      <td className="w-1/6 px-4 py-3 text-sm text-center font-semibold">{entry.totalWins}</td>
                      <td className="w-1/6 px-4 py-3 text-sm text-center">{entry.totalPlayed}</td>
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
