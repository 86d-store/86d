import { join } from "node:path";

/** Relative path from the monorepo root to the generated registry manifest. */
export const REGISTRY_MANIFEST_RELATIVE_PATH = "apps/registry/registry.json";

/** Relative path from the monorepo root to the module lock file. */
export const REGISTRY_LOCKFILE_RELATIVE_PATH =
	"apps/registry/registry.lock.json";

/** Default remote URL for the published registry manifest. */
export const DEFAULT_REGISTRY_URL =
	"https://raw.githubusercontent.com/86d-app/86d/main/apps/registry/registry.json";

export function registryManifestPath(root: string): string {
	return join(root, REGISTRY_MANIFEST_RELATIVE_PATH);
}

export function registryLockfilePath(root: string): string {
	return join(root, REGISTRY_LOCKFILE_RELATIVE_PATH);
}
