import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { readStoreConfig } from "@86d-app/registry/config";
import { computeIntegrity, fetchModules } from "@86d-app/registry/fetcher";
import { readLockfile } from "@86d-app/registry/lockfile";
import { readLocalManifest } from "@86d-app/registry/resolver";
import { parseSpecifier } from "@86d-app/registry/specifier";
import {
	restoreProcessEnv,
	setProcessEnv,
	snapshotProcessEnv,
} from "env/process-env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	captureRegistryOnlyPackageMetadata,
	type RegistryOnlyInputs,
	readRegistryOnlyPolicy,
	validateRegistryOnlyFetchCandidates,
	validateRegistryOnlyInputs,
	validateRegistryOnlyResolvedModules,
} from "../registry-only-policy.js";

const REVISION = "a".repeat(40);
const INTEGRITY = `sha256-${"1".repeat(64)}`;
const POLICY_TMP_ROOT = join(import.meta.dirname, ".tmp-registry-only-policy");
const WORKSPACE_ROOT = join(import.meta.dirname, "../../../..");

afterEach(() => {
	rmSync(POLICY_TMP_ROOT, { recursive: true, force: true });
	vi.unstubAllGlobals();
});

function officialInputs(): RegistryOnlyInputs {
	return {
		frozen: true,
		config: { modules: ["@86d-app/products"] },
		manifest: {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				products: {
					name: "@86d-app/products",
					description: "",
					// Registry entry version is the Module contract version, not the
					// independently released package.json version frozen by the lock.
					version: "1.0.0",
					category: "catalog",
					path: "modules/products",
					requires: [],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
					commit: REVISION,
					subtreeIntegrity: INTEGRITY,
					maturity: "experimental",
					maturityEvidence: [],
					providesCapabilities: [],
					acceptsCapabilities: [],
					emitsDurableEvents: [],
					handlesDurableEvents: [],
				},
			},
		},
		lockfile: {
			lockfileVersion: 1,
			generatedAt: "2026-08-23T00:00:00.000Z",
			modules: {
				products: {
					source: "local",
					packageName: "@86d-app/products",
					version: "0.0.42",
					integrity: INTEGRITY,
					localPath: "modules/products",
				},
			},
		},
		sourceRevision: REVISION,
	};
}

describe("readRegistryOnlyPolicy", () => {
	let originalEnvironment: NodeJS.ProcessEnv;

	beforeEach(() => {
		originalEnvironment = snapshotProcessEnv();
	});

	afterEach(() => {
		restoreProcessEnv(originalEnvironment);
	});

	it("enables registry-only generation only for the exact value true", () => {
		setProcessEnv("86D_REGISTRY_ONLY_MODULES", "TRUE");
		setProcessEnv("86D_REGISTRY_SOURCE_REVISION", "a".repeat(40));

		expect(readRegistryOnlyPolicy()).toEqual({ enabled: false });
	});

	it("requires a full source revision when registry-only generation is enabled", () => {
		setProcessEnv("86D_REGISTRY_ONLY_MODULES", "true");
		setProcessEnv("86D_REGISTRY_SOURCE_REVISION", undefined);

		expect(() => readRegistryOnlyPolicy()).toThrow(
			"86D_REGISTRY_SOURCE_REVISION must be a full 40-character commit SHA",
		);
	});
});

