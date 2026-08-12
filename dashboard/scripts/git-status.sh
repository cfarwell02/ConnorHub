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

  git -C "$PROJECT" fetch --quiet 2>/dev/null

  UPSTREAM="$(git -C "$PROJECT" rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)"

  if [ -n "$UPSTREAM" ]; then
    COUNTS="$(git -C "$PROJECT" rev-list --left-right --count "$UPSTREAM...HEAD")"

    BEHIND="$(echo "$COUNTS" | awk '{print $1}')"
    AHEAD="$(echo "$COUNTS" | awk '{print $2}')"

    echo "Ahead: $AHEAD"
    echo "Behind: $BEHIND"
  fi

  echo
done
