import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	unlink,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	CURATED_STORE_MODULES,
	TIER_NONE_CURATED_MODULES,
} from "../../../packages/core/src/curated-modules";
import {
	assertNextBuildOutput,
	assertRunnerLayout,
	writeModulePackageManifest,
} from "../verify-runtime-contract";

const repoRoot = join(import.meta.dirname, "../../..");
const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
	const root = await mkdtemp("/tmp/86d-runtime-contract-");
	temporaryRoots.push(root);
	return root;
}

async function writeFixtureFile(
	path: string,
	contents = "fixture",
): Promise<void> {
	await mkdir(join(path, ".."), { recursive: true });
	await writeFile(path, contents);
}

async function createRunnerFixture(root: string): Promise<void> {
	const tierNone = new Set<string>(TIER_NONE_CURATED_MODULES);
	for (const moduleId of CURATED_STORE_MODULES.filter(
		(moduleId) => !tierNone.has(moduleId),
	)) {
		await writeFixtureFile(join(root, "modules", moduleId, "src/schema.ts"));
	}
	await writeFixtureFile(join(root, "node_modules/@86d-app/core/src/index.ts"));
	await writeFixtureFile(join(root, "packages/core/src/test-utils.ts"));
}

async function createNextBuildFixture(nextRoot: string): Promise<void> {
	const buildId = "fixture-build-id";
	const standaloneRoot = join(nextRoot, "standalone");
	const standaloneStoreRoot = join(standaloneRoot, "apps/store");
	const requiredFiles = [
		".next/package.json",
		".next/routes-manifest.json",
		".next/build-manifest.json",
		".next/server/app-paths-manifest.json",
	];

	await writeFixtureFile(join(nextRoot, "BUILD_ID"), buildId);
	await writeFixtureFile(join(nextRoot, "build-manifest.json"), "{}");
	await writeFixtureFile(join(nextRoot, "routes-manifest.json"), "{}");
	await writeFixtureFile(
		join(nextRoot, "server/app-paths-manifest.json"),
		"{}",
	);
	for (const name of [
		"_buildManifest.js",
		"_clientMiddlewareManifest.js",
		"_ssgManifest.js",
	]) {
		await writeFixtureFile(join(nextRoot, "static", buildId, name));
	}
	await writeFixtureFile(join(standaloneStoreRoot, "package.json"), "{}");
	await writeFixtureFile(join(standaloneStoreRoot, "server.js"));
	await writeFixtureFile(
		join(standaloneRoot, "node_modules/next/package.json"),
		"{}",
	);
	for (const relativePath of requiredFiles) {
		await writeFixtureFile(join(standaloneStoreRoot, relativePath), "{}");
	}
	await writeFixtureFile(
		join(nextRoot, "required-server-files.json"),
		JSON.stringify({
			version: 1,
			relativeAppDir: "apps/store",
			files: requiredFiles,
		}),
	);
}

async function createModulePackageFixtures(
	modulesRoot: string,
	count: number,
): Promise<string[]> {
	const packageNames = Array.from(
		{ length: count },
		(_, index) => `@86d-app/fixture-${String(index).padStart(3, "0")}`,
	);
	for (const packageName of packageNames.toReversed()) {
		const moduleId = packageName.slice("@86d-app/".length);
		await writeFixtureFile(
			join(modulesRoot, moduleId, "package.json"),
			JSON.stringify({ name: packageName }),
		);
	}
	return packageNames;
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
	);
});

