import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computeIntegrity, fetchModule } from "@86d-app/registry/fetcher";
import { registryManifestPath } from "@86d-app/registry/paths";
import {
	getLocalModuleNames,
	getModuleDependencies,
	readLocalManifest,
} from "@86d-app/registry/resolver";
import { parseSpecifier } from "@86d-app/registry/specifier";
import type { RegistryManifest, RegistryModule } from "@86d-app/registry/types";
import {
	c,
	error,
	findProjectRoot,
	getTemplateConfigPath,
	heading,
	info,
	readJson,
	success,
	type TemplateConfig,
	warn,
	writeLine,
} from "../utils.js";

export function moduleCommand(subcommand: string | undefined, args: string[]) {
	switch (subcommand) {
		case "create":
			return createModule(args[0]);
		case "add":
		case "install":
			return addModule(args[0]);
		case "update":
		case "upgrade":
			return updateModules(args[0]);
		case "list":
		case "ls":
			return listModules();
		case "search":
			return searchRegistry(args[0]);
		case "info":
			return moduleInfo(args[0]);
		case "enable":
			return enableModule(args[0]);
		case "disable":
			return disableModule(args[0]);
		case "help":
		case "--help":
		case undefined:
			return printHelp();
		default:
			error(`Unknown subcommand: ${subcommand}`);
			writeLine();
			printHelp();
			process.exit(1);
	}
}

function printHelp() {
	writeLine(`
${c.bold("86d module")} — Manage modules

${c.dim("Usage:")}
  86d module create <name>           Scaffold a new module
  86d module add <specifier>         Add a module from registry, GitHub, or npm
  86d module update [name]           Check for and apply module updates
  86d module list                    List all local modules
  86d module search [query]          Search the registry for modules
  86d module info <name>             Show module details
  86d module enable <name>           Enable a module in the active template
  86d module disable <name>          Disable a module in the active template

${c.dim("Module specifiers (for 'add'):")}
  products                           Official module (short name)
  @86d-app/products                  Official module (full name)
  github:owner/repo/modules/name    GitHub repository module
  npm:@scope/package                 npm package
`);
}

// ── Registry Helpers ──────────────────────────────────────────────────

function loadManifest(root: string): RegistryManifest | undefined {
	return readLocalManifest(registryManifestPath(root));
}

// ── Add Module ────────────────────────────────────────────────────────

