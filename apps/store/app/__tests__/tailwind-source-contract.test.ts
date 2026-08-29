import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const globals = readFileSync(
	new URL("../globals.css", import.meta.url),
	"utf8",
);
const sharedUiSource = new URL("../../../../packages/ui/src/", import.meta.url);
const sharedCard = readFileSync(
	new URL("shadcn/card.tsx", sharedUiSource),
	"utf8",
);

describe("Store Tailwind source graph", () => {
	it("scans the shared UI primitives consumed by Module admin surfaces", () => {
		expect(existsSync(fileURLToPath(sharedUiSource))).toBe(true);
		expect(globals).toContain(
			'@source "../../../packages/ui/src/**/*.{ts,tsx}";',
		);
		expect(sharedCard).toContain("py-(--card-spacing)");
		expect(sharedCard).toContain("px-(--card-spacing)");
		expect(sharedCard).toContain("group/card");
	});
});
