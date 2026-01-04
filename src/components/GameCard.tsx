import { Game, GameRecord } from '@/types/models';
import { formatTimeUntilReset, getTimeUntilReset } from '@/utils/resetTimeUtils';
import { useEffect, useState, useRef } from 'react';
import { GameIconTooltip } from './GameIconTooltip';
import './Buttons.css';
import './GameCard.css';

/**
 * Format score display based on game's scoreTypes and record's scores
 */
function formatScore(record: GameRecord, game: Game): string {
  // New structure: use record.scores and game.scoreTypes
  if (record.scores && game.scoreTypes) {
    const puzzleKeys = Object.keys(record.scores);
    if (puzzleKeys.length === 0) return 'N/A';
    
    // Check if this is a multi-puzzle game (like LoLdle with emoji, quote, ability, etc.)
    // Multi-puzzle games have multiple keys that are NOT "puzzle1", "puzzle2", etc.
    const isMultiPuzzle = puzzleKeys.length > 1 && !puzzleKeys.every(k => k.match(/^puzzle\d+$/));
    
    if (isMultiPuzzle) {
      // For multi-puzzle games, sum up the attempts across all puzzles
      let totalAttempts = 0;
      for (const puzzleKey of puzzleKeys) {
        const scoreValue = record.scores[puzzleKey];
        if (scoreValue?.attempts !== undefined && scoreValue.attempts >= 0) {
          totalAttempts += scoreValue.attempts;
        }
      }
      return String(totalAttempts);
    }
    
    // Single puzzle game - use existing logic
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
      // Time in milliseconds, display as seconds with full precision
      const timeInSeconds = (actualValue ?? 0) / 1000;
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
  return 'N/A';
}


interface GameCardProps {
  game: Game;
  record?: GameRecord;
  onPlay: () => void;
  onLogScore: () => void;
  onViewStats: () => void;
  onRemove?: () => void;
  onReset?: () => void;
  isSaving?: boolean;
  organizeMode?: boolean;
}

function GameCard({ game, record, onPlay, onLogScore, onViewStats, onRemove, onReset, isSaving, organizeMode }: GameCardProps) {
  // Determine played/win state: existence of `record` means played; wins are `!failed`.
  const isPlayed = !!record;
  // shareTexts unused here — derive from record.metadata only when needed
  const hasError = record?.metadata?.hasInvalidShareText || false;
  const isFailed = record?.failed || false;
  const isSuccess = isPlayed && !hasError && !isFailed; // played and not failed or error


  // Timer state for live countdown and reset detection
  const [, setNow] = useState(Date.now());
  const prevTimeRef = useRef<{ hours: number; minutes: number } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      const timeLeft = getTimeUntilReset(game);
      const prev = prevTimeRef.current;
      // If timer just crossed zero (reset happened)
      if (prev && (prev.hours > 0 || prev.minutes > 0) && timeLeft.hours === 0 && timeLeft.minutes === 0) {
        if (onReset) onReset();
      }
      prevTimeRef.current = timeLeft;
    }, 1000 * 30); // check every 30 seconds for better accuracy
    return () => clearInterval(interval);
  }, [game, onReset]);

  const timeUntilReset = formatTimeUntilReset(game);

  return (
    <div className={`game-card ${organizeMode ? 'organize' : ''} ${hasError ? 'error' : ''} ${isPlayed ? 'completed' : ''}`}>
      <div className="game-card-header">
        <GameIconTooltip 
          icon={game.icon || '🎮'} 
          description={game.description}
          className="game-card-icon"
        />
        <div className="game-card-title">
          <h3>{game.displayName}</h3>
          <span className="game-card-category">{game.category}</span>
        </div>
        <div className="game-card-header-actions">
          {hasError ? (
            <span className="warning-badge" title="Invalid share text format">⚠️</span>
          ) : isSuccess ? (
            <span className="star-badge" title="Completed successfully!">⭐</span>
          ) : isPlayed ? (
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
      {!organizeMode && (
        <div className="game-card-reset-time">
          ⏰ Resets in {timeUntilReset}
        </div>
      )}

      {!organizeMode && (
      <div className="game-card-body">
        {isSaving ? (
          <div className="game-card-loading">
            <div className="loading-spinner"></div>
            <span>Saving...</span>
          </div>
        ) : record ? (
          <>
            <div className="game-card-score">
              {/* Display all scores from record.scores */}
              {record.scores && Object.keys(record.scores).length > 0 && (() => {
                const puzzleKeys = Object.keys(record.scores);
                
                // Check if this is a multi-puzzle game by looking at game.scoreTypes
                // Multi-puzzle games have multiple top-level keys in scoreTypes (e.g., LoLdle has classic, quote, ability, emoji, splash)
                const isMultiPuzzle = game.scoreTypes && Object.keys(game.scoreTypes).length > 1;
                
                if (isMultiPuzzle) {
                  // Display all sub-puzzles for multi-puzzle games
                  return (
                    <>
                      {/* Show total attempts as main score, then subpuzzle entries below */}
                      <div>
                        <div className="score-display">
                          <span className="score-label">Total</span>
                          <span className="score-value">{formatScore(record, game)}</span>
                        </div>
                        <div 
                          className="share-texts-container" 
                          style={{ 
                            marginTop: '1rem', 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit)', 
                            gap: '0.75rem', 
                            justifyItems: 'center' 
                          }}
                        >
                          {puzzleKeys.map((puzzleKey) => {
                            const scoreValue = record.scores![puzzleKey];
                            const attempts = scoreValue?.attempts;
                            const isFailed = attempts === -1;
                            const isCompleted = attempts !== undefined && !isFailed;
                            const statusClass = isFailed ? 'failed' : isCompleted ? 'success' : 'pending';
                            const attemptsDisplay = isFailed ? 'X' : (attempts !== undefined ? String(attempts) : '-');
                            return (
                              <div 
                                key={puzzleKey} 
                                className={`share-text-entry-preview ${statusClass}`}
                              >
                                <div className="entry-preview-name">{puzzleKey.charAt(0).toUpperCase() + puzzleKey.slice(1)}</div>
                                <div className="entry-preview-status">{attemptsDisplay}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                }
                
                // Single puzzle game - show all score types
                const puzzleKey = puzzleKeys[0];
                const scoreValues = record.scores[puzzleKey];
                const scoreTypes = game.scoreTypes?.[puzzleKey] || {};
                
                return Object.keys(scoreValues).map((scoreTypeKey, index) => {
                  const actualValue = scoreValues[scoreTypeKey];
                  const maxValue = scoreTypes[scoreTypeKey];
                  const label = scoreTypeKey.charAt(0).toUpperCase() + scoreTypeKey.slice(1);
                  
                  let displayValue: string;
                  if (scoreTypeKey === 'time') {
                    displayValue = `${(actualValue ?? 0) / 1000}s`;
                  } else if (scoreTypeKey === 'accuracy' || scoreTypeKey === 'percentage') {
                    displayValue = `${actualValue}%`;
                  } else if (scoreTypeKey === 'grade') {
                    displayValue = String(actualValue);
                  } else if (maxValue === -1 || maxValue === undefined) {
                    displayValue = actualValue === -1 ? 'X' : String(actualValue);
                  } else {
                    displayValue = actualValue === -1 ? `X/${maxValue}` : `${actualValue}/${maxValue}`;
                  }
                  
                  return (
                    <div key={index} className="score-display">
                      <span className="score-label">{label}</span>
                      <span className="score-value">{displayValue}</span>
                    </div>
                  );
                });
              })()}
              {game.displayName === 'Wantedle' && record.metadata?.shareTexts?.[0]?.grade && (
                <div className="score-display">
                  <span className="score-label">Grade</span>
                  <span className="score-value">{record.metadata.shareTexts[0].grade}</span>
                </div>
              )}
            </div>
            
            {/* Display share texts grid if present */}
            {record.metadata?.shareTexts && record.metadata.shareTexts.length === 1 && (
              /* Single share text - show emoji grid if present, else fallback to shareText */
              (() => {
                const entry = record.metadata.shareTexts[0];
                const gridLines = entry.grid ? entry.grid.split('\n').map(line => line.trim()).filter(line => line.length > 0) : [];
                return (
                  <div className="share-text-preview">
                    {entry.puzzleNumber && (
                      <div className="share-text-line puzzle-number">
                        #{entry.puzzleNumber}
                      </div>
                    )}
                    {gridLines.length > 0 && gridLines.map((line, i) => {
                      // Convert any 'X' markers to a red square emoji for failed cells
                      const converted = line.replace(/X/g, '🟥');
                      return <div key={i} className="share-text-line">{converted}</div>;
                    })}
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
      )}

      {!organizeMode && (
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
      )}
    </div>
  );
}

export default GameCard;
