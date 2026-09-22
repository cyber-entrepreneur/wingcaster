#!/bin/sh
# Runtime entrypoint. Railway mounts the persistent volume over /app/uploads at
# runtime owned by root, which masks the build-time chown and blocks the
# non-root `wingcaster` user from writing to it (EACCES on mkdir). Fix it here:
# while still root, take ownership of the mount, then drop privileges to
# `wingcaster` before exec'ing the app.
set -e

UPLOADS_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-/app/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS_DIR"
  chown -R wingcaster:wingcaster "$UPLOADS_DIR" 2>/dev/null || true
  exec gosu wingcaster "$@"
fi

# Already non-root (e.g. local runs) — just exec.
exec "$@"
