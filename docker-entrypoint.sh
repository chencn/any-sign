#!/usr/bin/env sh
set -eu

if [ -n "${HOST_OVERRIDES:-}" ]; then
  old_ifs="$IFS"
  IFS=","
  for item in $HOST_OVERRIDES; do
    host="${item%%=*}"
    ip="${item#*=}"

    if [ -n "$host" ] && [ -n "$ip" ] && [ "$host" != "$ip" ]; then
      echo "$ip $host" >> /etc/hosts
      echo "[HOST_OVERRIDES] applied: $host=$ip"
    else
      echo "[HOST_OVERRIDES] ignored invalid entry: $item" >&2
    fi
  done
  IFS="$old_ifs"
fi

exec "$@"
