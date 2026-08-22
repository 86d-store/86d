import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	resolve(import.meta.dirname, "../console/confirmation-dialog.tsx"),
	"utf8",
);

describe("ConfirmationDialog", () => {
	it("requires a hold-to-confirm fill instead of a click", () => {
		expect(source).toContain("HoldToConfirmButton");
		expect(source).toContain("AlertDialogMedia");
		expect(source).toContain("Press and hold");
		expect(source).not.toContain("AlertDialogAction");
	});
});
