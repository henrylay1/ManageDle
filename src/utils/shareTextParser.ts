/**
 * Parse Wordle-style share text to extract game information
 */

/**
 * Get current date in YYYY-MM-DD format as fallback puzzle number
 */
function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ParsedShareText {
  scores?: Record<string, Record<string, number | string | undefined>>; // Structured scores e.g., { puzzle1: { attempts: 4, grade: 'A' } }
  failed: boolean; // Whether they failed (X/6)
  maxAttempts?: number; // Total attempts allowed (e.g., 6)
  completed: boolean; // Whether the game was completed
  grid?: string; // The emoji grid
  puzzleNumber?: string; // The puzzle number (e.g., "1,643" from "Wordle 1,643 X/6")
  gameName?: string; // The game name (e.g., "Wordle")
  uniqueness?: number; // Uniqueness score (e.g., for Pokedoku 900/163)
  maxUniqueness?: number; // Max uniqueness value (e.g., for Pokedoku 163)
  maxGuessNumber?: number; // For Quordle: the highest numbered emoji found (e.g., 5 from 5️⃣)
  percentage?: number; // For Worldle: the proximity percentage (e.g., 80 from (80%))
  guessCount?: number; // For Worldle: the number of guesses used (separate from score which will be percentage)
  grade?: string; // For Wantedle: letter grade (A-F)
  // Warnings produced during parsing (e.g., non-numeric score fields)
  parseWarnings?: string[];
}

/**
 * Normalize parsed result to ensure empty `scores` objects are normalized to `undefined`.
 */
function normalizeParsedShareText(res: ParsedShareText | null): ParsedShareText | null {
  if (!res) return null;

  try {
    // Normalize empty scores => undefined
    if (res.scores && Object.keys(res.scores).length === 0) {
      res.scores = undefined;
    }

    // Prune nested empty score objects and validate values
    if (res.scores) {
      for (const k of Object.keys(res.scores)) {
        const v = res.scores[k];
        if (!v || Object.keys(v).length === 0) {
          delete res.scores![k];
        } else {
          // Allow certain fields (like 'grade') to be string values
          const allowedStringFields = new Set(['grade']);
          for (const field of Object.keys(v)) {
            const val = (v as any)[field];
            if (typeof val === 'string' && !allowedStringFields.has(field)) {
              res.parseWarnings = res.parseWarnings || [];
              res.parseWarnings.push(`Parsed non-numeric score value for '${field}' in '${k}': "${val}"`);
            }
          }
        }
      }
      if (Object.keys(res.scores).length === 0) res.scores = undefined;
      if (res.parseWarnings && res.parseWarnings.length > 0) {
        res.parseWarnings = Array.from(new Set(res.parseWarnings));
      }
    }
  } catch (e) {
    // Don't let normalization throw
  }

  return res;
}

export interface LoLdleParsedResult {
  puzzleNumber: string;
  modes: {
    Classic?: number;
    Quote?: number;
    Ability?: number;
    Emoji?: number;
    Splash?: number;
  };
  scores?: Record<string, Record<string, number>>; // Store scores in the mode name format
}

export interface PokedleParsedResult {
  puzzleNumber: string;
  modes: {
    Classic?: number;
    Card?: number;
    Description?: number;
    Silhouette?: number;
  };
}

export interface GamedleParsedResult {
  puzzleNumbers: {
    'Cover art'?: string;
    'Artwork'?: string;
    'Character'?: string;
    'Keywords'?: string;
    'Guess'?: string;
  };
  modes: {
    'Cover art'?: number;
    'Artwork'?: number;
    'Character'?: number;
    'Keywords'?: number;
    'Guess'?: number;
  };
}

/**
 * Helper function to extract emoji grid lines from text
 */
function extractEmojiGrid(lines: string[], emojiPattern: RegExp): string {
  const gridLines = lines.filter(line => emojiPattern.test(line));
  return gridLines.length > 0 ? gridLines.join('\n') : '';
}

/**
 * Detect game name from share text
 * Returns the detected game name or null if no game is detected
 */
