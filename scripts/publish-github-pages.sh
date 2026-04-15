#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

TARGET_BRANCH="main"
DRY_RUN="${1:-}"

current_branch="$(git branch --show-current)"

if [[ -z "${current_branch}" ]]; then
  echo "Publish failed: not on a git branch."
  exit 1
fi

if [[ "${current_branch}" != "${TARGET_BRANCH}" ]]; then
  echo "Publish failed: switch to '${TARGET_BRANCH}' before publishing."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Publish failed: git remote 'origin' is not configured."
  exit 1
fi

echo "Building production bundle..."
npm run build

has_worktree_changes="false"

if [[ -n "$(git status --porcelain)" ]]; then
  has_worktree_changes="true"
fi

commit_created="false"

ahead_count="$(git rev-list --count origin/${TARGET_BRANCH}..HEAD 2>/dev/null || echo "0")"

if [[ "${DRY_RUN}" == "--dry-run" ]]; then
  if [[ "${has_worktree_changes}" == "true" ]]; then
    timestamp="$(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Dry run: would create commit 'Publish GitHub Pages ${timestamp}'."
  fi

  if [[ "${has_worktree_changes}" == "false" && "${ahead_count}" == "0" ]]; then
    echo "Nothing to publish: no new local changes and branch is not ahead of origin/${TARGET_BRANCH}."
    exit 0
  fi

  echo "Dry run: would push '${TARGET_BRANCH}' to origin."
  exit 0
fi

if [[ "${has_worktree_changes}" == "true" ]]; then
  echo "Staging local changes..."
  git add -A

  if ! git diff --cached --quiet; then
    timestamp="$(date '+%Y-%m-%d %H:%M:%S %Z')"
    commit_message="Publish GitHub Pages ${timestamp}"
    echo "Creating commit: ${commit_message}"
    git commit -m "${commit_message}"
    commit_created="true"
  fi
fi

ahead_count="$(git rev-list --count origin/${TARGET_BRANCH}..HEAD 2>/dev/null || echo "0")"

if [[ "${ahead_count}" == "0" && "${commit_created}" == "false" ]]; then
  echo "Nothing to publish: no new local changes and branch is not ahead of origin/${TARGET_BRANCH}."
  exit 0
fi

echo "Pushing ${TARGET_BRANCH} to origin..."
git push origin "${TARGET_BRANCH}"
echo "Publish complete. GitHub Pages will redeploy from the latest main branch push."