describe("validateRegistryOnlyResolvedModules", () => {
	const stagedPackageDriftCases: Array<{
		label: string;
		expectedError: string;
		stubPackage: (name: string) => Record<string, unknown>;
		fetchedPackage: (name: string) => Record<string, unknown>;
	}> = [
		{
			label: "version drift",
			expectedError: "package version mismatch",
			stubPackage: (name) => ({
				name: `@86d-app/${name}`,
				version: "0.0.42",
				dependencies: { "@86d-app/shared": "workspace:*" },
			}),
			fetchedPackage: (name) => ({
				name: `@86d-app/${name}`,
				version: name === "beta" ? "0.0.43" : "0.0.42",
				dependencies: { "@86d-app/shared": "workspace:*" },
			}),
		},
		{
			label: "non-dependency package.json drift",
			expectedError: "package.json metadata mismatch",
			stubPackage: (name) => ({
				name: `@86d-app/${name}`,
				version: "0.0.42",
				dependencies: { "@86d-app/shared": "workspace:*" },
				exports: { ".": "./src/index.ts" },
			}),
			fetchedPackage: (name) => ({
				name: `@86d-app/${name}`,
				version: "0.0.42",
				dependencies: { "@86d-app/shared": "workspace:*" },
				exports: {
					".": name === "beta" ? "./src/alternate.ts" : "./src/index.ts",
				},
			}),
		},
	];

	it.each(stagedPackageDriftCases)(
		"rejects staged $label without changing any prune stub bytes",
		async ({ expectedError, stubPackage, fetchedPackage }) => {
			const commit = "e".repeat(40);
			const archiveRoot = join(POLICY_TMP_ROOT, "fixture", "86d-archive");
			const manifestModules: RegistryOnlyInputs["manifest"]["modules"] = {};
			const lockedModules: RegistryOnlyInputs["lockfile"]["modules"] = {};
			const stubIntegrity: Record<string, string> = {};
			const stubBytes: Record<string, { packageJson: Buffer; source: Buffer }> =
				{};
			for (const name of ["alpha", "beta"]) {
				const stub = join(POLICY_TMP_ROOT, "modules", name);
				mkdirSync(join(stub, "src"), { recursive: true });
				writeFileSync(
					join(stub, "package.json"),
					JSON.stringify(stubPackage(name)),
				);
				writeFileSync(join(stub, "src", "stub.ts"), `stub ${name}\n`);
				const before = computeIntegrity(stub);
				if (!before) throw new Error("stub integrity fixture missing");
				stubIntegrity[name] = before;
				stubBytes[name] = {
					packageJson: readFileSync(join(stub, "package.json")),
					source: readFileSync(join(stub, "src", "stub.ts")),
				};

				const source = join(archiveRoot, "modules", name);
				mkdirSync(join(source, "src"), { recursive: true });
				writeFileSync(
					join(source, "package.json"),
					JSON.stringify(fetchedPackage(name)),
				);
				writeFileSync(join(source, "src", "index.ts"), `remote ${name}\n`);
				const integrity = computeIntegrity(source);
				if (!integrity) throw new Error("archive integrity fixture missing");
				manifestModules[name] = {
					name: `@86d-app/${name}`,
					description: "",
					version: "1.0.0",
					category: "general",
					path: `modules/${name}`,
					requires: [],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
					commit,
					subtreeIntegrity: integrity,
					maturity: "experimental",
					maturityEvidence: [],
					providesCapabilities: [],
					acceptsCapabilities: [],
					emitsDurableEvents: [],
					handlesDurableEvents: [],
				};
				lockedModules[name] = {
					source: "local",
					packageName: `@86d-app/${name}`,
					version: "0.0.42",
					integrity,
					localPath: `modules/${name}`,
				};
			}
			const manifest: RegistryOnlyInputs["manifest"] = {
				version: 1,
				baseUrl: "https://github.com/86d-app/86d",
				defaultRef: "main",
				modules: manifestModules,
				templates: {},
			};
			const lockfile: RegistryOnlyInputs["lockfile"] = {
				lockfileVersion: 1,
				generatedAt: "2026-08-23T00:00:00.000Z",
				modules: lockedModules,
			};
			const selected = validateRegistryOnlyInputs({
				frozen: true,
				config: { modules: ["@86d-app/alpha", "@86d-app/beta"] },
				manifest,
				lockfile,
				sourceRevision: commit,
			});
			const expectedPackageMetadata = captureRegistryOnlyPackageMetadata(
				POLICY_TMP_ROOT,
				selected,
				lockfile,
			);
			const resolved = selected.map((specifier) => ({
				specifier,
				status: "missing" as const,
			}));
			const archivePath = join(POLICY_TMP_ROOT, "fixture", "archive.tar.gz");
			expect(
				spawnSync(
					"tar",
					[
						"czf",
						archivePath,
						"-C",
						join(POLICY_TMP_ROOT, "fixture"),
						"86d-archive",
					],
					{ stdio: "pipe" },
				).status,
			).toBe(0);
			vi.stubGlobal(
				"fetch",
				vi.fn(
					async () => new Response(readFileSync(archivePath), { status: 200 }),
				),
			);

			const results = await fetchModules(selected, POLICY_TMP_ROOT, manifest, {
				replaceExisting: true,
				allowPackageManagerMutation: false,
				validateBeforeCommit: (candidates) =>
					validateRegistryOnlyFetchCandidates(
						{
							root: POLICY_TMP_ROOT,
							selected,
							resolved,
							manifest,
							lockfile,
							expectedPackageMetadata,
						},
						candidates,
					),
			});

			expect(results.every((result) => !result.success)).toBe(true);
			expect(results[0]?.error).toContain(expectedError);
			expect(
				Object.fromEntries(
					["alpha", "beta"].map((name) => [
						name,
						computeIntegrity(join(POLICY_TMP_ROOT, "modules", name)),
					]),
				),
			).toEqual(stubIntegrity);
			expect(
				Object.fromEntries(
					["alpha", "beta"].map((name) => [
						name,
						{
							packageJson: readFileSync(
								join(POLICY_TMP_ROOT, "modules", name, "package.json"),
							),
							source: readFileSync(
								join(POLICY_TMP_ROOT, "modules", name, "src", "stub.ts"),
							),
						},
					]),
				),
			).toEqual(stubBytes);
		},
	);

	it("accepts an exact npm package when its lock omits a workspace localPath", () => {
		const packagePath = join(
			POLICY_TMP_ROOT,
			"node_modules",
			"@acme",
			"plugin",
		);
		mkdirSync(packagePath, { recursive: true });
		writeFileSync(
			join(packagePath, "package.json"),
			JSON.stringify({ name: "@acme/plugin", version: "1.2.3" }),
		);
		const integrity = computeIntegrity(packagePath);
		if (!integrity) throw new Error("integrity fixture missing");
		const lockfile = {
			lockfileVersion: 1 as const,
			generatedAt: "2026-08-23T00:00:00.000Z",
			modules: {
				plugin: {
					source: "npm" as const,
					packageName: "@acme/plugin",
					version: "1.2.3",
					integrity,
				},
			},
		};
		const manifest = {
			version: 1 as const,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			modules: {},
			templates: {},
		};
		const selected = validateRegistryOnlyInputs({
			frozen: true,
			config: { modules: ["npm:@acme/plugin@1.2.3"] },
			manifest,
			lockfile,
			sourceRevision: REVISION,
		});
		const selectedModule = selected[0];
		if (!selectedModule) throw new Error("selected Module fixture missing");

		expect(() =>
			validateRegistryOnlyResolvedModules({
				root: POLICY_TMP_ROOT,
				selected,
				resolved: [
					{
						specifier: selectedModule,
						status: "found",
						localPath: packagePath,
					},
				],
				manifest,
				lockfile,
			}),
		).not.toThrow();
	});

	it("rejects a strict npm package root symlink escaping node_modules", () => {
		const physicalPath = join(POLICY_TMP_ROOT, "outside", "plugin");
		const packagePath = join(
			POLICY_TMP_ROOT,
			"node_modules",
			"@acme",
			"plugin",
		);
		mkdirSync(physicalPath, { recursive: true });
		mkdirSync(join(packagePath, ".."), { recursive: true });
		writeFileSync(
			join(physicalPath, "package.json"),
			JSON.stringify({ name: "@acme/plugin", version: "1.2.3" }),
		);
		writeFileSync(join(physicalPath, "index.js"), "export {};\n");
		symlinkSync(physicalPath, packagePath, "dir");
		const integrity = computeIntegrity(packagePath);
		if (!integrity) throw new Error("integrity fixture missing");
		const lockfile = {
			lockfileVersion: 1 as const,
			generatedAt: "2026-08-23T00:00:00.000Z",
			modules: {
				plugin: {
					source: "npm" as const,
					packageName: "@acme/plugin",
					version: "1.2.3",
					integrity,
				},
			},
		};
		const manifest = {
			version: 1 as const,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			modules: {},
			templates: {},
		};
		const selected = validateRegistryOnlyInputs({
			frozen: true,
			config: { modules: ["npm:@acme/plugin@1.2.3"] },
			manifest,
			lockfile,
			sourceRevision: REVISION,
		});
		const selectedModule = selected[0];
		if (!selectedModule) throw new Error("selected Module fixture missing");

		expect(() =>
			validateRegistryOnlyResolvedModules({
				root: POLICY_TMP_ROOT,
				selected,
				resolved: [
					{
						specifier: selectedModule,
						status: "found",
						localPath: packagePath,
					},
				],
				manifest,
				lockfile,
			}),
		).toThrow(/npm package target.*outside node_modules/i);
		expect(readFileSync(join(physicalPath, "index.js"), "utf8")).toBe(
			"export {};\n",
		);
	});

	it.each([
		{
			label: "a nested symlink",
			expected: /symbolic link/i,
			prepare: (physicalPath: string) =>
				symlinkSync("index.js", join(physicalPath, "link.js")),
		},
		{
			label: "integrity-excluded build bytes",
			expected: /integrity-excluded directory/i,
			prepare: (physicalPath: string) => {
				mkdirSync(join(physicalPath, "dist"), { recursive: true });
				writeFileSync(join(physicalPath, "dist", "index.js"), "built();\n");
			},
		},
	])(
		"rejects strict npm package containing $label",
		({ prepare, expected }) => {
			const physicalPath = join(
				POLICY_TMP_ROOT,
				"node_modules",
				".bun",
				"plugin",
			);
			const packagePath = join(
				POLICY_TMP_ROOT,
				"node_modules",
				"@acme",
				"plugin",
			);
			mkdirSync(physicalPath, { recursive: true });
			writeFileSync(
				join(physicalPath, "package.json"),
				JSON.stringify({ name: "@acme/plugin", version: "1.2.3" }),
			);
			writeFileSync(join(physicalPath, "index.js"), "export {};\n");
			prepare(physicalPath);
			mkdirSync(join(packagePath, ".."), { recursive: true });
			symlinkSync(physicalPath, packagePath, "dir");
			const integrity = computeIntegrity(packagePath);
			if (!integrity) throw new Error("integrity fixture missing");
			const lockfile = {
				lockfileVersion: 1 as const,
				generatedAt: "2026-08-23T00:00:00.000Z",
				modules: {
					plugin: {
						source: "npm" as const,
						packageName: "@acme/plugin",
						version: "1.2.3",
						integrity,
					},
				},
			};
			const manifest = {
				version: 1 as const,
				baseUrl: "https://github.com/86d-app/86d",
				defaultRef: "main",
				modules: {},
				templates: {},
			};
			const selected = validateRegistryOnlyInputs({
				frozen: true,
				config: { modules: ["npm:@acme/plugin@1.2.3"] },
				manifest,
				lockfile,
				sourceRevision: REVISION,
			});
			const selectedModule = selected[0];
			if (!selectedModule) throw new Error("selected Module fixture missing");

			expect(() =>
				validateRegistryOnlyResolvedModules({
					root: POLICY_TMP_ROOT,
					selected,
					resolved: [
						{
							specifier: selectedModule,
							status: "found",
							localPath: packagePath,
						},
					],
					manifest,
					lockfile,
				}),
			).toThrow(expected);
		},
	);

	it("rejects dependency metadata changed by registry archive replacement", () => {
		const modulePath = join(POLICY_TMP_ROOT, "modules", "products");
		mkdirSync(join(modulePath, "src"), { recursive: true });
		writeFileSync(
			join(modulePath, "package.json"),
			JSON.stringify({
				name: "@86d-app/products",
				version: "0.0.42",
				dependencies: { "@86d-app/shared": "workspace:*" },
				peerDependencies: { react: "catalog:react" },
			}),
		);
		writeFileSync(join(modulePath, "src", "index.ts"), "export {};\n");
		const inputs = officialInputs();
		const selected = validateRegistryOnlyInputs(inputs);
		const selectedModule = selected[0];
		if (!selectedModule) throw new Error("selected Module fixture missing");
		const expectedPackageMetadata = captureRegistryOnlyPackageMetadata(
			POLICY_TMP_ROOT,
			selected,
			inputs.lockfile,
		);

		writeFileSync(
			join(modulePath, "package.json"),
			JSON.stringify({
				name: "@86d-app/products",
				version: "0.0.42",
				dependencies: { "@86d-app/shared": "9.9.9" },
				peerDependencies: { react: "catalog:react" },
			}),
		);
		const integrity = computeIntegrity(modulePath);
		const manifestEntry = inputs.manifest.modules.products;
		const lockEntry = inputs.lockfile.modules.products;
		if (!integrity || !manifestEntry || !lockEntry) {
			throw new Error("integrity fixture missing");
		}
		manifestEntry.subtreeIntegrity = integrity;
		lockEntry.integrity = integrity;

		expect(() =>
			validateRegistryOnlyResolvedModules({
				root: POLICY_TMP_ROOT,
				selected,
				resolved: [
					{
						specifier: selectedModule,
						status: "found",
						localPath: modulePath,
					},
				],
				manifest: inputs.manifest,
				lockfile: inputs.lockfile,
				expectedPackageMetadata,
			}),
		).toThrow("dependency metadata mismatch");
	});

	it("accepts matching package bytes and rejects later integrity drift", () => {
		const modulePath = join(POLICY_TMP_ROOT, "modules", "products");
		mkdirSync(join(modulePath, "src"), { recursive: true });
		writeFileSync(
			join(modulePath, "package.json"),
			JSON.stringify({ name: "@86d-app/products", version: "0.0.42" }),
		);
		const sourcePath = join(modulePath, "src", "index.ts");
		writeFileSync(sourcePath, "export const value = 1;\n");
		const integrity = computeIntegrity(modulePath);
		if (!integrity) throw new Error("integrity fixture missing");
		const inputs = officialInputs();
		const manifestEntry = inputs.manifest.modules.products;
		const lockEntry = inputs.lockfile.modules.products;
		if (!manifestEntry || !lockEntry) throw new Error("fixture missing");
		manifestEntry.subtreeIntegrity = integrity;
		lockEntry.integrity = integrity;
		const selected = validateRegistryOnlyInputs(inputs);
		const selectedModule = selected[0];
		if (!selectedModule) throw new Error("selected Module fixture missing");
		const resolved = [
			{
				specifier: selectedModule,
				status: "found" as const,
				localPath: modulePath,
			},
		];

		expect(() =>
			validateRegistryOnlyResolvedModules({
				root: POLICY_TMP_ROOT,
				selected,
				resolved,
				manifest: inputs.manifest,
				lockfile: inputs.lockfile,
			}),
		).not.toThrow();

		writeFileSync(sourcePath, "export const value = 2;\n");
		expect(() =>
			validateRegistryOnlyResolvedModules({
				root: POLICY_TMP_ROOT,
				selected,
				resolved,
				manifest: inputs.manifest,
				lockfile: inputs.lockfile,
			}),
		).toThrow("integrity bytes mismatch");
	});

	it("rejects fetched package metadata that differs from the frozen lock", () => {
		const modulePath = join(POLICY_TMP_ROOT, "modules", "products");
		mkdirSync(join(modulePath, "src"), { recursive: true });
		writeFileSync(
			join(modulePath, "package.json"),
			JSON.stringify({ name: "@86d-app/products", version: "0.0.43" }),
		);
		writeFileSync(join(modulePath, "src", "index.ts"), "export {};\n");
		const integrity = computeIntegrity(modulePath);
		if (!integrity) throw new Error("integrity fixture missing");
		const inputs = officialInputs();
		const manifestEntry = inputs.manifest.modules.products;
		const lockEntry = inputs.lockfile.modules.products;
		if (!manifestEntry || !lockEntry) throw new Error("fixture missing");
		manifestEntry.subtreeIntegrity = integrity;
		lockEntry.integrity = integrity;
		const selected = validateRegistryOnlyInputs(inputs);
		const selectedModule = selected[0];
		if (!selectedModule) throw new Error("selected Module fixture missing");

		expect(() =>
			validateRegistryOnlyResolvedModules({
				root: POLICY_TMP_ROOT,
				selected,
				resolved: [
					{
						specifier: selectedModule,
						status: "found",
						localPath: modulePath,
					},
				],
				manifest: inputs.manifest,
				lockfile: inputs.lockfile,
			}),
		).toThrow("package version mismatch");
	});
});

