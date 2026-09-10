import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const browserRoot = resolve(import.meta.dirname, "..");

function browserSpecSources(): string[] {
	return readdirSync(browserRoot)
		.filter((fileName) => fileName.endsWith(".spec.ts"))
		.map((fileName) => readFileSync(join(browserRoot, fileName), "utf8"));
}

describe("browser smoke harness contract", () => {
	it("keeps a compact suite with no conditional bypasses or pixel assertions", () => {
		const sources = browserSpecSources();
		const combined = sources.join("\n");
		const testCount = sources.reduce(
			(count, source) => count + [...source.matchAll(/\btest\(\s*"/g)].length,
			0,
		);

		expect(testCount).toBeGreaterThanOrEqual(12);
		expect(testCount).toBeLessThanOrEqual(18);
		expect(combined).not.toContain("test.skip(");
		expect(combined).not.toContain("waitForTimeout(");
		expect(combined).not.toContain('waitForLoadState("networkidle")');
		expect(combined).not.toContain(["toHave", "Screenshot"].join(""));
	});

	it("keeps two scoped semantic scans with only the documented contrast exclusion", () => {
		const combined = browserSpecSources().join("\n");

		expect(combined.match(/new AxeBuilder/g)).toHaveLength(2);
		expect(combined.match(/\.include\("main"\)/g)).toHaveLength(2);
		expect(
			combined.match(/\.disableRules\(\["color-contrast"\]\)/g),
		).toHaveLength(2);
		expect(combined.match(/\.disableRules\(/g)).toHaveLength(2);
		expect(combined).not.toContain(".exclude(");
	});

	it("uses one Chromium project with no retries", () => {
		const config = readFileSync(
			join(repositoryRoot, "tests/playwright.config.ts"),
			"utf8",
		);

		expect(config).toContain('name: "browser-smoke"');
		expect(config).toContain('...devices["Desktop Chrome"]');
		expect(config).toMatch(/retries:\s*0/);
		expect(config.match(/\.\.\.devices\[/g)).toHaveLength(1);
		expect(config).not.toContain("snapshotPathTemplate");
		expect(config).toContain("bun run build:store");
		expect(config).toContain("bun run --cwd apps/store start");
		expect(config).toContain("cwd: REPOSITORY_ROOT");
		expect(config).toMatch(/timeout:\s*600_000/);
		expect(config).toMatch(/reuseExistingServer:\s*false/);
		expect(config).not.toContain("bun run dev:store");
	});

	it("runs browser smoke once as a fail-closed read-only gate", () => {
		const workflow = readFileSync(
			join(repositoryRoot, ".github/workflows/browser-smoke.yml"),
			"utf8",
		);

		expect(workflow).toMatch(/permissions:\s+contents: read/);
		expect(workflow).not.toContain("contents: write");
		expect(workflow.match(/\brun: bun test:browser\b/g)).toHaveLength(1);
		expect(workflow).toContain("pull_request:");
		expect(workflow).toContain("workflow_dispatch:");
		expect(workflow).toContain("./internals/github/browser-database");
		expect(workflow).toContain("./internals/github/browser-store");
		expect(workflow).toContain('- "internals/github/setup/**"');
		expect(workflow).toContain('- "packages/**"');
		expect(workflow).toContain("browser-report/");
		expect(workflow).toContain("browser-results/**/*.zip");
		expect(workflow).toContain("browser-results/**/*.png");
		expect(workflow).toContain("browser-results/**/*.webm");
		expect(workflow).not.toMatch(/^\s+browser-results\/\s*$/m);
	});

	it("opts fixture-only routes into browser builds without production defaults", () => {
		const workflow = readFileSync(
			join(repositoryRoot, ".github/workflows/browser-smoke.yml"),
			"utf8",
		);
		const storeAction = readFileSync(
			join(repositoryRoot, "internals/github/browser-store/action.yml"),
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
		const turbo = JSON.parse(
			readFileSync(join(repositoryRoot, "turbo.json"), "utf8"),
		) as { globalPassThroughEnv?: string[] };
		const dockerfile = readFileSync(join(repositoryRoot, "Dockerfile"), "utf8");

		expect(workflow).toContain('BROWSER_MERCHANT_UI_FIXTURES: "true"');
		expect(
			storeAction.match(/BROWSER_MERCHANT_UI_FIXTURES:\s+"true"/g),
		).toHaveLength(2);
		expect(playwrightConfig).toContain('BROWSER_MERCHANT_UI_FIXTURES: "true"');
		expect(turbo.globalPassThroughEnv).toContain(
			"BROWSER_MERCHANT_UI_FIXTURES",
		);
		expect(packageJson).not.toContain("BROWSER_MERCHANT_UI_FIXTURES");
		expect(dockerfile).not.toContain("BROWSER_MERCHANT_UI_FIXTURES");
	});

	it("keeps stored auth state outside uploaded failure artifacts", () => {
		const fixtures = readFileSync(
			join(repositoryRoot, "tests/browser/fixtures/test-fixtures.ts"),
			"utf8",
		);
		const workflow = readFileSync(
			join(repositoryRoot, ".github/workflows/browser-smoke.yml"),
			"utf8",
		);
		const gitignore = readFileSync(join(repositoryRoot, ".gitignore"), "utf8");
		const dockerignore = readFileSync(
			join(repositoryRoot, ".dockerignore"),
			"utf8",
		);
		const packageJson = readFileSync(
			join(repositoryRoot, "package.json"),
			"utf8",
		);

		expect(fixtures).toContain('".browser-auth/admin-storage-state.json"');
		expect(fixtures).not.toContain("browser-results/admin-storage-state.json");
		expect(workflow).not.toContain(".browser-auth");
		expect(workflow).not.toContain("admin-storage-state");
		expect(gitignore).toContain(".browser-auth/");
		expect(dockerignore).toContain(".browser-auth/");
		expect(packageJson).toContain("browser-results .browser-auth");
	});

	it("inherits seed credentials and fails on browser runtime errors", () => {
		const fixtures = readFileSync(
			join(repositoryRoot, "tests/browser/fixtures/test-fixtures.ts"),
			"utf8",
		);
		const globalSetup = readFileSync(
			join(repositoryRoot, "tests/browser/global-setup.ts"),
			"utf8",
		);

		expect(fixtures).toMatch(
			/getProcessEnv\("BROWSER_ADMIN_EMAIL"\)[\s\S]*getProcessEnv\("APP_ADMIN_EMAIL"\)/,
		);
		expect(fixtures).toMatch(
			/getProcessEnv\("BROWSER_ADMIN_PASSWORD"\)[\s\S]*getProcessEnv\("APP_ADMIN_PASSWORD"\)/,
		);
		expect(fixtures).toContain('page.on("pageerror"');
		expect(fixtures).toContain('message.type() !== "error"');
		expect(fixtures).toMatch(/browserRuntimeErrors:[\s\S]*auto:\s*true/);
		expect(globalSetup).toContain("context.request.post(");
		expect(globalSetup).toContain("signInResponse.ok()");
		expect(globalSetup).not.toContain("page.goto(");
	});

	it("leaves lockfile synchronization scoped to its own workflow", () => {
		const ciWorkflow = readFileSync(
			join(repositoryRoot, ".github/workflows/ci.yml"),
			"utf8",
		);
		const browserWorkflow = readFileSync(
			join(repositoryRoot, ".github/workflows/browser-smoke.yml"),
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
		expect(browserWorkflow).toMatch(/permissions:\s+contents: read/);
		expect(browserWorkflow).not.toContain("contents: write");
		expect(syncWorkflow).toMatch(/permissions:\s+contents: write/);
		expect(syncWorkflow).toMatch(/pull-requests: write/);
		expect(syncAction).toContain("configure-git-merge-drivers.sh");
		expect(syncAction).toContain("bun run regen:locks");
		expect(syncAction).toContain("git push --force-with-lease");
	});
});