describe("runner layout contract", () => {
	it("accepts only the curated runtime schemas and non-Module packages", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);

		await expect(
			assertRunnerLayout({
				root,
				modulePackageNames: ["@86d-app/products"],
			}),
		).resolves.toBeUndefined();
	});

	it("rejects any file beyond the exact curated schema tree", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await writeFixtureFile(join(root, "modules/products/src/index.ts"));

		await expect(
			assertRunnerLayout({ root, modulePackageNames: [] }),
		).rejects.toThrow("Unexpected /app/modules runtime layout");
	});

	it("rejects an unexpected empty directory in the curated tree", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await mkdir(join(root, "modules/products/src/empty"));

		await expect(
			assertRunnerLayout({ root, modulePackageNames: [] }),
		).rejects.toThrow("Unexpected /app/modules runtime layout");
	});

	it("rejects an unexpected symlink in the curated tree", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await symlink(
			"schema.ts",
			join(root, "modules/products/src/schema-alias.ts"),
		);

		await expect(
			assertRunnerLayout({ root, modulePackageNames: [] }),
		).rejects.toThrow("Unexpected /app/modules runtime layout");
	});

	it("rejects a traced Module package anywhere below node_modules", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await writeFixtureFile(
			join(
				root,
				"apps/store/node_modules/@86d-app/products/src/store/endpoints/index.ts",
			),
		);

		await expect(
			assertRunnerLayout({
				root,
				modulePackageNames: ["@86d-app/products"],
			}),
		).rejects.toThrow(
			"Traced Module package found below node_modules: apps/store/node_modules/@86d-app/products",
		);
	});

	it("rejects test trees anywhere in the runner", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await writeFixtureFile(
			join(root, "packages/core/src/__tests__/runtime.test.ts"),
		);

		await expect(
			assertRunnerLayout({ root, modulePackageNames: [] }),
		).rejects.toThrow(
			"Test/spec/fixture artifact found in runner: packages/core/src/__tests__",
		);
	});

	it("rejects spec files anywhere in the runner", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await writeFixtureFile(
			join(root, "node_modules/dependency/src/runtime.spec.js"),
		);

		await expect(
			assertRunnerLayout({ root, modulePackageNames: [] }),
		).rejects.toThrow(
			"Test/spec/fixture artifact found in runner: node_modules/dependency/src/runtime.spec.js",
		);
	});

	it("rejects type-test artifacts anywhere in the runner", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await writeFixtureFile(
			join(root, "node_modules/dependency/index.test-d.ts"),
		);

		await expect(
			assertRunnerLayout({ root, modulePackageNames: [] }),
		).rejects.toThrow(
			"Test/spec/fixture artifact found in runner: node_modules/dependency/index.test-d.ts",
		);
	});

	it("rejects fixture trees anywhere in the runner", async () => {
		const root = await temporaryRoot();
		await createRunnerFixture(root);
		await writeFixtureFile(
			join(root, "packages/storage/src/fixtures/blob.json"),
		);

		await expect(
			assertRunnerLayout({ root, modulePackageNames: [] }),
		).rejects.toThrow(
			"Test/spec/fixture artifact found in runner: packages/storage/src/fixtures",
		);
	});
});

describe("resolved Module package manifest", () => {
	it("writes exactly 100 sorted resolved package names", async () => {
		const root = await temporaryRoot();
		const modulesRoot = join(root, "modules");
		const destination = join(root, "runtime/module-package-names.json");
		const expected = await createModulePackageFixtures(modulesRoot, 100);

		await writeModulePackageManifest({ modulesRoot, destination });

		expect(JSON.parse(await readFile(destination, "utf8"))).toEqual(expected);
	});

	it("rejects managed-payments even when the package count is 100", async () => {
		const root = await temporaryRoot();
		const modulesRoot = join(root, "modules");
		await createModulePackageFixtures(modulesRoot, 99);
		await writeFixtureFile(
			join(modulesRoot, "managed-payments/package.json"),
			JSON.stringify({ name: "@86d-app/managed-payments" }),
		);

		await expect(
			writeModulePackageManifest({
				modulesRoot,
				destination: join(root, "module-package-names.json"),
			}),
		).rejects.toThrow("managed-payments must not enter the public Store image");
	});

	it("rejects a resolved package count other than 100", async () => {
		const root = await temporaryRoot();
		const modulesRoot = join(root, "modules");
		await createModulePackageFixtures(modulesRoot, 99);

		await expect(
			writeModulePackageManifest({
				modulesRoot,
				destination: join(root, "module-package-names.json"),
			}),
		).rejects.toThrow("Expected 100 resolved Module packages, found 99");
	});

	it("can derive the same selected set from a checkout containing managed-payments", async () => {
		const root = await temporaryRoot();
		const modulesRoot = join(root, "modules");
		const expected = await createModulePackageFixtures(modulesRoot, 100);
		await writeFixtureFile(
			join(modulesRoot, "managed-payments/package.json"),
			JSON.stringify({ name: "@86d-app/managed-payments" }),
		);
		const destination = join(root, "module-package-names.json");

		await writeModulePackageManifest({
			modulesRoot,
			destination,
			allowManagedExclusion: true,
		});

		expect(JSON.parse(await readFile(destination, "utf8"))).toEqual(expected);
	});
});

