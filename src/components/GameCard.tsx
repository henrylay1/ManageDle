import { Game, GameRecord } from '@/types/models';
import './GameCard.css';

/**
 * Format score display based on game type and scoring method
 */
function formatScore(record: GameRecord, game: Game): string {
    // Always display as n/6 or X/6 for Wordle-style games
    if (game.displayName === 'Colorfle' || game.displayName === 'Wordle' || game.displayName === 'Nerdle') {
      const entry = record.metadata?.shareTexts?.[0];
      const max = entry?.maxAttempts || 6;
      if (record.failed || record.score === -1 || record.score === undefined) {
        return `X/${max}`;
      }
      if (typeof record.score === 'number') {
        return `${record.score}/${max}`;
      }
      return `N/A`;
    }

    // Angle: Display as n/4 or X/4
    if (game.displayName === 'Angle') {
      const entry = record.metadata?.shareTexts?.[0];
      const max = entry?.maxAttempts || 4;
      if (record.failed || record.score === -1 || record.score === undefined) {
        return `X/${max}`;
      }
      if (typeof record.score === 'number') {
        return `${record.score}/${max}`;
      }
      return `N/A`;
    }

    // Quordle: Solved is always n/4 (number of non-red emojis)
    if (game.displayName === 'Quordle') {
      const solved = typeof record.score === 'number' ? record.score : 0;
      return `${solved}/4`;
    }
  // Get parsed data from stored metadata (no re-parsing)
  const entry = record.metadata?.shareTexts?.[0];
  
  // Game-specific formatting
  if (game.displayName === 'Colorguesser') {
    return `${record.score}/500`;
  }

  if (game.displayName === 'Spellcheck') {
    return `${record.score}/15`;
  }

  if (game.displayName === 'Connections') {
    return `${record.score}/4`;
  }

  if (game.displayName === 'Scrandle' || game.displayName === 'r34dle') {
    return `${record.score}/10`;
  }

  if (game.displayName === 'Hexcodle') {
    // Guesses: n/5 if solved, X/5 if failed
    if (record.failed || record.score === -1 || record.score === undefined) {
      return 'X/5';
    }
    return `${record.score}/5`;
  }

  if (game.displayName === 'Timingle') {
    // Convert milliseconds back to seconds for display
    const timeInSeconds = ((record.score ?? 0) / 1000).toFixed(1);
    return `${timeInSeconds}s`;
  }
  
  if (game.displayName === 'Wantedle') {
    // Always display the time in seconds, never 'X' or any code
    const timeInSeconds = ((record.score ?? 0) / 1000).toFixed(1);
    return `${timeInSeconds}s`;
  }
  
  if (game.displayName === 'Pokedoku') {
    if (entry && typeof entry.score === 'number' && entry.maxAttempts !== undefined) {
      return `${entry.score}/${entry.maxAttempts}`;
    }
    if (record.score !== undefined && entry?.maxAttempts !== undefined) {
      return `${record.score}/${entry.maxAttempts}`;
    }
    if (entry?.score !== undefined) {
      return `${entry.score}/9`;
    }
    return record.score !== undefined ? String(record.score) : 'N/A';
  }
  
  if (game.displayName === 'Quordle') {
    return `${record.score}/4`;
  }
  
  if (game.displayName === 'Worldle') {
    return `${record.score}%`;
  }
  
  if (game.displayName === 'Wordle') {
    // Always display as n/6 or X/6
    if (entry?.failed) {
      return 'X';
    }else{
        return `${record.score}/6`;
    }
  }

  if (game.displayName === 'Gamedle') {
    // For multi-puzzle display, count solved puzzles out of 5
    if (record.metadata?.shareTexts && record.metadata.shareTexts.length > 1) {
      // Only count successful ones for the score display
      const solvedCount = record.metadata.shareTexts.filter(st => !st.failed && st.completed).length;
      return `${solvedCount}/5`;
    }
    // For single puzzle display
    if (entry && entry.maxAttempts !== undefined) {
      if (entry.failed || entry.score === undefined) {
        return `X/${entry.maxAttempts}`;
      }
      return `${entry.score}/${entry.maxAttempts}`;
    }
    if (record.failed || record.score === undefined) {
      return 'X';
    }
    return record.score !== undefined ? String(record.score) : 'N/A';
  }

  if (game.displayName === 'Genshindle') {
    // Display as n/5 or X/5
    if (record.failed || record.score === -1 || record.score === undefined) {
      return 'X/5';
    }
    return `${record.score}/5`;
  }

  // Fallback: just return score as string
  return `${record.score}`;
}