describe("validateRegistryOnlyInputs", () => {
	it("accepts immutable GitHub commits and exact npm versions with matching locks", () => {
		const githubRevision = "c".repeat(40);
		const selected = validateRegistryOnlyInputs({
			frozen: true,
			config: {
				modules: [
					`github:owner/repo/modules/custom#${githubRevision}`,
					"npm:@acme/plugin@1.2.3",
				],
			},
			manifest: {
				version: 1,
				baseUrl: "https://github.com/86d-app/86d",
				defaultRef: "main",
				modules: {},
				templates: {},
			},
			lockfile: {
				lockfileVersion: 1,
				generatedAt: "2026-08-23T00:00:00.000Z",
				modules: {
					custom: {
						source: "github",
						packageName: "@86d-app/custom",
						version: "1.0.0",
						integrity: INTEGRITY,
						localPath: "modules/custom",
						repo: "owner/repo",
						ref: githubRevision,
						path: "modules/custom",
					},
					plugin: {
						source: "npm",
						packageName: "@acme/plugin",
						version: "1.2.3",
						integrity: INTEGRITY,
					},
				},
			},
			sourceRevision: REVISION,
		});

		expect(selected.map((specifier) => specifier.source)).toEqual([
			"github",
			"npm",
		]);
	});

	it.each(["local", "registry"] as const)(
		"accepts official %s lock provenance when metadata matches",
		(source) => {
			const inputs = officialInputs();
			const products = inputs.lockfile.modules.products;
			if (!products) throw new Error("products lock fixture missing");
			products.source = source;

			expect(validateRegistryOnlyInputs(inputs)).toEqual([
				expect.objectContaining({
					name: "products",
					packageName: "@86d-app/products",
				}),
			]);
		},
	);

	it("rejects an official manifest commit that differs from the build source revision", () => {
		const inputs = officialInputs();
		const products = inputs.manifest.modules.products;
		if (!products) throw new Error("products fixture missing");
		products.commit = "b".repeat(40);

		expect(() => validateRegistryOnlyInputs(inputs)).toThrow(
			"does not match 86D_REGISTRY_SOURCE_REVISION",
		);
	});

	it.each([
		[
			"a mutable GitHub branch",
			"github:owner/repo/modules/custom#main",
			"full 40-character commit SHA",
		],
		["an npm range", "npm:@acme/custom@^1.2.3", "exact version"],
		["npm latest", "npm:@acme/custom", "exact version"],
	])("rejects %s", (_label, raw, expectedMessage) => {
		expect(() =>
			validateRegistryOnlyInputs({
				frozen: true,
				config: { modules: [raw] },
				manifest: {
					version: 1,
					baseUrl: "https://github.com/86d-app/86d",
					defaultRef: "main",
					modules: {},
					templates: {},
				},
				lockfile: {
					lockfileVersion: 1,
					generatedAt: "2026-08-23T00:00:00.000Z",
					modules: {},
				},
				sourceRevision: "a".repeat(40),
			}),
		).toThrow(expectedMessage);
	});
});

