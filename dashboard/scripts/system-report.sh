#!/usr/bin/env bash

echo "ConnorHub System Report"
echo "======================="
echo

echo "Hostname:"
hostname
echo

echo "Operating System:"
uname -s
echo

echo "Uptime:"
uptime
echo

echo "Date:"
date
echo

echo "Disk usage:"
df -h /
echo

OS_NAME="$(uname -s)"

echo "Memory:"

if [ "$OS_NAME" = "Darwin" ]; then
  vm_stat
elif [ "$OS_NAME" = "Linux" ]; then
  free -h
else
  echo "Memory information is not supported on this operating system."
fi
