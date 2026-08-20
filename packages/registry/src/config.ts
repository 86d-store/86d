import { existsSync, readFileSync } from "node:fs";
import type { StoreConfig } from "./types.js";

/**
 * Read and parse a store config.json file.
 */
export function readStoreConfig(configPath: string): StoreConfig {
	if (!existsSync(configPath)) {
		throw new Error(`Config file not found: ${configPath}`);
	}

	const raw = JSON.parse(readFileSync(configPath, "utf-8"));
	return raw as StoreConfig;
}

/**
 * Expand the modules field from config into a normalized array of specifier strings.
 *
 * - `"*"` → returns `"*"` (caller handles expansion via registry)
 * - `string[]` → returns the array as-is
 * - `undefined` → returns `"*"` (default: all modules)
 */
export function normalizeModulesField(
	modules: StoreConfig["modules"],
): "*" | string[] {
	if (modules === "*" || modules === undefined) {
		return "*";
	}
	return modules;
}

/**
 * Get module options for a specific module from config.
 */
export function getModuleOptions(
	config: StoreConfig,
	packageName: string,
): Record<string, unknown> {
	return (config.moduleOptions?.[packageName] as Record<string, unknown>) ?? {};
}
