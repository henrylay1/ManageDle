import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/appStore';

interface UserGameStats {
  gameId: string;
  gameName: string;
  completions: number;
  icon: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  displayName,
  avatarUrl,
}) => {
  const [gameStats, setGameStats] = useState<UserGameStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const games = useAppStore(state => state.games);

  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch all completed games for this user
      const { data, error: fetchError } = await supabase
        .from('game_records')
        .select('game_id, completed')
        .eq('user_id', userId)
        .eq('completed', true);

      if (fetchError) {
        console.error('Failed to fetch user profile:', fetchError);
        setError('Failed to load user profile');
        return;
      }

      // Count completions per game
      const statsMap = new Map<string, number>();
      data?.forEach(record => {
        const count = statsMap.get(record.game_id) || 0;
        statsMap.set(record.game_id, count + 1);
      });

      // Build the stats with game info
      const stats: UserGameStats[] = [];
      games.forEach(game => {
        const completions = statsMap.get(game.gameId) || 0;
        if (completions > 0) {
          stats.push({
            gameId: game.gameId,
            gameName: game.displayName,
            completions,
            icon: game.icon || '🎮',
          });
        }
      });

      // Sort by completions (highest first)
      stats.sort((a, b) => b.completions - a.completions);
      setGameStats(stats);
    } catch (err) {
      console.error(err);
      setError('Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '40rem',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          color: 'black',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl">
            {avatarUrl || '😊'}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{displayName}</h2>
            <p className="text-gray-600 text-sm">Public Profile</p>
          </div>
        </div>

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
              <p>No completed puzzles yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-4">Completed Puzzles</h3>
              {gameStats.map(stat => (
                <div
                  key={stat.gameId}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stat.icon}</span>
                    <span className="font-medium">{stat.gameName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-sm">Completed:</span>
                    <span className="font-bold text-lg">{stat.completions}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
