#!/bin/bash

# Script to install all 29 footer components from shadcnblocks
# Automatically answers "n" to overwrite prompts

cd "$(dirname "$0")"

for i in {1..32}; do
    echo "Installing footer$i..."
    yes n | bunx --bun shadcn@latest add @shadcnblocks/footer$i 2>&1 | grep -v "^n$" || true
    echo "Completed footer$i"
    echo "---"
done

echo "All footer components installation complete!"
