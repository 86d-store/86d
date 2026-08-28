import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_VISUAL_ENDPOINT_CONTRACTS } from "../admin-visual-api-contract";
import { DETERMINISTIC_ADMIN_VISUAL_ENDPOINT_PATHS } from "../admin-visual-data";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const e2eRoot = resolve(import.meta.dirname, "..");

function sourceViolations(fileNames: string[], pattern: RegExp): string[] {
	const violations: string[] = [];

	for (const fileName of fileNames) {
		const source = readFileSync(join(e2eRoot, fileName), "utf8");
		for (const match of source.matchAll(pattern)) {
			const line = source.slice(0, match.index).split("\n").length;
			violations.push(`${fileName}:${line}`);
		}
	}

	return violations;
}

describe("E2E harness contract", () => {
	it("does not register or conditionally bypass cart and checkout tests", () => {
		const specFiles = readdirSync(e2eRoot).filter((file) =>
			file.endsWith(".spec.ts"),
		);
		const runtimeRegistrations = sourceViolations(
			specFiles,
			/\btest\s*\(\s*true\s*,/g,
		);
		const conditionalBypasses = sourceViolations(
			["storefront.spec.ts", "checkout.spec.ts"],
			/\btest\.skip\s*\(/g,
		);
		const directCartMutationRaces = sourceViolations(
			["storefront.spec.ts", "checkout.spec.ts"],
			/\.addToCartButton\.click\s*\(/g,
		);
		const checkoutSource = readFileSync(
			join(e2eRoot, "checkout.spec.ts"),
			"utf8",
		);

		expect({
			runtimeRegistrations,
			conditionalBypasses,
			directCartMutationRaces,
		}).toEqual({
			runtimeRegistrations: [],
			conditionalBypasses: [],
			directCartMutationRaces: [],
		});
		expect(checkoutSource).not.toContain('url.includes("/checkout")');
		expect(
			checkoutSource.match(/addFirstInStockProductToCart\(\)/g),
		).toHaveLength(4);
	});

	it("runs E2E once as a fail-closed read-only gate", () => {
		const workflow = readFileSync(
			join(repositoryRoot, ".github/workflows/e2e.yml"),
			"utf8",
		);
		const recoveryMarkers = [
			"continue-on-error:",
			"uses: ./internals/github/update-visual-snapshots",
			"id: e2e-retest",
			"Fail if E2E did not recover",
		].filter((marker) => workflow.includes(marker));

		expect(workflow).toMatch(/permissions:\s+contents: read/);
		expect(workflow).not.toContain("contents: write");
		expect(workflow.match(/\brun: bun test:e2e\b/g)).toHaveLength(1);
		expect(workflow).toMatch(
			/STORAGE_LOCAL_DIR:\s+\$\{\{ github\.workspace \}\}\/uploads/,
		);
		expect(workflow).toMatch(/STORAGE_CLIENT:\s+local/);
		expect(recoveryMarkers).toEqual([]);
	});

	it("opts fixture-only routes into E2E build and runtime without changing production defaults", () => {
		const workflow = readFileSync(
			join(repositoryRoot, ".github/workflows/e2e.yml"),
			"utf8",
		);
		const storeAction = readFileSync(
			join(repositoryRoot, "internals/github/e2e-store/action.yml"),
			"utf8",
		);
		const playwrightConfig = readFileSync(
			join(repositoryRoot, "tests/playwright.config.ts"),
			"utf8",
		);
		const packageJson = readFileSync(
			join(repositoryRoot, "package.json"),
			"utf8",
		);
		const dockerfile = readFileSync(join(repositoryRoot, "Dockerfile"), "utf8");

		expect(workflow).toContain('E2E_MERCHANT_UI_FIXTURES: "true"');
		expect(
			storeAction.match(/E2E_MERCHANT_UI_FIXTURES:\s+"true"/g),
		).toHaveLength(2);
		expect(playwrightConfig).toContain('E2E_MERCHANT_UI_FIXTURES: "true"');
		expect(packageJson).not.toContain("E2E_MERCHANT_UI_FIXTURES");
		expect(dockerfile).not.toContain("E2E_MERCHANT_UI_FIXTURES");
	});

	it("regenerates every locked snapshot suite at the canonical tolerance", () => {
		const visualSpec = readFileSync(join(e2eRoot, "visual.spec.ts"), "utf8");
		const visualTolerances = Array.from(
			visualSpec.matchAll(/maxDiffPixelRatio:\s*(\d+(?:\.\d+)?)/g),
			(match) => Number(match[1]),
		);
		const pixelThresholds = Array.from(
			visualSpec.matchAll(/\bthreshold:\s*(\d+(?:\.\d+)?)/g),
			(match) => Number(match[1]),
		);
		const updateAction = readFileSync(
			join(
				repositoryRoot,
				"internals/github/update-visual-snapshots/action.yml",
			),
			"utf8",
		);

		expect(visualTolerances).toEqual([0.005]);
		expect(pixelThresholds).toEqual([0.15]);
		expect(updateAction).toContain(
			"playwright test visual.spec.ts merchant-ui-fixtures.spec.ts",
		);
		expect(updateAction).toContain("--update-snapshots");
		expect(updateAction).not.toMatch(/\bgit\s+(?:commit|push)\b/);
	});

	it("fails visual tests on same-store API errors and Module boundaries", () => {
		const visualSpec = readFileSync(join(e2eRoot, "visual.spec.ts"), "utf8");
		const apiTracker = readFileSync(
			join(e2eRoot, "visual-api-tracker.ts"),
			"utf8",
		);

		expect(visualSpec).toMatch(/page\.on\(\s*"request"/);
		expect(visualSpec).toMatch(/page\.on\(\s*"response"/);
		expect(visualSpec).toMatch(/page\.on\(\s*"requestfinished"/);
		expect(visualSpec).toMatch(/page\.on\(\s*"requestfailed"/);
		expect(visualSpec).toContain("request.failure()?.errorText");
		expect(visualSpec).toContain("tracker.issues()");
		expect(visualSpec).toContain("tracker.pendingIssues()");
		expect(visualSpec).toMatch(/await expect\s*\.poll/);
		expect(apiTracker).toMatch(/url\.origin\s*!==\s*storeOrigin/);
		expect(apiTracker).toContain('url.pathname.startsWith("/api/")');
		expect(apiTracker).toContain('url.pathname.startsWith("/uploads/")');
		expect(apiTracker).toMatch(/status\s*<\s*400/);
		expect(apiTracker).toContain("request remained pending at teardown");
		expect(visualSpec).toContain("test.afterEach");
		expect(visualSpec).toContain('/^Module "[^"]+" encountered an error$/');
		expect(visualSpec).not.toContain("waitForTimeout");
	});

	it("starts authenticated visual tracking after cookie-only session setup", () => {
		const visualSpec = readFileSync(join(e2eRoot, "visual.spec.ts"), "utf8");
		const authenticatedPhaseStarts = visualSpec.match(
			/await admin\.applyStoredAdminSession\(\);\s+beginVisualApiPhase\(admin\.page\);/g,
		);
		const dashboardStart = visualSpec.indexOf('test("admin dashboard"');
		const dashboardEnd = visualSpec.indexOf("\n\ttest(", dashboardStart + 1);
		const dashboardSource = visualSpec.slice(dashboardStart, dashboardEnd);

		expect(authenticatedPhaseStarts).toHaveLength(2);
		expect(visualSpec).not.toContain("await admin.signIn();");
		expect(visualSpec).not.toContain('waitForLoadState("networkidle"');
		expect(visualSpec).toContain("tracker.beginPhase()");
		expect(dashboardStart).toBeGreaterThan(-1);
		expect(dashboardSource).toContain('await admin.page.goto("/admin");');
	});

	it("stabilizes mutable admin list data before visual navigation", () => {
		const visualSpec = readFileSync(join(e2eRoot, "visual.spec.ts"), "utf8");
		const adminVisualData = readFileSync(
			join(e2eRoot, "admin-visual-data.ts"),
			"utf8",
		);

		expect(visualSpec).toContain(
			"await installDeterministicAdminVisualData(admin.page);",
		);
		for (const endpoint of [
			"/api/admin/abandoned-carts",
			"/api/admin/carts",
			"/api/admin/customers",
			"/api/admin/inventory/low-stock",
			"/api/admin/orders",
			"/api/admin/reviews",
		]) {
			expect(adminVisualData).toContain(endpoint);
		}
		expect(visualSpec).toContain("No carts found");
		expect(visualSpec).toContain("No abandoned carts found.");
	});

	it("isolates visual analytics writes and mutable analytics and checkout views", () => {
		const visualSpec = readFileSync(join(e2eRoot, "visual.spec.ts"), "utf8");
		const adminVisualData = readFileSync(
			join(e2eRoot, "admin-visual-data.ts"),
			"utf8",
		);

		expect(visualSpec).toContain(
			"await installDeterministicVisualWrites(page);",
		);
		expect(visualSpec).toContain("/api/analytics/events");
		for (const endpoint of [
			"/api/admin/analytics/stats",
			"/api/admin/analytics/top-products",
			"/api/admin/revenue/stats",
			"/api/admin/checkout/sessions",
			"/api/admin/checkout/stats",
		]) {
			expect(adminVisualData).toContain(endpoint);
		}
		for (const terminalText of [
			"Total Events",
			"No checkout sessions found",
			"Total Sessions",
		]) {
			expect(visualSpec).toContain(terminalText);
		}
	});

	it("stabilizes seeded admin lists and waits for their empty states", () => {
		const visualSpec = readFileSync(join(e2eRoot, "visual.spec.ts"), "utf8");
		const adminVisualData = readFileSync(
			join(e2eRoot, "admin-visual-data.ts"),
			"utf8",
		);

		for (const endpoint of [
			"/api/admin/blog",
			"/api/admin/collections",
			"/api/admin/collections/stats",
			"/api/admin/media",
			"/api/admin/media/folders",
			"/api/admin/newsletter",
			"/api/admin/pages",
			"/api/admin/payments",
			"/api/admin/notifications",
			"/api/admin/notifications/stats",
			"/api/admin/sitemap/config",
			"/api/admin/sitemap/stats",
			"/api/admin/sitemap/entries",
		]) {
			expect(adminVisualData).toContain(endpoint);
		}
		for (const terminalText of [
			"No posts found",
			"No collections found",
			"No assets found",
			"No subscribers found",
			"No pages found",
			"No payment intents found",
			"No notifications found",
			"No sitemap entries yet.",
		]) {
			expect(visualSpec).toContain(terminalText);
		}
	});

	it("live-covers every deterministic admin visual endpoint", () => {
		const liveEndpointPaths = ADMIN_VISUAL_ENDPOINT_CONTRACTS.map(
			(endpoint) => endpoint.path,
		).toSorted();

		expect(DETERMINISTIC_ADMIN_VISUAL_ENDPOINT_PATHS).toEqual(
			liveEndpointPaths,
		);
		expect(new Set(liveEndpointPaths).size).toBe(liveEndpointPaths.length);
	});

	it("scopes public clocks and normalizes the rendered footer year", () => {
		const visualSpec = readFileSync(join(e2eRoot, "visual.spec.ts"), "utf8");

		for (const title of [
			"appointments page",
			"delivery slots page",
			"store pickup page",
		]) {
			const testStart = visualSpec.indexOf(`test("${title}"`);
			const nextTest = visualSpec.indexOf("\n\ttest(", testStart + 1);
			const testSource = visualSpec.slice(testStart, nextTest);
			expect(testStart).toBeGreaterThan(-1);
			expect(testSource).toContain(
				"await page.clock.setFixedTime(VISUAL_FIXED_TIME);",
			);
			expect(testSource.indexOf("setFixedTime")).toBeLessThan(
				testSource.indexOf("stableGoto"),
			);
		}

		expect(visualSpec).toContain('const VISUAL_COPYRIGHT_YEAR = "2026";');
		const stableGotoStart = visualSpec.indexOf("async function stableGoto(");
		const stableGotoEnd = visualSpec.indexOf("\n}\n", stableGotoStart) + 2;
		const stableGotoSource = visualSpec.slice(stableGotoStart, stableGotoEnd);
		expect(stableGotoSource).toContain("footer span");
		expect(stableGotoSource).toContain("VISUAL_COPYRIGHT_YEAR");
		expect(stableGotoSource).toContain("replace");
	});

	it("scopes lockfile sync automation to its own workflow", () => {
		const ciWorkflow = readFileSync(
			join(repositoryRoot, ".github/workflows/ci.yml"),
			"utf8",
		);
		const e2eWorkflow = readFileSync(
			join(repositoryRoot, ".github/workflows/e2e.yml"),
			"utf8",
		);
		const syncWorkflow = readFileSync(
			join(repositoryRoot, ".github/workflows/sync-pr-locks.yml"),
			"utf8",
		);
		const syncAction = readFileSync(
			join(repositoryRoot, "internals/github/sync-pr-locks/action.yml"),
			"utf8",
		);

		expect(ciWorkflow).toMatch(/permissions:\s+contents: read/);
		expect(ciWorkflow).not.toContain("contents: write");
		expect(e2eWorkflow).toMatch(/permissions:\s+contents: read/);
		expect(e2eWorkflow).not.toContain("contents: write");

		expect(syncWorkflow).toMatch(/paths:\s*\n\s+- "modules\/\*\*"/);
		expect(syncWorkflow).toContain("apps/registry/registry.lock.json");
		expect(syncWorkflow).toContain("bun.lock");
		expect(syncWorkflow).toContain("packages/registry/**");
		expect(syncWorkflow).toMatch(/permissions:\s+contents: write/);
		expect(syncWorkflow).toMatch(/pull-requests: write/);
		expect(syncWorkflow).toContain(
			"sync-pr-locks-${{ github.event.pull_request.number",
		);
		expect(syncAction).toContain("configure-git-merge-drivers.sh");
		expect(syncAction).toContain("bun run regen:locks");
		expect(syncAction).toContain("git push --force-with-lease");
	});
});