interface GameCardProps {
  game: Game;
  record?: GameRecord;
  onPlay: () => void;
  onLogScore: () => void;
  onViewStats: () => void;
  onRemove?: () => void;
}

function GameCard({ game, record, onPlay, onLogScore, onViewStats, onRemove }: GameCardProps) {
  const isCompleted = record?.completed || false;
  const hasError = record?.metadata?.hasInvalidShareText || false;
  const isFailed = record?.failed || false;
  const isSuccess = isCompleted && !hasError && !isFailed;

  return (
    <div className={`game-card ${hasError ? 'error' : ''} ${isCompleted && !hasError ? 'completed' : ''}`}>
      <div className="game-card-header">
        <span className="game-card-icon">{game.icon}</span>
        <div className="game-card-title">
          <h3>{game.displayName}</h3>
          <span className="game-card-category">{game.category}</span>
        </div>
        <div className="game-card-header-actions">
          {hasError ? (
            <span className="warning-badge" title="Invalid share text format">⚠️</span>
          ) : isSuccess ? (
            <span className="star-badge" title="Completed successfully!">⭐</span>
          ) : isCompleted ? (
            <span className="completion-badge">✓</span>
          ) : null}
          {onRemove && (
            <button
              className="btn-remove"
              onClick={onRemove}
              title="Remove"
            >
              ❌
            </button>
          )}
        </div>
      </div>

      <div className="game-card-body">
        {record ? (
          <>
            <div className="game-card-score">
              <div className="score-display">
                <span className="score-label">
                  {game.displayName === 'Wordle' ? 'Guesses' :
                   game.displayName === 'Quordle' ? 'Solved' :
                   game.displayName === 'Pokedoku' ? 'Solved' :
                   game.displayName === 'Connections' ? 'Solved' :
                   game.displayName === 'Worldle' ? 'Proximity' :
                   game.displayName === 'Timingle' ? 'Seconds' :
                   game.displayName === 'Hexcodle' ? 'Guesses' :
                   game.displayName === 'Colorguesser' ? 'Score' :
                   game.displayName === 'Spellcheck' ? 'Score' :
                   game.displayName === 'Scrandle' ? 'Score' :
                   game.displayName === 'r34dle' ? 'Score' :
                   game.displayName === 'Colorfle' ? 'Guesses' :
                   game.displayName === 'Nerdle' ? 'Guesses' :
                   game.displayName === 'Angle' ? 'Guesses' :
                   game.displayName === 'Wantedle' ? 'Time' :
                   game.displayName === 'Gamedle' ? 'Solved' :
                   game.displayName === 'Genshindle' ? 'Guesses' :
                   'Score'}
                </span>
                <span className="score-value">{formatScore(record, game)}</span>
              </div>
              {game.displayName === 'Wantedle' && record.metadata?.shareTexts?.[0]?.grade && (
                <div className="score-display">
                  <span className="score-label">Grade</span>
                  <span className="score-value">{record.metadata.shareTexts[0].grade}</span>
                </div>
              )}
              {record.metadata?.shareTexts?.[0]?.additionalScores?.map((additionalScore, index) => (
                <div key={index} className="score-display">
                  <span className="score-label">{additionalScore.label}</span>
                  <span className="score-value">
                    {additionalScore.label === 'Accuracy' && typeof additionalScore.value === 'number'
                      ? `${additionalScore.value}%`
                      : additionalScore.value === -1
                        ? 'X'
                        : additionalScore.value}
                    {additionalScore.maxValue && additionalScore.label !== 'Accuracy' && `/${additionalScore.maxValue}`}
                  </span>
                </div>
              ))}
              {record.metadata?.hardMode && (
                <span className="hard-mode-badge">🔥 Hard Mode</span>
              )}
            </div>
            
            {/* Display share texts */}
            {record.metadata?.shareTexts && record.metadata.shareTexts.length > 1 ? (
              /* Multiple share texts - show only names and scores */
              <div className="share-texts-container">
                {record.metadata.shareTexts.map((entry, i) => {
                  // Format individual subtask scores from stored parsed data
                  let scoreDisplay = '';
                  if (entry.completed && (entry.score !== undefined && entry.score !== null)) {
                    // Check if this is a game with special scoring
                    if (game.displayName === 'Hexcodle') {
                      scoreDisplay = `${entry.score}%`;
                    } else if (game.displayName === 'Timingle') {
                      scoreDisplay = `${entry.score}s`;
                    } else if (game.displayName === 'Pokedoku' && entry.maxAttempts) {
                      scoreDisplay = `${entry.score}/${entry.maxAttempts}`;
                      if (entry.uniqueness !== undefined && entry.maxUniqueness) {
                        scoreDisplay += ` • ${entry.uniqueness}/${entry.maxUniqueness}`;
                      }
                    } else if (game.displayName === 'Gamedle' && entry.maxAttempts) {
                      scoreDisplay = `${entry.score}/${entry.maxAttempts}`;
                    } else {
                      scoreDisplay = String(entry.score);
                    }
                  } else if (game.displayName === 'Gamedle' && entry.failed && entry.maxAttempts) {
                    // Show X/max for failed Gamedle subpuzzles
                    scoreDisplay = `X/${entry.maxAttempts}`;
                  }
                  
                  // For Gamedle, both completed and failed (with shareText) are considered complete
                  const hasShareText = entry.shareText && entry.shareText.length > 0;
                  const isGamedleComplete = game.displayName === 'Gamedle' && hasShareText;
                  const displayAsComplete = entry.completed || entry.failed || isGamedleComplete;
                  
                  return (
                    <div key={i} className={`share-text-entry-preview ${displayAsComplete ? (entry.failed ? 'failed' : 'success') : 'pending'}`}>
                      <div className="entry-preview-name">{entry.name}</div>
                      <div className="entry-preview-status">
                        {displayAsComplete ? (
                          entry.failed ? (scoreDisplay || 'X') : 
                          scoreDisplay || '✓'
                        ) : '⏳'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : record.metadata?.shareTexts && record.metadata.shareTexts.length === 1 && record.metadata.shareTexts[0].shareText ? (
              /* Single share text - show parsed format for fixed puzzles, original for custom */
              (() => {
                const entry = record.metadata.shareTexts[0];
                const isFixedPuzzle = game.category === 'academic' || game.category === 'games' || game.category === 'misc';

                // ColorGuesser: only show puzzle number, no grid
                if (game.displayName === 'Colorguesser' && entry.puzzleNumber) {
                  return (
                    <div className="share-text-preview">
                      <div className="share-text-line puzzle-number">
                        #{entry.puzzleNumber}
                      </div>
                    </div>
                  );
                }

                // Timingle: only show puzzle number, no grid
                if (game.displayName === 'Timingle' && entry.puzzleNumber) {
                  return (
                    <div className="share-text-preview">
                      <div className="share-text-line puzzle-number">
                        #{entry.puzzleNumber}
                      </div>
                    </div>
                  );
                }

                // r34dle: only show puzzle number and emoji grid
                if (game.displayName === 'r34dle' && entry.puzzleNumber) {
                  const gridLines = entry.grid ? entry.grid.split('\n').map(line => line.trim()).filter(line => line.length > 0) : [];
                  return (
                    <div className="share-text-preview">
                      <div className="share-text-line puzzle-number">
                        #{entry.puzzleNumber}
                      </div>
                      {gridLines.map((line, i) => (
                        <div key={i} className="share-text-line">{line}</div>
                      ))}
                    </div>
                  );
                }

                if (isFixedPuzzle && entry.grid) {
                  // Grid is already parsed and filtered by shareTextParser
                  const gridLines = entry.grid.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                  return (
                    <div className="share-text-preview">
                      {entry.puzzleNumber && (
                        <div className="share-text-line puzzle-number">
                          #{entry.puzzleNumber}
                        </div>
                      )}
                      {gridLines.map((line, i) => (
                        <div key={i} className="share-text-line">{line}</div>
                      ))}
                    </div>
                  );
                }
                
                // Fall back to showing raw text for misc games or if no grid was parsed
                return (
                  <div className="share-text-preview">
                    {entry.shareText.split('\n').slice(0, 10).map((line, i) => (
                      <div key={i} className="share-text-line">{line}</div>
                    ))}
                  </div>
                );
              })()
            ) : record.metadata?.shareText && (
              /* Legacy single share text display */
              <div className="share-text-preview">
                {record.metadata.shareText.split('\n').slice(0, 10).map((line, i) => (
                  <div key={i} className="share-text-line">{line}</div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="game-card-pending">
            <span className="pending-icon">⏳</span>
            <span className="pending-text">Not played today</span>
          </div>
        )}
      </div>

      <div className="game-card-actions">
        <button 
          className="btn-play"
          onClick={onPlay}
          title="Open game"
        >
          🎮 Play
        </button>
        <button 
          className="btn-log"
          onClick={onLogScore}
          title="Log your score"
        >
          📝 {record ? 'Edit' : 'Log'} Score
        </button>
        <button 
          className="btn-stats"
          onClick={onViewStats}
          title="View statistics"
        >
          📊 Stats
        </button>
      </div>
    </div>
  );
}

export default GameCard;