async function addModule(specifier: string | undefined) {
	if (!specifier) {
		error("Module specifier is required.");
		writeLine(`\n  Usage: 86d module add <specifier>`);
		writeLine(`  Examples:`);
		writeLine(`    ${c.dim("86d module add products")}`);
		writeLine(
			`    ${c.dim("86d module add github:owner/repo/modules/loyalty")}`,
		);
		writeLine(`    ${c.dim("86d module add npm:@acme/commerce-module")}`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const manifest = loadManifest(root);

	// Parse the specifier using the registry package
	const spec = parseSpecifier(specifier);

	heading(`Adding module: ${spec.packageName}`);
	writeLine();

	// Check if already installed locally
	const localDir = join(root, "modules", spec.name);
	if (existsSync(join(localDir, "package.json"))) {
		info(`Module "${spec.name}" already exists locally`);
		enableModule(spec.name);
		return;
	}

	// Fetch the module using the registry package
	info(`Fetching ${spec.packageName} (source: ${spec.source})...`);
	const result = await fetchModule(spec, root, manifest);

	if (!result.success) {
		error(`Failed to add module: ${result.error}`);

		if (spec.source === "registry") {
			writeLine(
				`\n  Try: ${c.bold(`86d module create ${spec.name}`)} to scaffold a new module.`,
			);
		}
		process.exit(1);
	}

	success(`Downloaded module to ${result.localPath}`);

	// Check for required dependencies and auto-install them
	const deps = getModuleDependencies(spec.name, manifest);
	if (deps.length > 0) {
		const missingDeps = deps.filter(
			(dep) => !existsSync(join(root, "modules", dep, "package.json")),
		);

		if (missingDeps.length > 0) {
			writeLine();
			info(
				`${spec.name} requires: ${missingDeps.map((d) => c.cyan(d)).join(", ")}`,
			);
			info("Installing required dependencies...");

			for (const dep of missingDeps) {
				const depSpec = parseSpecifier(dep);
				info(`  ↓ Fetching ${depSpec.packageName}...`);
				const depResult = await fetchModule(depSpec, root, manifest);
				if (depResult.success) {
					success(`  ✓ ${depSpec.packageName}`);
				} else {
					warn(
						`  Failed to fetch ${depSpec.packageName}: ${depResult.error ?? "unknown error"}`,
					);
				}
			}
		}
	}

	// Install node dependencies
	info("Installing dependencies...");
	try {
		execSync("bun install", { cwd: root, stdio: "pipe" });
	} catch {
		warn("Failed to install dependencies — run 'bun install' manually");
	}

	success(`Added ${c.bold(spec.packageName)}`);

	// Enable in template config
	enableModule(spec.name);

	writeLine(`\n  Run ${c.bold("86d generate")} to update generated code.\n`);
}

// ── Update Modules ────────────────────────────────────────────────────

async function updateModules(name: string | undefined) {
	const root = findProjectRoot();
	const manifest = loadManifest(root);

	if (!manifest) {
		error("No registry.json found. Run 'bun run generate:registry' first.");
		process.exit(1);
	}

	const localModules = getLocalModuleNames(root);

	// If a specific module is given, only check that one
	const targets = name ? [name.replace(/^@86d-app\//, "")] : localModules;

	heading(`Checking for updates${name ? ` (${name})` : ""}`);
	writeLine();

	const outdated: Array<{
		name: string;
		localVersion: string;
		registryVersion: string;
		integrityChanged: boolean;
	}> = [];

	for (const moduleName of targets) {
		const registryEntry = manifest.modules[moduleName];
		if (!registryEntry) continue; // Not in registry (custom module)

		const moduleDir = join(root, "modules", moduleName);
		const pkgPath = join(moduleDir, "package.json");
		if (!existsSync(pkgPath)) continue;

		const pkg = readJson<{ version?: string }>(pkgPath);
		const localVersion = pkg?.version ?? "0.0.0";

		// Check version difference
		const versionChanged = localVersion !== registryEntry.version;

		// Check integrity
		const localIntegrity = computeIntegrity(moduleDir);
		const integrityChanged =
			registryEntry.integrity !== undefined &&
			localIntegrity !== undefined &&
			localIntegrity !== registryEntry.integrity;

		if (versionChanged || integrityChanged) {
			outdated.push({
				name: moduleName,
				localVersion,
				registryVersion: registryEntry.version,
				integrityChanged,
			});
		}
	}

	if (outdated.length === 0) {
		success("All modules are up to date");
		return;
	}

	writeLine(
		`  ${c.yellow(`${outdated.length} module(s) have updates available:`)}`,
	);
	writeLine();

	for (const mod of outdated) {
		const versionInfo =
			mod.localVersion !== mod.registryVersion
				? `${c.dim(mod.localVersion)} → ${c.green(mod.registryVersion)}`
				: c.dim(mod.localVersion);
		const integrityTag = mod.integrityChanged
			? c.yellow(" (content changed)")
			: "";
		writeLine(
			`  ${c.bold(`@86d-app/${mod.name}`)} ${versionInfo}${integrityTag}`,
		);
	}

	writeLine();
	info(
		`To update, run: ${c.bold("86d module add <name>")} for each module above`,
	);
	writeLine();
}

// ── Search Registry ───────────────────────────────────────────────────

function searchRegistry(query: string | undefined) {
	const root = findProjectRoot();
	const manifest = loadManifest(root);

	if (!manifest?.modules) {
		error("No registry.json found. Run 'bun run generate:registry' first.");
		process.exit(1);
	}

	const entries = Object.entries(manifest.modules);
	const filtered = query
		? entries.filter(
				([name, mod]) =>
					name.includes(query) ||
					mod.description.toLowerCase().includes(query.toLowerCase()) ||
					mod.category.toLowerCase().includes(query.toLowerCase()),
			)
		: entries;

	heading(
		`Registry modules${query ? ` matching "${query}"` : ""} (${filtered.length})`,
	);
	writeLine();

	// Group by category
	const grouped: Record<string, Array<[string, RegistryModule]>> = {};
	for (const entry of filtered) {
		const cat = entry[1].category;
		if (!grouped[cat]) grouped[cat] = [];
		grouped[cat].push(entry);
	}

	const localModules = new Set(getLocalModuleNames(root));

	for (const [category, mods] of Object.entries(grouped).sort((a, b) =>
		a[0].localeCompare(b[0]),
	)) {
		writeLine(
			`  ${c.bold(category.charAt(0).toUpperCase() + category.slice(1))}`,
		);
		for (const [name, mod] of mods) {
			const installed = localModules.has(name);
			const status = installed ? c.green(" ●") : c.dim(" ○");
			writeLine(
				`  ${status} ${c.cyan(name)} ${c.dim(`v${mod.version}`)} — ${c.dim(mod.description.slice(0, 60))}`,
			);
		}
		writeLine();
	}
}

// ── List Modules ──────────────────────────────────────────────────────

function listModules() {
	const root = findProjectRoot();
	const modulesDir = join(root, "modules");

	if (!existsSync(modulesDir)) {
		warn("No modules directory found.");
		return;
	}

	const modules = getLocalModuleNames(root);
	const manifest = loadManifest(root);

	heading(`Local modules (${modules.length})`);
	writeLine();

	for (const mod of modules) {
		const pkg = readJson<{ version?: string }>(
			join(modulesDir, mod, "package.json"),
		);
		const version = pkg?.version ? c.dim(` v${pkg.version}`) : "";
		const hasComponents = existsSync(
			join(modulesDir, mod, "src/store/components/mdx.tsx"),
		);
		const hasAdmin = existsSync(
			join(modulesDir, mod, "src/admin/endpoints/routes.ts"),
		);

		const tags: string[] = [];
		if (hasComponents) tags.push(c.cyan("components"));
		if (hasAdmin) tags.push(c.yellow("admin"));

		// Add registry metadata if available
		const registryEntry = manifest?.modules[mod];
		if (registryEntry?.category) {
			tags.push(c.dim(registryEntry.category));
		}

		const tagStr =
			tags.length > 0
				? `  ${c.dim("[")}${tags.join(c.dim(", "))}${c.dim("]")}`
				: "";

		writeLine(`  ${c.bold(`@86d-app/${mod}`)}${version}${tagStr}`);
	}
	writeLine();
}

// ── Module Info ───────────────────────────────────────────────────────

function moduleInfo(name: string | undefined) {
	if (!name) {
		error("Module name is required.");
		writeLine(`\n  Usage: 86d module info <name>`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const moduleName = name.replace(/^@86d-app\//, "");
	const moduleDir = join(root, "modules", moduleName);

	// Check registry first if not installed locally
	if (!existsSync(moduleDir)) {
		const manifest = loadManifest(root);
		const entry = manifest?.modules[moduleName];
		if (entry) {
			heading(`@86d-app/${moduleName} ${c.dim("(not installed)")}`);
			writeLine();
			writeLine(`  ${c.dim("Version:")}     ${entry.version}`);
			writeLine(`  ${c.dim("Category:")}    ${entry.category}`);
			writeLine(`  ${c.dim("Description:")} ${entry.description}`);
			if (entry.requires.length > 0) {
				writeLine(`  ${c.dim("Requires:")}    ${entry.requires.join(", ")}`);
			}
			writeLine(
				`  ${c.dim("Components:")}  store: ${entry.hasStoreComponents ? c.green("yes") : c.dim("no")}, admin: ${entry.hasAdminComponents ? c.green("yes") : c.dim("no")}`,
			);
			writeLine(
				`\n  Install with: ${c.bold(`86d module add ${moduleName}`)}\n`,
			);
			return;
		}

		error(`Module "${moduleName}" not found locally or in registry`);
		process.exit(1);
	}

	const pkg = readJson<{
		name?: string;
		version?: string;
		dependencies?: Record<string, string>;
	}>(join(moduleDir, "package.json"));

	const manifest = loadManifest(root);
	const registryEntry = manifest?.modules[moduleName];

	heading(`@86d-app/${moduleName}`);
	writeLine();

	if (pkg?.version) {
		writeLine(`  ${c.dim("Version:")}  ${pkg.version}`);
	}

	if (registryEntry?.category) {
		writeLine(`  ${c.dim("Category:")} ${registryEntry.category}`);
	}

	// Read module ID from index.ts
	const indexPath = join(moduleDir, "src/index.ts");
	if (existsSync(indexPath)) {
		const indexContent = readFileSync(indexPath, "utf-8");
		const idMatch = indexContent.match(/id:\s*"([^"]+)"/);
		if (idMatch) {
			writeLine(`  ${c.dim("ID:")}       ${idMatch[1]}`);
		}
	}

	// Count endpoints
	const storeEndpointsPath = join(moduleDir, "src/store/endpoints/routes.ts");
	const adminEndpointsPath = join(moduleDir, "src/admin/endpoints/routes.ts");
	const storeCount = countEndpoints(storeEndpointsPath);
	const adminCount = countEndpoints(adminEndpointsPath);
	writeLine(
		`  ${c.dim("Endpoints:")} ${storeCount} store, ${adminCount} admin`,
	);

	// Check for components
	const storeComponents = existsSync(
		join(moduleDir, "src/store/components/mdx.tsx"),
	);
	const adminComponents = existsSync(join(moduleDir, "src/admin/components"));
	writeLine(
		`  ${c.dim("Components:")} ${storeComponents ? c.green("store") : c.dim("none")}${adminComponents ? `, ${c.green("admin")}` : ""}`,
	);

	if (registryEntry?.requires && registryEntry.requires.length > 0) {
		writeLine(`  ${c.dim("Requires:")}   ${registryEntry.requires.join(", ")}`);
	}

	// Check for tests
	const hasTests =
		existsSync(join(moduleDir, "src/__tests__")) ||
		existsSync(join(moduleDir, "src/tests"));
	writeLine(
		`  ${c.dim("Tests:")}     ${hasTests ? c.green("yes") : c.dim("none")}`,
	);

	// List store endpoint paths
	if (storeCount > 0 && existsSync(storeEndpointsPath)) {
		writeLine(`\n  ${c.dim("Store endpoints:")}`);
		listEndpointPaths(storeEndpointsPath, "  ");
	}

	if (adminCount > 0 && existsSync(adminEndpointsPath)) {
		writeLine(`\n  ${c.dim("Admin endpoints:")}`);
		listEndpointPaths(adminEndpointsPath, "  ");
	}

	writeLine();
}

function countEndpoints(filePath: string): number {
	if (!existsSync(filePath)) return 0;
	const content = readFileSync(filePath, "utf-8");
	const matches = content.match(/"\/[^"]+"/g);
	return matches?.length ?? 0;
}

function listEndpointPaths(filePath: string, indent: string) {
	const content = readFileSync(filePath, "utf-8");
	const paths = content.match(/"(\/[^"]+)"/g);
	if (!paths) return;
	for (const raw of paths) {
		const path = raw.slice(1, -1);
		writeLine(`${indent}  ${c.cyan(path)}`);
	}
}

// ── Enable/Disable ───────────────────────────────────────────────────

function enableModule(name: string | undefined) {
	if (!name) {
		error("Module name is required.");
		writeLine(`\n  Usage: 86d module enable <name>`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const moduleName = name.replace(/^@86d-app\//, "");
	const moduleDir = join(root, "modules", moduleName);
	const fullName = `@86d-app/${moduleName}`;

	if (!existsSync(moduleDir)) {
		error(`Module "${moduleName}" not found at ${moduleDir}`);
		process.exit(1);
	}

	const configPath = getTemplateConfigPath(root);
	if (!configPath) {
		error("Could not find active template config.json");
		process.exit(1);
	}

	const config = readJson<TemplateConfig>(configPath);
	if (!config) {
		error(`Could not read ${configPath}`);
		process.exit(1);
	}

	// When modules is "*", all modules are already enabled
	if (config.modules === "*") {
		info(`Config uses "*" (all modules) — ${fullName} is already included`);
		return;
	}

	const modules = config.modules ?? [];
	if (modules.includes(fullName)) {
		warn(`${fullName} is already enabled`);
		return;
	}

	modules.push(fullName);
	config.modules = modules;
	writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
	success(`Enabled ${c.bold(fullName)}`);
	writeLine(`\n  Run ${c.bold("86d generate")} to update generated code.\n`);
}

function disableModule(name: string | undefined) {
	if (!name) {
		error("Module name is required.");
		writeLine(`\n  Usage: 86d module disable <name>`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const moduleName = name.replace(/^@86d-app\//, "");
	const fullName = `@86d-app/${moduleName}`;

	const configPath = getTemplateConfigPath(root);
	if (!configPath) {
		error("Could not find active template config.json");
		process.exit(1);
	}

	const config = readJson<TemplateConfig>(configPath);
	if (!config) {
		error(`Could not read ${configPath}`);
		process.exit(1);
	}

	// When modules is "*", convert to explicit list minus the disabled module
	if (config.modules === "*") {
		const allModules = getLocalModuleNames(root)
			.map((d) => `@86d-app/${d}`)
			.filter((m) => m !== fullName);

		config.modules = allModules;
		writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
		success(`Disabled ${c.bold(fullName)} (converted "*" to explicit list)`);
		writeLine(`\n  Run ${c.bold("86d generate")} to update generated code.\n`);
		return;
	}

	const modules = config.modules ?? [];
	const idx = modules.indexOf(fullName);
	if (idx === -1) {
		warn(`${fullName} is not currently enabled`);
		return;
	}

	modules.splice(idx, 1);
	config.modules = modules;
	writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
	success(`Disabled ${c.bold(fullName)}`);
	writeLine(`\n  Run ${c.bold("86d generate")} to update generated code.\n`);
}

// ── Create Module ─────────────────────────────────────────────────────

function createModule(name: string | undefined) {
	if (!name) {
		error("Module name is required.");
		writeLine(`\n  Usage: 86d module create <name>`);
		writeLine(`  Example: ${c.dim("86d module create loyalty-points")}`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const modulesDir = join(root, "modules");

	// Normalize: strip @86d-app/ prefix if provided
	const moduleName = name.replace(/^@86d-app\//, "");
	const moduleDir = join(modulesDir, moduleName);

	if (existsSync(moduleDir)) {
		error(`Module "${moduleName}" already exists at ${moduleDir}`);
		process.exit(1);
	}

	heading(`Creating @86d-app/${moduleName}`);
	writeLine();

	// Create directory structure
	const dirs = [
		moduleDir,
		join(moduleDir, "src"),
		join(moduleDir, "src/store"),
		join(moduleDir, "src/store/components"),
		join(moduleDir, "src/store/endpoints"),
		join(moduleDir, "src/admin"),
		join(moduleDir, "src/admin/components"),
		join(moduleDir, "src/admin/endpoints"),
		join(moduleDir, "src/__tests__"),
	];

	for (const dir of dirs) {
		mkdirSync(dir, { recursive: true });
	}

	// package.json
	writeFileSync(
		join(moduleDir, "package.json"),
		JSON.stringify(
			{
				name: `@86d-app/${moduleName}`,
				version: "0.0.1",
				private: true,
				type: "module",
				exports: {
					".": "./src/index.ts",
					"./components": "./src/store/components/mdx.tsx",
				},
				scripts: {
					build: "tsc",
					check: "biome check src",
					"check:fix": "biome check --write src",
					test: "vitest run",
					"test:watch": "vitest watch",
					typecheck: "tsc --noEmit --emitDeclarationOnly false",
				},
				dependencies: {
					"@86d-app/core": "workspace:*",
				},
				devDependencies: {
					"@biomejs/biome": "catalog:",
					typescript: "catalog:",
					vitest: "catalog:vite",
				},
			},
			null,
			"\t",
		),
	);

	// tsconfig.json
	writeFileSync(
		join(moduleDir, "tsconfig.json"),
		JSON.stringify(
			{
				extends: "../../tsconfig.base.json",
				compilerOptions: {},
				include: ["src"],
				exclude: ["node_modules"],
			},
			null,
			"\t",
		),
	);

	// Module entry point
	writeFileSync(
		join(moduleDir, "src/index.ts"),
		`import type { Module } from "@86d-app/core/types/module";
import { schema } from "./schema.js";
import { storeEndpoints } from "./store/endpoints/routes.js";
import { adminEndpoints } from "./admin/endpoints/routes.js";

export default function ${toCamelCase(moduleName)}(
	options: Record<string, unknown> = {},
): Module {
	return {
		id: "${moduleName}",
		version: "0.0.1",
		schema,
		options,
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
	};
}
`,
	);

	// Schema
	writeFileSync(
		join(moduleDir, "src/schema.ts"),
		`import { z } from "@86d-app/core/zod";

export const schema = z.object({
	// Define your module's data schema here
});

export type ${toPascalCase(moduleName)}Data = z.infer<typeof schema>;
`,
	);

	// Store endpoints
	writeFileSync(
		join(moduleDir, "src/store/endpoints/routes.ts"),
		`// Store (public) endpoints for ${moduleName}
// biome-ignore lint/suspicious/noExplicitAny: endpoint map
export const storeEndpoints: Record<string, any> = {};
`,
	);

	// Admin endpoints
	writeFileSync(
		join(moduleDir, "src/admin/endpoints/routes.ts"),
		`// Admin (protected) endpoints for ${moduleName}
// biome-ignore lint/suspicious/noExplicitAny: endpoint map
export const adminEndpoints: Record<string, any> = {};
`,
	);

	// Store components
	writeFileSync(
		join(moduleDir, "src/store/components/mdx.tsx"),
		`import type { MDXComponents } from "mdx/types";

const components = {} satisfies MDXComponents;

export default components;
`,
	);

	// Admin components
	// Admin page components live in one file each, named for the component. The
	// generator resolves them by scanning this directory — there is no barrel.
	writeFileSync(join(moduleDir, "src/admin/components/.gitkeep"), "");

	// MDX type declarations
	writeFileSync(
		join(moduleDir, "src/mdx.d.ts"),
		`declare module "*.mdx" {
	import type { ComponentType } from "react";
	const component: ComponentType<Record<string, unknown>>;
	export default component;
}
`,
	);

	// Basic test file
	writeFileSync(
		join(moduleDir, "src/__tests__/index.test.ts"),
		`import { describe, expect, it } from "vitest";
import ${toCamelCase(moduleName)} from "../index.js";

describe("${moduleName}", () => {
	it("creates a module with correct id", () => {
		const mod = ${toCamelCase(moduleName)}();
		expect(mod.id).toBe("${moduleName}");
	});

	it("creates a module with version", () => {
		const mod = ${toCamelCase(moduleName)}();
		expect(mod.version).toBe("0.0.1");
	});
});
`,
	);

	success(`Created ${dirs.length} directories`);
	success(
		"Created module entry point, schema, endpoints, components, and test",
	);

	writeLine(`\n  Next steps:`);
	writeLine(
		`  ${c.dim("1.")} Implement your schema, controllers, and endpoints`,
	);
	writeLine(
		`  ${c.dim("2.")} Run: ${c.bold(`86d module enable ${moduleName}`)}`,
	);
	writeLine(`  ${c.dim("3.")} Run: ${c.bold("86d generate")}`);
	writeLine();
}

// ── Helpers ───────────────────────────────────────────────────────────

function toCamelCase(name: string): string {
	return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascalCase(name: string): string {
	const camel = toCamelCase(name);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}
