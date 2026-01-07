import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TooltipWithArrow } from './Dashboard';
import { useAppStore } from '@/store/appStore';
import { Game, GameRecord, ShareTextEntry } from '@/types/models';

import { autoFillFromShareText, parseLoLdleSummary, parsePokedleSummary, parseGamedleSummary, parseShareText } from '@/utils/shareTextParser';
import '../styles/modals.css';
import '../styles/forms.css';
import '../styles/buttons.css';
import './ScoreEntryModal.css';

interface ScoreEntryModalProps {
  game: Game;
  existingRecord?: GameRecord;
  onClose: () => void;
}

// Dynamic score label based on game's scoreTypes - returns the first score type key capitalized
function getScoreLabel(game: Game, puzzleKey?: string): string {
  if (!game.scoreTypes) return 'Score';
  
  const puzzleKeys = Object.keys(game.scoreTypes);
  if (puzzleKeys.length === 0) return 'Score';
  
  const targetPuzzle = puzzleKey || puzzleKeys[0];
  const scoreTypeKeys = Object.keys(game.scoreTypes[targetPuzzle] || {});
  if (scoreTypeKeys.length === 0) return 'Score';
  
  // Return the first score type key, capitalized
  const scoreType = scoreTypeKeys[0];
  return scoreType.charAt(0).toUpperCase() + scoreType.slice(1).replace(/_/g, ' ');
}

