#!/usr/bin/env bun
/**
 * Workspace bin for `86d`. `package.json` `bin` must point at a file that
 * exists at install time. `dist/index.js` is gitignored, so linking it from
 * `bin` left `86d` missing on a clean CI checkout and `86d module build` failed.
 *
 * Prefer compiled `dist/` when present (after `86d#build` / npm pack).
 * Otherwise run TypeScript sources so module builds do not wait on dist.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(pkgRoot, "dist", "index.js");
const src = join(pkgRoot, "src", "index.ts");
const entry = existsSync(dist) ? dist : src;

await import(pathToFileURL(entry).href);
