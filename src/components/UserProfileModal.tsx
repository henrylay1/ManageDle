import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UserGameStats {
  gameId: string;
  gameName: string;
  wins: number;
  plays: number;
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
  // ...existing code...

  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch user stats from user_game_stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_game_stats')
        .select('game_id, total_wins, total_played')
        .eq('user_id', userId);

      if (statsError) {
        console.error('Failed to fetch user profile:', statsError);
        setError('Failed to load user profile');
        return;
      }

      // Fetch all games metadata from Supabase
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('game_id, name, icon');

      if (gamesError) {
        console.error('Failed to fetch games metadata:', gamesError);
        setError('Failed to load games metadata');
        return;
      }

      // Build the stats with game info
      const stats: UserGameStats[] = [];
      statsData?.forEach(statRow => {
        const game = gamesData?.find(g => g.game_id === statRow.game_id);
        stats.push({
          gameId: statRow.game_id,
          gameName: game?.name || statRow.game_id,
          wins: statRow.total_wins,
          plays: statRow.total_played,
          icon: game?.icon || '🎮',
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

  const isImage = typeof avatarUrl === 'string' && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'));
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
          {isImage ? (
            <a
              href={`/ManageDle/profile/${encodeURIComponent(displayName)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View public profile"
              style={{ display: 'inline-block' }}
              onClick={e => e.stopPropagation()}
            >
              <img
                src={avatarUrl!}
                alt="Profile"
                className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl"
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', background: 'black' }}
                title="Profile picture"
              />
            </a>
          ) : (
            <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl text-gray-400">
              No Image
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold" style={{ margin: '0.5em' }}>{displayName}</h2>
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
              <p>No games played yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-4">Game Statistics</h3>
              {gameStats.map(stat => (
                <div
                  key={stat.gameId}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stat.icon}</span>
                    <span className="font-medium">{stat.gameName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-gray-600 text-sm">Wins:</span>
                      <span className="font-bold text-lg ml-2">{stat.wins}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-600 text-sm">Plays:</span>
                      <span className="font-bold text-lg ml-2">{stat.plays}</span>
                    </div>
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
