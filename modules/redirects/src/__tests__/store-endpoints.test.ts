import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRedirectController } from "../service-impl";

/**
 * Store endpoint integration tests for the redirects module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. resolve: resolves a request path to its redirect target
 * 2. test-path: tests if a path matches any redirect
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateResolve(data: DataService, path: string) {
	const controller = createRedirectController(data);
	const redirect = await controller.resolve(path);
	if (!redirect) {
		return { error: "No redirect found", status: 404 };
	}
	return { redirect };
}

async function simulateTestPath(data: DataService, path: string) {
	const controller = createRedirectController(data);
	const result = await controller.testPath(path);
	return { result };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: resolve redirect", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("resolves a matching redirect", async () => {
		const ctrl = createRedirectController(data);
		await ctrl.createRedirect({
			sourcePath: "/old-page",
			targetPath: "/new-page",
			statusCode: 301,
			isActive: true,
		});

		const result = await simulateResolve(data, "/old-page");

		expect("redirect" in result).toBe(true);
		if ("redirect" in result) {
			expect(result.redirect.targetPath).toBe("/new-page");
			expect(result.redirect.statusCode).toBe(301);
		}
	});

	it("returns 404 for unmatched path", async () => {
		const result = await simulateResolve(data, "/no-redirect");

		expect(result).toEqual({ error: "No redirect found", status: 404 });
	});

	it("does not resolve inactive redirects", async () => {
		const ctrl = createRedirectController(data);
		await ctrl.createRedirect({
			sourcePath: "/disabled",
			targetPath: "/somewhere",
			statusCode: 302,
			isActive: false,
		});

		const result = await simulateResolve(data, "/disabled");

		expect(result).toEqual({ error: "No redirect found", status: 404 });
	});
});

describe("store endpoint: test path", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns matched true for existing redirect", async () => {
		const ctrl = createRedirectController(data);
		await ctrl.createRedirect({
			sourcePath: "/legacy",
			targetPath: "/modern",
			statusCode: 301,
			isActive: true,
		});

		const res = await simulateTestPath(data, "/legacy");

		expect(res.result.matched).toBe(true);
	});

	it("returns matched false for non-matching path", async () => {
		const res = await simulateTestPath(data, "/nothing-here");

		expect(res.result.matched).toBe(false);
	});
});
