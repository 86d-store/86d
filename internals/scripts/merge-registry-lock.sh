#!/usr/bin/env sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

bun run generate:modules
cp "$ROOT/apps/registry/registry.lock.json" "$1"
