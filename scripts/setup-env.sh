#!/bin/sh
# Creates .env from .env.example and fills in the three secrets, so a first
# install is one command instead of "copy the file, then hand-edit three
# values". Every generated value is unique to this machine — the point is that
# no two installs share a signing key.
#
# POSIX sh rather than a Node script like the rest of scripts/: the documented
# Docker path needs only docker and git, and requiring Node just to generate a
# random string would add a prerequisite to the install it is meant to shorten.
#
#   ./scripts/setup-env.sh      (or: pnpm setup:env)
set -eu

# Matches ENV_EXAMPLE_PLACEHOLDER in src/lib/env.ts, which rejects it at boot.
PLACEHOLDER="replace-with-long-random-secret"
# 64 hex chars, comfortably over the 32-character floor env.ts enforces.
KEYS="AUTH_SECRET CRON_SECRET AUTH_SELF_HOST_PASSWORD"

if [ -f .env ]; then
  echo ".env already exists — not touching it." >&2
  echo "Regenerating AUTH_SECRET would sign every session out. To start over, remove .env first." >&2
  exit 1
fi

if [ ! -f .env.example ]; then
  echo ".env.example not found in $(pwd). Run this from the repository root." >&2
  exit 1
fi

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -tx1 -N32 /dev/urandom | tr -d ' \n'
  fi
}

cp .env.example .env
owner_password=""

for key in $KEYS; do
  if ! grep -q "^${key}=\"${PLACEHOLDER}\"$" .env; then
    rm -f .env
    echo "${key} in .env.example no longer holds the expected placeholder." >&2
    echo "Update scripts/setup-env.sh and src/lib/env.ts together." >&2
    exit 1
  fi
  secret="$(gen_secret)"
  sed "s|^${key}=\"${PLACEHOLDER}\"$|${key}=\"${secret}\"|" .env > .env.tmp
  mv .env.tmp .env
  if [ "$key" = "AUTH_SELF_HOST_PASSWORD" ]; then
    owner_password="$secret"
  fi
done

chmod 600 .env

echo "Wrote .env with freshly generated secrets."
echo
echo "Sign in with this password — it is also stored in .env:"
echo
echo "  ${owner_password}"
echo
echo "Next: docker compose --profile full up --no-build -d"