// Get max value for a score type from game's scoreTypes
function getMaxFromScoreTypes(game: Game, puzzleKey: string, scoreTypeKey?: string): number | undefined {
  if (!game.scoreTypes || !game.scoreTypes[puzzleKey]) return undefined;
  
  const scoreTypes = game.scoreTypes[puzzleKey];
  const targetKey = scoreTypeKey || Object.keys(scoreTypes)[0];
  const maxValue = scoreTypes[targetKey];
  
  // Return the max value if it's a positive number (not -1 which means unlimited)
  return typeof maxValue === 'number' && maxValue > 0 ? maxValue : undefined;
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
    // New record - initialize based on game's scoreTypes
    if (game.scoreTypes && Object.keys(game.scoreTypes).length > 0) {
      // Create a share-text-entry for each puzzle/subpuzzle in scoreTypes
      return Object.keys(game.scoreTypes).map(puzzleName => ({
        name: puzzleName,
        shareText: '',
        failed: false,
      }));
    }
    return [];
  };

  const [shareTexts, setShareTexts] = useState<ShareTextEntry[]>(initializeShareTexts());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseMessage, setParseMessage] = useState<string>('');
  const [hasValidationError, setHasValidationError] = useState(false);
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null);
  const [summaryText, setSummaryText] = useState(() => {
    // Check if existing record has summary share text stored
    if (existingRecord?.metadata?.shareTexts) {
      const summaryEntry = existingRecord.metadata.shareTexts.find(entry => entry.name === 'SUMMARY');
      if (summaryEntry?.shareText) {
        return summaryEntry.shareText;
      }
    }
    return '';
  });

  // Determine whether a share-text entry should be considered "completed".
  // We derive this from presence of a shareText, parsed scores, or an explicit failure flag.
  const isEntryComplete = (st: ShareTextEntry) => {
    const hasShareText = !!st.shareText && st.shareText.trim().length > 0;
    const hasScores = !!(st as any).scores && Object.keys((st as any).scores).some(k => Object.keys((st as any).scores[k] || {}).length > 0);
    return st.failed || hasShareText || hasScores;
  };

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
      if (loldleParsed && loldleParsed.scores) {
        // Create entries for each mode from scoreTypes with empty shareText (summary will be locked)
        const modes = Object.keys(game.scoreTypes || {});
        const newShareTexts = modes.map((modeName) => {
          const score = loldleParsed.scores?.[modeName];
          return {
            name: modeName,
            shareText: '',
            failed: false,
            scores: score ? { [modeName]: score } : undefined,
            puzzleNumber: loldleParsed.puzzleNumber,
          };
        });
        setShareTexts(newShareTexts);
        setParseMessage('✓ Auto-filled all LoLdle modes from summary');
        setHasValidationError(false);
        setTimeout(() => setParseMessage(''), 3000);
      } else if (text.trim().length > 0) {
        // Summary parsing failed - show error
        setParseMessage('❌ Could not parse LoLdle summary. Please check the format.');
        setHasValidationError(true);
      }
      return;
    }
    
    // Try to parse Pokedle summary when text is pasted
    if (text.length > 20 && game.displayName === 'Pokedle' && text.includes('#Pokedle')) {
      const pokedleParsed = parsePokedleSummary(text);
      if (pokedleParsed) {
        // Create entries for each mode from scoreTypes with empty shareText (summary will be locked)
        const modes = Object.keys(game.scoreTypes || {});
        const newShareTexts = modes.map((modeName) => {
          // Map lowercase scoreType keys to capitalized parser keys
          const capitalizedMode = modeName.charAt(0).toUpperCase() + modeName.slice(1) as keyof typeof pokedleParsed.modes;
          const score = pokedleParsed.modes[capitalizedMode];
          return {
            name: modeName,
            shareText: '',
            failed: false,
            scores: score !== undefined ? { [modeName]: { attempts: score } } : undefined,
            puzzleNumber: pokedleParsed.puzzleNumber,
          };
        });
        setShareTexts(newShareTexts);
        setParseMessage('✓ Auto-filled all Pokedle modes from summary');
        setHasValidationError(false);
        setTimeout(() => setParseMessage(''), 3000);
      } else if (text.trim().length > 0) {
        // Summary parsing failed - show error
        setParseMessage('❌ Could not parse Pokedle summary. Please check the format.');
        setHasValidationError(true);
      }
      return;
    }
    
    // Try to parse Gamedle summary when text is pasted
    if (text.length > 20 && game.displayName === 'Gamedle' && text.includes('Gamedle')) {
      const gamedleParsed = parseGamedleSummary(text);
      if (gamedleParsed) {
        // Create entries for each mode from scoreTypes with empty shareText (summary will be locked)
        const modes = Object.keys(game.scoreTypes || {});
        const newShareTexts = modes.map((modeName) => {
          const score = gamedleParsed.modes[modeName as keyof typeof gamedleParsed.modes];
          const puzzleNumber = gamedleParsed.puzzleNumbers[modeName as keyof typeof gamedleParsed.puzzleNumbers];
          const hasPuzzle = puzzleNumber !== undefined;
          return {
            name: modeName,
            shareText: '',
            failed: hasPuzzle && score === undefined,
            scores: score !== undefined ? { [modeName]: { attempts: score } } : undefined,
            maxAttempts: getMaxFromScoreTypes(game, modeName, 'attempts'),
          };
        });
        
        setShareTexts(newShareTexts);
        setParseMessage('✓ Auto-filled all Gamedle modes from summary');
        setHasValidationError(false);
        setTimeout(() => setParseMessage(''), 3000);
      } else if (text.trim().length > 0) {
        // Summary parsing failed - show error
        setParseMessage('❌ Could not parse Gamedle summary. Please check the format.');
        setHasValidationError(true);
      }
      return;
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
        // Check for LoLdle summary format first
        if (game.displayName === 'LoLdle' && text.includes('#LoLdle')) {
          const loldleParsed = parseLoLdleSummary(text);
          if (loldleParsed && loldleParsed.scores) {
            setSummaryText(text);
            // Create entries for each mode from scoreTypes with empty shareText
            const modes = Object.keys(game.scoreTypes || {});
            const newShareTexts = modes.map((modeName) => {
              const score = loldleParsed.scores?.[modeName];
              return {
                name: modeName,
                shareText: '',
                failed: false,
                scores: score ? { [modeName]: score } : undefined,
                puzzleNumber: loldleParsed.puzzleNumber,
              };
            });
            setShareTexts(newShareTexts);
            setParseMessage('✓ Auto-filled all LoLdle modes from summary');
            setHasValidationError(false);
            setTimeout(() => setParseMessage(''), 3000);
            return;
          } else if (text.trim().length > 0) {
            // Detected LoLdle summary format but parsing failed
            setParseMessage('❌ Could not parse LoLdle summary. Please check the format.');
            setHasValidationError(true);
            return;
          }
        }
        
        // Check for Pokedle summary format
        if (game.displayName === 'Pokedle' && text.includes('#Pokedle')) {
          const pokedleParsed = parsePokedleSummary(text);
          if (pokedleParsed) {
            setSummaryText(text);
            // Create entries for each mode from scoreTypes with empty shareText
            const modes = Object.keys(game.scoreTypes || {});
            const newShareTexts = modes.map((modeName) => {
              // Map lowercase scoreType keys to capitalized parser keys
              const capitalizedMode = modeName.charAt(0).toUpperCase() + modeName.slice(1) as keyof typeof pokedleParsed.modes;
              const score = pokedleParsed.modes[capitalizedMode];
              return {
                name: modeName,
                shareText: '',
                failed: false,
                scores: score !== undefined ? { [modeName]: { attempts: score } } : undefined,
                puzzleNumber: pokedleParsed.puzzleNumber,
              };
            });
            setShareTexts(newShareTexts);
            setParseMessage('✓ Auto-filled all Pokedle modes from summary');
            setHasValidationError(false);
            setTimeout(() => setParseMessage(''), 3000);
            return;
          } else if (text.trim().length > 0) {
            // Detected Pokedle summary format but parsing failed
            setParseMessage('❌ Could not parse Pokedle summary. Please check the format.');
            setHasValidationError(true);
            return;
          }
        }
        
        // Check for Gamedle summary format
        if (game.displayName === 'Gamedle' && text.includes('#Gamedle')) {
          const gamedleParsed = parseGamedleSummary(text);
          if (gamedleParsed) {
            setSummaryText(text);
            // Create entries for each mode from scoreTypes with empty shareText
            const modes = Object.keys(game.scoreTypes || {});
            const newShareTexts = modes.map((modeName) => {
              const score = gamedleParsed.modes[modeName as keyof typeof gamedleParsed.modes];
              const puzzleNumber = gamedleParsed.puzzleNumbers[modeName as keyof typeof gamedleParsed.puzzleNumbers];
              const hasPuzzle = puzzleNumber !== undefined;
              return {
                name: modeName,
                shareText: '',
                failed: hasPuzzle && score === undefined,
                scores: score !== undefined ? { [modeName]: { attempts: score } } : undefined,
                maxAttempts: getMaxFromScoreTypes(game, modeName, 'attempts'),
                puzzleNumber,
              };
            });
            setShareTexts(newShareTexts);
            setParseMessage('✓ Auto-filled all Gamedle puzzles from summary');
            setHasValidationError(false);
            setTimeout(() => setParseMessage(''), 3000);
            return;
          } else if (text.trim().length > 0) {
            // Detected Gamedle summary format but parsing failed
            setParseMessage('❌ Could not parse Gamedle summary. Please check the format.');
            setHasValidationError(true);
            return;
          }
        }
        
        // Standard game record parsing
        const parsed = autoFillFromShareText(text, game.displayName);
        if (parsed && !('error' in parsed)) {
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
            
// Validate parsed scores match game.scoreTypes exactly
          if (parsedScores && game.scoreTypes) {
            for (const [puzzleKey, puzzleScores] of Object.entries(parsedScores)) {
              const gameScoreTypes = game.scoreTypes[puzzleKey];
              if (gameScoreTypes) {
                const expectedKeys = Object.keys(gameScoreTypes);
                const parsedKeys = Object.keys(puzzleScores);
                
                // Check for missing expected score types (only if game was completed successfully)
                if (!fullParsed.failed) {
                  const missingKeys = expectedKeys.filter(key => !(key in puzzleScores) || puzzleScores[key] === undefined);
                  if (missingKeys.length > 0) {
                    throw new Error(`❌ Parser error: Missing score types [${missingKeys.join(', ')}] for ${game.displayName}. Expected: [${expectedKeys.join(', ')}], Got: [${parsedKeys.join(', ')}]`);
                  }
                }
                
                // Check for extra parsed keys not in scoreTypes
                const extraKeys = parsedKeys.filter(key => !expectedKeys.includes(key));
                if (extraKeys.length > 0) {
                  throw new Error(`❌ Parser/scoreTypes mismatch for ${game.displayName}: Parser returned unexpected score keys [${extraKeys.join(', ')}]. Expected keys: [${expectedKeys.join(', ')}]. Please update game.scoreTypes in database to match parser output.`);
                }
              }
            }
            }
            
            (updated[index] as any).scores = parsedScores;
  

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
    // If summaryText is present, we don't require individual share texts
    const hasEmptyOrInvalidShareText = shareTexts.some(st => {
      // If we have a summary, individual entries don't need anything
      if (summaryText.trim()) {
        // Summary mode: individual entries can be empty
        return false;
      }
      // Empty share text (no summary)
      if (!st.shareText || st.shareText.trim().length === 0) return true;
      // Not completed (parsing failed) -> require shareText, failed, or scores
      if (!isEntryComplete(st)) return true;
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
      const anyCompleted = shareTexts.some(st => isEntryComplete(st));
      const anyFailed = shareTexts.some(st => st.failed);

      // Build scores object from ShareTextEntries
      // For single-puzzle games: use the first entry's scores
      // For multi-puzzle games: merge all entries' scores with unique keys
      let recordScores: Record<string, Record<string, number>> | undefined;
      
      // If we have a summary, calculate scores from the parsed summary instead
      if (summaryText.trim()) {
        if (game.displayName === 'LoLdle') {
          const loldleParsed = parseLoLdleSummary(summaryText);
          if (loldleParsed && loldleParsed.scores) {
            recordScores = loldleParsed.scores;
          }
        } else if (game.displayName === 'Pokedle') {
          const pokedleParsed = parsePokedleSummary(summaryText);
          if (pokedleParsed) {
            recordScores = {};
            for (const [mode, score] of Object.entries(pokedleParsed.modes)) {
              if (score !== undefined) {
                const modeKey = mode.toLowerCase();
                recordScores[modeKey] = { attempts: score };
              }
            }
            if (Object.keys(recordScores).length === 0) {
              recordScores = undefined;
            }
          }
        } else if (game.displayName === 'Gamedle') {
          const gamedleParsed = parseGamedleSummary(summaryText);
          if (gamedleParsed) {
            recordScores = {};
            for (const [mode, score] of Object.entries(gamedleParsed.modes)) {
              if (score !== undefined) {
                recordScores[mode] = { attempts: score };
              }
            }
            if (Object.keys(recordScores).length === 0) {
              recordScores = undefined;
            }
          }
        }
      } else if (shareTexts.length === 1 && (shareTexts[0] as any).scores) {
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
        // Remove any puzzle entries that ended up empty
        if (recordScores) {
          const nonEmptyKeys = Object.keys(recordScores).filter(pk => Object.keys(recordScores![pk]).length > 0);
          if (nonEmptyKeys.length === 0) {
            recordScores = undefined;
          } else {
            // prune empty keys
            for (const pk of Object.keys(recordScores)) {
              if (Object.keys(recordScores[pk]).length === 0) delete recordScores[pk];
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
              // Filter out undefined values and only add if non-empty
              const tmp: Record<string, number> = {};
              for (const [scoreKey, scoreVal] of Object.entries(stScores.puzzle1 as Record<string, number | undefined>)) {
                if (scoreVal !== undefined) {
                  tmp[scoreKey] = scoreVal as number;
                }
              }
              if (Object.keys(tmp).length > 0) {
                recordScores![puzzleKey] = tmp;
              }
            } else {
              // Otherwise just merge all keys, filtering undefined and only adding non-empty
              for (const [pk, pv] of Object.entries(stScores)) {
                const tmp2: Record<string, number> = {};
                for (const [sk, sv] of Object.entries(pv as Record<string, number | undefined>)) {
                  if (sv !== undefined) {
                    tmp2[sk] = sv as number;
                  }
                }
                if (Object.keys(tmp2).length > 0) {
                  recordScores![pk] = tmp2;
                }
              }
            }
          }
        });
        if (!recordScores || Object.keys(recordScores).length === 0) {
          recordScores = undefined;
        }
      }

      const recordData = {
        gameId: game.gameId,
        date: new Date().toISOString(), // Store full timestamp for puzzle period tracking
        failed: shareTexts.length > 1 ? (anyCompleted && anyFailed) : shareTexts[0].failed,
        scores: recordScores,
        metadata: {
          shareTexts: [
            // Include SUMMARY entry if summaryText exists
            ...(summaryText.trim() ? [{
              name: 'SUMMARY',
              shareText: summaryText,
              failed: false,
            }] : []),
            ...shareTexts,
          ],
          hasInvalidShareText: false,
        },
      };

      // Runtime guard: ensure we never upload an empty scores object
      try {
        if (recordData.scores && Object.keys(recordData.scores).length === 0) {
          console.warn('[ScoreEntryModal] Detected empty recordData.scores, pruning before save', recordData.scores, shareTexts);
          recordData.scores = undefined;
        } else if (recordData.scores) {
          // prune any nested empty score objects
          for (const pk of Object.keys(recordData.scores)) {
            const v = recordData.scores[pk];
            if (!v || Object.keys(v).length === 0) {
              delete recordData.scores![pk];
            }
          }
          if (recordData.scores && Object.keys(recordData.scores).length === 0) {
            console.warn('[ScoreEntryModal] All nested score keys were empty, clearing scores before save');
            recordData.scores = undefined;
          }
        }
      } catch (e) {
        // Non-fatal - proceed with save but log
        console.error('[ScoreEntryModal] Error normalizing scores before save', e);
      }

      // Close modal immediately for better UX (optimistic update)
      onClose();
      setIsSubmitting(false);

      // Save in background
      if (existingRecord) {
        updateRecord(existingRecord.recordId, recordData)
          .then(() => loadTodayRecords())
          .catch((error) => {
            console.error('Error updating record:', error);
            // Could show a toast notification instead of alert for better UX
            alert('Failed to update record. Please try again.');
          });
      } else {
        addRecord(recordData)
          .then(() => loadTodayRecords())
          .catch((error) => {
            console.error('Error saving record:', error);
            alert('Failed to save record. Please try again.');
          });
      }
    } catch (error) {
      // Only validation errors should reach here
      console.error('Error preparing record:', error);
      alert('Failed to prepare record. Please check your input.');
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

        {/* Scrollable content wrapper */}
        <div style={{ flex: 1, minHeight: 0, maxHeight: 'calc(90vh - 80px)', overflowY: 'auto', position: 'relative' }}>
          <form onSubmit={handleSubmit} className="score-entry-form">
          {(game.displayName === 'LoLdle' || game.displayName === 'Pokedle' || game.displayName === 'Gamedle') && (
            <>
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
                    // Capture the target before setTimeout (React pools synthetic events)
                    const target = e.currentTarget;
                    setTimeout(() => {
                      if (target) {
                        handleSummaryTextChange(target.value);
                      }
                    }, 10);
                  }}
                  placeholder={`Paste ${game.displayName} summary here (e.g., 'I've completed all the modes of #${game.displayName} #... today:...')`}
                  rows={8}
                  className="share-text-area summary-text-area"
                />
              </div>

            </>
          )}

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

              {summaryText.trim() && (
                <div style={{
                  backgroundColor: 'rgba(255, 193, 7, 0.1)',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  color: '#ffc107',
                  fontSize: '0.875rem'
                }}>
                  ⚠️ Summary detected - individual entries below are locked.
                </div>
              )}

              {shareTexts.map((entry, index) => ({ entry, originalIndex: index }))
                .filter(({ entry }) => entry.name !== 'SUMMARY')
                .map(({ entry, originalIndex }) => (
                <div 
                  key={originalIndex} 
                  className="share-text-entry"
                  style={summaryText.trim() ? {
                    opacity: 0.6,
                    pointerEvents: 'none',
                  } : {}}
                >
                  <div className="entry-header">
                    {game.category === 'custom' && editingNameIndex === originalIndex && !summaryText.trim() ? (
                      <input
                        type="text"
                        className="name-input"
                        value={entry.name}
                        onChange={(e) => updateShareTextEntry(originalIndex, { name: e.target.value })}
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
                        onClick={() => !summaryText.trim() && game.category === 'custom' && setEditingNameIndex(originalIndex)}
                        title={!summaryText.trim() && game.category === 'custom' ? 'Click to rename' : ''}
                        style={{ cursor: !summaryText.trim() && game.category === 'custom' ? 'pointer' : 'default' }}
                      >
                        {entry.name}
                      </h4>
                    )}
                    {shareTexts.filter(e => e.name !== 'SUMMARY').length > 1 && game.category === 'custom' && !summaryText.trim() && (
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removeShareText(originalIndex)}
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
                          checked={isEntryComplete(entry)}
                          disabled={true}
                          tabIndex={-1}
                          style={{ pointerEvents: 'none' }}
                        />
                        <span>Completed</span>
                      </label>

                      {isEntryComplete(entry) && game.isFailable && (
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
                          <label style={{ fontSize: '0.8em', color: '#aaa' }}>{getScoreLabel(game, entry.name)}</label>
                          {(() => {
                            // Extract primary score from scores object for display
                            const entryScores = (entry as any).scores?.[entry.name] || (entry as any).scores?.puzzle1;
                            const scoreTypeKeys = Object.keys(entryScores || {});
                            const primaryScoreKey = scoreTypeKeys[0];
                            const primaryScore = entryScores?.[primaryScoreKey];
                            const maxAttempts = entry.maxAttempts || getMaxFromScoreTypes(game, entry.name, primaryScoreKey);
                            
                            let displayValue = '';
                            // Handle time specially (convert to seconds)
                            if (primaryScoreKey === 'time' && typeof primaryScore === 'number') {
                              displayValue = !entry.failed
                                ? `${(primaryScore / 1000).toFixed(1)}s`
                                : 'X';
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
                                placeholder={getScoreLabel(game, entry.name)}
                                readOnly
                                style={{ pointerEvents: 'none', background: '#222', color: '#aaa', textAlign: 'center', width: 60 }}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <textarea
                        ref={originalIndex === 0 && !summaryText ? textareaRef : undefined}
                        value={entry.shareText}
                        onChange={(e) => !summaryText.trim() && handleShareTextChange(originalIndex, e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={(e) => {
                          if (!summaryText.trim()) {
                            const target = e.currentTarget;
                            setTimeout(() => {
                              if (target) {
                                handleShareTextChange(originalIndex, target.value);
                              }
                            }, 10);
                          }
                        }}
                        placeholder="Paste share text here... Score will be auto-detected!"
                        rows={4}
                        className="share-text-area"
                        disabled={summaryText.trim() ? true : false}
                      />
                      {/* TooltipWithArrow rendered via portal for robust visibility */}
                      {originalIndex === 0 && tooltipPos && createPortal(
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
