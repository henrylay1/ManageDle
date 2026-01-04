// Simple script to verify pruning logic for recordScores
function buildRecordScoresFromShareTexts(game, shareTexts, summaryText = '') {
  let recordScores;

  if (summaryText && summaryText.trim()) {
    // summary-based logic omitted for this simple test
    return undefined;
  } else if (shareTexts.length === 1 && shareTexts[0].scores) {
    const rawScores = shareTexts[0].scores;
    recordScores = {};
    for (const [puzzleKey, puzzleScores] of Object.entries(rawScores)) {
      recordScores[puzzleKey] = {};
      for (const [scoreKey, scoreVal] of Object.entries(puzzleScores || {})) {
        if (scoreVal !== undefined) {
          recordScores[puzzleKey][scoreKey] = scoreVal;
        }
      }
    }
    // prune empty
    if (recordScores) {
      const nonEmptyKeys = Object.keys(recordScores).filter(pk => Object.keys(recordScores[pk]).length > 0);
      if (nonEmptyKeys.length === 0) {
        recordScores = undefined;
      } else {
        for (const pk of Object.keys(recordScores)) {
          if (Object.keys(recordScores[pk]).length === 0) delete recordScores[pk];
        }
      }
    }
  } else if (shareTexts.length > 1) {
    recordScores = {};
    shareTexts.forEach((st, idx) => {
      const stScores = st.scores;
      if (stScores) {
        const puzzleKey = `puzzle${idx + 1}`;
        if (stScores.puzzle1) {
          const tmp = {};
          for (const [scoreKey, scoreVal] of Object.entries(stScores.puzzle1 || {})) {
            if (scoreVal !== undefined) tmp[scoreKey] = scoreVal;
          }
          if (Object.keys(tmp).length > 0) recordScores[puzzleKey] = tmp;
        } else {
          for (const [pk, pv] of Object.entries(stScores)) {
            const tmp2 = {};
            for (const [sk, sv] of Object.entries(pv || {})) {
              if (sv !== undefined) tmp2[sk] = sv;
            }
            if (Object.keys(tmp2).length > 0) recordScores[pk] = tmp2;
          }
        }
      }
    });
    if (!recordScores || Object.keys(recordScores).length === 0) recordScores = undefined;
  }

  return recordScores;
}

// Test cases
const tests = [
  {
    name: 'Single puzzle with empty puzzle1',
    shareTexts: [{ scores: { puzzle1: {} } }],
  },
  {
    name: 'Single puzzle with defined scores',
    shareTexts: [{ scores: { puzzle1: { attempts: 3 } } }],
  },
  {
    name: 'Multi puzzle where one puzzle is empty',
    shareTexts: [ { scores: { puzzle1: { attempts: 2 } } }, { scores: { puzzle1: {} } } ],
  },
  {
    name: 'Multi puzzle with all empty',
    shareTexts: [ { scores: { puzzle1: {} } }, { scores: { puzzle1: {} } } ],
  }
];

for (const t of tests) {
  console.log('---', t.name);
  console.log(JSON.stringify(buildRecordScoresFromShareTexts({}, t.shareTexts), null, 2));
}

process.exit(0);
