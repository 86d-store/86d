import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	resolve(import.meta.dirname, "../console/destructive-section.tsx"),
	"utf8",
);

describe("DestructiveSection", () => {
	it("uses a destructive header and a horizontal field", () => {
		expect(source).toContain("<Separator");
		expect(source).toContain('data-slot="destructive-section-header"');
		expect(source).toContain("BreadcrumbPage");
		expect(source).toContain("text-destructive");
		expect(source).toContain('orientation="horizontal"');
		expect(source).toContain("FieldDescription");
		expect(source).toContain("text-destructive-500");
	});
});
