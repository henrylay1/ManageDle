import { Game, GameRecord } from '@/types/models';
import { formatTimeUntilReset } from '@/utils/resetTimeUtils';
import { useEffect, useState } from 'react';
import './Buttons.css';
import './GameCard.css';

/**
 * Format score display based on game's scoreTypes and record's scores
 */
function formatScore(record: GameRecord, game: Game): string {
  // New structure: use record.scores and game.scoreTypes
  if (record.scores && game.scoreTypes) {
    // Get the first puzzle key (e.g., "puzzle1")
    const puzzleKeys = Object.keys(record.scores);
    if (puzzleKeys.length === 0) return 'N/A';
    
    const firstPuzzle = puzzleKeys[0];
    const actualScores = record.scores[firstPuzzle];
    const maxScores = game.scoreTypes[firstPuzzle];
    
    if (!actualScores || !maxScores) return 'N/A';
    
    // Get the primary score type (first key in the score object)
    const scoreTypes = Object.keys(maxScores);
    if (scoreTypes.length === 0) return 'N/A';
    
    const primaryType = scoreTypes[0];
    const actualValue = actualScores[primaryType];
    const maxValue = maxScores[primaryType];
    
    // Handle different score types
    if (primaryType === 'attempts' || primaryType === 'solved' || primaryType === 'points') {
      if (maxValue === -1) {
        // No max, just display value or X for failed
        return actualValue === -1 ? 'X' : String(actualValue);
      } else {
        // Has max, display as n/max or X/max
        return actualValue === -1 ? `X/${maxValue}` : `${actualValue}/${maxValue}`;
      }
    } else if (primaryType === 'time') {
      // Time in milliseconds, display as seconds
      const timeInSeconds = ((actualValue ?? 0) / 1000).toFixed(1);
      return `${timeInSeconds}s`;
    } else if (primaryType === 'accuracy') {
      // Percentage
      return `${actualValue}%`;
    } else if (primaryType === 'grade') {
      // Letter grade
      return String(actualValue);
    }
    
    return String(actualValue);
  }
}

/**
 * Get display label for score based on game's scoreTypes
 */
function getScoreLabel(game: Game, record?: GameRecord): string {
  // Prefer to derive from record.scores if available
  if (record && record.scores) {
    const puzzleKeys = Object.keys(record.scores);
    if (puzzleKeys.length > 0) {
      const firstPuzzle = puzzleKeys[0];
      const scoreTypes = record.scores[firstPuzzle];
      const primaryType = Object.keys(scoreTypes)[0];
      return primaryType.charAt(0).toUpperCase() + primaryType.slice(1);
    }
  }
  // Fallback to game.scoreTypes if present
  if (game.scoreTypes) {
    const puzzleKeys = Object.keys(game.scoreTypes);
    if (puzzleKeys.length > 0) {
      const firstPuzzle = puzzleKeys[0];
      const scoreTypes = game.scoreTypes[firstPuzzle];
      const primaryType = Object.keys(scoreTypes)[0];
      return primaryType.charAt(0).toUpperCase() + primaryType.slice(1);
    }
  }
  // If no score type found, fallback to generic label
  return 'Score';
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

  // Timer state for live countdown
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000 * 60); // update every minute
    return () => clearInterval(interval);
  }, []);

  const timeUntilReset = formatTimeUntilReset(game);

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
      
      {/* Time until reset */}
      <div className="game-card-reset-time">
        ⏰ Resets in {timeUntilReset}
      </div>

      <div className="game-card-body">
        {record ? (
          <>
            <div className="game-card-score">
              <div className="score-display">
                <span className="score-label">
                  {getScoreLabel(game, record)}
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
            ) : record.metadata?.shareTexts && record.metadata.shareTexts.length === 1 && (
              /* Single share text - show emoji grid if present, else fallback to shareText */
              (() => {
                const entry = record.metadata.shareTexts[0];
                const gridLines = entry.grid ? entry.grid.split('\n').map(line => line.trim()).filter(line => line.length > 0) : null;
                return (
                  <div className="share-text-preview">
                    {entry.puzzleNumber && (
                      <div className="share-text-line puzzle-number">
                        #{entry.puzzleNumber}
                      </div>
                    )}
                    {gridLines && gridLines.length > 0 && gridLines.map((line, i) => (
                      <div key={i} className="share-text-line">{line}</div>
                    ))}
                    {!gridLines && entry.shareText && entry.shareText.split('\n').slice(0, 10).map((line, i) => (
                      <div key={i} className="share-text-line">{line}</div>
                    ))}
                  </div>
                );
              })()
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
          className="btn-action"
          onClick={onPlay}
          title="Open game"
        >
          🎮 Play
        </button>
        <button 
          className="btn-action"
          onClick={onLogScore}
          title="Log your score"
        >
          📝 {record ? 'Edit' : 'Log'} Score
        </button>
        <button 
          className="btn-action"
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
