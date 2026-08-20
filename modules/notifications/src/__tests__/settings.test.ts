import { describe, expect, it } from "vitest";

describe("notifications — module factory settings wiring", () => {
	it("includes the settings endpoint when no providers are configured", async () => {
		const { default: notifications } = await import("../index");
		const mod = notifications({});

		expect(mod.endpoints?.admin).toHaveProperty(
			"/admin/notifications/settings",
		);
	});

	it("admin pages include the settings page when no providers are configured", async () => {
		const { default: notifications } = await import("../index");
		const mod = notifications({});
		const paths = mod.admin?.pages?.map((page) => page.path) ?? [];

		expect(paths).toContain("/admin/notifications/settings");
	});
});
