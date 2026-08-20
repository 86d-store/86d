/**
 * Storage singleton for the store app.
 * Reads STORAGE_CLIENT from env to select the backend.
 * Defaults to "local" unless the environment overrides it.
 */

import { createStorageFromEnv } from "@86d-app/storage/factory";
import type { StorageProvider } from "@86d-app/storage/types";

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
	if (!instance) {
		instance = createStorageFromEnv();
	}
	return instance;
}
