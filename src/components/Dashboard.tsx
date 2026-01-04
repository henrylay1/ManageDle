import { useState, useRef, useEffect } from 'react';
import TicketModal from './TicketModal';
import ReactTooltip from 'react-tooltip';
import { useAppStore } from '@/store/appStore';
import GameCard from './GameCard';
import { GameIconTooltip } from './GameIconTooltip';
import ScoreEntryModal from './ScoreEntryModal';
import StatsModal from './StatsModal';
import RemoveModal from './RemoveModal';
import ChangelogModal from './ChangelogModal';
import { LoginModal } from './LoginModal';
import { RegisterModal } from './RegisterModal';
import { AccountMenu } from './AccountMenu';
import { LeaderboardModal } from './LeaderboardModal';
import { authService } from '@/services/authService';
import { Game } from '@/types/models';
import './Buttons.css';
import './Dashboard.css';

// Reusable TooltipWithArrow component
export function TooltipWithArrow({
  onHide,
  position = 'right',
  message,
  arrow = 'left',
  style = {},
}: {
  onHide: () => void;
  position?: 'right' | 'left';
  message: string;
  arrow?: 'left' | 'right';
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const arrowStyle = {
    display: 'inline-block',
    marginRight: arrow === 'left' ? 12 : 0,
    marginLeft: arrow === 'right' ? 12 : 0,
    fontSize: '2rem',
    animation: arrow === 'right' ? 'arrowOscillateRight 1s infinite' : 'arrowOscillate 1s infinite',
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'absolute',
        right: position === 'right' ? '-280px' : undefined,
        left: position === 'left' ? '-280px' : undefined,
        top: '50%',
        transform: 'translateY(-50%)',
        background: '#222',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000,
        cursor: 'pointer',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (hovered) onHide(); }}
    >
      {arrow === 'left' && <span style={arrowStyle}>&#8592;</span>}
      {message}
      {arrow === 'right' && <span style={arrowStyle}>&#8594;</span>}
      <style>{`
        @keyframes arrowOscillate {
          0% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(0); }
          60% { transform: translateX(-10px); }
          80% { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
        @keyframes arrowOscillateRight {
          0% { transform: translateX(0); }
          20% { transform: translateX(10px); }
          40% { transform: translateX(0); }
          60% { transform: translateX(10px); }
          80% { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// Backwards compatibility for existing onboarding tooltip
function TooltipWithHoverOut({ onHide }: { onHide: () => void }) {
  const [highlight, setHighlight] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setHighlight(false), 1000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <TooltipWithArrow
      onHide={onHide}
      message="Click to add"
      arrow="left"
      position="right"
      style={highlight ? { background: '#c00', color: '#fff', border: '2px solid #f33' } : {}}
    />
  );
}

function Dashboard() {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('theme') || 'dark');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const { 
    activeGames, 
    games, 
    todayRecords, 
    authUser, 
    isAuthenticated, 
    savingGames,
    organizeMode,
    toggleOrganizeMode,
    reorderActiveGames,
    newGameIds,
    clearNewGame,
  } = useAppStore();
  const [showScoreEntry, setShowScoreEntry] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [showClearAll, setShowClearAll] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegisterFromStats, setIsRegisterFromStats] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['academic']);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [shimmeringGameId, setShimmeringGameId] = useState<string | null>(null);
  const wordleAddBtnRef = useRef<HTMLButtonElement | null>(null);
  const gameCardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Drag and drop state
  const [draggedGameId, setDraggedGameId] = useState<string | null>(null);
  const [visualOrder, setVisualOrder] = useState<string[]>([]);
  const [disableTransitions, setDisableTransitions] = useState(false);
  const [localBaseOrder, setLocalBaseOrder] = useState<Game[]>(activeGames);
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null);
  const [cardsPerRow, setCardsPerRow] = useState<number>(3);
  const gamesGridRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  
  // Todo sort state (temporary, not persisted)
  const [todoSortActive, setTodoSortActive] = useState(false);
  
  // Shared auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Rebuild tooltip when onboarding becomes active
  useEffect(() => {
    if (onboardingActive) {
      setTimeout(() => {
        ReactTooltip.rebuild();
      }, 100);
    }
  }, [onboardingActive]);

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
    if (!isAuthenticated) {
      setSelectedGame(game);
      setIsRegisterFromStats(true);
      setShowRegisterModal(true);
      return;
    }
    setSelectedGame(game);
    setShowStats(true);
  };

  const getTodayRecord = (gameId: string) => {
    const record = todayRecords.find(r => r.gameId === gameId);
    return record;
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

  const handleShimmerGameCard = (game: Game) => {
    // Scroll to and shimmer the game card (without removing)
    const cardRef = gameCardRefsMap.current.get(game.gameId);
    if (cardRef) {
      cardRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Apply shimmer effect
      setShimmeringGameId(game.gameId);
      setTimeout(() => setShimmeringGameId(null), 1500);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, gameId: string) => {
    setDraggedGameId(gameId);
    // Initialize visual order based on current displayed order
    const displayed = (organizeMode
      ? localBaseOrder
      : todoSortActive
        ? (() => {
            const incompleteGames = localBaseOrder.filter(g => !getTodayRecord(g.gameId));
            const completedGames = localBaseOrder.filter(g => !!getTodayRecord(g.gameId));
            return [...incompleteGames, ...completedGames];
          })()
        : localBaseOrder
    );
    const currentOrder = displayed.map(g => g.gameId);
    setVisualOrder(currentOrder);
    // Measure card size and calculate cards per row for 2D transforms
    const el = gameCardRefsMap.current.get(gameId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setCardSize({ width: rect.width, height: rect.height });
      
      // Calculate cards per row based on grid container width
      const gridEl = el.parentElement;
      if (gridEl) {
        const gridWidth = gridEl.clientWidth;
        const perRow = Math.max(1, Math.floor(gridWidth / rect.width));
        setCardsPerRow(perRow);
      }
    }
   
    // Try to use our SVG as the drag image so pointer shows custom icon during drag
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', gameId);
  };

  const handleDragOver = (e: React.DragEvent, gameId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Auto-scroll when near top/bottom of viewport
    const scrollThreshold = 80; // pixels from edge to start scrolling
    const scrollSpeed = 12; // pixels per frame
    const viewportY = e.clientY;
    const viewportHeight = window.innerHeight;

    // Clear any existing auto-scroll interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // Start auto-scroll if near edges
    if (viewportY < scrollThreshold) {
      // Near top - scroll up
      autoScrollIntervalRef.current = window.setInterval(() => {
        window.scrollBy(0, -scrollSpeed);
      }, 16);
    } else if (viewportY > viewportHeight - scrollThreshold) {
      // Near bottom - scroll down
      autoScrollIntervalRef.current = window.setInterval(() => {
        window.scrollBy(0, scrollSpeed);
      }, 16);
    }

    if (!draggedGameId || gameId === draggedGameId || visualOrder.length === 0) return;

    const draggedIndex = visualOrder.indexOf(draggedGameId);
    const targetIndex = visualOrder.indexOf(gameId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Get target element rect to measure cursor position
    const targetEl = gameCardRefsMap.current.get(gameId);
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const fractionX = (e.clientX - rect.left) / rect.width;
    const fractionY = (e.clientY - rect.top) / rect.height;

    const perRow = Math.max(1, cardsPerRow || 1);
    const sameRow = Math.floor(draggedIndex / perRow) === Math.floor(targetIndex / perRow);
    const threshold = 0.10; // 10% threshold to trigger swap

    let shouldSwap = false;
    if (sameRow) {
      if (draggedIndex < targetIndex) {
        // moving right: cursor must be at least 10% into target from left
        shouldSwap = fractionX > threshold;
      } else if (draggedIndex > targetIndex) {
        // moving left: cursor must be at least 10% into target from right
        shouldSwap = fractionX < (1 - threshold);
      }
    } else {
      // different rows -> check vertical fraction
      if (draggedIndex < targetIndex) {
        // moving down: cursor must be 25% into target from top
        shouldSwap = fractionY > threshold;
      } else if (draggedIndex > targetIndex) {
        // moving up: cursor must be 25% into target from bottom
        shouldSwap = fractionY < (1 - threshold);
      }
    }

    if (shouldSwap) {
      const newOrder = [...visualOrder];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedGameId);
      setVisualOrder(newOrder);
    }
  };

  const handleDragLeave = () => {
    // Don't reset visual order - let it animate smoothly
  };

  const finalizeReorder = (order?: string[]) => {
    const finalOrder = order ?? visualOrder.slice();
    if (!finalOrder || finalOrder.length === 0) {
      setDraggedGameId(null);
      setVisualOrder([]);
      return;
    }

    // Disable transitions so elements snap immediately
    setDisableTransitions(true);
    // Force a reflow so the `transition: none` takes effect immediately
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    void document.body.offsetHeight;

    // Persist the visual order to database
    // Optimistically update local order so DOM reflects final order immediately
    const finalGames = finalOrder.map(id => activeGames.find(g => g.gameId === id) || games.find(g => g.gameId === id)).filter((g): g is Game => !!g);
    if (finalGames.length === finalOrder.length) {
      setLocalBaseOrder(finalGames);
    }
    reorderActiveGames(finalOrder);

    // Clear drag state
    setDraggedGameId(null);
    setVisualOrder([]);

    // Re-enable transitions after a short delay
    setTimeout(() => setDisableTransitions(false), 50);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Clear auto-scroll interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    finalizeReorder();
  };

  const handleDragEnd = () => {
    // Clear auto-scroll interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    // Always finalize the reorder to ensure transitions complete
    if (visualOrder.length > 0) {
      finalizeReorder();
    } else {
      setDraggedGameId(null);
      setVisualOrder([]);
    }
    try { document.body.style.cursor = ''; } catch (err) { }
  };

  const handleSortByTodo = () => {
    // Toggle temporary todo sort (incomplete first)
    // This is not persisted - resets on page reload
    setTodoSortActive(!todoSortActive);
  };

  // Reset todo sort when entering organize mode
  useEffect(() => {
    if (organizeMode) {
      setTodoSortActive(false);
    }
  }, [organizeMode]);

  // Keep localBaseOrder in sync with store when not actively dragging
  useEffect(() => {
    if (!draggedGameId && visualOrder.length === 0) {
      setLocalBaseOrder(activeGames);
    }
  }, [activeGames, draggedGameId, visualOrder.length]);

  const handleRemoveAllFromActive = () => {
    setShowClearAll(true);
  };

  const handleConfirmClearAll = async () => {
    // Toggle all active games to inactive
    for (const game of activeGames) {
      await useAppStore.getState().toggleGameActive(game.gameId);
    }
    setShowClearAll(false);
  };

  const handleDeleteRecord = async () => {
    if (selectedGame) {
      const record = getTodayRecord(selectedGame.gameId);
      if (record?.recordId) {
        await useAppStore.getState().deleteRecord(record.recordId);
      }
    }
  };

  // Theme toggle handler
  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    window.localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Set theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div
      className="dashboard"
      style={{ position: 'relative' }}
      onDragOver={(e) => { if (organizeMode) e.preventDefault(); }}
      onDrop={(e) => {
        if (!organizeMode) return;
        e.preventDefault();
        finalizeReorder();
      }}
    >
      {/* Persistent dashboard header at the very top */}
      <header className="dashboard-header">
        <div className="dashboard-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem' }}>🎮</span>
            <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.02em' }}>ManageDle</span>
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #888)' }}>Your daily puzzle hub</span>
        </div>
        <div className="dashboard-header-actions">
          {/* Theme toggle icon */}
          <button
            className="btn-icon btn-theme-toggle"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={handleThemeToggle}
            style={{ fontSize: '1.5rem', cursor: 'pointer' }}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          {/* Ticket/feedback icon */}
          <button
            className="btn-icon btn-ticket"
            title="Send feedback or report a problem"
            onClick={() => setShowTicketModal(true)}
            style={{ fontSize: '1.5rem', cursor: 'pointer' }}
          >
            📨
          </button>
          {/* Changelog icon */}
          <button
            className="btn-icon btn-changelog"
            title="View changelog"
            onClick={() => setShowChangelog(true)}
            style={{ fontSize: '1.4rem', cursor: 'pointer', marginLeft: 6 }}
          >
            📜
          </button>
        </div>
      </header>
      <section className="dashboard-section">
        <div className="section-header">
          <h2>📅 Today's Games</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Ticket Modal */}
              <TicketModal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} />
            {/* Organize Mode Toggle */}
            {activeGames.length > 1 && (
              <button
                className={`btn-secondary ${organizeMode ? 'active' : ''}`}
                onClick={toggleOrganizeMode}
                disabled={todoSortActive}
                title={todoSortActive ? 'Exit todo mode to organize' : organizeMode ? 'Exit organize mode' : 'Drag to reorder games'}
              >
                {organizeMode ? '✓ Done' : '↕️ Organize'}
              </button>
            )}
            {/* Todo Sort Button */}
            {activeGames.length > 1 && !organizeMode && (
              <button
                className={`btn-secondary ${todoSortActive ? 'active' : ''}`}
                onClick={handleSortByTodo}
                title={todoSortActive ? 'Show custom order' : 'Sort incomplete games first'}
              >
                {todoSortActive ? '✓ Todo' : '📋 Todo'}
              </button>
            )}
            
            {/* Remove All from Active Button */}
            {activeGames.length > 0 && !organizeMode && (
              <button
                className="btn-secondary"
                onClick={handleRemoveAllFromActive}
                title="Remove all games from active"
              >
                Clear All
              </button>
            )}
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

          </div>
        </div>
        
        {activeGames.length === 0 ? (
          <div className="empty-state">
            <p>No games in your roster yet!</p>
            <button
              className="btn-small"
              onClick={() => {
                // Expand all categories and activate onboarding
                setExpandedCategories(['academic', 'games', 'misc']);
                setOnboardingActive(true);
              }}
            >
              Add your first game
            </button>
          </div>
        ) : organizeMode ? (
          // Organize mode: fullscreen overlay with centered games grid
          <div className="organize-overlay">
            <div className="organize-overlay-header">
              <h2>📋 Organize Your Games</h2>
              <button 
                className="btn-icon"
                onClick={() => toggleOrganizeMode()}
                title="Exit organize mode"
              >
                ✕
              </button>
            </div>
            <div
              ref={gamesGridRef}
              className="organize-grid-container"
              onDragOver={(e) => {
                e.preventDefault();
                // Auto-scroll when near top/bottom of viewport
                const scrollThreshold = 80;
                const scrollSpeed = 12;
                const viewportY = e.clientY;
                const viewportHeight = window.innerHeight;

                if (autoScrollIntervalRef.current) {
                  clearInterval(autoScrollIntervalRef.current);
                  autoScrollIntervalRef.current = null;
                }

                if (viewportY < scrollThreshold) {
                  autoScrollIntervalRef.current = window.setInterval(() => {
                    window.scrollBy(0, -scrollSpeed);
                  }, 16);
                } else if (viewportY > viewportHeight - scrollThreshold) {
                  autoScrollIntervalRef.current = window.setInterval(() => {
                    window.scrollBy(0, scrollSpeed);
                  }, 16);
                }
              }}
              onDragLeave={() => {
                // Clear auto-scroll when leaving the grid
                if (autoScrollIntervalRef.current) {
                  clearInterval(autoScrollIntervalRef.current);
                  autoScrollIntervalRef.current = null;
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (autoScrollIntervalRef.current) {
                  clearInterval(autoScrollIntervalRef.current);
                  autoScrollIntervalRef.current = null;
                }
                finalizeReorder();
              }}
            >
              <div className="games-grid organize-mode">
                {activeGames.map((game, index) => {
                  // Calculate transform offset if card has moved during drag
                  let transformStyle: React.CSSProperties = { 
                    order: index,
                    transition: disableTransitions ? 'none' : undefined,
                  };
                  
                  if (draggedGameId && visualOrder.length > 0) {
                    const baseOrderIds = activeGames.map(g => g.gameId);
                    const originalIndex = baseOrderIds.indexOf(game.gameId);
                    const visualIndex = visualOrder.indexOf(game.gameId);
                    
                    if (originalIndex !== -1 && visualIndex !== -1 && originalIndex !== visualIndex) {
                      const origRow = Math.floor(originalIndex / cardsPerRow);
                      const origCol = originalIndex % cardsPerRow;
                      const visRow = Math.floor(visualIndex / cardsPerRow);
                      const visCol = visualIndex % cardsPerRow;
                      
                      const stepX = cardSize?.width ?? 340;
                      const stepY = cardSize?.height ?? 200;
                      const deltaX = (visCol - origCol) * stepX;
                      const deltaY = (visRow - origRow) * stepY;
                      
                      if (game.gameId === draggedGameId) {
                        transformStyle.transform = `scale(0.98) translate(${deltaX}px, ${deltaY}px)`;
                      } else {
                        transformStyle.transform = `translate(${deltaX}px, ${deltaY}px)`;
                      }
                    }
                  }

                  return (
                    <div
                      key={game.gameId}
                      ref={(el) => {
                        if (el) {
                          gameCardRefsMap.current.set(game.gameId, el);
                        }
                      }}
                      className={`game-card-wrapper ${shimmeringGameId === game.gameId ? 'shimmer-effect' : ''} ${newGameIds?.has(game.gameId) ? 'new' : ''} ${draggedGameId === game.gameId ? 'dragging' : ''}`}
                      style={transformStyle}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, game.gameId)}
                      onDragOver={(e) => handleDragOver(e, game.gameId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e)}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={() => { if (newGameIds?.has(game.gameId)) clearNewGame(game.gameId); }}
                    >
                      <GameCard
                        game={game}
                        record={getTodayRecord(game.gameId)}
                        onPlay={() => handlePlayGame(game)}
                        onLogScore={() => handleLogScore(game)}
                        onViewStats={() => handleViewStats(game)}
                        onRemove={() => handleRemoveGame(game)}
                        isSaving={savingGames.has(game.gameId)}
                        onReset={async () => {
                          await useAppStore.getState().loadTodayRecords();
                        }}
                        organizeMode={true}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // Normal mode: regular games grid
          <div className="games-grid">
            {(() => {
              // Determine base order for display
              let baseOrder: Game[];
              
              if (todoSortActive) {
                // Todo sort: incomplete first, then completed
                const incompleteGames = activeGames.filter(g => !getTodayRecord(g.gameId));
                const completedGames = activeGames.filter(g => !!getTodayRecord(g.gameId));
                baseOrder = [...incompleteGames, ...completedGames];
              } else {
                baseOrder = activeGames;
              }
              
              return baseOrder.map((game, index) => (
                <div
                  key={game.gameId}
                  ref={(el) => {
                    if (el) {
                      gameCardRefsMap.current.set(game.gameId, el);
                    }
                  }}
                  className={`game-card-wrapper ${shimmeringGameId === game.gameId ? 'shimmer-effect' : ''} ${newGameIds?.has(game.gameId) ? 'new' : ''}`}
                  style={{ order: index }}
                  onMouseEnter={() => { if (newGameIds?.has(game.gameId)) clearNewGame(game.gameId); }}
                >
                  <GameCard
                    game={game}
                    record={getTodayRecord(game.gameId)}
                    onPlay={() => handlePlayGame(game)}
                    onLogScore={() => handleLogScore(game)}
                    onViewStats={() => handleViewStats(game)}
                    onRemove={() => handleRemoveGame(game)}
                    isSaving={savingGames.has(game.gameId)}
                    onReset={async () => {
                      await useAppStore.getState().loadTodayRecords();
                    }}
                  />
                </div>
              ));
            })()}
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
              {games.filter(g => g.category === 'academic').map((game, idx) => (
                <div key={game.gameId} className="game-list-item" style={{ position: 'relative' }}>
                  <GameIconTooltip icon={game.icon || '🎮'} description={game.description} className="game-icon" />
                  <span className="game-name">{game.displayName}</span>
                  {game.isActive ? (
                    <button 
                      className="game-status active"
                      onClick={() => handleShimmerGameCard(game)}
                      title="Click to highlight in dashboard"
                    >
                      Active
                    </button>
                  ) : (
                    <span className="game-status inactive">Inactive</span>
                  )}
                  <button
                    className="btn-small"
                    onClick={() => {
                      useAppStore.getState().toggleGameActive(game.gameId);
                      if (onboardingActive) setOnboardingActive(false);
                    }}
                  >
                    {game.isActive ? 'Remove' : 'Add to Dailies'}
                  </button>
                  {onboardingActive && idx === 0 && (
                    <TooltipWithHoverOut onHide={() => setOnboardingActive(false)} />
                  )}
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
              {games.filter(g => g.category === 'games').map(game => {
                return (
                  <div key={game.gameId} className="game-list-item" style={{ position: 'relative' }}>
                    <GameIconTooltip icon={game.icon || '🎮'} description={game.description} className="game-icon" />
                    <span className="game-name">{game.displayName}</span>
                    {game.isActive ? (
                      <button 
                        className="game-status active"
                        onClick={() => handleShimmerGameCard(game)}
                        title="Click to highlight in dashboard"
                      >
                        Active
                      </button>
                    ) : (
                      <span className="game-status inactive">Inactive</span>
                    )}
                    <button
                      className="btn-small"
                      ref={ onboardingActive ? wordleAddBtnRef : undefined}
                      onClick={() => {
                        useAppStore.getState().toggleGameActive(game.gameId);
                        if (onboardingActive) setOnboardingActive(false);
                      }}
                    >
                      {game.isActive ? 'Remove' : 'Add to Dailies'}
                    </button>
                  </div>
                );
              })}
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
                  <GameIconTooltip icon={game.icon || '🎮'} description={game.description} className="game-icon" />
                  <span className="game-name">{game.displayName}</span>
                  {game.isActive ? (
                    <button 
                      className="game-status active"
                      onClick={() => handleShimmerGameCard(game)}
                      title="Click to highlight in dashboard"
                    >
                      Active
                    </button>
                  ) : (
                    <span className="game-status inactive">Inactive</span>
                  )}
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
                  <GameIconTooltip icon={game.icon || '🎮'} description={game.description} className="game-icon" />
                  <span className="game-name">{game.displayName}</span>
                  {game.isActive ? (
                    <button 
                      className="game-status active"
                      onClick={() => handleShimmerGameCard(game)}
                      title="Click to highlight in dashboard"
                    >
                      Active
                    </button>
                  ) : (
                    <span className="game-status inactive">Inactive</span>
                  )}
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

      {selectedGame && showScoreEntry && (
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

      {showClearAll && (
        <RemoveModal
          game={activeGames[0]}
          record={undefined}
          onClose={() => setShowClearAll(false)}
          onRemoveGame={handleConfirmClearAll}
          onDeleteRecord={() => {}}
          clearAllMode={true}
        />
      )}

      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
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
        onClose={() => {
          setShowRegisterModal(false);
          setIsRegisterFromStats(false);
        }}
        onSwitchToLogin={() => {
          setShowRegisterModal(false);
          setIsRegisterFromStats(false);
          setShowLoginModal(true);
        }}
        email={authEmail}
        password={authPassword}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        isFromStats={isRegisterFromStats}
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
