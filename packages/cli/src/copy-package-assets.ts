/**
 * Copy non-TypeScript publish assets from src/ → dist/ so compiled packages
 * keep MDX/admin presentation imports working after `tsc`.
 */

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ASSET_EXT = new Set([
	".mdx",
	".json",
	".css",
	".svg",
	".png",
	".jpg",
	".jpeg",
	".webp",
	".gif",
	".woff",
	".woff2",
]);

function shouldSkip(rel: string): boolean {
	const parts = rel.split(/[/\\]/);
	if (parts.includes("__tests__")) return true;
	if (/\.test\.(ts|tsx|js|jsx)$/.test(rel)) return true;
	return false;
}

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			walk(full, out);
			continue;
		}
		out.push(full);
	}
	return out;
}

export type CopyPackageAssetsResult = {
	copied: number;
	pkgDir: string;
	skipped: boolean;
};

/**
 * Copy publish assets for a package directory (defaults to cwd).
 */
export function copyPackageAssets(
	pkgDir: string = process.cwd(),
): CopyPackageAssetsResult {
	const absDir = resolve(pkgDir);
	const src = join(absDir, "src");
	const dist = join(absDir, "dist");

	if (!existsSync(src)) {
		return { copied: 0, pkgDir: absDir, skipped: true };
	}

	if (!existsSync(dist)) {
		mkdirSync(dist, { recursive: true });
	}

	let copied = 0;
	for (const file of walk(src)) {
		const rel = relative(src, file);
		if (shouldSkip(rel)) continue;
		const ext = rel.includes(".") ? `.${rel.split(".").pop()}` : "";
		if (!ASSET_EXT.has(ext)) continue;
		const dest = join(dist, rel);
		mkdirSync(dirname(dest), { recursive: true });
		copyFileSync(file, dest);
		copied += 1;
	}

	return { copied, pkgDir: absDir, skipped: false };
}
