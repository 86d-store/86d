import type { Dirent, Stats } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import {
	CURATED_STORE_MODULES,
	TIER_NONE_CURATED_MODULES,
} from "../../packages/core/src/curated-modules";

interface RunnerLayoutOptions {
	root: string;
	modulePackageNames: readonly string[];
}

interface ModulePackageManifestOptions {
	modulesRoot: string;
	destination: string;
	allowManagedExclusion?: boolean;
}

interface RequiredServerFilesManifest {
	files: string[];
	relativeAppDir: "apps/store";
}

const TIER_NONE = new Set<string>(TIER_NONE_CURATED_MODULES);
const RUNTIME_ARTIFACT_DIRECTORIES = new Set([
	"__fixtures__",
	"__specs__",
	"__tests__",
	"fixture",
	"fixtures",
	"spec",
	"specs",
	"test",
	"tests",
]);
const RUNTIME_ARTIFACT_FILE = /\.(?:fixture|spec|test)(?:\.|-)/;

function normalizePath(path: string): string {
	return path.split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requireNonemptyFile(path: string, label: string): Promise<void> {
	let file: Stats;
	try {
		file = await stat(path);
	} catch {
		throw new Error(`${label} is missing: ${path}`);
	}
	if (!file.isFile() || file.size === 0) {
		throw new Error(`${label} is empty or not a regular file: ${path}`);
	}
}

async function readJsonRecord(
	path: string,
	label: string,
): Promise<Record<string, unknown>> {
	await requireNonemptyFile(path, label);
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(path, "utf8"));
	} catch {
		throw new Error(`${label} is not valid JSON: ${path}`);
	}
	if (!isRecord(parsed)) {
		throw new Error(`${label} must contain a JSON object: ${path}`);
	}
	return parsed;
}

async function listTree(
	root: string,
	relativeRoot = "",
): Promise<{ entries: string[]; files: string[] }> {
	const entries: string[] = [];
	const files: string[] = [];
	for (const entry of await readdir(join(root, relativeRoot), {
		withFileTypes: true,
	})) {
		const relativePath = join(relativeRoot, entry.name);
		const normalized = normalizePath(relativePath);
		entries.push(normalized);
		if (entry.isDirectory()) {
			const nested = await listTree(root, relativePath);
			entries.push(...nested.entries);
			files.push(...nested.files);
		} else if (entry.isFile()) {
			files.push(normalized);
		}
	}
	return { entries, files };
}

async function containsRegularFile(root: string): Promise<boolean> {
	let entries: Dirent[];
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return false;
	}
	for (const entry of entries) {
		if (entry.isFile()) return true;
		if (
			entry.isDirectory() &&
			(await containsRegularFile(join(root, entry.name)))
		) {
			return true;
		}
	}
	return false;
}

function requiredServerFilesManifest(
	value: Record<string, unknown>,
): RequiredServerFilesManifest {
	if (value.relativeAppDir !== "apps/store") {
		throw new Error(
			"required-server-files.json must target relativeAppDir apps/store",
		);
	}
	if (
		!Array.isArray(value.files) ||
		value.files.length === 0 ||
		!value.files.every((file): file is string => typeof file === "string")
	) {
		throw new Error(
			"required-server-files.json must contain a nonempty files array",
		);
	}
	return { files: value.files, relativeAppDir: value.relativeAppDir };
}

function resolveWithin(root: string, relativePath: string): string {
	if (isAbsolute(relativePath)) {
		throw new Error(
			`Required server file path must be relative: ${relativePath}`,
		);
	}
	const resolvedRoot = resolve(root);
	const resolvedPath = resolve(resolvedRoot, relativePath);
	if (
		resolvedPath !== resolvedRoot &&
		!resolvedPath.startsWith(`${resolvedRoot}${sep}`)
	) {
		throw new Error(
			`Required server file escapes its package: ${relativePath}`,
		);
	}
	return resolvedPath;
}

