import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function componentSource(file: string): string {
	return readFileSync(
		join(import.meta.dirname, `../store/components/${file}`),
		"utf-8",
	);
}

describe("kiosk terminal containment", () => {
	it("renders a truthful static unavailable state", () => {
		const template = componentSource("kiosk-terminal.mdx");

		expect(template).toContain('data-testid="kiosk-unavailable"');
		expect(template).toContain('role="status"');
		expect(template).toContain("Kiosk unavailable");
		expect(template).toContain(
			"This kiosk isn't accepting orders or payments. Ask a team member for help. Nothing was ordered or charged.",
		);
		expect(template).not.toContain("Start order");
		expect(template).not.toContain("Cancel");
		expect(template).not.toMatch(/>\s*Pay(?:ment)?\b/);
		expect(template).not.toContain("Add item");
	});

	it("has no browser capability, mutation, or timer behavior", () => {
		const component = componentSource("kiosk-terminal.tsx");

		expect(component).toContain("return <KioskTerminalTemplate />");
		expect(component).not.toContain("useModuleClient");
		expect(component).not.toContain("useMutation");
		expect(component).not.toContain("localStorage");
		expect(component).not.toContain("setTimeout");
		expect(component).not.toContain("setInterval");
	});
});