function detectGameName(text: string): string | null {
  // Check for each game's unique identifier
  if (text.match(/WANTEDLE\s+#[\d,]+/i)) return 'Wantedle';
  if (text.match(/Chronophoto/i)) return 'Chronophoto';
  if (text.match(/#Angle\s+#[\d,]+/i)) return 'Angle';
  if (text.match(/I (found|couldn't find) today's #Genshindle/i)) return 'Genshindle';
  if (text.match(/Gamedle\s+\((Cover art|Artwork|Character|Keywords|Guess)\):/i)) return 'Gamedle';
  if (text.match(/Rule34dle Daily [\d-]+/i)) return 'r34dle';
  if (text.match(/[🟩🟥]+\s+\d+\/10\s*\|\s*[\d-]+\s*\|\s*https:\/\/scrandle\.com/i)) return 'Scrandle';
  if (text.match(/Connections[\s\S]*?Puzzle #[\d,]+/i)) return 'Connections';
  if (text.match(/(?:🙂\s*)?Daily Quordle\s+[\d,]+/i)) return 'Quordle';
  if (text.match(/#Worldle\s+#[\d,]+/i)) return 'Worldle';
  if (text.match(/nerdlegame\s+[\d,]+/i)) return 'Nerdle';
  if (text.match(/Colorfle\s+[\d,]+/i)) return 'Colorfle';
  if (text.match(/#Hexcodle\s+#[\d,]+/i)) return 'Hexcodle';
  if (text.match(/ColorGuesser\s+#[\d,]+/i)) return 'ColorGuesser';
  if (text.match(/Timingle\s+#[\d,]+/i)) return 'Timingle';
  if (text.match(/Spellcheck\s+#[\d,]+/i)) return 'Spellcheck';
  if (text.match(/Pokedoku\s+#[\d,]+/i)) return 'Pokedoku';
  if (text.match(/Wordle\s+[\d,]+/i)) return 'Wordle';
  
  return null;
}

/**
 * Parse share text for a specific game with validation
 */
function parseSpecificGame(text: string, lines: string[], gameName: string): ParsedShareText | null {
  const result: ParsedShareText = {
    failed: false,
    completed: false,
  };

  const normalizedGameName = gameName.toLowerCase().trim();

   // Chronophoto
  if (normalizedGameName === 'chronophoto') {
    // Example input:
    // I got a score of 342 on today's Chronophoto: 12/25/2025
    // Round 1: 0❌
    // Round 2: 0❌
    // Round 3: 0❌
    // Round 4: 342
    // Round 5: 0❌
    // https://www.chronophoto.app/daily.html

    const scoreMatch = text.match(/I got a score of (\d+) on today's Chronophoto/i);
    if (!scoreMatch) {
      throw new Error('❌ Incorrect share text for Chronophoto. Expected format: "I got a score of N on today\'s Chronophoto"');
    }
    result.gameName = 'Chronophoto';
    result.completed = true;

    // Extract rounds and calculate total score
    const roundScores: number[] = [];
    for (const line of lines) {
      const roundMatch = line.match(/Round (\d+): (\d+)/);
      if (roundMatch) {
        roundScores.push(parseInt(roundMatch[2], 10));
      }
    }
    // Store total score in points field
    const totalScore = roundScores.reduce((sum, score) => sum + score, 0);
    result.scores = { puzzle1: { points: totalScore } };
    // Mark failed based on totalScore
    result.failed = totalScore === 0;

    // Puzzle number: extract date if present
    const dateMatch = text.match(/Chronophoto: (\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      result.puzzleNumber = dateMatch[1];
    } else {
      result.puzzleNumber = getCurrentDate();
    }

    // Store the grid as space-separated round results (e.g., '0❌ 0❌ 0❌ 342 0❌')
    const roundGrid: string[] = [];
    for (const line of lines) {
      const roundGridMatch = line.match(/Round \d+: (\d+[❌✅]|\d+)/);
      if (roundGridMatch) {
        roundGrid.push(roundGridMatch[1]);
      }
    }
    result.grid = roundGrid.join('\n');

    return result;
  }

  // Wantedle
  if (normalizedGameName === 'wantedle') {
    const wantedleMatch = text.match(/WANTEDLE\s+#([\d,]+)/i);
    if (!wantedleMatch) {
      throw new Error('❌ Incorrect share text for Wantedle. Expected format: "WANTEDLE #... - Difficulty\n[Grade] - [time]s..."');
    }
    const [, puzzleNumber] = wantedleMatch;
    
    // Extract the score line (e.g., "B - 19.2s" or "S - 9.4s")
    const scoreMatch = text.match(/([SABDF])\s*-\s*([\d.]+)s/i);
    if (!scoreMatch) {
      throw new Error('❌ Incorrect share text for Wantedle. Could not find score line (e.g., "S - 9.4s", "A - 12.3s", "F - 30.0s")');
    }
    
    const [, grade, timeStr] = scoreMatch;
    result.gameName = 'Wantedle';
    result.puzzleNumber = puzzleNumber;
    // Store time in milliseconds as main score (e.g., 19.2s -> 19200ms)
    const timeMs = Math.round(parseFloat(timeStr) * 1000);
    result.completed = true;
    // Fail if grade is D or F (S, A, B, C are successes)
    result.failed = /[DF]/i.test(grade);
    // Store grade as separate property
    result.grade = grade;
    // Store all scores in scores field (include grade and time)
    result.scores = { puzzle1: { time: timeMs, grade } };
    
    // Extract emoji (single emoji line)
    const emojiLines = lines.filter(line => {
      const trimmed = line.trim();
      // Match lines that are only emoji (including those with variation selectors, e.g., ⛄️)
      // This regex matches one or more emoji, each optionally followed by a variation selector, with optional whitespace
      return /^\s*(?:\p{Emoji}(?:\uFE0F)?)+\s*$/u.test(trimmed);
    });
    // Always set grid, even if empty
    result.grid = emojiLines.length > 0 ? emojiLines.join('\n') : '';
    
    return result;
  }

  // Angle
  if (normalizedGameName === 'angle') {
    const angleMatch = text.match(/#Angle\s+#([\d,]+)\s+([X\d]+)\/(\d+)/i);
    if (!angleMatch) {
      throw new Error('❌ Incorrect share text for Angle. Expected format: "#Angle #... X/4 or n/4..."');
    }
    const [, puzzleNumber, scoreStr, maxAttemptsStr] = angleMatch;
    result.gameName = 'Angle';
    result.puzzleNumber = puzzleNumber;
    result.maxAttempts = parseInt(maxAttemptsStr, 10);
    
    if (scoreStr.toUpperCase() === 'X') {
      result.failed = true;
      result.completed = true;
      result.scores = { puzzle1: { attempts: -1 } };
    } else {
      const attempts = parseInt(scoreStr, 10);
      result.completed = true;
      result.failed = false;
      result.scores = { puzzle1: { attempts } };
    }
    
    // Extract emoji grid (lines with ⬆️⬇️🎉)
    const grid = extractEmojiGrid(lines, /[⬆️⬇️🎉]/);
    if (grid) {
      result.grid = grid;
    }
    
    return result;
  }

  // Genshindle
  if (normalizedGameName === 'genshindle') {
    const genshindleMatch = text.match(/I (found|couldn't find) today's #Genshindle/i);
    if (!genshindleMatch) {
      throw new Error('❌ Incorrect share text for Genshindle. Expected format: "I found today\'s #Genshindle in n tries!" or "I couldn\'t find today\'s #Genshindle"');
    }
    
    result.gameName = 'Genshindle';
    result.puzzleNumber = getCurrentDate();
    result.maxAttempts = 5;
    
    // Extract emoji grid lines (lines with 🟪🟩🟥)
    const grid = extractEmojiGrid(lines, /[🟪🟩🟥]/);
    
    if (!grid) {
      throw new Error('❌ Incorrect share text for Genshindle. No emoji grid found.');
    }
    
    const gridLines = grid.split('\n');
    
    // Check if first line is the success pattern: 🟪🟩🟩🟩🟩🟩🟩
    const firstLine = gridLines[0];
    const isSuccess = /^🟪🟩🟩🟩🟩🟩🟩$/.test(firstLine.trim());
    
    if (isSuccess) {
      // Count the number of rows to determine score
      const attempts = gridLines.length;
      result.failed = false;
      result.completed = true;
      result.scores = { puzzle1: { attempts } };
    } else {
      // Failed
      result.failed = true;
      result.completed = true;
      result.scores = { puzzle1: { attempts: -1 } };
    }
    
    result.grid = grid;
    return result;
  }

  // Gamedle
  if (normalizedGameName === 'gamedle') {
    // Match individual Gamedle puzzles
    // 🕹️ Gamedle (Cover art): #1337 🟥🟥🟥🟥🟥🟩
    // 🎨 Gamedle (Artwork): #1096 🟥🟥🟥🟥🟥🟥
    // 👤 Gamedle (Character): #189 🟥🟥🟥🟥
    // 🔑 Gamedle (Keywords): #896 🟥🟥🟥🟥🟥🟥
    // 🔍 Gamedle (Guess): #1150 🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
    const gamedleMatch = text.match(/Gamedle\s+\((Cover art|Artwork|Character|Keywords|Guess)\):\s+#([\d,]+)\s+([\u{1F7E5}\u{1F7E9}\u{2B1C}]+)/ui);
    if (!gamedleMatch) {
      throw new Error('❌ Incorrect share text for Gamedle. Expected format: "🕹️ Gamedle (Cover art): #... 🟥🟥🟩..."');
    }
    const [, puzzleType, puzzleNumber, emojiString] = gamedleMatch;
    result.gameName = 'Gamedle';
    result.puzzleNumber = puzzleNumber;
    
    // Determine max attempts based on puzzle type
    const maxAttemptsMap: { [key: string]: number } = {
      'Cover art': 6,
      'Artwork': 6,
      'Character': 4,
      'Keywords': 6,
      'Guess': 10
    };
    result.maxAttempts = maxAttemptsMap[puzzleType] || 6;
    
    // Count red emojis before first green emoji
    const greenIndex = emojiString.indexOf('🟩');
    if (greenIndex === -1) {
      // No green emoji = failed
      result.failed = true;
      result.completed = false;
      result.scores = { puzzle1: { attempts: -1 } };
    } else {
      // Count red emojis before green
      const beforeGreen = emojiString.substring(0, greenIndex);
      const redCount = (beforeGreen.match(/🟥/gu) || []).length;
      result.failed = false;
      result.completed = true;
      result.scores = { puzzle1: { attempts: redCount } };
    }
    
    // Set grid to the emoji string
    result.grid = emojiString;
    
    return result;
  }

  // r34dle / Rule34dle
  if (normalizedGameName === 'r34dle') {
    if (!text.match(/Rule34dle Daily ([\d-]+)/i)) {
      throw new Error('❌ Incorrect share text for r34dle. Expected format: "Rule34dle Daily YYYY-MM-DD\\nn/10\\n..."');
    }
    const r34dleHeaderMatch = text.match(/Rule34dle Daily ([\d-]+)/i);
    result.gameName = 'r34dle';
    result.puzzleNumber = r34dleHeaderMatch![1];
    const fractionMatch = text.match(/(\d+)\/10/);
    if (!fractionMatch) {
      throw new Error('❌ Incorrect share text for r34dle. Could not find score in format "n/10"');
    }
    const solved = parseInt(fractionMatch[1], 10);
    result.maxAttempts = 10;
    result.completed = true;
    result.failed = solved < result.maxAttempts;
    result.scores = { puzzle1: { solved: solved } };
    
    // Extract emoji grid (lines with 🟩🟥)
    const grid = extractEmojiGrid(lines, /[🟩🟥]/);
    if (grid) {
      result.grid = grid;
    }
    
    return result;
  }

  // Scrandle
  if (normalizedGameName === 'scrandle') {
    const scrandleMatch = text.match(/([🟩🟥]+)\s+(\d+)\/10\s*\|\s*([\d-]+)\s*\|\s*https:\/\/scrandle.com/i);
    if (!scrandleMatch) {
      throw new Error('❌ Incorrect share text for Scrandle. Expected format: "🟩🟥... n/10 | YYYY-MM-DD | https://scrandle.com"');
    }
    result.gameName = 'Scrandle';
    result.puzzleNumber = scrandleMatch[3];
    const correctCount = parseInt(scrandleMatch[2], 10);
    result.maxAttempts = 10;
    result.completed = true;
    result.failed = correctCount < result.maxAttempts;
    result.scores = { puzzle1: { solved: correctCount } };
    
    // Store grid from match
    result.grid = scrandleMatch[1];
    
    return result;
  }

  // Connections
  if (normalizedGameName === 'connections') {
    const connectionsMatch = text.match(/Connections[\s\S]*?Puzzle #([\d,]+)/i);
    if (!connectionsMatch) {
      throw new Error('❌ Incorrect share text for Connections. Expected format: "Connections...Puzzle #..."');
    }
    result.gameName = 'Connections';
    result.puzzleNumber = connectionsMatch[1];
    // Count lines that are exactly 4 of the same color (🟦🟩🟨🟪), ignoring spaces, using Unicode-aware splitting
    const allowedColors = ['🟦', '🟩', '🟨', '🟪'];
    
    // Extract all emoji grid lines (including mixed-color wrong guesses and correct rows)
    const emojiLines = lines.filter(line => {
      const clean = line.replace(/\s+/g, '');
      const chars = Array.from(clean);
      // Keep lines that are exactly 4 characters and contain only Connections colors
      return chars.length === 4 && chars.every(c => allowedColors.includes(c));
    });
    
    // Count only the successful rows (4 of the same color) for score
    const colorRows = emojiLines.filter(line => {
      const clean = line.replace(/\s+/g, '');
      const chars = Array.from(clean);
      return allowedColors.includes(chars[0]) && chars.every(c => c === chars[0]);
    });
    
    const solvedCount = colorRows.length;
    result.maxAttempts = 4;
    result.completed = true;
    result.failed = solvedCount < 4;
    result.scores = { puzzle1: { solved: solvedCount } };
    
    // Store all emoji lines (correct and incorrect attempts)
    if (emojiLines.length > 0) {
      result.grid = emojiLines.join('\n');
    }
    
    return result;
  }

  // Quordle
  if (normalizedGameName === 'quordle') {
    const quordleMatch = text.match(/(?:🙂\s*)?Daily Quordle\s+([\d,]+)/i);
    if (!quordleMatch) {
      throw new Error('❌ Incorrect share text for Quordle. Expected format: "Daily Quordle #..."');
    }
    result.gameName = 'Quordle';
    result.puzzleNumber = quordleMatch[1];
    
    const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    const failEmoji = '🟥';
    
    let successCount = 0;
    let totalWords = 0;
    let maxGuess = 0;
    
    for (const line of lines) {
      const hasEmojiNumber = emojiNumbers.some(emoji => line.includes(emoji));
      const hasFailEmoji = line.includes(failEmoji);
      
      if (hasEmojiNumber || hasFailEmoji) {
        for (let i = 0; i < emojiNumbers.length; i++) {
          const emoji = emojiNumbers[i];
          const count = (line.match(new RegExp(emoji, 'g')) || []).length;
          if (count > 0) {
            successCount += count;
            totalWords += count;
            maxGuess = Math.max(maxGuess, i + 1);
          }
        }
        const failCount = (line.match(new RegExp(failEmoji, 'g')) || []).length;
        totalWords += failCount;
      }
    }
    
    result.maxAttempts = totalWords;
    result.maxGuessNumber = maxGuess;
    result.completed = true;
    result.failed = successCount < 4;
    
    // Store all scores in scores field: solved and guesses
    const allSolved = successCount === 4;
    result.scores = {
      puzzle1: {
        solved: successCount,
        attempts: allSolved ? maxGuess : -1
      }
    };
    
    // Extract emoji grid (filter out header line)
    const emojiLines = lines
      .filter(line => {
        // Skip the header line (e.g., "Daily Quordle 123")
        if (/(?:🙂\s*)?Daily Quordle\s+[\d,]+/i.test(line)) return false;
        // Keep lines with Quordle emojis (numbered emojis or fail squares)
        return /[1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🟥⬛⬜🟨🟩]/.test(line);
      });
    if (emojiLines.length > 0) {
      result.grid = emojiLines.join('\n');
    }
    
    return result;
  }

  // Worldle
  if (normalizedGameName === 'worldle') {
    const worldleMatch = text.match(/#Worldle\s+#([\d,]+)(?:\s+\([^\)]+\))?\s+([X\d]+)\/(\d+)(?:\s+\((\d+)%\))?/i);
    if (!worldleMatch) {
      throw new Error('❌ Incorrect share text for Worldle. Expected format: "#Worldle #... X/6 (%)..."');
    }
    const [, puzzleNumber, scoreStr, maxAttemptsStr, percentStr] = worldleMatch;
    result.gameName = 'Worldle';
    result.puzzleNumber = puzzleNumber;
    result.maxAttempts = parseInt(maxAttemptsStr, 10);
    
    if (percentStr) {
      result.percentage = parseInt(percentStr, 10);
    }
    
    if (scoreStr.toUpperCase() === 'X') {
      result.guessCount = undefined;
    } else {
      result.guessCount = parseInt(scoreStr, 10);
    }
    
    result.completed = true;
    result.failed = result.percentage !== 100;
    
    // Store all scores in scores field: accuracy (percentage) and attempts (guesses)
    result.scores = {
      puzzle1: {
        accuracy: result.percentage || 0,
        attempts: result.failed ? -1 : (result.guessCount || -1)
      }
    };
    
    // Extract emoji grid (ignore bonus round and unrelated lines)
    const emojiLines = lines.filter(line => {
      // Skip the score header line (e.g., "#Worldle #123 3/6 (100%)")
      if (/^#Worldle\s+#[\d,]+/i.test(line)) return false;
      // Skip any line that contains 'streak' (case-insensitive) or starts with '🔥'
      if (/streak/i.test(line) || line.trim().startsWith('🔥')) return false;
      // Skip any line that is a bonus round or non-emoji message
      if (/Worldle has a new bonus round/i.test(line)) return false;
      // Only keep lines that are made up entirely of valid Worldle emojis (arrows, colored squares, white square, and 🎉)
      const emojiPattern = /^[⬆️⬇️⬅️➡️↗️↘️↙️↖️🟩🟨🟥⬜🎉]+$/u;
      return emojiPattern.test(line.trim());
    });
    if (emojiLines.length > 0) {
      result.grid = emojiLines.join('\n');
    }
    
    return result;
  }

  // Nerdle
  if (normalizedGameName === 'nerdle') {
    const nerdleMatch = text.match(/nerdlegame\s+([\d,]+)\s+([X\d]+)\/(\d+)/i);
    if (!nerdleMatch) {
      throw new Error('❌ Incorrect share text for Nerdle. Expected format: "nerdlegame # X/6..."');
    }
    const [, puzzleNumber, scoreStr, maxAttemptsStr] = nerdleMatch;
    result.gameName = 'Nerdle';
    result.puzzleNumber = puzzleNumber;
    result.maxAttempts = parseInt(maxAttemptsStr, 10);
    
    if (scoreStr.toUpperCase() === 'X') {
      result.failed = true;
      result.completed = true;
      result.scores = { puzzle1: { attempts: -1 } };
    } else {
      const attempts = parseInt(scoreStr, 10);
      result.completed = true;
      result.failed = false;
      result.scores = { puzzle1: { attempts } };
    }
    
    // Extract emoji grid (filter out score header line)
    const emojiLines = lines
      .filter(line => {
        // Skip the score header line (e.g., "nerdlegame 1,234 5/6")
        if (/^nerdlegame\s+[\d,]+\s+[X\d]+\/\d+/i.test(line)) return false;
        // Keep lines with Nerdle emojis
        return /[⬛⬜🟪🟩]/.test(line);
      });
    if (emojiLines.length > 0) {
      result.grid = emojiLines.join('\n');
    }
    
    return result;
  }

  // Colorfle
  if (normalizedGameName === 'colorfle') {
    const colorfleMatch = text.match(/Colorfle\s+([\d,]+)\s+([X\d]+)\/(\d+)/i);
    if (!colorfleMatch) {
      throw new Error('❌ Incorrect share text for Colorfle. Expected format: "Colorfle # X/6..."');
    }
    const [, puzzleNumber, scoreStr] = colorfleMatch;
    result.gameName = 'Colorfle';
    result.puzzleNumber = puzzleNumber;
    result.maxAttempts = 6;

    // Extract accuracy percentage (e.g., "color accuracy of 76.8%")
    let accuracy: number | undefined = undefined;
    const accuracyMatch = text.match(/accuracy of\s*([\d.]+)%/i);
    if (accuracyMatch) {
      accuracy = parseFloat(accuracyMatch[1]);
    }

    let attemptsVal: number;
    if (scoreStr.toUpperCase() === 'X') {
      result.failed = true;
      result.completed = true;
      attemptsVal = -1;
    } else {
      attemptsVal = parseInt(scoreStr, 10);
      result.completed = true;
      result.failed = false;
    }

    // Store all scores in scores field: attempts and accuracy
    result.scores = {
      puzzle1: {
        attempts: attemptsVal,
        accuracy: typeof accuracy === 'number' ? accuracy : 0
      }
    };
    
    // Extract emoji grid (filter out score header line)
    const emojiLines = lines
      .filter(line => {
        // Skip the score header line (e.g., "Colorfle 123 5/6")
        if (/^Colorfle\s+[\d,]+\s+[X\d]+\/\d+/i.test(line)) return false;
        // Keep lines with Colorfle emojis
        return /[⬛⬜🟨🟩🟦🟧🟥🟪🟫]/.test(line);
      });
    if (emojiLines.length > 0) {
      result.grid = emojiLines.join('\n');
    }
    
    return result;
  }

  // Hexcodle
  if (normalizedGameName === 'hexcodle') {
    // Match both "in X!" for attempts and "Score: X%" for accuracy
    const hexcodleMatch = text.match(/Hexcodle\s+#([\d,]+)\s+in\s+(\d+)!.*?Score:\s*(\d+)%/is);
    // Also try without "in X!" for failed games: "I didn't get Hexcodle #869. Score: 69%"
    const hexcodleFailedMatch = text.match(/(?:I\s+didn't\s+get\s+)?Hexcodle\s+#([\d,]+).*?Score:\s*(\d+)%/is);
    
    if (!hexcodleMatch && !hexcodleFailedMatch) {
      throw new Error('❌ Incorrect share text for Hexcodle. Expected format: "Hexcodle #... in X! Score: %..."');
    }
    
    let puzzleNumber: string;
    let attempts: number | undefined;
    let percent: number;
    
    if (hexcodleMatch) {
      [, puzzleNumber, , ] = hexcodleMatch;
      attempts = parseInt(hexcodleMatch[2], 10);
      percent = parseInt(hexcodleMatch[3], 10);
    } else {
      [, puzzleNumber, ] = hexcodleFailedMatch!;
      percent = parseInt(hexcodleFailedMatch![2], 10);
      attempts = undefined; // Failed, no successful attempts
    }
    
    result.gameName = 'Hexcodle';
    result.puzzleNumber = puzzleNumber;
    result.percentage = percent;
    result.completed = true;
    
    // Extract emoji grid (filter out header line)
    const emojiLines = lines
      .filter(line => {
        // Skip the header line (e.g., "Hexcodle #123")
        if (/^Hexcodle\s+#[\d,]+/i.test(line)) return false;
        if (/^I\s+(didn't\s+get|got)\s+Hexcodle/i.test(line)) return false;
        if (/Score:/i.test(line)) return false;
        if (/hexcodle\.com/i.test(line)) return false;
        // Keep lines with Hexcodle emojis (arrows and checkmarks)
        return /[⏫⏬🔼🔽✅]/.test(line);
      });
    
    const numRows = emojiLines.length;
    const lastRow = emojiLines[numRows - 1] || '';
    // Check if last row is all checkmarks (solved)
    const isLastRowAllCheckmarks = lastRow.length > 0 && [...lastRow].every(ch => ch === '✅' || /\s/.test(ch));
    
    // Failed if 5 rows and last row is not all checkmarks, or if no "in X!" found
    result.failed = (numRows === 5 && !isLastRowAllCheckmarks) || attempts === undefined;
    
    // Guesses: number of rows if solved, undefined if failed
    result.guessCount = result.failed ? undefined : numRows;
    result.maxAttempts = 5;
    // Store all scores in scores field: accuracy and attempts
    result.scores = {
      puzzle1: {
        accuracy: percent,
        attempts: attempts // Will be undefined if failed
      }
    };
    
    if (emojiLines.length > 0) {
      result.grid = emojiLines.join('\n');
    }
    
    return result;
  }

  // ColorGuesser / Colorguesser
  if (normalizedGameName === 'colorguesser') {
    const colorGuesserMatch = text.match(/ColorGuesser\s+#([\d,]+).*?Score:\s*(\d+)\/(\d+)/is);
    if (!colorGuesserMatch) {
      throw new Error('❌ Incorrect share text for ColorGuesser. Expected format: "ColorGuesser #...Score: n/500..."');
    }
    const [, puzzleNumber, scoreStr, maxScoreStr] = colorGuesserMatch;
    result.gameName = 'ColorGuesser';
    result.puzzleNumber = puzzleNumber;
    const scoreValue = parseInt(scoreStr, 10);
    result.maxAttempts = parseInt(maxScoreStr, 10);
    result.completed = true;
    result.failed = false;
    result.scores = { puzzle1: { points: scoreValue } };
    
    return result;
  }

  // Timingle
  if (normalizedGameName === 'timingle') {
    const timingleMatch = text.match(/Timingle\s+#([\d,]+).*?([-+]?\d+\.?\d*)\s*seconds/is);
        result.gameName = 'Timingle';
        result.puzzleNumber = timingleMatch ? timingleMatch[1] : undefined;
        // Store time in milliseconds as integer (e.g., 2.4s -> 2400ms)
        const secondsStr = timingleMatch ? timingleMatch[2] : undefined;
        const timeMs = secondsStr ? Math.round(parseFloat(secondsStr) * 1000) : undefined;
          result.completed = true;
          result.failed = false;
          result.grid = '';
          result.scores = { puzzle1: { time: timeMs } };
        return result;
  }

  // Spellcheck
  if (normalizedGameName === 'spellcheck') {
    const spellcheckMatch = text.match(/Spellcheck\s+#([\d,]+)/i);
    if (!spellcheckMatch) {
      throw new Error('❌ Incorrect share text for Spellcheck. Expected format: "Spellcheck #..."');
    }
    result.gameName = 'Spellcheck';
    result.puzzleNumber = spellcheckMatch[1];
    const grid = extractEmojiGrid(lines, /[🟥🟩🟦🟨🟧🟪🟫⭐✅❌]/);
    const gridLines = grid.split('\n').filter(line => line.length > 0);
    let score = 0;
    let total = 0;
    for (const line of gridLines) {
      for (const char of Array.from(line)) {
        if (char === '🟥') {
          total++;
        } else if (/[🟩🟦🟨🟧🟪🟫⭐✅]/.test(char)) {
          score++;
          total++;
        }
      }
    }
    const correct = score;
    result.maxAttempts = 15;
    result.completed = true;
    result.failed = false;
    result.scores = { puzzle1: { solved: correct } };
    
    // Store the extracted grid
    if (gridLines.length > 0) {
      result.grid = gridLines.join('\n');
    }
    
    return result;
  }

  // Pokedoku
  if (normalizedGameName === 'pokedoku') {
    // Accept Pokedoku Summary with or without a date after 'Summary'
    const pokedokuMatch = text.match(/PokeDoku\s+Summary(?:.*?(\d{4}-\d{2}-\d{2}))?.*?Score:\s*(\d+)\s*\/\s*(\d+)/is);
    if (!pokedokuMatch) {
      throw new Error('❌ Incorrect share text for Pokedoku. Expected format: "PokeDoku Summary...Score: n/9..."');
    }
    const [, date, scoreStr, maxScoreStr] = pokedokuMatch;
    result.gameName = 'Pokedoku';
    if (date) {
      result.puzzleNumber = date;
    }
    const solved = parseInt(scoreStr, 10);
    result.maxAttempts = parseInt(maxScoreStr, 10);
    
    // Extract uniqueness if present
    const uniquenessMatch = text.match(/Uniqueness:\s*(\d+)\/(\d+)/i);
    let uniqueness = 0;
    let maxUniqueness = 0;
    if (uniquenessMatch) {
      uniqueness = parseInt(uniquenessMatch[1], 10);
      maxUniqueness = parseInt(uniquenessMatch[2], 10);
      result.uniqueness = uniqueness;
      result.maxUniqueness = maxUniqueness;
    }
    
    // Store all scores in scores field: solved, uniqueness, maxUniqueness
    result.scores = {
      puzzle1: {
        solved,
        uniqueness: uniqueness,
        maxUniqueness: maxUniqueness
      }
    };
    
    // Extract the grid (3x3 matrix of ✅ and 🟥)
    const gridPattern = /((?:(?:✅|🟥)\s*)+(?:\n(?:(?:✅|🟥)\s*)+){2})/;
    const gridMatch = text.match(gridPattern);
    if (gridMatch) {
      const gridLines = gridMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      result.grid = gridLines.join('\n');
    }
    
    result.completed = true;
    result.failed = false;
    
    return result;
  }

  // Wordle (generic)
  if (normalizedGameName === 'wordle') {
    // Only extract the value before the "/" in its share text
    const wordleMatch = text.match(/Wordle\s+([\d,]+)\s+([X\d]+)\/(\d+)/i);
    if (!wordleMatch) {
      throw new Error('❌ Incorrect share text for Wordle. Expected format: "Wordle # X/6..."');
    }
    const [, puzzleNumber, scoreStr, maxAttemptsStr] = wordleMatch;
    result.gameName = 'Wordle';
    result.puzzleNumber = puzzleNumber;

    result.maxAttempts = parseInt(maxAttemptsStr, 10);
    if (scoreStr.toUpperCase() === 'X') {
      result.failed = true;
      result.completed = true;
      result.scores = { puzzle1: { attempts: -1 } };
    } else {
      const attempts = parseInt(scoreStr, 10);
      result.completed = true;
      result.failed = false;
      result.scores = { puzzle1: { attempts } };
    }
    
    // Extract emoji grid (filter out score header line)
    const emojiLines = lines
      .filter(line => {
        // Skip the score header line (e.g., "Wordle 1,644 X/6")
        if (/^Wordle\s+[\d,]+\s+[X\d]+\/\d+/.test(line)) return false;
        // Keep lines with Wordle emojis
        return /[⬛⬜🟨🟩]/.test(line);
      });
    if (emojiLines.length > 0) {
      result.grid = emojiLines.join('\n');
    }
    
    return result;
  }

  // Bandle
  if (normalizedGameName === 'bandle') {
    // Example header: "Bandle #1227 x/6" or "Bandle #1227 4/6"
    const bandleMatch = text.match(/Bandle\s+#([\d,]+)\s+([Xx\d]+)\/(\d+)/i);
    if (!bandleMatch) {
      throw new Error('❌ Incorrect share text for Bandle. Expected format: "Bandle #... X/6 or n/6"');
    }
    const [, puzzleNumber, scoreStr, maxAttemptsStr] = bandleMatch;
    result.gameName = 'Bandle';
    result.puzzleNumber = puzzleNumber;
    result.maxAttempts = parseInt(maxAttemptsStr, 10);

    if (scoreStr.toUpperCase() === 'X') {
      result.failed = true;
      result.completed = true;
      result.scores = { puzzle1: { attempts: -1 } };
    } else {
      const attempts = parseInt(scoreStr, 10);
      result.completed = true;
      result.failed = false;
      result.scores = { puzzle1: { attempts } };
    }

    // Extract emoji/grid lines (black squares etc.)
    const grid = extractEmojiGrid(lines, /[⬛⬜🟨🟩🟥]/);
    if (grid) result.grid = grid;

    return result;
  }

  throw new Error(`❌ Incorrect share text for ${gameName}. Please check the format.`);
}

/**
 * Parse share text from various wordle-style games
 * @param text The share text to parse
 * @param expectedGameName Optional: The expected game name to validate against
 * @returns Parsed share text or null if invalid
 * @throws Error if expectedGameName is provided and text doesn't match that game
 */
export function parseShareText(text: string, expectedGameName?: string): ParsedShareText | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const lines = text.trim().split('\n');
  
  // If a specific game is expected, validate and parse only that game
  if (expectedGameName) {
    let result = parseSpecificGame(text, lines, expectedGameName);
    // Ensure puzzleNumber is set (fallback to current date)
    if (result && !result.puzzleNumber) {
      result.puzzleNumber = getCurrentDate();
    }
    result = normalizeParsedShareText(result);
    if (result && result.parseWarnings && result.parseWarnings.length > 0) {
      throw new Error(`Share text parse warnings for ${expectedGameName}: ${result.parseWarnings.join('; ')}`);
    }
    return result;
  }

  // Auto-detect game name from share text
  const detectedGameName = detectGameName(text);
  
  if (detectedGameName) {
    // Use the specific game parser
    let result = parseSpecificGame(text, lines, detectedGameName);
    if (result && !result.puzzleNumber) {
      result.puzzleNumber = getCurrentDate();
    }
    result = normalizeParsedShareText(result);
    return result;
  }

  // Fallback: Try to parse generic Wordle-style format
  const result: ParsedShareText = {
    failed: false,
    completed: false,
  };

  // Look for score line (e.g., "Wordle 1,643 X/6" or "Wordle 1,643 5/6")
  const scoreLinePatterns = [
    // Format with game name and puzzle number: "Wordle 1,643 X/6" or "Wordle 1,643 5/6"
    /([\w\s]+?)\s+([\d,]+)\s+([X\d]+)\/(\d+)/i,
    // Alternative format: "X/6" or "5/6"
    /([X\d]+)\/(\d+)/i,
  ];

  let scoreFound = false;
  for (const line of lines) {
    // Try pattern with game name and puzzle number first
    const fullMatch = line.match(scoreLinePatterns[0]);
    if (fullMatch) {
      const [, gameName, puzzleNumber, scoreStr, maxAttemptsStr] = fullMatch;
      result.gameName = gameName.trim();
      result.puzzleNumber = puzzleNumber;
      result.maxAttempts = parseInt(maxAttemptsStr, 10);
      let attemptsVal: number | undefined;
      if (scoreStr.toUpperCase() === 'X') {
        attemptsVal = undefined;
        result.failed = true;
        result.completed = true;
      } else {
        attemptsVal = parseInt(scoreStr, 10);
        result.completed = true;
        result.failed = false;
      }
      result.scores = { puzzle1: { attempts: attemptsVal === undefined ? -1 : attemptsVal } };
      scoreFound = true;
      break;
    }
    
    // Try simple score pattern
    const simpleMatch = line.match(scoreLinePatterns[1]);
    if (simpleMatch) {
      const [, scoreStr, maxAttemptsStr] = simpleMatch;
      result.maxAttempts = parseInt(maxAttemptsStr, 10);
      let attemptsVal: number | undefined;
      if (scoreStr.toUpperCase() === 'X') {
        attemptsVal = undefined;
        result.failed = true;
        result.completed = true;
      } else {
        attemptsVal = parseInt(scoreStr, 10);
        result.completed = true;
        result.failed = false;
      }
      result.scores = { puzzle1: { attempts: attemptsVal === undefined ? -1 : attemptsVal } };
      scoreFound = true;
      break;
    }
  }

  // Check for hard mode indicator

  // Extract emoji grid (lines containing game emojis)
  const emojiLines: string[] = [];
  const gameEmojis = [
    '⬛', '⬜', '🟨', '🟩', '🟦', '🟧', '🟥', // Wordle-style
    '🟪', '🟫', '⭐', '✅', '❌', // Other games
    '🔴', '🔵', '🟢', '🟡', '⚪', // Alternative styles
  ];

  for (const line of lines) {
    // Skip URLs, empty lines, and metadata lines
    if (line.includes('http://') || line.includes('https://') || line.includes('.com') || 
        line.trim().length === 0) {
      continue;
    }
    
    // Check if line contains game emojis
    const hasEmojis = gameEmojis.some(emoji => line.includes(emoji));
    if (hasEmojis) {
      emojiLines.push(line);
    }
  }

  if (emojiLines.length > 0) {
    result.grid = emojiLines.join('\n');
    
    // If no score was found from header, try to deduce from grid
    if (!scoreFound && emojiLines.length > 0) {
      result.maxAttempts = emojiLines.length;
      
      // Check if last line is all correct (all green/correct emojis)
      const lastLine = emojiLines[emojiLines.length - 1];
      const correctEmojis = ['🟩', '✅', '🟢'];
      const allCorrect = correctEmojis.some(emoji => {
        const count = (lastLine.match(new RegExp(emoji, 'g')) || []).length;
        return count > 0 && !lastLine.includes('⬛') && !lastLine.includes('🟨');
      });
      
      if (allCorrect) {
        result.completed = true;
        result.failed = false;
        result.scores = { puzzle1: { attempts: emojiLines.length } };
      } else {
        // If grid is present but not solved, mark as failed
        result.completed = true;
        result.failed = true;
        result.scores = { puzzle1: { attempts: -1 } };
      }
    }
  }

  // Ensure puzzleNumber is set (fallback to current date if not already set)
  if (!result.puzzleNumber) {
    result.puzzleNumber = getCurrentDate();
  }

  return normalizeParsedShareText(result);
}

/**
 * Auto-fill form data from share text
 */
export function autoFillFromShareText(shareText: string, expectedGameName?: string) {
  try {
    const parsed = parseShareText(shareText, expectedGameName);
    
    if (!parsed) {
      return null;
    }

    return {
      completed: parsed.completed,
      failed: parsed.failed,
      shareText: shareText.trim(),
    };
  } catch (error) {
    // Return error message if validation fails
    return {
      error: error instanceof Error ? error.message : 'Failed to parse share text'
    };
  }
}

/**
 * Parse LoLdle summary text
 * Format: "I've completed all the modes of #LoLdle #1261 today:\n❓ Classic: 8\n💬 Quote: 5\n..."
 */
export function parseLoLdleSummary(text: string): LoLdleParsedResult | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Extract puzzle number from "#LoLdle #1261"
  const puzzleMatch = text.match(/#LoLdle\s+#([\d,]+)/i);
  if (!puzzleMatch) {
    return null;
  }

  const result: LoLdleParsedResult = {
    puzzleNumber: puzzleMatch[1],
    modes: {},
    scores: {},
  };

  // Parse each mode line
  const lines = text.split('\n');
  for (const line of lines) {
    // Classic: "❓ Classic: 8"
    const classicMatch = line.match(/Classic:\s*(\d+)/i);
    if (classicMatch) {
      result.modes.Classic = parseInt(classicMatch[1], 10);
      result.scores!.classic = { attempts: parseInt(classicMatch[1], 10) };
    }

    // Quote: "💬 Quote: 5"
    const quoteMatch = line.match(/Quote:\s*(\d+)/i);
    if (quoteMatch) {
      result.modes.Quote = parseInt(quoteMatch[1], 10);
      result.scores!.quote = { attempts: parseInt(quoteMatch[1], 10) };
    }

    // Ability: "🔥 Ability: 1 🧠 ✓"
    const abilityMatch = line.match(/Ability:\s*(\d+)/i);
    if (abilityMatch) {
      result.modes.Ability = parseInt(abilityMatch[1], 10);
      result.scores!.ability = { attempts: parseInt(abilityMatch[1], 10) };
    }

    // Emoji: "😀 Emoji: 4"
    const emojiMatch = line.match(/Emoji:\s*(\d+)/i);
    if (emojiMatch) {
      result.modes.Emoji = parseInt(emojiMatch[1], 10);
      result.scores!.emoji = { attempts: parseInt(emojiMatch[1], 10) };
    }

    // Splash: "🎨 Splash: 1 ✓"
    const splashMatch = line.match(/Splash:\s*(\d+)/i);
    if (splashMatch) {
      result.modes.Splash = parseInt(splashMatch[1], 10);
      result.scores!.splash = { attempts: parseInt(splashMatch[1], 10) };
    }
  }

  return result;
}

/**
 * Parse Pokedle summary text
 * Format: "I've completed all the modes of #Pokedle #799 today:\n❓ Classic: 11\n🃏 Card: 14\n..."
 */
export function parsePokedleSummary(text: string): PokedleParsedResult | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Extract puzzle number from "#Pokedle #799"
  const puzzleMatch = text.match(/#Pokedle\s+#([\d,]+)/i);
  if (!puzzleMatch) {
    return null;
  }

  const result: PokedleParsedResult = {
    puzzleNumber: puzzleMatch[1],
    modes: {},
  };

  // Parse each mode line
  const lines = text.split('\n');
  for (const line of lines) {
    // Classic: "❓ Classic: 11"
    const classicMatch = line.match(/Classic:\s*(\d+)/i);
    if (classicMatch) {
      result.modes.Classic = parseInt(classicMatch[1], 10);
    }

    // Card: "🃏 Card: 14"
    const cardMatch = line.match(/Card:\s*(\d+)/i);
    if (cardMatch) {
      result.modes.Card = parseInt(cardMatch[1], 10);
    }

    // Description: "📄 Description: 4"
    const descriptionMatch = line.match(/Description:\s*(\d+)/i);
    if (descriptionMatch) {
      result.modes.Description = parseInt(descriptionMatch[1], 10);
    }

    // Silhouette: "👤 Silhouette: 15"
    const silhouetteMatch = line.match(/Silhouette:\s*(\d+)/i);
    if (silhouetteMatch) {
      result.modes.Silhouette = parseInt(silhouetteMatch[1], 10);
    }
  }

  return result;
}

/**
 * Parse Gamedle summary text
 * Format: "Gamedle\n🕹️ (Cover art) #1337:\n🟥🟥🟥🟥🟥🟩\n\n🎨 (Artwork) #1096:\n🟥🟥🟥🟥🟥🟩\n..."
 */
export function parseGamedleSummary(text: string): GamedleParsedResult | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Check if this is a Gamedle summary
  if (!text.match(/^Gamedle\s*$/m)) {
    return null;
  }

  const result: GamedleParsedResult = {
    puzzleNumbers: {},
    modes: {},
  };

  const subPuzzles = [
    { name: 'Cover art', icon: '🕹️', maxAttempts: 6 },
    { name: 'Artwork', icon: '🎨', maxAttempts: 6 },
    { name: 'Character', icon: '👤', maxAttempts: 4 },
    { name: 'Keywords', icon: '🔑', maxAttempts: 6 },
    { name: 'Guess', icon: '🔍', maxAttempts: 10 }
  ];

  for (const puzzle of subPuzzles) {
    const regex = new RegExp(`${puzzle.icon}\\s+\\(${puzzle.name}\\)\\s+#([\\d,]+):\\s*([\\u{1F7E5}\\u{1F7E9}\\u{2B1C}]+)`, 'ui');
    const match = text.match(regex);
    
    if (match) {
      const [, puzzleNumber, emojiString] = match;
      
      // Count red emojis before first green emoji and convert to 1-based attempts
      const greenIndex = emojiString.indexOf('🟩');
      let attemptsVal: number | undefined;

      if (greenIndex === -1) {
        // No green emoji = failed -> store -1 to indicate failure
        attemptsVal = -1;
      } else {
        // Count red emojis before green and add one for the successful attempt
        const beforeGreen = emojiString.substring(0, greenIndex);
        const redCount = (beforeGreen.match(/🟥/gu) || []).length;
        attemptsVal = redCount + 1;
      }

      const key = puzzle.name.toLowerCase();
      result.puzzleNumbers[key as keyof typeof result.puzzleNumbers] = puzzleNumber;
      result.modes[key as keyof typeof result.modes] = attemptsVal;
    }
  }

  return result;
}
