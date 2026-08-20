import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up from `startDir` until a directory contains package.json with workspaces. */
export function findWorkspaceRoot(startDir: string): string {
	let dir = startDir;
	for (;;) {
		const pkgPath = join(dir, "package.json");
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
					workspaces?: unknown;
				};
				if (Array.isArray(pkg.workspaces)) {
					return dir;
				}
			} catch {
				// keep walking
			}
		}
		const parent = dirname(dir);
		if (parent === dir) {
			throw new Error(`Could not find workspace root from ${startDir}`);
		}
		dir = parent;
	}
}

/** Workspace root when called from a file URL (ESM entrypoints). */
export function workspaceRootFromImportMeta(importMetaUrl: string): string {
	return findWorkspaceRoot(dirname(fileURLToPath(importMetaUrl)));
}
