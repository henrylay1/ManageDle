import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TooltipWithArrow } from './Dashboard';
import { useAppStore } from '@/store/appStore';
import { Game, GameRecord, ShareTextEntry } from '@/types/models';

import { autoFillFromShareText, parseLoLdleSummary, parsePokedleSummary, parseGamedleSummary, parseShareText } from '@/utils/shareTextParser';
import './Modal.css';
import './Forms.css';
import './Buttons.css';
import './ScoreEntryModal.css';

interface ScoreEntryModalProps {
  game: Game;
  existingRecord?: GameRecord;
  onClose: () => void;
}

// Helper function to get appropriate score label for each game
function getScoreLabel(gameName: string): string {
  switch (gameName) {
    case 'Wordle':
    case 'Hexcodle':
    case 'Colorfle':
    case 'Nerdle':
    case 'Angle':
    case 'Genshindle':
      return 'Guesses';
    case 'Quordle':
    case 'Pokedoku':
    case 'Connections':
    case 'Gamedle':
      return 'Solved';
    case 'Worldle':
      return 'Proximity';
    case 'Timingle':
      return 'Seconds';
    case 'Wantedle':
      return 'Time';
    case 'Colorguesser':
    case 'Spellcheck':
    case 'Scrandle':
    case 'r34dle':
      return 'Score';
    default:
      return 'Score';
  }
}

