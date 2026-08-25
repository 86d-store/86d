import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../../..");
const temporaryRoots: string[] = [];

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

function runCapturedBuildWrapper(
	overrides: Record<string, string>,
	omit: readonly string[] = [],
) {
	const root = mkdtempSync(join(tmpdir(), "86d-docker-wrapper-"));
	temporaryRoots.push(root);
	const argumentsPath = join(root, "arguments");
	const dockerPath = join(root, "docker");
	writeFileSync(
		dockerPath,
		'#!/bin/sh\nprintf \'%s\\n\' "$@" > "$DOCKER_ARGUMENTS_PATH"\n',
	);
	chmodSync(dockerPath, 0o755);
	const result = runBuildWrapper(
		{
			...overrides,
			DOCKER_ARGUMENTS_PATH: argumentsPath,
			PATH: `${root}:/usr/local/bin:/usr/bin:/bin`,
		},
		omit,
	);
	const argumentsList =
		result.status === 0
			? readFileSync(argumentsPath, "utf8").trim().split("\n")
			: [];
	return { argumentsList, result };
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("Docker build wrapper", () => {
	it("rejects an unknown Module source before invoking Docker", () => {
		const result = runBuildWrapper({ MODULE_SOURCE: "unknown" });

		expect(result.status).toBe(2);
		expect(stderr(result)).toContain(
			"MODULE_SOURCE must be either workspace or registry",
		);
	});

	it("requires an explicit source revision for registry builds", () => {
		const result = runBuildWrapper({ MODULE_SOURCE: "registry" }, [
			"SOURCE_REVISION",
		]);

		expect(result.status).toBe(2);
		expect(stderr(result)).toContain(
			"SOURCE_REVISION is required when MODULE_SOURCE=registry",
		);
	});

	it("rejects a registry revision other than the checkout", () => {
		const result = runBuildWrapper({
			MODULE_SOURCE: "registry",
			SOURCE_REVISION: "0000000000000000000000000000000000000000",
		});

		expect(result.status).toBe(2);
		expect(stderr(result)).toContain(
			"SOURCE_REVISION must match the checked-out commit",
		);
	});

	it("builds an exact registry revision without Docker secrets or named contexts", () => {
		const revision = spawnSync("git", ["rev-parse", "HEAD"], {
			cwd: repoRoot,
			encoding: "utf8",
		}).stdout.trim();
		const { argumentsList, result } = runCapturedBuildWrapper(
			{ MODULE_SOURCE: "registry", SOURCE_REVISION: revision },
			["GITHUB_TOKEN", "TURBO_TOKEN", "TURBO_TEAM"],
		);

		expect(result.status).toBe(0);
		expect(argumentsList).toContain("MODULE_SOURCE=registry");
		expect(argumentsList).toContain(`SOURCE_REVISION=${revision}`);
		expect(argumentsList).not.toContain("--secret");
		expect(argumentsList).not.toContain("--build-context");
	});

	it("builds workspace source without Docker secrets or named contexts", () => {
		const { argumentsList, result } = runCapturedBuildWrapper({
			GITHUB_TOKEN: "unused-github-token",
			MODULE_SOURCE: "workspace",
			TURBO_TEAM: "unused-team",
			TURBO_TOKEN: "unused-turbo-token",
		});

		expect(result.status).toBe(0);
		expect(argumentsList).toContain("MODULE_SOURCE=workspace");
		expect(argumentsList).not.toContain("--secret");
		expect(argumentsList).not.toContain("--build-context");
		expect(argumentsList).not.toContain("TURBO_TEAM=unused-team");
	});
});
