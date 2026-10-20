import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getBaseUrl: vi.fn(() => "https://store.example.com"),
}));

vi.mock("utils/url", () => ({
	getBaseUrl: mocks.getBaseUrl,
}));

const { default: robots } = await import("../robots");

function getRulesArray(config: ReturnType<typeof robots>) {
	return Array.isArray(config.rules) ? config.rules : [config.rules];
}

describe("robots()", () => {
	it("returns robots.txt configuration with correct structure", () => {
		const config = robots();
		expect(config.rules).toBeDefined();
		const rules = getRulesArray(config);
		expect(rules.length).toBeGreaterThan(0);
	});

	it("blocks admin, api, auth, and internal paths", () => {
		const config = robots();
		const rules = getRulesArray(config);
		const mainRule = rules[0];
		expect(mainRule).toBeDefined();
		expect(mainRule.disallow).toContain("/admin/");
		expect(mainRule.disallow).toContain("/api/");
		expect(mainRule.disallow).toContain("/auth/");
	});

	it("includes sitemap URL using base URL from getBaseUrl", () => {
		mocks.getBaseUrl.mockReturnValue("https://my-store.86d.app");
		const config = robots();
		expect(config.sitemap).toBe("https://my-store.86d.app/sitemap.xml");
	});

	it("resolves base URL at request time via getBaseUrl (runtime NEXT_PUBLIC_STORE_URL)", () => {
		mocks.getBaseUrl.mockReturnValue("https://production.86d.store");
		const config = robots();
		expect(mocks.getBaseUrl).toHaveBeenCalled();
		expect(config.sitemap).toBe("https://production.86d.store/sitemap.xml");
	});

	it("allows AI crawlers access to llms.txt", () => {
		const config = robots();
		const rules = getRulesArray(config);
		const aiRule = rules.find(
			(r) => Array.isArray(r.userAgent) && r.userAgent.includes("ChatGPT-User"),
		);
		expect(aiRule).toBeDefined();
		expect(aiRule?.allow).toContain("/llms.txt");
		expect(aiRule?.allow).toContain("/llms-full.txt");
	});
});