describe("Store registry Module selection", () => {
	it("selects exactly 100 of 101 manifest Modules and excludes managed-payments", () => {
		const config = readStoreConfig(
			join(WORKSPACE_ROOT, "templates/brisa/config.json"),
		);
		const manifest = readLocalManifest(
			join(WORKSPACE_ROOT, "apps/registry/registry.json"),
		);
		const lockfile = readLockfile(WORKSPACE_ROOT);
		if (!manifest || !lockfile || !Array.isArray(config.modules)) {
			throw new Error("Store registry selection fixtures are missing");
		}

		const selectedNames = config.modules.map((raw) => parseSpecifier(raw).name);
		const manifestNames = Object.keys(manifest.modules);
		const lockedNames = Object.keys(lockfile.modules);
		const unselectedNames = manifestNames.filter(
			(name) => !selectedNames.includes(name),
		);

		expect(manifestNames).toHaveLength(101);
		expect(selectedNames).toHaveLength(100);
		expect(new Set(selectedNames)).toHaveLength(100);
		expect(lockedNames).toHaveLength(100);
		expect(lockedNames.toSorted((a, b) => a.localeCompare(b))).toEqual(
			selectedNames.toSorted((a, b) => a.localeCompare(b)),
		);
		expect(selectedNames).not.toContain("managed-payments");
		expect(lockedNames).not.toContain("managed-payments");
		expect(manifest.modules["managed-payments"]).toBeDefined();
		expect(unselectedNames).toEqual(["managed-payments"]);
	});
});
