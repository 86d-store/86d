/**
 * Append .js to relative ESM import/export specifiers in dist so Node and
 * Vitest resolve the published package (tsc with moduleResolution bundler
 * emits extensionless paths).
 */
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = join(pkgDir, "dist");

const RELATIVE_SPEC =
	/(from\s+|import\s*\(\s*|export\s+\*\s+from\s+)(["'])(\.[^"']+)\2/g;

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

function withJsExtension(specifier: string): string {
	if (
		specifier.endsWith(".js") ||
		specifier.endsWith(".json") ||
		specifier.endsWith(".css") ||
		specifier.endsWith(".mjs") ||
		specifier.endsWith(".cjs")
	) {
		return specifier;
	}
	return `${specifier}.js`;
}

function rewrite(source: string): string {
	return source.replace(
		RELATIVE_SPEC,
		(_match, prefix: string, quote: string, specifier: string) =>
			`${prefix}${quote}${withJsExtension(specifier)}${quote}`,
	);
}

function main(): void {
	if (!existsSync(distDir)) {
		throw new Error(`Missing dist/ at ${distDir}; run tsc first`);
	}

	for (const file of walk(distDir)) {
		if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
		const source = readFileSync(file, "utf8");
		const next = rewrite(source);
		if (next === source) continue;
		writeFileSync(file, next);
	}

	// Touch dirname so unused-import linters stay quiet if needed.
	void dirname(distDir);
}

main();
