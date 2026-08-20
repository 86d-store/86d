import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve the path to the template config.json.
 * Tries cwd-relative and monorepo-relative paths.
 */
export function resolveTemplatePath(): string {
	const cwd = process.cwd();
	const candidates = [
		join(/*turbopackIgnore: true*/ cwd, "templates", "brisa", "config.json"),
		join(
			/*turbopackIgnore: true*/ cwd,
			"..",
			"..",
			"templates",
			"brisa",
			"config.json",
		),
	];
	for (const p of candidates) {
		if (existsSync(/*turbopackIgnore: true*/ p)) return p;
	}
	return candidates[0];
}
