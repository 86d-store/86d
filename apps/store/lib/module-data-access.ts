/**
 * Resolve a Module's ModuleDataService after registry boot.
 * Used by SSR SEO / prefetch paths that previously read ModuleData JSON.
 */

import type { ModuleDataService } from "@86d-app/core/types/module";
import { ensureBooted } from "./api-registry";

export async function getModuleDataService(
	moduleId: string,
): Promise<ModuleDataService | null> {
	try {
		const registry = await ensureBooted();
		if (!registry.getModuleDbId(moduleId)) {
			return null;
		}
		return registry.createRequestContext(moduleId).data;
	} catch {
		return null;
	}
}
