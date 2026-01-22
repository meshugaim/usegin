---
phase: plan
iteration: 1
testPlan:
  tests:
    - index: 0
      name: missing argument exits with error
      description: Running word-count with no arguments should print error to stderr and exit with code 1
      acceptanceCriteria: ["4"]
    - index: 1
      name: nonexistent file exits with error
      description: Running word-count with a path to a file that doesn't exist should print error to stderr and exit with code 1
      acceptanceCriteria: ["1", "4"]
    - index: 2
      name: empty file outputs zero words
      description: Running word-count on an empty file should output "0 words" and exit with code 0
      acceptanceCriteria: ["1", "2", "4"]
    - index: 3
      name: file with content outputs correct word count
      description: Running word-count on a file with multiple words should output the correct count in "N words" format
      acceptanceCriteria: ["1", "2", "4"]
    - index: 4
      name: help flag shows usage information
      description: Running word-count --help should display usage information and exit successfully
      acceptanceCriteria: ["3", "4"]
---

## Rationale

The test order follows a progression from simple error cases to core functionality:

1. **missing argument** - Start with the simplest error case that requires minimal setup (no files needed). Tests basic argument validation.

2. **nonexistent file** - Next simplest error case, tests file path handling and error messaging for invalid input.

3. **empty file** - First success case with the simplest valid input (0 words). Establishes that the basic file reading and output format work.

4. **file with content** - Core functionality test with actual word counting. Tests the main use case of counting words in a real file.

5. **help flag** - Tests the --help flag functionality. Placed last as it's a utility feature separate from core word counting logic.

This ordering ensures we validate error handling first (fail fast), then build up to the core functionality, ending with auxiliary features.
