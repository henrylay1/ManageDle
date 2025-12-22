import { parseShareText, autoFillFromShareText } from './shareTextParser';

// Test cases
const testCases = [
  {
    name: 'Wordle Failed (X/6)',
    input: `Wordle 1,643 X/6

⬛🟨⬛⬛⬛
⬛⬛🟨⬛🟨
🟨⬛⬛🟨⬛
🟩⬛⬛⬛🟩
🟩⬛🟩⬛⬛
🟩🟩🟩⬛🟩`,
    expected: {
      score: undefined,
      failed: true,
      maxAttempts: 6,
      completed: true,
    }
  },
  {
    name: 'Wordle Success (5/6)',
    input: `Wordle 1,643 5/6

⬛🟨⬛⬛⬛
⬛⬛🟨⬛🟨
🟨⬛⬛🟨⬛
🟩⬛⬛⬛🟩
🟩🟩🟩🟩🟩`,
    expected: {
      score: 5,
      failed: false,
      maxAttempts: 6,
      completed: true,
    }
  },
  {
    name: 'Wordle Success with Hard Mode (3/6*)',
    input: `Wordle 1,643 3/6*

⬛🟨⬛⬛⬛
🟩⬛🟩⬛🟩
🟩🟩🟩🟩🟩`,
    expected: {
      score: 3,
      failed: false,
      maxAttempts: 6,
      completed: true,
    }
  },
];

// Run tests
console.log('=== Share Text Parser Tests ===\n');

testCases.forEach(testCase => {
  console.log(`Test: ${testCase.name}`);
  console.log('Input:', testCase.input.substring(0, 50) + '...');
  
  const result = parseShareText(testCase.input);
  console.log('Result:', result);
  
  if (result) {
    const autoFill = autoFillFromShareText(testCase.input);
    console.log('Auto-fill:', autoFill);
  }
  
  console.log('\n---\n');
});

export { testCases };
