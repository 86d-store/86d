#!/usr/bin/env tsx
/**
 * Thin entry for library packages: run from a package cwd after `tsc`.
 * Modules should prefer `86d module build` instead.
 */

import { join, relative } from "node:path";
import { copyPackageAssets } from "../../../packages/cli/src/copy-package-assets.ts";

const arg = process.argv[2];
const result = copyPackageAssets(arg);
if (result.skipped) {
} else {
	const _relDist = join(relative(process.cwd(), result.pkgDir) || ".", "dist");
}