function ScoreEntryModal({ game, existingRecord, onClose }: ScoreEntryModalProps) {
  const { addRecord, updateRecord, loadTodayRecords } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  
  const hasMultipleShareTexts = game.customData?.hasMultipleShareTexts === true;
  
  // Initialize share texts array
  const initializeShareTexts = (): ShareTextEntry[] => {
    if (existingRecord?.metadata?.shareTexts) {
      return [...existingRecord.metadata.shareTexts];
    }
    // New record - initialize with "main" or default subtasks
    if (hasMultipleShareTexts && game.customData?.defaultShareTexts) {
      return (game.customData.defaultShareTexts as string[]).map(name => ({
        name,
        shareText: '',
        completed: false,
        failed: false,
      }));
    }
    // Gamedle: initialize with 5 sub-puzzles
    if (game.displayName === 'Gamedle') {
      return ['Cover art', 'Artwork', 'Character', 'Keywords', 'Guess'].map(name => ({
        name,
        shareText: '',
        completed: false,
        failed: false,
      }));
    }
    return [{
      name: 'main',
      shareText: '',
      completed: false,
      failed: false,
    }];
  };

  const [shareTexts, setShareTexts] = useState<ShareTextEntry[]>(initializeShareTexts());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseMessage, setParseMessage] = useState<string>('');
  const [hasValidationError, setHasValidationError] = useState(false);
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null);
  const [useSummary, setUseSummary] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  // Auto-focus the first textarea when modal opens
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Calculate tooltip position for portal rendering
  useEffect(() => {
    if (textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top + window.scrollY + rect.height / 2,
        left: rect.left + window.scrollX - 300, // 280px width + margin
      });
    } else {
      setTooltipPos(null);
    }
  }, [textareaRef.current]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter is pressed without Shift, submit the form
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
    // Shift+Enter allows new line (default behavior)
  };

  const handleSummaryTextChange = (text: string) => {
    setSummaryText(text);
    
    // Try to parse LoLdle summary when text is pasted
    if (text.length > 20 && game.displayName === 'LoLdle' && text.includes('#LoLdle')) {
      const loldleParsed = parseLoLdleSummary(text);
      if (loldleParsed) {
        const modeNames = ['Classic', 'Quote', 'Ability', 'Emoji', 'Splash'];
        const newShareTexts = modeNames.map((modeName) => {
          const score = loldleParsed.modes[modeName as keyof typeof loldleParsed.modes];
          return {
            name: modeName,
            shareText: score !== undefined ? '(parsed from summary)' : '',
            completed: score !== undefined,
            failed: false,
            scores: score !== undefined ? { puzzle1: { attempts: score } } : undefined,
          };
        });
        setShareTexts(newShareTexts);
        setParseMessage('✓ Auto-filled all LoLdle modes from summary');
        setTimeout(() => setParseMessage(''), 3000);
      }
    }
    
    // Try to parse Pokedle summary when text is pasted
    if (text.length > 20 && game.displayName === 'Pokedle' && text.includes('#Pokedle')) {
      const pokedleParsed = parsePokedleSummary(text);
      if (pokedleParsed) {
        const modeNames = ['Classic', 'Card', 'Description', 'Silhouette'];
        const newShareTexts = modeNames.map((modeName) => {
          const score = pokedleParsed.modes[modeName as keyof typeof pokedleParsed.modes];
          return {
            name: modeName,
            shareText: score !== undefined ? '(parsed from summary)' : '',
            completed: score !== undefined,
            failed: false,
            scores: score !== undefined ? { puzzle1: { attempts: score } } : undefined,
          };
        });
        setShareTexts(newShareTexts);
        setParseMessage('✓ Auto-filled all Pokedle modes from summary');
        setTimeout(() => setParseMessage(''), 3000);
      }
    }
    
    // Try to parse Gamedle summary when text is pasted
    if (text.length > 20 && game.displayName === 'Gamedle' && text.includes('Gamedle')) {
      const gamedleParsed = parseGamedleSummary(text);
      if (gamedleParsed) {
        const modeNames = ['Cover art', 'Artwork', 'Character', 'Keywords', 'Guess'];
        const maxAttemptsMap: { [key: string]: number } = {
          'Cover art': 6,
          'Artwork': 6,
          'Character': 4,
          'Keywords': 6,
          'Guess': 10
        };
        const newShareTexts = modeNames.map((modeName) => {
          const score = gamedleParsed.modes[modeName as keyof typeof gamedleParsed.modes];
          const puzzleNumber = gamedleParsed.puzzleNumbers[modeName as keyof typeof gamedleParsed.puzzleNumbers];
          const hasPuzzle = puzzleNumber !== undefined;
          return {
            name: modeName,
            shareText: hasPuzzle ? `(parsed from summary #${puzzleNumber})` : '',
            completed: score !== undefined,
            failed: hasPuzzle && score === undefined,
            scores: score !== undefined ? { puzzle1: { attempts: score } } : undefined,
            maxAttempts: maxAttemptsMap[modeName],
          };
        });
        
        setShareTexts(newShareTexts);
        setParseMessage('✓ Auto-filled all Gamedle modes from summary');
        setTimeout(() => setParseMessage(''), 3000);
      }
    }
  };

  const handleShareTextChange = (index: number, text: string) => {
    const updated = [...shareTexts];
    updated[index].shareText = text;
    
    // Clear error message when user types (allows them to retry)
    if (hasValidationError && text.length < 20) {
      setParseMessage('');
      setHasValidationError(false);
    }
    
    // Try to auto-fill when text is pasted
    if (text.length > 20) {
      try {
        const parsed = autoFillFromShareText(text, game.displayName);
        if (parsed && !('error' in parsed)) {
          updated[index].completed = parsed.completed;
          updated[index].failed = parsed.failed;
          
          // Parse full data and store all parsed fields for future use (no re-parsing in GameCard)
          const fullParsed = parseShareText(text, game.displayName);
          if (fullParsed) {
            // Store all parsed data
            updated[index].maxAttempts = fullParsed.maxAttempts;
            updated[index].puzzleNumber = fullParsed.puzzleNumber;
            updated[index].grid = fullParsed.grid;
            updated[index].maxGuessNumber = fullParsed.maxGuessNumber;
            updated[index].percentage = fullParsed.percentage;
            updated[index].guessCount = fullParsed.guessCount;
            updated[index].uniqueness = fullParsed.uniqueness;
            updated[index].maxUniqueness = fullParsed.maxUniqueness;
            
            // Build scores object from parsed data for DB storage
            // Transform to use the correct score type key from game.scoreTypes
            let parsedScores = fullParsed.scores;
            if (!parsedScores && fullParsed.score !== undefined) {
              // Construct scores from legacy score field
              parsedScores = { puzzle1: { attempts: fullParsed.score } };
            }
            
            // Transform score keys to match game.scoreTypes
            if (parsedScores && game.scoreTypes) {
              const transformedScores: Record<string, Record<string, number | undefined>> = {};
              for (const [puzzleKey, puzzleScores] of Object.entries(parsedScores)) {
                const gameScoreTypes = game.scoreTypes[puzzleKey];
                if (gameScoreTypes) {
                  // For Worldle, map both 'accuracy' and 'attempts' if present
                  if (game.displayName === 'Worldle' && puzzleKey === 'puzzle1') {
                    transformedScores[puzzleKey] = {};
                    if ('accuracy' in gameScoreTypes && typeof fullParsed.percentage === 'number') {
                      transformedScores[puzzleKey]['accuracy'] = fullParsed.percentage;
                    }
                    if ('attempts' in gameScoreTypes && typeof fullParsed.guessCount === 'number') {
                      transformedScores[puzzleKey]['attempts'] = fullParsed.guessCount;
                    }
                  } else {
                    // Default: map the first score value to the first score type key
                    const scoreTypeKey = Object.keys(gameScoreTypes)[0];
                    if (scoreTypeKey) {
                      const parsedValue = Object.values(puzzleScores)[0];
                      transformedScores[puzzleKey] = { [scoreTypeKey]: parsedValue };
                    } else {
                      transformedScores[puzzleKey] = puzzleScores;
                    }
                  }
                } else {
                  transformedScores[puzzleKey] = puzzleScores;
                }
              }
              parsedScores = transformedScores;
            }
            
            (updated[index] as any).scores = parsedScores;
            
            // For Pokedoku, store uniqueness in additionalScores for display
            if (game.displayName === 'Pokedoku' && fullParsed.uniqueness !== undefined && fullParsed.maxUniqueness !== undefined) {
              updated[index].additionalScores = [{
                label: 'Uniqueness',
                value: fullParsed.uniqueness,
                maxValue: fullParsed.maxUniqueness
              }];
            }
            
            // For Quordle, store max guess number in additionalScores
            if (game.displayName === 'Quordle') {
              const solved = fullParsed.score; // Quordle uses score for number solved
              const allSolved = solved === 4;
              updated[index].additionalScores = [{
                label: 'Guesses',
                value: allSolved ? (fullParsed.maxGuessNumber || -1) : -1,
                maxValue: 9
              }];
            }
            
            // For Worldle, store guesses in additionalScores
            if (game.displayName === 'Worldle') {
              updated[index].additionalScores = [{
                label: 'Guesses',
                value: fullParsed.failed ? -1 : (fullParsed.guessCount || -1),
                maxValue: undefined
              }];
            }
            
            // For Hexcodle, store percentage in additionalScores
            if (game.displayName === 'Hexcodle') {
              updated[index].failed = fullParsed.failed;
              updated[index].maxAttempts = 5;
              updated[index].additionalScores = [{
                label: 'Score',
                value: fullParsed.percentage ?? 0,
                maxValue: undefined
              }];
            }
            
            // For Colorfle, store accuracy in additionalScores
            if (game.displayName === 'Colorfle') {
              updated[index].maxAttempts = fullParsed.maxAttempts;
              updated[index].failed = fullParsed.failed;
              // Filter out undefined values from additionalScores
              updated[index].additionalScores = (fullParsed.additionalScores || [])
                .filter((s): s is { label: string; value: number; maxValue?: number } => s.value !== undefined);
            }
            
            // For Wantedle, store grade
            if (game.displayName === 'Wantedle') {
              updated[index].grade = fullParsed.grade;
            }

          }
          
          setParseMessage('✓ Auto-filled from share text');
          setHasValidationError(false);
          setTimeout(() => setParseMessage(''), 3000);
        } else if (parsed && 'error' in parsed) {
          setParseMessage(parsed.error || "");
          setHasValidationError(true);
          // Don't clear the error message automatically
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to parse share text';
        setParseMessage(errorMsg);
        setHasValidationError(true);
        // Don't clear the error message automatically
      }
    }
    
    setShareTexts(updated);
  };

  const updateShareTextEntry = (index: number, updates: Partial<ShareTextEntry>) => {
    const updated = [...shareTexts];
    updated[index] = { ...updated[index], ...updates };
    setShareTexts(updated);
  };

  const addShareText = () => {
    setShareTexts([...shareTexts, {
      name: `Subtask ${shareTexts.length + 1}`,
      shareText: '',
      completed: false,
      failed: false,
    }]);
  };

  const removeShareText = (index: number) => {
    if (shareTexts.length > 1) {
      setShareTexts(shareTexts.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Check if any share text is empty or invalid
    const hasEmptyOrInvalidShareText = shareTexts.some(st => {
      // Empty share text
      if (!st.shareText || st.shareText.trim().length === 0) return true;
      // Not completed (parsing failed)
      if (!st.completed) return true;
      return false;
    });

    if (hasEmptyOrInvalidShareText) {
      setHasValidationError(true);
      setParseMessage('⚠️ Please check your share text format.');
      setIsSubmitting(false);
      return; // Don't save if validation fails
    }
    
    // Valid share text - clear any previous errors
    setHasValidationError(false);
    setParseMessage('');

    try {
      // Calculate overall completion status
      const allCompleted = shareTexts.every(st => st.completed);
      const anyCompleted = shareTexts.some(st => st.completed);
      const anyFailed = shareTexts.some(st => st.failed);
      
      // For Gamedle: consider complete when all subpuzzles have shareText (success or fail)
      const allGamedleComplete = game.displayName === 'Gamedle' && shareTexts.length > 1
        ? shareTexts.every(st => st.completed || st.failed || (st.shareText && st.shareText.length > 0))
        : false;

      // Build scores object from ShareTextEntries
      // For single-puzzle games: use the first entry's scores
      // For multi-puzzle games: merge all entries' scores with unique keys
      let recordScores: Record<string, Record<string, number>> | undefined;
      if (shareTexts.length === 1 && (shareTexts[0] as any).scores) {
        // Filter out undefined values from scores
        const rawScores = (shareTexts[0] as any).scores;
        recordScores = {};
        for (const [puzzleKey, puzzleScores] of Object.entries(rawScores)) {
          recordScores[puzzleKey] = {};
          for (const [scoreKey, scoreVal] of Object.entries(puzzleScores as Record<string, number | undefined>)) {
            if (scoreVal !== undefined) {
              recordScores[puzzleKey][scoreKey] = scoreVal;
            }
          }
        }
      } else if (shareTexts.length > 1) {
        recordScores = {};
        shareTexts.forEach((st, idx) => {
          const stScores = (st as any).scores;
          if (stScores) {
            // Use puzzle index as key for multi-puzzle games
            const puzzleKey = `puzzle${idx + 1}`;
            // If stScores has puzzle1, rename it to the correct puzzle key
            if (stScores.puzzle1) {
              // Filter out undefined values
              recordScores![puzzleKey] = {};
              for (const [scoreKey, scoreVal] of Object.entries(stScores.puzzle1 as Record<string, number | undefined>)) {
                if (scoreVal !== undefined) {
                  recordScores![puzzleKey][scoreKey] = scoreVal;
                }
              }
            } else {
              // Otherwise just merge all keys, filtering undefined
              for (const [pk, pv] of Object.entries(stScores)) {
                recordScores![pk] = {};
                for (const [sk, sv] of Object.entries(pv as Record<string, number | undefined>)) {
                  if (sv !== undefined) {
                    recordScores![pk][sk] = sv;
                  }
                }
              }
            }
          }
        });
        if (Object.keys(recordScores).length === 0) {
          recordScores = undefined;
        }
      }

      const recordData = {
        gameId: game.gameId,
        date: new Date().toISOString(), // Store full timestamp for puzzle period tracking
        completed: shareTexts.length > 1 ? (allGamedleComplete || allCompleted) : shareTexts[0].completed,
        failed: shareTexts.length > 1 ? (anyCompleted && anyFailed) : shareTexts[0].failed,
        scores: recordScores,
        metadata: {
          shareTexts: shareTexts,
          hasInvalidShareText: false,
        },
      };

      if (existingRecord) {
        await updateRecord(existingRecord.recordId, recordData);
      } else {
        await addRecord(recordData);
      }

      await loadTodayRecords();
      onClose();
    } catch (error) {
      console.error('Error saving record:', error);
      alert('Failed to save record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content score-entry-modal" style={{ position: 'relative' }}>
        <div className="modal-header">
          <h2>
            {game.icon} {existingRecord ? 'Edit' : 'Log'} Score - {game.displayName}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <form onSubmit={handleSubmit} className="score-entry-form">
          {(game.displayName === 'LoLdle' || game.displayName === 'Pokedle' || game.displayName === 'Gamedle') && (
            <div className="form-section input-mode-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={useSummary}
                  onChange={(e) => setUseSummary(e.target.checked)}
                />
                <span>Use Summary Share Text</span>
              </label>
            </div>
          )}

          {(game.displayName === 'LoLdle' || game.displayName === 'Pokedle' || game.displayName === 'Gamedle') && useSummary ? (
            <div className="form-section">
              <div className="section-header-row">
                <h3>{game.displayName} Summary {parseMessage && <span className="parse-message">{parseMessage}</span>}</h3>
              </div>
              <textarea
                ref={textareaRef}
                value={summaryText}
                onChange={(e) => handleSummaryTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={(e) => {
                  setTimeout(() => {
                    handleSummaryTextChange(e.currentTarget.value);
                  }, 10);
                }}
                placeholder={`Paste ${game.displayName} summary here (e.g., 'I've completed all the modes of #${game.displayName} #... today:...')`}
                rows={8}
                className="share-text-area summary-text-area"
              />
              <div className="summary-results">
                <h4>Parsed Results:</h4>
                {shareTexts.map((entry, index) => {
                  // Extract display score from scores object
                  const entryScores = (entry as any).scores?.puzzle1;
                  const displayScore = entryScores?.attempts ?? entryScores?.solved ?? entryScores?.time ?? entryScores?.percentage;
                  return (
                    <div key={index} className="summary-result-item">
                      <span className="result-name">{entry.name}:</span>
                      <span className="result-score">
                        {entry.failed ? 'X' : (entry.completed ? (displayScore !== undefined ? `${displayScore}` : '✓') : '-')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="form-section">
              <div className="section-header-row">
                <h3>Share Texts {parseMessage && <span className="parse-message">{parseMessage}</span>}</h3>
                {!hasMultipleShareTexts && game.category === 'custom' && (
                  <button
                    type="button"
                    className="btn-small"
                    onClick={addShareText}
                  >
                    + Add Subtask
                  </button>
                )}
              </div>

            {shareTexts.map((entry, index) => (
              <div key={index} className="share-text-entry">
                <div className="entry-header">
                  {game.category === 'custom' && editingNameIndex === index ? (
                    <input
                      type="text"
                      className="name-input"
                      value={entry.name}
                      onChange={(e) => updateShareTextEntry(index, { name: e.target.value })}
                      onBlur={() => setEditingNameIndex(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setEditingNameIndex(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <h4 
                      className="entry-name"
                      onClick={() => game.category === 'custom' && setEditingNameIndex(index)}
                      title={game.category === 'custom' ? 'Click to rename' : ''}
                      style={{ cursor: game.category === 'custom' ? 'pointer' : 'default' }}
                    >
                      {entry.name}
                    </h4>
                  )}
                  {shareTexts.length > 1 && game.category === 'custom' && (
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => removeShareText(index)}
                      title="Remove this subtask"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="entry-content">
                  <div className="checkbox-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={entry.completed}
                        disabled={true}
                        tabIndex={-1}
                        style={{ pointerEvents: 'none' }}
                      />
                      <span>Completed</span>
                    </label>

                    {entry.completed && game.isFailable && (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={entry.failed}
                          disabled={true}
                          title="Automatically detected from share text"
                        />
                        <span>Failed</span>
                      </label>
                    )}

                    {/* Always show score field, even if empty */}
                    <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.8em', color: '#aaa' }}>{getScoreLabel(game.displayName)}</label>
                        {(() => {
                          // Extract primary score from scores object for display
                          const entryScores = (entry as any).scores?.puzzle1;
                          const primaryScore = entryScores?.attempts ?? entryScores?.solved ?? entryScores?.time ?? entryScores?.percentage ?? entryScores?.correct;
                          const maxAttempts = entry.maxAttempts || entry.shareText?.match(/\/(\d+)/)?.[1];
                          
                          let displayValue = '';
                          if (game.displayName === 'Wantedle') {
                            const timeMs = entryScores?.time;
                            displayValue = typeof timeMs === 'number' && !entry.failed
                              ? `${(timeMs / 1000).toFixed(1)}s`
                              : entry.failed ? 'X' : '';
                          } else if (typeof primaryScore === 'number') {
                            displayValue = entry.failed
                              ? 'X'
                              : `${primaryScore}${maxAttempts ? `/${maxAttempts}` : ''}`;
                          }
                          
                          return (
                            <input
                              type="text"
                              className="score-input-small"
                              value={displayValue}
                              placeholder={getScoreLabel(game.displayName)}
                              readOnly
                              style={{ pointerEvents: 'none', background: '#222', color: '#aaa', textAlign: 'center', width: 60 }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Always show additionalScores when present (for metrics like accuracy, uniqueness, etc.) */}
                    {entry.additionalScores && entry.additionalScores.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
                        {entry.additionalScores.map((additionalScore, scoreIndex) => (
                          <div key={scoreIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.8em', color: '#aaa' }}>{additionalScore.label}</label>
                            <input
                              type="text"
                              className="score-input-small"
                              value={
                                typeof additionalScore.value === 'number' 
                                  ? `${additionalScore.value}${additionalScore.maxValue ? `/${additionalScore.maxValue}` : '%'}` 
                                  : typeof additionalScore.value === 'string'
                                    ? additionalScore.value // For Wantedle grade (e.g., "B")
                                    : 'N/A'
                              }
                              placeholder={additionalScore.label}
                              title={`${additionalScore.label}${additionalScore.maxValue ? ` (max: ${additionalScore.maxValue})` : ''}`}
                              readOnly
                              tabIndex={-1}
                              style={{ pointerEvents: 'none', background: '#222', color: '#aaa', textAlign: 'center', width: 60 }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <textarea
                      ref={index === 0 ? textareaRef : undefined}
                      value={entry.shareText}
                      onChange={(e) => handleShareTextChange(index, e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={(e) => {
                        const target = e.currentTarget;
                        setTimeout(() => {
                          if (target) {
                            handleShareTextChange(index, target.value);
                          }
                        }, 10);
                      }}
                      placeholder="Paste share text here... Score will be auto-detected!"
                      rows={4}
                      className="share-text-area"
                    />
                    {/* TooltipWithArrow rendered via portal for robust visibility */}
                    {index === 0 && tooltipPos && createPortal(
                      <TooltipWithArrow
                        onHide={() => {}}
                        message="paste share text here"
                        arrow="right"
                        position="left"
                        style={{
                          position: 'absolute',
                          left: tooltipPos.left,
                          top: tooltipPos.top,
                          transform: 'translateY(-50%)',
                          pointerEvents: 'none',
                          zIndex: 3000,
                          background: '#222',
                          minWidth: 220,
                        }}
                      />,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : existingRecord ? 'Update' : 'Save'}
            </button>
          </div>
          </form>
          {/* TooltipWithArrow now rendered next to textarea above */}
        </div>
      </div>
    </div>
  );
}

export default ScoreEntryModal;
