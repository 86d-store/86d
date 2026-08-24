import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../../..");

function runBuildWrapper(
	overrides: Record<string, string>,
	omit: readonly string[] = [],
) {
	const environmentArguments = omit.flatMap((name) => ["-u", name]);
	for (const [name, value] of Object.entries(overrides)) {
		environmentArguments.push(`${name}=${value}`);
	}
	return spawnSync(
		"env",
		[...environmentArguments, "sh", "internals/docker/build.sh"],
		{
			cwd: repoRoot,
			encoding: "utf8",
		},
	);
}

function stderr(result: ReturnType<typeof runBuildWrapper>): string {
	return result.stderr;
}

describe("Docker build wrapper", () => {
	it("rejects an unknown Module source before invoking Docker", () => {
		const result = runBuildWrapper({ MODULE_SOURCE: "unknown" });

		expect(result.status).toBe(2);
		expect(stderr(result)).toContain(
			"MODULE_SOURCE must be either workspace or registry",
		);
	});

	it("requires an explicit source revision for registry builds", () => {
		const result = runBuildWrapper(
			{ GITHUB_TOKEN: "test-token", MODULE_SOURCE: "registry" },
			["SOURCE_REVISION"],
		);

		expect(result.status).toBe(2);
		expect(stderr(result)).toContain(
			"SOURCE_REVISION is required when MODULE_SOURCE=registry",
		);
	});

	it("rejects a registry revision other than the checkout", () => {
		const result = runBuildWrapper({
			GITHUB_TOKEN: "test-token",
			MODULE_SOURCE: "registry",
			SOURCE_REVISION: "0000000000000000000000000000000000000000",
		});

		expect(result.status).toBe(2);
		expect(stderr(result)).toContain(
			"SOURCE_REVISION must match the checked-out commit",
		);
	});

	it("requires a GitHub token after validating the registry revision", () => {
		const revision = spawnSync("git", ["rev-parse", "HEAD"], {
			cwd: repoRoot,
			encoding: "utf8",
		}).stdout.trim();
		const result = runBuildWrapper(
			{ MODULE_SOURCE: "registry", SOURCE_REVISION: revision },
			["GITHUB_TOKEN"],
		);

		expect(result.status).toBe(2);
		expect(stderr(result)).toContain(
			"GITHUB_TOKEN is required when MODULE_SOURCE=registry",
		);
	});
});
