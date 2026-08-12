#!/usr/bin/env bash

PROJECTS_ROOT="/srv/connorhub/Projects"

echo "ConnorHub Git Status"
echo "===================="
echo

for PROJECT in "$PROJECTS_ROOT"/*; do
  if [ ! -d "$PROJECT/.git" ]; then
    continue
  fi

  PROJECT_NAME="$(basename "$PROJECT")"
  BRANCH="$(git -C "$PROJECT" branch --show-current)"
  CHANGES="$(git -C "$PROJECT" status --porcelain)"

  echo "$PROJECT_NAME"
  echo "Branch: $BRANCH"

  if [ -z "$CHANGES" ]; then
    echo "Status: clean"
  else
    CHANGE_COUNT="$(printf '%s\n' "$CHANGES" | wc -l | tr -d ' ')"
    echo "Status: $CHANGE_COUNT changed file(s)"
  fi

  echo
done
