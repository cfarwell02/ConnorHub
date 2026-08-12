#!/usr/bin/env bash

PROJECTS_ROOT="/srv/connorhub/Projects"

echo "ConnorHub Projects"
echo "=================="
echo

for PROJECT in "$PROJECTS_ROOT"/*; do
  if [ ! -d "$PROJECT" ]; then
    continue
  fi

  PROJECT_NAME="$(basename "$PROJECT")"

  echo "$PROJECT_NAME"

  if [ -d "$PROJECT/.git" ]; then
    BRANCH="$(git -C "$PROJECT" branch --show-current 2>/dev/null)"
    echo "  Git: yes"
    echo "  Branch: ${BRANCH:-unknown}"
  else
    echo "  Git: no"
  fi

  if [ -f "$PROJECT/package.json" ]; then
    echo "  Node project: yes"
  fi

  if [ -f "$PROJECT/requirements.txt" ] || [ -f "$PROJECT/pyproject.toml" ]; then
    echo "  Python project: yes"
  fi

  echo
done
