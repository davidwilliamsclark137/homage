# Code readability for learning

The user reads this code to learn. Treat readability as a requirement.

- Use conventional formatting: Python with four-space indentation and Black;
  JavaScript/TypeScript with two-space indentation and Prettier.
- Prefer one statement per line. Break long calls, conditions, and collections
  across lines. Aim for 88 columns where practical.
- Use descriptive names. Explain unfamiliar concepts and non-obvious decisions
  with short comments. Avoid comments that merely repeat obvious syntax.
- Give scripts a short explanation of their purpose, inputs, outputs, and side
  effects. Make destructive operations clearly visible and explicitly selected.
- Organize scripts into setup, small named helpers, and a clear entry point.
  Use docstrings for reusable functions when their contracts need explanation.
- When editing existing code, preserve behavior and verify the change. Separate
  substantial refactoring from formatting so each can be reviewed and tested.
- Do not reformat generated files, dependencies, private records, or immutable
  source evidence. Preserve provenance when changing adapted upstream code.
- Explain changed code in plain language and point to the relevant files.
