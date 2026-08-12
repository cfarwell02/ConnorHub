#!/usr/bin/env bash

ROOT="/srv/connorhub"

echo "ConnorHub Storage Report"
echo "========================"
echo

echo "Disk:"
df -h "$ROOT"
echo

echo "Top-level folders:"
du -sh "$ROOT"/* 2>/dev/null | sort -hr
echo

echo "Largest files:"
find "$ROOT" -type f -printf '%s %p\n' 2>/dev/null \
  | sort -nr \
  | head -20 \
  | numfmt --field=1 --to=iec
