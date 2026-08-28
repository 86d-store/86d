#!/usr/bin/env sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

bun run generate:modules
rm -f bun.lock
bun install --ignore-scripts
cp "$ROOT/bun.lock" "$1"