export async function assertNextBuildOutput(nextRoot: string): Promise<void> {
	const resolvedNextRoot = resolve(nextRoot);
	const buildIdPath = join(resolvedNextRoot, "BUILD_ID");
	await requireNonemptyFile(buildIdPath, "Next BUILD_ID");
	const buildId = (await readFile(buildIdPath, "utf8")).trim();
	if (!/^[A-Za-z0-9_-]+$/.test(buildId)) {
		throw new Error(`Next BUILD_ID is invalid: ${JSON.stringify(buildId)}`);
	}

	const staticRoot = join(resolvedNextRoot, "static");
	if (!(await containsRegularFile(staticRoot))) {
		throw new Error(`Next static output contains no files: ${staticRoot}`);
	}
	for (const manifest of [
		"_buildManifest.js",
		"_clientMiddlewareManifest.js",
		"_ssgManifest.js",
	]) {
		try {
			await requireNonemptyFile(
				join(staticRoot, buildId, manifest),
				"BUILD_ID-linked static manifest",
			);
		} catch {
			throw new Error(
				`BUILD_ID-linked static manifest is missing: ${manifest}`,
			);
		}
	}

	for (const manifest of [
		"build-manifest.json",
		"routes-manifest.json",
		"server/app-paths-manifest.json",
	]) {
		await readJsonRecord(join(resolvedNextRoot, manifest), `Next ${manifest}`);
	}

	const requiredManifest = requiredServerFilesManifest(
		await readJsonRecord(
			join(resolvedNextRoot, "required-server-files.json"),
			"Next required-server-files.json",
		),
	);
	const standaloneRoot = join(resolvedNextRoot, "standalone");
	const standaloneStoreRoot = join(
		standaloneRoot,
		requiredManifest.relativeAppDir,
	);
	await readJsonRecord(
		join(standaloneStoreRoot, "package.json"),
		"Standalone Store package.json",
	);
	await requireNonemptyFile(
		join(standaloneStoreRoot, "server.js"),
		"Standalone Store server",
	);
	if (!(await containsRegularFile(join(standaloneRoot, "node_modules")))) {
		throw new Error("Standalone node_modules closure contains no files");
	}
	for (const requiredFile of requiredManifest.files) {
		await requireNonemptyFile(
			resolveWithin(standaloneStoreRoot, requiredFile),
			`Required standalone server file ${requiredFile}`,
		);
	}
}

export async function assertRunnerLayout({
	root,
	modulePackageNames,
}: RunnerLayoutOptions): Promise<void> {
	const resolvedRoot = resolve(root);
	const schemaModuleIds = CURATED_STORE_MODULES.filter(
		(moduleId) => !TIER_NONE.has(moduleId),
	);
	if (schemaModuleIds.length !== 22) {
		throw new Error(
			`Expected 22 curated schema Modules, found ${schemaModuleIds.length}`,
		);
	}
	const expectedModuleEntries = schemaModuleIds
		.flatMap((moduleId) => [
			`modules/${moduleId}`,
			`modules/${moduleId}/src`,
			`modules/${moduleId}/src/schema.ts`,
		])
		.sort((left, right) => left.localeCompare(right));
	const moduleTree = await listTree(join(resolvedRoot, "modules"));
	const actualModuleEntries = moduleTree.entries
		.map((path) => `modules/${path}`)
		.sort((left, right) => left.localeCompare(right));
	if (
		JSON.stringify(actualModuleEntries) !==
		JSON.stringify(expectedModuleEntries)
	) {
		throw new Error(
			`Unexpected /app/modules runtime layout: ${JSON.stringify(actualModuleEntries)}`,
		);
	}

	const modulePackages = new Set<string>();
	for (const packageName of modulePackageNames) {
		if (!/^@86d-app\/[a-z0-9-]+$/.test(packageName)) {
			throw new Error(
				`Invalid Module package name: ${JSON.stringify(packageName)}`,
			);
		}
		modulePackages.add(packageName);
	}
	const runnerTree = await listTree(resolvedRoot);
	const firstRuntimeArtifact = runnerTree.entries.find((entry) => {
		const segments = entry.split("/");
		return (
			segments.some((segment) => RUNTIME_ARTIFACT_DIRECTORIES.has(segment)) ||
			RUNTIME_ARTIFACT_FILE.test(segments.at(-1) ?? "")
		);
	});
	if (firstRuntimeArtifact) {
		throw new Error(
			`Test/spec/fixture artifact found in runner: ${firstRuntimeArtifact}`,
		);
	}
	const tracedModuleRoots = new Set<string>();
	for (const entry of runnerTree.entries) {
		const segments = entry.split("/");
		for (let index = 0; index < segments.length - 2; index += 1) {
			if (segments[index] !== "node_modules") continue;
			const packageName = `${segments[index + 1]}/${segments[index + 2]}`;
			if (modulePackages.has(packageName)) {
				tracedModuleRoots.add(segments.slice(0, index + 3).join("/"));
			}
		}
	}
	const [firstTracedModule] = [...tracedModuleRoots].sort();
	if (firstTracedModule) {
		throw new Error(
			`Traced Module package found below node_modules: ${firstTracedModule}`,
		);
	}
}

