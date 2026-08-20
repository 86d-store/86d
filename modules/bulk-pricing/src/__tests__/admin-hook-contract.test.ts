import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adminEndpoints } from "../admin/endpoints/routes";

/**
 * Scans the admin component directory rather than a single file: which file holds
 * the hook is a layout detail, and pinning it to `index.tsx` made this contract
 * break when the components were split into one file per component.
 */
function adminEndpointReferences(): string[] {
	const dir = join(import.meta.dirname, "../admin/components");
	const refs: string[] = [];
	for (const file of readdirSync(dir)) {
		if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
		const source = readFileSync(join(dir, file), "utf-8");
		for (const match of source.matchAll(
			/client\.module\("bulk-pricing"\)\s*\.\s*admin\[\s*"([^"]+)"\s*\]/g,
		)) {
			const path = match[1];
			if (path) refs.push(path);
		}
	}
	return refs;
}

describe("bulk-pricing admin hook contract", () => {
	it("binds the landing page to a registered admin endpoint", () => {
		const refs = adminEndpointReferences();

		expect(refs).toContain("/admin/bulk-pricing/rules");
		expect(adminEndpoints["/admin/bulk-pricing/rules"]).toBeDefined();
	});

	it("references only admin endpoints the module actually registers", () => {
		const registered = new Set(Object.keys(adminEndpoints));
		for (const path of adminEndpointReferences()) {
			expect(registered).toContain(path);
		}
	});
});
