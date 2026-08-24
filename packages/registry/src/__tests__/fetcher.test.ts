import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	computeIntegrity,
	ensureCacheDir,
	fetchModule,
	fetchModules,
} from "../fetcher.js";
import type { ModuleSpecifier, RegistryManifest } from "../types.js";

const TMP_ROOT = join(import.meta.dirname, ".tmp-fetcher-test");

beforeAll(() => {
	// Create a fake project structure with a local module
	mkdirSync(join(TMP_ROOT, "modules", "products", "src"), {
		recursive: true,
	});
	writeFileSync(
		join(TMP_ROOT, "modules", "products", "package.json"),
		JSON.stringify({ name: "@86d-app/products", version: "0.0.1" }),
	);
});

afterAll(() => {
	rmSync(TMP_ROOT, { recursive: true, force: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("fetchModules", () => {
	it.each([
		{
			label: "official",
			specifier: {
				raw: "..",
				source: "local" as const,
				name: "..",
				packageName: "@86d-app/..",
			},
			prepare: (root: string) =>
				writeFileSync(join(root, "package.json"), "root manifest\n"),
		},
		{
			label: "GitHub",
			specifier: {
				raw: `github:owner/repo/modules/..#${"a".repeat(40)}`,
				source: "github" as const,
				name: "..",
				packageName: "@86d-app/..",
				repo: "owner/repo",
				path: "modules/..",
				ref: "a".repeat(40),
			},
			prepare: (root: string) =>
				writeFileSync(join(root, "package.json"), "root manifest\n"),
		},
		{
			label: "npm",
			specifier: {
				raw: "npm:../outside@1.2.3",
				source: "npm" as const,
				name: "outside",
				packageName: "../outside",
				version: "1.2.3",
			},
			prepare: (root: string) => {
				mkdirSync(join(root, "outside"), { recursive: true });
				writeFileSync(join(root, "outside", "package.json"), "outside\n");
			},
		},
	])(
		"rejects $label target traversal without changing the root",
		async (test) => {
			const root = join(
				TMP_ROOT,
				`target-traversal-${test.label.toLowerCase()}`,
			);
			rmSync(root, { recursive: true, force: true });
			mkdirSync(root, { recursive: true });
			writeFileSync(join(root, "sentinel.txt"), "unchanged\n");
			test.prepare(root);

			const result = await fetchModule(test.specifier, root, undefined, {
				allowPackageManagerMutation: false,
			});

			expect(result).toEqual(
				expect.objectContaining({
					success: false,
					error: expect.stringMatching(/invalid .*specifier/i),
				}),
			);
			expect(readFileSync(join(root, "sentinel.txt"), "utf8")).toBe(
				"unchanged\n",
			);
		},
	);

	it.each(["modules parent", "Module target"])(
		"rejects an escaping $label symlink",
		async (label) => {
			const root = join(
				TMP_ROOT,
				`physical-containment-${label.replaceAll(" ", "-")}`,
			);
			const outside = join(root, "outside");
			rmSync(root, { recursive: true, force: true });
			mkdirSync(join(outside, "alpha"), { recursive: true });
			writeFileSync(
				join(outside, "alpha", "package.json"),
				"outside manifest\n",
			);
			writeFileSync(join(outside, "alpha", "sentinel.txt"), "unchanged\n");
			if (label === "modules parent") {
				symlinkSync(outside, join(root, "modules"), "dir");
			} else {
				mkdirSync(join(root, "modules"), { recursive: true });
				symlinkSync(
					join(outside, "alpha"),
					join(root, "modules", "alpha"),
					"dir",
				);
			}

			const result = await fetchModule(
				{
					raw: "alpha",
					source: "local",
					name: "alpha",
					packageName: "@86d-app/alpha",
				},
				root,
			);

			expect(result).toEqual(
				expect.objectContaining({
					success: false,
					error: expect.stringMatching(/outside|containment/i),
				}),
			);
			expect(readFileSync(join(outside, "alpha", "sentinel.txt"), "utf8")).toBe(
				"unchanged\n",
			);
		},
	);

	it("rejects an escaping scoped npm parent before package installation", async () => {
		const root = join(TMP_ROOT, "physical-containment-npm-scope");
		const outside = join(root, "outside-scope");
		rmSync(root, { recursive: true, force: true });
		mkdirSync(join(root, "node_modules"), { recursive: true });
		mkdirSync(outside, { recursive: true });
		writeFileSync(join(outside, "sentinel.txt"), "unchanged\n");
		symlinkSync(outside, join(root, "node_modules", "@scope"), "dir");

		const result = await fetchModule(
			{
				raw: "npm:@scope/alpha@1.2.3",
				source: "npm",
				name: "alpha",
				packageName: "@scope/alpha",
				version: "1.2.3",
			},
			root,
			undefined,
			{ allowPackageManagerMutation: false },
		);

		expect(result).toEqual(
			expect.objectContaining({
				success: false,
				error: expect.stringMatching(/containment|outside/i),
			}),
		);
		expect(readFileSync(join(outside, "sentinel.txt"), "utf8")).toBe(
			"unchanged\n",
		);
	});

	it.each([
		{
			label: "repository owner",
			baseUrl: "https://github.com/../repo",
			path: "modules/alpha",
			commit: "a".repeat(40),
		},
		{
			label: "repository path",
			baseUrl: "https://github.com/owner/repo",
			path: "modules/..",
			commit: "a".repeat(40),
		},
		{
			label: "repository ref",
			baseUrl: "https://github.com/owner/repo",
			path: "modules/alpha",
			commit: "../mutable",
		},
	])(
		"rejects an invalid manifest $label before archive fetch",
		async (test) => {
			const root = join(
				TMP_ROOT,
				`manifest-specifier-${test.label.replaceAll(" ", "-")}`,
			);
			rmSync(root, { recursive: true, force: true });
			mkdirSync(root, { recursive: true });
			writeFileSync(join(root, "sentinel.txt"), "unchanged\n");
			const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
			vi.stubGlobal("fetch", fetchMock);
			const manifest: RegistryManifest = {
				version: 1,
				baseUrl: test.baseUrl,
				defaultRef: "main",
				templates: {},
				modules: {
					alpha: {
						name: "@86d-app/alpha",
						description: "",
						version: "1.0.0",
						category: "general",
						path: test.path,
						requires: [],
						hasStoreComponents: false,
						hasAdminComponents: false,
						hasStorePages: false,
						commit: test.commit,
						subtreeIntegrity: `sha256-${"1".repeat(64)}`,
						maturity: "experimental",
						maturityEvidence: [],
						providesCapabilities: [],
						acceptsCapabilities: [],
						emitsDurableEvents: [],
						handlesDurableEvents: [],
					},
				},
			};

			const result = await fetchModule(
				{
					raw: "@86d-app/alpha",
					source: "registry",
					name: "alpha",
					packageName: "@86d-app/alpha",
				},
				root,
				manifest,
				{ replaceExisting: true },
			);

			expect(result).toEqual(
				expect.objectContaining({
					success: false,
					error: expect.stringMatching(/invalid GitHub specifier/i),
				}),
			);
			expect(fetchMock).not.toHaveBeenCalled();
			expect(readFileSync(join(root, "sentinel.txt"), "utf8")).toBe(
				"unchanged\n",
			);
		},
	);

	const rejectedArchiveEntries: Array<{
		label: string;
		slug: string;
		expectedError: RegExp;
		prepare: (source: string, archiveRoot: string, root: string) => void;
	}> = [
		{
			label: "a parent symlink that escapes the archive root",
			slug: "symlink-parent-escape",
			expectedError: /not found|outside/i,
			prepare: (source, archiveRoot, root) => {
				const externalModules = join(root, "host-modules");
				mkdirSync(externalModules, { recursive: true });
				renameSync(source, join(externalModules, "alpha"));
				rmSync(join(archiveRoot, "modules"), {
					recursive: true,
					force: true,
				});
				symlinkSync(externalModules, join(archiveRoot, "modules"), "dir");
			},
		},
		{
			label: "a symlink used as the Module root",
			slug: "symlink-root",
			expectedError: /symbolic link/i,
			prepare: (source) => {
				const realSource = `${source}-real`;
				renameSync(source, realSource);
				symlinkSync("alpha-real", source, "dir");
			},
		},
		{
			label: "an internal symlink",
			slug: "symlink-internal",
			expectedError: /symbolic link/i,
			prepare: (source) =>
				symlinkSync("real.ts", join(source, "src", "link.ts")),
		},
		{
			label: "an escaping symlink",
			slug: "symlink-escape",
			expectedError: /symbolic link/i,
			prepare: (source) =>
				symlinkSync("../../../../outside.ts", join(source, "src", "link.ts")),
		},
		...["node_modules", "dist", ".turbo", ".cache", ".next", "coverage"].map(
			(directory) => ({
				label: `integrity-excluded ${directory} content`,
				slug: `directory-${directory.replaceAll(".", "dot-")}`,
				expectedError: /integrity-excluded directory/i,
				prepare: (source: string) => {
					mkdirSync(join(source, directory), { recursive: true });
					writeFileSync(join(source, directory, "payload.js"), "unhashed();\n");
				},
			}),
		),
		{
			label: "an integrity-excluded host-junk file",
			slug: "host-junk",
			expectedError: /integrity-excluded file/i,
			prepare: (source) => writeFileSync(join(source, ".DS_Store"), "junk"),
		},
		{
			label: "an integrity-excluded tsbuildinfo file",
			slug: "tsbuildinfo",
			expectedError: /integrity-excluded file/i,
			prepare: (source) =>
				writeFileSync(join(source, "src", "cache.tsbuildinfo"), "{}"),
		},
	];

	it.each(rejectedArchiveEntries)(
		"rejects $label before replacing a stub",
		async ({ slug, expectedError, prepare }) => {
			const root = join(TMP_ROOT, slug);
			rmSync(root, { recursive: true, force: true });
			const source = join(root, "fixture", "86d-archive", "modules", "alpha");
			mkdirSync(join(source, "src"), { recursive: true });
			writeFileSync(
				join(source, "package.json"),
				JSON.stringify({ name: "@86d-app/alpha", version: "1.0.0" }),
			);
			writeFileSync(
				join(source, "src", "real.ts"),
				"export const value = 1;\n",
			);
			prepare(source, join(root, "fixture", "86d-archive"), root);
			const stub = join(root, "modules", "alpha");
			mkdirSync(stub, { recursive: true });
			writeFileSync(join(stub, "package.json"), "original stub\n");

			const archivePath = join(root, "fixture", "archive.tar.gz");
			expect(
				spawnSync(
					"tar",
					["czf", archivePath, "-C", join(root, "fixture"), "86d-archive"],
					{ stdio: "pipe" },
				).status,
			).toBe(0);
			const manifest: RegistryManifest = {
				version: 1,
				baseUrl: "https://github.com/86d-app/86d",
				defaultRef: "main",
				templates: {},
				modules: {
					alpha: {
						name: "@86d-app/alpha",
						description: "",
						version: "1.0.0",
						category: "general",
						path: "modules/alpha",
						requires: [],
						hasStoreComponents: false,
						hasAdminComponents: false,
						hasStorePages: false,
						commit: "c".repeat(40),
						subtreeIntegrity: computeIntegrity(source),
						maturity: "experimental",
						maturityEvidence: [],
						providesCapabilities: [],
						acceptsCapabilities: [],
						emitsDurableEvents: [],
						handlesDurableEvents: [],
					},
				},
			};
			vi.stubGlobal(
				"fetch",
				vi.fn(
					async () => new Response(readFileSync(archivePath), { status: 200 }),
				),
			);

			const [result] = await fetchModules(
				[
					{
						raw: "@86d-app/alpha",
						source: "registry",
						name: "alpha",
						packageName: "@86d-app/alpha",
					},
				],
				root,
				manifest,
				{ replaceExisting: true },
			);

			expect(result).toEqual(
				expect.objectContaining({
					success: false,
					error: expect.stringMatching(expectedError),
				}),
			);
			expect(readFileSync(join(stub, "package.json"), "utf8")).toBe(
				"original stub\n",
			);
		},
	);

	it("fetches the pinned archive when replacement is requested even if local integrity matches", async () => {
		const root = join(TMP_ROOT, "force-remote-replacement");
		rmSync(root, { recursive: true, force: true });
		const source = join(root, "fixture", "86d-archive", "modules", "alpha");
		const existing = join(root, "modules", "alpha");
		for (const modulePath of [source, existing]) {
			mkdirSync(join(modulePath, "src"), { recursive: true });
			writeFileSync(
				join(modulePath, "package.json"),
				JSON.stringify({ name: "@86d-app/alpha", version: "1.0.0" }),
			);
			writeFileSync(
				join(modulePath, "src", "index.ts"),
				"export const value = 1;\n",
			);
		}
		const archivePath = join(root, "fixture", "archive.tar.gz");
		expect(
			spawnSync(
				"tar",
				["czf", archivePath, "-C", join(root, "fixture"), "86d-archive"],
				{ stdio: "pipe" },
			).status,
		).toBe(0);
		const integrity = computeIntegrity(source);
		if (!integrity) throw new Error("integrity fixture missing");
		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				alpha: {
					name: "@86d-app/alpha",
					description: "",
					version: "1.0.0",
					category: "general",
					path: "modules/alpha",
					requires: [],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
					commit: "d".repeat(40),
					subtreeIntegrity: integrity,
					maturity: "experimental",
					maturityEvidence: [],
					providesCapabilities: [],
					acceptsCapabilities: [],
					emitsDurableEvents: [],
					handlesDurableEvents: [],
				},
			},
		};
		const fetchMock = vi.fn(
			async () => new Response(readFileSync(archivePath), { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const [result] = await fetchModules(
			[
				{
					raw: "@86d-app/alpha",
					source: "registry",
					name: "alpha",
					packageName: "@86d-app/alpha",
				},
			],
			root,
			manifest,
			{ replaceExisting: true },
		);

		expect(result?.success).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("downloads one pinned archive and replaces metadata-only module stubs", async () => {
		const root = join(TMP_ROOT, "batch-fetch");
		rmSync(root, { recursive: true, force: true });
		const archiveRoot = join(root, "fixture", "86d-archive");
		const commit = "a".repeat(40);
		for (const name of ["alpha", "beta"]) {
			const source = join(archiveRoot, "modules", name);
			mkdirSync(join(source, "src"), { recursive: true });
			writeFileSync(
				join(source, "package.json"),
				JSON.stringify({ name: `@86d-app/${name}`, version: "1.0.0" }),
			);
			writeFileSync(
				join(source, "src", "index.ts"),
				`export const ${name} = 1;\n`,
			);

			const stub = join(root, "modules", name);
			mkdirSync(stub, { recursive: true });
			writeFileSync(
				join(stub, "package.json"),
				JSON.stringify({ name: `@86d-app/${name}`, version: "1.0.0" }),
			);
		}

		const archivePath = join(root, "fixture", "archive.tar.gz");
		const tar = spawnSync(
			"tar",
			["czf", archivePath, "-C", join(root, "fixture"), "86d-archive"],
			{ stdio: "pipe" },
		);
		expect(tar.status).toBe(0);

		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: Object.fromEntries(
				["alpha", "beta"].map((name) => [
					name,
					{
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
						subtreeIntegrity: computeIntegrity(
							join(archiveRoot, "modules", name),
						),
						maturity: "experimental" as const,
						maturityEvidence: [],
						providesCapabilities: [],
						acceptsCapabilities: [],
						emitsDurableEvents: [],
						handlesDurableEvents: [],
					},
				]),
			),
		};
		const fetchMock = vi.fn(
			async () => new Response(readFileSync(archivePath), { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const results = await fetchModules(
			["alpha", "beta"].map((name) => ({
				raw: `@86d-app/${name}`,
				source: "registry" as const,
				name,
				packageName: `@86d-app/${name}`,
			})),
			root,
			manifest,
			{ replaceExisting: true },
		);

		expect(results.every((result) => result.success)).toBe(true);
		expect(
			readFileSync(join(root, "modules", "alpha", "src", "index.ts"), "utf8"),
		).toBe("export const alpha = 1;\n");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toContain(commit);
	});

	it("leaves every existing stub untouched when one module fails integrity", async () => {
		const root = join(TMP_ROOT, "atomic-failure");
		rmSync(root, { recursive: true, force: true });
		const archiveRoot = join(root, "fixture", "86d-archive");
		const commit = "b".repeat(40);
		for (const name of ["alpha", "beta"]) {
			const source = join(archiveRoot, "modules", name);
			mkdirSync(join(source, "src"), { recursive: true });
			writeFileSync(
				join(source, "package.json"),
				JSON.stringify({ name: `@86d-app/${name}`, version: "1.0.0" }),
			);
			writeFileSync(join(source, "src", "index.ts"), `remote ${name}\n`);

			const stub = join(root, "modules", name);
			mkdirSync(stub, { recursive: true });
			writeFileSync(join(stub, "package.json"), `original ${name}\n`);
		}

		const archivePath = join(root, "fixture", "archive.tar.gz");
		expect(
			spawnSync(
				"tar",
				["czf", archivePath, "-C", join(root, "fixture"), "86d-archive"],
				{ stdio: "pipe" },
			).status,
		).toBe(0);
		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: Object.fromEntries(
				["alpha", "beta"].map((name) => [
					name,
					{
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
						subtreeIntegrity:
							name === "alpha"
								? computeIntegrity(join(archiveRoot, "modules", name))
								: `sha256-${"0".repeat(64)}`,
						maturity: "experimental" as const,
						maturityEvidence: [],
						providesCapabilities: [],
						acceptsCapabilities: [],
						emitsDurableEvents: [],
						handlesDurableEvents: [],
					},
				]),
			),
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () => new Response(readFileSync(archivePath), { status: 200 }),
			),
		);

		const results = await fetchModules(
			["alpha", "beta"].map((name) => ({
				raw: `@86d-app/${name}`,
				source: "registry" as const,
				name,
				packageName: `@86d-app/${name}`,
			})),
			root,
			manifest,
			{ replaceExisting: true },
		);

		expect(results[1]).toEqual(
			expect.objectContaining({
				success: false,
				error: expect.stringContaining("Integrity check failed"),
			}),
		);
		expect(
			["alpha", "beta"].map((name) =>
				readFileSync(join(root, "modules", name, "package.json"), "utf8"),
			),
		).toEqual(["original alpha\n", "original beta\n"]);
	});

	it("refuses to mutate package manifests for a missing npm module when disabled", async () => {
		const root = join(TMP_ROOT, "immutable-npm");
		rmSync(root, { recursive: true, force: true });
		mkdirSync(join(root, "apps", "store"), { recursive: true });
		writeFileSync(
			join(root, "apps", "store", "package.json"),
			JSON.stringify({ name: "store", dependencies: {} }),
		);

		const [result] = await fetchModules(
			[
				{
					raw: "npm:@acme/custom@1.2.3",
					source: "npm",
					name: "custom",
					packageName: "@acme/custom",
					version: "1.2.3",
				},
			],
			root,
			undefined,
			{ allowPackageManagerMutation: false },
		);

		expect(result).toEqual(
			expect.objectContaining({
				success: false,
				error: expect.stringContaining("mutation is disabled"),
			}),
		);
		expect(
			readFileSync(join(root, "apps", "store", "package.json"), "utf8"),
		).toBe(JSON.stringify({ name: "store", dependencies: {} }));
	});
});

describe("fetchModule", () => {
	it("returns local path for local source", async () => {
		const spec: ModuleSpecifier = {
			raw: "products",
			source: "local",
			name: "products",
			packageName: "@86d-app/products",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(true);
		expect(result.localPath).toBe(join(TMP_ROOT, "modules", "products"));
	});

	it("fails for registry source without manifest", async () => {
		const spec: ModuleSpecifier = {
			raw: "@86d-app/shipping",
			source: "registry",
			name: "shipping",
			packageName: "@86d-app/shipping",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(false);
		expect(result.error).toContain("No registry manifest");
	});

	it("fails for registry source with module not in manifest", async () => {
		const spec: ModuleSpecifier = {
			raw: "@86d-app/unknown",
			source: "registry",
			name: "unknown",
			packageName: "@86d-app/unknown",
		};

		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			modules: {},
			templates: {},
		};

		const result = await fetchModule(spec, TMP_ROOT, manifest);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found in registry");
	});

	it("fails for github source without repo", async () => {
		const spec: ModuleSpecifier = {
			raw: "github:",
			source: "github",
			name: "test",
			packageName: "@86d-app/test",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(false);
		expect(result.error).toContain("missing repo");
	});

	it("skips fetch for github source when module already exists", async () => {
		const spec: ModuleSpecifier = {
			raw: "github:86d-app/86d/modules/products",
			source: "github",
			name: "products",
			packageName: "@86d-app/products",
			repo: "86d-app/86d",
			path: "modules/products",
			ref: "main",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(true);
		expect(result.localPath).toBe(join(TMP_ROOT, "modules", "products"));
	});
});

describe("ensureCacheDir", () => {
	it("creates .86d directory", () => {
		const cacheDir = ensureCacheDir(TMP_ROOT);
		expect(cacheDir).toBe(join(TMP_ROOT, ".86d"));
	});
});

describe("computeIntegrity", () => {
	it("computes sha256 hash over the Module subtree", () => {
		const hash = computeIntegrity(join(TMP_ROOT, "modules", "products"));
		expect(hash).toBeDefined();
		expect(hash).toMatch(/^sha256-[a-f0-9]{64}$/);
	});

	it("returns undefined for a missing module directory", () => {
		const hash = computeIntegrity("/non/existent/module");
		expect(hash).toBeUndefined();
	});
});

describe("registry fetch verification", () => {
	// A failed verification deletes the unverified source, so each case
	// restores the fixture rather than inheriting the previous one.
	beforeEach(() => {
		mkdirSync(join(TMP_ROOT, "modules", "products", "src"), {
			recursive: true,
		});
		writeFileSync(
			join(TMP_ROOT, "modules", "products", "package.json"),
			JSON.stringify({ name: "@86d-app/products", version: "0.0.1" }),
		);
	});

	function manifestWith(entry: Record<string, unknown>) {
		return {
			version: 1 as const,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				products: {
					name: "@86d-app/products",
					description: "",
					version: "1.0.0",
					category: "general",
					path: "modules/products",
					requires: [],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
					maturity: "experimental" as const,
					maturityEvidence: [],
					providesCapabilities: [],
					acceptsCapabilities: [],
					emitsDurableEvents: [],
					handlesDurableEvents: [],
					...entry,
				},
			},
		};
	}

	it("refuses a registry entry that records no subtree hash", async () => {
		// The Module is already present locally, so the fetch short-circuits to
		// the existing directory and goes straight to verification.
		const spec = {
			raw: "products",
			source: "registry" as const,
			name: "products",
			packageName: "@86d-app/products",
		};

		const result = await fetchModule(spec, TMP_ROOT, manifestWith({}));

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/unverified source/i);
	});

	it("refuses a registry entry whose subtree hash does not match", async () => {
		const spec = {
			raw: "products",
			source: "registry" as const,
			name: "products",
			packageName: "@86d-app/products",
		};

		const result = await fetchModule(
			spec,
			TMP_ROOT,
			manifestWith({ subtreeIntegrity: `sha256-${"0".repeat(64)}` }),
		);

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/Integrity check failed/);
	});
});