async function readModulePackageNames(path: string): Promise<string[]> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(path, "utf8"));
	} catch {
		throw new Error(`Module package manifest is not valid JSON: ${path}`);
	}
	if (
		!Array.isArray(parsed) ||
		!parsed.every(
			(packageName): packageName is string => typeof packageName === "string",
		)
	) {
		throw new Error(`Module package manifest must be a string array: ${path}`);
	}
	return parsed;
}

export async function writeModulePackageManifest({
	modulesRoot,
	destination,
	allowManagedExclusion = false,
}: ModulePackageManifestOptions): Promise<void> {
	const packageNames: string[] = [];
	for (const entry of await readdir(resolve(modulesRoot), {
		withFileTypes: true,
	})) {
		if (!entry.isDirectory()) continue;
		const manifestPath = join(modulesRoot, entry.name, "package.json");
		const manifest = await readJsonRecord(
			manifestPath,
			`Module package manifest for ${entry.name}`,
		);
		if (
			typeof manifest.name !== "string" ||
			!/^@86d-app\/[a-z0-9-]+$/.test(manifest.name)
		) {
			throw new Error(`Invalid Module package name in ${manifestPath}`);
		}
		if (manifest.name === "@86d-app/managed-payments") {
			if (allowManagedExclusion) continue;
			throw new Error("managed-payments must not enter the public Store image");
		}
		packageNames.push(manifest.name);
	}
	if (packageNames.length !== 100) {
		throw new Error(
			`Expected 100 resolved Module packages, found ${packageNames.length}`,
		);
	}
	if (new Set(packageNames).size !== packageNames.length) {
		throw new Error("Resolved Module package names must be unique");
	}
	packageNames.sort((left, right) => left.localeCompare(right));
	const resolvedDestination = resolve(destination);
	await mkdir(dirname(resolvedDestination), { recursive: true });
	await writeFile(
		resolvedDestination,
		`${JSON.stringify(packageNames, null, 2)}\n`,
	);
}

async function main(): Promise<void> {
	const [mode, root, packageManifest] = Bun.argv.slice(2);
	if (mode === "next-build" && root && !packageManifest) {
		await assertNextBuildOutput(root);
		return;
	}
	if (mode === "runner" && root && packageManifest) {
		await assertRunnerLayout({
			root,
			modulePackageNames: await readModulePackageNames(packageManifest),
		});
		return;
	}
	if (mode === "module-manifest" && root && packageManifest) {
		await writeModulePackageManifest({
			modulesRoot: root,
			destination: packageManifest,
		});
		return;
	}
	if (mode === "selected-module-manifest" && root && packageManifest) {
		await writeModulePackageManifest({
			modulesRoot: root,
			destination: packageManifest,
			allowManagedExclusion: true,
		});
		return;
	}
	throw new Error(
		"Usage: verify-runtime-contract.ts next-build <next-root> | runner <runner-root> <module-package-manifest> | module-manifest <modules-root> <destination> | selected-module-manifest <modules-root> <destination>",
	);
}

if (import.meta.main) {
	try {
		await main();
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Runtime contract verification failed",
		);
		process.exit(1);
	}
}
