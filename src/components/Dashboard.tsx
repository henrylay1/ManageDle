import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import GameCard from './GameCard';
import EditGameModal from './EditGameModal';
import ScoreEntryModal from './ScoreEntryModal';
import StatsModal from './StatsModal';
import RemoveModal from './RemoveModal';
import { LoginModal } from './LoginModal';
import { RegisterModal } from './RegisterModal';
import { AccountMenu } from './AccountMenu';
import { LeaderboardModal } from './LeaderboardModal';
import { authService } from '@/services/authService';
import { Game } from '@/types/models';
import './Dashboard.css';

function Dashboard() {
  const { activeGames, games, todayRecords, authUser, isAuthenticated } = useAppStore();
  const [showAddGame, setShowAddGame] = useState(false);
  const [showEditGame, setShowEditGame] = useState(false);
  const [showScoreEntry, setShowScoreEntry] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['academic']);
  
  // Shared auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const handlePlayGame = (game: Game) => {
    window.open(game.url, '_blank');
    // Open log score modal after opening game
    setSelectedGame(game);
    setShowScoreEntry(true);
  };

  const handleLogScore = (game: Game) => {
    setSelectedGame(game);
    setShowScoreEntry(true);
  };

  const handleViewStats = (game: Game) => {
    setSelectedGame(game);
    setShowStats(true);
  };

  // const handleEditGame = (game: Game) => {
  //   setEditingGame(game);
  //   setShowEditGame(true);
  // };

  const getTodayRecord = (gameId: string) => {
    return todayRecords.find(r => r.gameId === gameId);
  };

  const handleRemoveGame = (game: Game) => {
    setSelectedGame(game);
    setShowRemove(true);
  };

  const handleRemoveFromActive = async () => {
    if (selectedGame) {
      await useAppStore.getState().toggleGameActive(selectedGame.gameId);
    }
  };

  const handleDeleteRecord = async () => {
    if (selectedGame) {
      const record = getTodayRecord(selectedGame.gameId);
      if (record?.recordId) {
        await useAppStore.getState().deleteRecord(record.recordId);
      }
    }
  };

  return (
    <div className="dashboard">
      <section className="dashboard-section">
        <div className="section-header">
          <h2>📅 Today's Games</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Leaderboard Button */}
            {authService.isConfigured() && (
              <button
                className="btn-primary btn-leaderboard"
                onClick={() => setShowLeaderboard(true)}
              >
                🏆 Leaderboard
              </button>
            )}

            {/* Auth Buttons */}
            {authService.isConfigured() ? (
              isAuthenticated && authUser ? (
                <button
                  className="btn-primary btn-account"
                  onClick={() => setShowAccountMenu(true)}
                >
                  {authUser.displayName || authUser.email} ⚙️
                </button>
              ) : (
                <>
                  <button
                    className="btn-primary btn-login"
                    onClick={() => setShowLoginModal(true)}
                  >
                    Log In
                  </button>
                  <button
                    className="btn-primary btn-signup"
                    onClick={() => setShowRegisterModal(true)}
                  >
                    Sign Up
                  </button>
                </>
              )
            ) : (
              <span className="offline-mode-text">
                ℹ️ Offline Mode
              </span>
            )}

            {/* <button 
              className="btn-primary"
              onClick={() => setShowAddGame(true)}
            >
              + Add Game
            </button> */}
          </div>
        </div>
        
        {activeGames.length === 0 ? (
          <div className="empty-state">
            <p>No games in your roster yet!</p>
            <button onClick={() => setShowAddGame(true)}>
              Add your first game
            </button>
          </div>
        ) : (
          <div className="games-grid">
            {activeGames
              .slice()
              .sort((a, b) => {
                const aCompleted = !!getTodayRecord(a.gameId)?.completed;
                const bCompleted = !!getTodayRecord(b.gameId)?.completed;
                if (aCompleted === bCompleted) return 0;
                return aCompleted ? -1 : 1;
              })
              .map(game => (
                <GameCard
                  key={game.gameId}
                  game={game}
                  record={getTodayRecord(game.gameId)}
                  onPlay={() => handlePlayGame(game)}
                  onLogScore={() => handleLogScore(game)}
                  onViewStats={() => handleViewStats(game)}
                  onRemove={() => handleRemoveGame(game)}
                />
              ))}
          </div>
        )}
      </section>
      <section className="dashboard-section">
        <div className="section-header">
          <h2>🎯 All Games</h2>
        </div>
        
        {/* Academic Games */}
        <div className="category-section">
          <h3 
            className={`category-title ${expandedCategories.includes('academic') ? 'expanded' : ''}`}
            onClick={() => setExpandedCategories(expandedCategories => expandedCategories.includes('academic')
              ? expandedCategories.filter(c => c !== 'academic')
              : [...expandedCategories, 'academic'])}
          >
            <span className="category-toggle">{expandedCategories.includes('academic') ? '▼' : '▶'}</span>
            📚 Academic ({games.filter(g => g.category === 'academic').length})
          </h3>
          {expandedCategories.includes('academic') && (
            <div className="games-list">
              {games.filter(g => g.category === 'academic').map(game => (
                <div key={game.gameId} className="game-list-item">
                  <span className="game-icon">{game.icon}</span>
                  <span className="game-name">{game.displayName}</span>
                  <span className={`game-status ${game.isActive ? 'active' : 'inactive'}`}>
                    {game.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    className="btn-small"
                    onClick={() => useAppStore.getState().toggleGameActive(game.gameId)}
                  >
                    {game.isActive ? 'Remove' : 'Add to Dailies'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Games */}
        <div className="category-section">
          <h3 
            className={`category-title ${expandedCategories.includes('games') ? 'expanded' : ''}`}
            onClick={() => setExpandedCategories(expandedCategories => expandedCategories.includes('games')
              ? expandedCategories.filter(c => c !== 'games')
              : [...expandedCategories, 'games'])}
          >
            <span className="category-toggle">{expandedCategories.includes('games') ? '▼' : '▶'}</span>
            🎮 Games ({games.filter(g => g.category === 'games').length})
          </h3>
          {expandedCategories.includes('games') && (
            <div className="games-list">
              {games.filter(g => g.category === 'games').map(game => (
                <div key={game.gameId} className="game-list-item">
                  <span className="game-icon">{game.icon}</span>
                  <span className="game-name">{game.displayName}</span>
                  <span className={`game-status ${game.isActive ? 'active' : 'inactive'}`}>
                    {game.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    className="btn-small"
                    onClick={() => useAppStore.getState().toggleGameActive(game.gameId)}
                  >
                    {game.isActive ? 'Remove' : 'Add to Dailies'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Misc Games */}
        <div className="category-section">
          <h3 
            className={`category-title ${expandedCategories.includes('misc') ? 'expanded' : ''}`}
            onClick={() => setExpandedCategories(expandedCategories => expandedCategories.includes('misc')
              ? expandedCategories.filter(c => c !== 'misc')
              : [...expandedCategories, 'misc'])}
          >
            <span className="category-toggle">{expandedCategories.includes('misc') ? '▼' : '▶'}</span>
            📦 Misc ({games.filter(g => g.category === 'misc').length})
          </h3>
          {expandedCategories.includes('misc') && (
            <div className="games-list">
              {games.filter(g => g.category === 'misc').map(game => (
                <div key={game.gameId} className="game-list-item">
                  <span className="game-icon">{game.icon}</span>
                  <span className="game-name">{game.displayName}</span>
                  <span className={`game-status ${game.isActive ? 'active' : 'inactive'}`}>
                    {game.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    className="btn-small"
                    onClick={() => useAppStore.getState().toggleGameActive(game.gameId)}
                  >
                    {game.isActive ? 'Remove' : 'Add to Dailies'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hide Custom category for now
        <div className="category-section">
          <h3 
            className={`category-title ${expandedCategories.includes('custom') ? 'expanded' : ''}`}
            onClick={() => setExpandedCategories(expandedCategories => expandedCategories.includes('custom')
              ? expandedCategories.filter(c => c !== 'custom')
              : [...expandedCategories, 'custom'])}
          >
            <span className="category-toggle">{expandedCategories.includes('custom') ? '▼' : '▶'}</span>
            ✨ Custom (COMING SOON) ({games.filter(g => g.category === 'custom').length})
          </h3>
          {expandedCategories.includes('custom') && (
            <div className="games-list">
              {games.filter(g => g.category === 'custom').map(game => (
                <div key={game.gameId} className="game-list-item">
                  <span className="game-icon">{game.icon}</span>
                  <span className="game-name">{game.displayName}</span>
                  <span className={`game-status ${game.isActive ? 'active' : 'inactive'}`}>
                    {game.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    className="btn-small"
                    onClick={() => useAppStore.getState().toggleGameActive(game.gameId)}
                  >
                    {game.isActive ? 'Remove' : 'Add to Dailies'}
                  </button>
                  <button
                    className="btn-small btn-edit"
                    onClick={() => handleEditGame(game)}
                    title="Edit game"
                  >
                    ✏️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        */}
      </section>

      {showAddGame && (
        <div className="coming-soon-popup" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem 3rem',
            borderRadius: '12px',
            boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
            textAlign: 'center',
            color: 'black'
          }}>
            <h2>Coming Soon</h2>
            <p>This feature is coming soon!</p>
            <button onClick={() => setShowAddGame(false)} style={{marginTop: '1rem'}}>Close</button>
          </div>
        </div>
      )}

      {showEditGame && editingGame && (
        <EditGameModal 
          game={editingGame}
          onClose={() => {
            setShowEditGame(false);
            setEditingGame(null);
          }} 
        />
      )}

      {showScoreEntry && selectedGame && (
        <ScoreEntryModal
          game={selectedGame}
          existingRecord={getTodayRecord(selectedGame.gameId)}
          onClose={() => {
            setShowScoreEntry(false);
            setSelectedGame(null);
          }}
        />
      )}

      {showStats && selectedGame && (
        <StatsModal
          game={selectedGame}
          onClose={() => {
            setShowStats(false);
            setSelectedGame(null);
          }}
        />
      )}

      {showRemove && selectedGame && (
        <RemoveModal
          game={selectedGame}
          record={getTodayRecord(selectedGame.gameId)}
          onClose={() => {
            setShowRemove(false);
            setSelectedGame(null);
          }}
          onRemoveGame={handleRemoveFromActive}
          onDeleteRecord={handleDeleteRecord}
        />
      )}

      {/* Auth & Leaderboard Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToRegister={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }}
        email={authEmail}
        password={authPassword}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
      />

      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSwitchToLogin={() => {
          setShowRegisterModal(false);
          setShowLoginModal(true);
        }}
        email={authEmail}
        password={authPassword}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
      />

      <AccountMenu
        isOpen={showAccountMenu}
        onClose={() => setShowAccountMenu(false)}
      />

      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
    </div>
  );
}

export default Dashboard;
