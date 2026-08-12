#!/usr/bin/env bash

echo "ConnorHub Network Report"
echo "========================"
echo

echo "Hostname:"
hostname
echo

echo "Local IP addresses:"
hostname -I
echo

echo "Active connections:"
nmcli connection show --active 2>/dev/null || true
echo

echo "Tailscale:"
if command -v tailscale >/dev/null 2>&1; then
  TAILSCALE_IP="$(tailscale ip -4 2>/dev/null)"

  if [ -n "$TAILSCALE_IP" ]; then
    echo "Connected"
    echo "IP: $TAILSCALE_IP"
  else
    echo "Not connected"
  fi
else
  echo "Tailscale not installed"
fi

echo

echo "Internet:"
if ping -c 1 -W 2 1.1.1.1 >/dev/null 2>&1; then
  echo "Connected"
else
  echo "No connection"
fi
