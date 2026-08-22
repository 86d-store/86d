/**
 * Rewrite workspace path aliases in emitted dist so npm consumers resolve
 * relative files instead of `~/` specifiers.
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = join(pkgDir, "dist");

const IMPORT_SPECIFIER = /(from\s+|import\s*\(\s*)(["'])~\/([^"']+)\2/g;

function toPosix(path: string): string {
	return path.split(sep).join("/");
}

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			walk(full, out);
			continue;
		}
		out.push(full);
	}
	return out;
}

function relativeSpecifier(fromFile: string, importedPath: string): string {
	const targetAbs = resolve(distDir, importedPath);
	let rel = toPosix(relative(dirname(fromFile), targetAbs));
	if (!rel.startsWith(".")) rel = `./${rel}`;
	if (!extname(rel)) rel += ".js";
	return rel;
}

function rewriteFileContents(fromFile: string, source: string): string {
	return source.replace(
		IMPORT_SPECIFIER,
		(_match, prefix: string, quote: string, importedPath: string) =>
			`${prefix}${quote}${relativeSpecifier(fromFile, importedPath)}${quote}`,
	);
}

function main(): void {
	if (!existsSync(distDir)) {
		throw new Error(`Missing dist/ at ${distDir}; run tsc first`);
	}

	let rewritten = 0;
	for (const file of walk(distDir)) {
		if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
		const source = readFileSync(file, "utf8");
		const next = rewriteFileContents(file, source);
		if (next === source) continue;
		writeFileSync(file, next);
		rewritten += 1;
	}

	console.log(`Rewrote ~/ imports in ${rewritten} dist file(s).`);
}

main();
