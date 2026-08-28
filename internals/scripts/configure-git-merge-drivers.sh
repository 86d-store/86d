#!/usr/bin/env sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

git config merge.registry-lock.name "Regenerate registry lock"
git config merge.registry-lock.driver "internals/scripts/merge-registry-lock.sh %A"
git config merge.bun-lock.name "Regenerate bun lock"
git config merge.bun-lock.driver "internals/scripts/merge-bun-lock.sh %A"

echo "Configured git merge drivers for registry.lock.json and bun.lock."