describe("Docker context contract", () => {
	it("uses only Railway-supported cache mounts", async () => {
		const dockerfile = await readFile(
			join(import.meta.dirname, "../../../Dockerfile"),
			"utf8",
		);
		const unsupportedMounts = dockerfile
			.split("\n")
			.filter(
				(line) =>
					line.includes("--mount=type=") &&
					!line.includes("--mount=type=cache"),
			);

		expect(unsupportedMounts).toEqual([]);
	});

	it("loads workspace Modules from the ordinary Docker context", async () => {
		const dockerfile = await readFile(
			join(import.meta.dirname, "../../../Dockerfile"),
			"utf8",
		);

		expect(dockerfile).not.toContain("--from=workspace-modules");
	});

	it("keeps CI and release image builds free of secret and named contexts", async () => {
		for (const relativePath of [
			"internals/github/ci-cd/action.yml",
			".github/workflows/docker-release.yml",
		]) {
			const workflow = await readFile(join(repoRoot, relativePath), "utf8");

			expect(workflow).not.toContain("build-contexts:");
			expect(workflow).not.toMatch(/^\s+secrets:\s*$/m);
			expect(workflow).not.toContain("secret-envs:");
		}
	});

	it("excludes every dotenv credential variant from the default context", async () => {
		const dockerignore = await readFile(
			join(import.meta.dirname, "../../../.dockerignore"),
			"utf8",
		);
		const rules = dockerignore
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));

		expect(rules).toContain(".env*");
	});

	it("recursively excludes host dependency and authoring artifacts", async () => {
		const dockerignore = await readFile(
			join(import.meta.dirname, "../../../.dockerignore"),
			"utf8",
		);
		const rules = dockerignore
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));

		for (const recursiveRule of [
			"**/node_modules",
			"**/.next",
			"**/.turbo",
			"**/.86d",
			"**/.env*",
			"**/*.log",
			"**/logs",
			"**/coverage",
			"**/playwright-report",
			"**/test-results",
			"**/dist",
			"**/build",
			"**/*.tsbuildinfo",
		]) {
			expect(rules).toContain(recursiveRule);
		}
	});

	it("never overlays dependency-stage Module source trees", async () => {
		const dockerfile = await readFile(
			join(import.meta.dirname, "../../../Dockerfile"),
			"utf8",
		);

		expect(dockerfile).not.toContain("COPY --from=deps /app/modules ./modules");
	});
});

describe("Next standalone output contract", () => {
	it("accepts a complete BUILD_ID-linked standalone closure", async () => {
		const nextRoot = await temporaryRoot();
		await createNextBuildFixture(nextRoot);

		await expect(assertNextBuildOutput(nextRoot)).resolves.toBeUndefined();
	});

	it("rejects an empty static build directory", async () => {
		const nextRoot = await temporaryRoot();
		await createNextBuildFixture(nextRoot);
		await rm(join(nextRoot, "static"), { recursive: true });

		await expect(assertNextBuildOutput(nextRoot)).rejects.toThrow(
			"Next static output contains no files",
		);
	});

	it("rejects static manifests that do not match BUILD_ID", async () => {
		const nextRoot = await temporaryRoot();
		await createNextBuildFixture(nextRoot);
		await unlink(join(nextRoot, "static/fixture-build-id/_buildManifest.js"));

		await expect(assertNextBuildOutput(nextRoot)).rejects.toThrow(
			"BUILD_ID-linked static manifest is missing: _buildManifest.js",
		);
	});

	it("rejects an incomplete standalone server package closure", async () => {
		const nextRoot = await temporaryRoot();
		await createNextBuildFixture(nextRoot);
		await unlink(join(nextRoot, "standalone/apps/store/package.json"));

		await expect(assertNextBuildOutput(nextRoot)).rejects.toThrow(
			"Standalone Store package.json is missing",
		);
	});
});
