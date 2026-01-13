import { useGameStats } from '@/hooks/useUserStats';
import { Game } from '@/types/models';
import '../styles/modals.css';
import '../styles/buttons.css';
import './StatsModal.css';

interface StatsModalProps {
  game: Game;
  onClose: () => void;
}

function StatsModal({ game, onClose }: StatsModalProps) {
  const { data: stats, isLoading, error } = useGameStats(game.gameId);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const winPercentage = stats && stats.totalPlayed > 0
    ? Math.round((stats.totalWon / stats.totalPlayed) * 100)
    : 0;

  const maxDistribution = stats 
    ? Math.max(...Object.values(stats.scoreDistribution), 1)
    : 1;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content stats-modal">
        <div className="modal-header">
          <h2>{game.icon} {game.displayName} Statistics</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="stats-content">
          {isLoading ? (
            <div className="stats-loading">
              <div className="loading-spinner"></div>
              <p>Loading statistics...</p>
            </div>
          ) : stats ? (
            <>
              <div className="stats-overview">
                <div className="stat-card">
                  <div className="stat-value">{stats.totalPlayed}</div>
                  <div className="stat-label">Played</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{winPercentage}%</div>
                  <div className="stat-label">Win Rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={stats.streakAtRisk ? { color: '#ffd700' } : undefined}>{stats.playstreak}</div>
                  <div className="stat-label">Play Streak</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.winstreak}</div>
                  <div className="stat-label">Win Streak</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.maxWinstreak}</div>
                  <div className="stat-label">Max Win Streak</div>
                </div>
              </div>

              <div className="stats-section">
                <h3>Performance</h3>
                <div className="performance-stats">
                  <div className="performance-item">
                    <span className="performance-label">Total Won</span>
                    <span className="performance-value">{stats.totalWon}</span>
                  </div>
                  <div className="performance-item">
                    <span className="performance-label">Total Failed</span>
                    <span className="performance-value">{stats.totalFailed}</span>
                  </div>
                  {stats.averageScore > 0 && (
                    <div className="performance-item">
                      <span className="performance-label">Average Score</span>
                      <span className="performance-value">{stats.averageScore}</span>
                    </div>
                  )}
                  {stats.lastPlayedDate && (
                    <div className="performance-item">
                      <span className="performance-label">Last Played</span>
                      <span className="performance-value">{stats.lastPlayedDate}</span>
                    </div>
                  )}
                </div>
              </div>

              {Object.keys(stats.scoreDistribution).length > 0 && (
                <div className="stats-section">
                  <h3>Score Distribution</h3>
                  <div className="score-distribution">
                    {Object.entries(stats.scoreDistribution)
                      .sort(([a], [b]) => {
                        const val = (s: string) => {
                          if (s === 'X') return Number.POSITIVE_INFINITY;
                          const n = parseFloat(s as string);
                          return isNaN(n) ? Number.POSITIVE_INFINITY : n;
                        };
                        return val(a) - val(b);
                      })
                      .map(([score, count]) => (
                        <div key={score} className="distribution-row">
                          <div className="distribution-label">{score}</div>
                          <div className="distribution-bar-container">
                            <div
                              className="distribution-bar"
                              style={{
                                width: `${(count / maxDistribution) * 100}%`,
                              }}
                            >
                              <span className="distribution-count">{count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {stats.totalPlayed === 0 && (
                <div className="no-stats">
                  <p>No games played yet. Start playing to see your statistics!</p>
                </div>
              )}
            </>
          ) : error ? (
            <div className="stats-error">
              <p>Failed to load statistics: {error.message}</p>
            </div>
          ) : (
            <div className="stats-error">
              <p>No statistics available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatsModal;
