import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adminEndpoints } from "../admin/endpoints/routes";

const READ_ONLY_ROUTES = [
	"/admin/gift-cards",
	"/admin/gift-cards/stats",
	"/admin/gift-cards/:id",
	"/admin/gift-cards/:id/transactions",
];

const UNSAFE_ROUTES = [
	"/admin/gift-cards/create",
	"/admin/gift-cards/bulk-create",
	"/admin/gift-cards/disable-expired",
	"/admin/gift-cards/:id/update",
	"/admin/gift-cards/:id/delete",
	"/admin/gift-cards/:id/credit",
];

const UNSAFE_SOURCES = [
	"bulk-create.ts",
	"create-gift-card.ts",
	"credit-gift-card.ts",
	"delete-gift-card.ts",
	"disable-expired.ts",
	"update-gift-card.ts",
];

describe("gift-card admin route exposure", () => {
	it("exposes only read projections", () => {
		expect(Object.keys(adminEndpoints)).toEqual(READ_ONLY_ROUTES);

		for (const route of UNSAFE_ROUTES) {
			expect(adminEndpoints).not.toHaveProperty(route);
		}
	});

	it("removes unsafe endpoint sources", () => {
		for (const source of UNSAFE_SOURCES) {
			expect(
				existsSync(new URL(`../admin/endpoints/${source}`, import.meta.url)),
			).toBe(false);
		}
	});
});
