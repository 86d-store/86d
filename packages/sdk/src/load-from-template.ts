import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Load store config from a local template config.json file.
 * Used when STORE_ID is not set or invalid.
 */
export function loadFromTemplate(templatePath: string): Config {
	const resolved = resolve(templatePath);
	const raw = readFileSync(resolved, "utf-8");
	const parsed = JSON.parse(raw) as Record<string, unknown>;
	return mergeWithDefaults(parsed);
}

function mergeWithDefaults(parsed: Record<string, unknown>): Config {
	const vars = parsed.variables as
		| { light?: Record<string, unknown>; dark?: Record<string, unknown> }
		| undefined;
	return {
		...DEFAULT_CONFIG,
		...parsed,
		icon: { ...DEFAULT_CONFIG.icon, ...(parsed.icon as object) },
		logo: { ...DEFAULT_CONFIG.logo, ...(parsed.logo as object) },
		variables: {
			light: { ...DEFAULT_CONFIG.variables.light, ...vars?.light },
			dark: { ...DEFAULT_CONFIG.variables.dark, ...vars?.dark },
		},
	} as Config;
}
