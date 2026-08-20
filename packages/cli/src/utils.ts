import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Find the 86d project root by walking up from cwd looking for turbo.json.
 * Falls back to import.meta.dirname-based resolution for monorepo development.
 */
export function findProjectRoot(): string {
	// First, try walking up from cwd
	let dir = process.cwd();
	while (dir !== dirname(dir)) {
		if (
			existsSync(join(dir, "turbo.json")) &&
			existsSync(join(dir, "package.json"))
		) {
			try {
				const pkg = JSON.parse(
					readFileSync(join(dir, "package.json"), "utf-8"),
				);
				if (pkg.name === "86d") return dir;
			} catch {
				// continue searching
			}
		}
		dir = dirname(dir);
	}

	// Fallback: resolve from package location (monorepo dev)
	const fallback = resolve(import.meta.dirname, "../../../..");
	if (existsSync(join(fallback, "turbo.json"))) return fallback;

	return process.cwd();
}

/**
 * Read version from the root package.json or the CLI package.json.
 */
export function getVersion(): string {
	// Try CLI's own package.json first
	const cliPkg = join(import.meta.dirname, "..", "package.json");
	if (existsSync(cliPkg)) {
		try {
			const pkg = JSON.parse(readFileSync(cliPkg, "utf-8"));
			if (pkg.version) return pkg.version;
		} catch {
			// fall through
		}
	}

	// Try project root
	const root = findProjectRoot();
	const rootPkg = join(root, "package.json");
	if (existsSync(rootPkg)) {
		try {
			const pkg = JSON.parse(readFileSync(rootPkg, "utf-8"));
			if (pkg.version) return pkg.version;
		} catch {
			// fall through
		}
	}

	return "0.0.1";
}

// ANSI color helpers (no external deps)
const isColorSupported =
	process.env.FORCE_COLOR !== "0" &&
	process.env.NO_COLOR === undefined &&
	(process.stdout.isTTY || process.env.FORCE_COLOR === "1");

function ansi(code: string, text: string): string {
	return isColorSupported ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export const c = {
	bold: (t: string) => ansi("1", t),
	dim: (t: string) => ansi("2", t),
	green: (t: string) => ansi("32", t),
	yellow: (t: string) => ansi("33", t),
	blue: (t: string) => ansi("34", t),
	cyan: (t: string) => ansi("36", t),
	red: (t: string) => ansi("31", t),
	gray: (t: string) => ansi("90", t),
};

export function success(msg: string) {
	console.log(`${c.green("✓")} ${msg}`);
}

export function warn(msg: string) {
	console.log(`${c.yellow("!")} ${msg}`);
}

export function error(msg: string) {
	console.error(`${c.red("✗")} ${msg}`);
}

export function info(msg: string) {
	console.log(`${c.blue("›")} ${msg}`);
}

export function heading(msg: string) {
	console.log(`\n${c.bold(msg)}`);
}

/**
 * Read and parse a JSON file, returning undefined on failure.
 */
export function readJson<T = Record<string, unknown>>(
	path: string,
): T | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as T;
	} catch {
		return undefined;
	}
}

export interface TemplateConfig {
	theme?: string;
	name?: string;
	modules?: "*" | string[];
	[key: string]: unknown;
}

/**
 * Detect the active template name from the store tsconfig path alias.
 */
export function detectActiveTemplate(root: string): string | undefined {
	const tsconfigPath = join(root, "apps/store/tsconfig.json");
	if (!existsSync(tsconfigPath)) return undefined;
	try {
		const content = readFileSync(tsconfigPath, "utf-8");
		const match = content.match(/templates\/([^/]+)\//);
		return match?.[1];
	} catch {
		return undefined;
	}
}

/**
 * Get the path to the active template's config.json, if it exists.
 */
export function getTemplateConfigPath(root: string): string | undefined {
	const template = detectActiveTemplate(root);
	if (!template) return undefined;
	const configPath = join(root, "templates", template, "config.json");
	return existsSync(configPath) ? configPath : undefined;
}

/**
 * Parse a .env file into key-value pairs.
 * Handles comments, empty lines, quoted values, and inline comments.
 */
export function parseEnvFile(filePath: string): Record<string, string> {
	if (!existsSync(filePath)) return {};
	const vars: Record<string, string> = {};
	for (const line of readFileSync(filePath, "utf-8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		let value = trimmed.slice(eqIdx + 1).trim();
		// Strip surrounding quotes
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		vars[key] = value;
	}
	return vars;
}
