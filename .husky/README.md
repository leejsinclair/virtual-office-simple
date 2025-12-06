# Git Hooks

This directory contains git hooks managed by Husky.

## Hooks

### pre-commit

- Runs `lint-staged` to format and lint staged files
- Automatically formats code with Prettier
- Fixes ESLint issues where possible
- Prevents commit if linting fails

### pre-push

- Runs all tests (`npm test`)
- Prevents push if tests fail
- Ensures code quality before pushing to remote

## Setup

Hooks are automatically installed when you run `npm install` (via the `prepare` script).

## Manual Setup

If hooks aren't working, run:

```bash
npm run prepare
```

## Bypassing Hooks (Not Recommended)

To skip hooks in an emergency:

```bash
git commit --no-verify  # Skip pre-commit
git push --no-verify     # Skip pre-push
```
