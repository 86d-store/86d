/** Rewrite emitted imports so npm consumers can load the package with Node ESM. */

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

const IMPORT_SPECIFIER =
	/(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g;

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

function withJavaScriptExtension(specifier: string): string {
	const suffixIndex = specifier.search(/[?#]/);
	const path = suffixIndex === -1 ? specifier : specifier.slice(0, suffixIndex);
	const suffix = suffixIndex === -1 ? "" : specifier.slice(suffixIndex);
	if (extname(path)) return specifier;
	return `${path}.js${suffix}`;
}

function relativeSpecifier(fromFile: string, importedPath: string): string {
	const targetAbs = resolve(distDir, importedPath);
	let rel = toPosix(relative(dirname(fromFile), targetAbs));
	if (!rel.startsWith(".")) rel = `./${rel}`;
	return withJavaScriptExtension(rel);
}

function rewriteSpecifier(fromFile: string, specifier: string): string {
	if (specifier.startsWith("~/")) {
		return relativeSpecifier(fromFile, specifier.slice(2));
	}
	if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
		return specifier;
	}
	return withJavaScriptExtension(specifier);
}

export function rewriteFileContents(fromFile: string, source: string): string {
	return source.replace(
		IMPORT_SPECIFIER,
		(_match, prefix: string, quote: string, specifier: string) =>
			`${prefix}${quote}${rewriteSpecifier(fromFile, specifier)}${quote}`,
	);
}

function main(): void {
	if (!existsSync(distDir)) {
		throw new Error(`Missing dist/ at ${distDir}; run tsc first`);
	}

	let _rewritten = 0;
	for (const file of walk(distDir)) {
		if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
		const source = readFileSync(file, "utf8");
		const next = rewriteFileContents(file, source);
		if (next === source) continue;
		writeFileSync(file, next);
		_rewritten += 1;
	}
}

if (import.meta.main) {
	main();
}
