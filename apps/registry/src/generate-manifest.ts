#!/usr/bin/env tsx

/**
 * Registry Manifest Generator
 *
 * Scans the modules/ directory and generates apps/registry/registry.json.
 * This manifest indexes all available modules for the git-based registry system.
 *
 * Module metadata comes from each Module's own declaration, loaded here, rather
 * than from patterns matched against its source. Maturity comes from the
 * Module's recorded evidence and is never inferred from package presence.
 *
 * Usage:
 *   bun run generate:registry
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Module } from "@86d-app/core/types/module";
import {
	buildManifest,
	type ModuleDeclarations,
} from "@86d-app/registry/manifest";
import { registryManifestPath } from "@86d-app/registry/paths";
import { workspaceRootFromImportMeta } from "../../../internals/lib/workspace-root.ts";

const WORKSPACE_ROOT = workspaceRootFromImportMeta(import.meta.url);
const OUTPUT_PATH = registryManifestPath(WORKSPACE_ROOT);
const MODULES_ROOT = join(WORKSPACE_ROOT, "modules");

/** The Module contract version the Store Runtime must understand. */
const MODULE_CONTRACT_VERSION = 1;

function resolveCommit(): string | undefined {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: WORKSPACE_ROOT,
			encoding: "utf-8",
		}).trim();
	} catch {
		return undefined;
	}
}

function assertTrackedSourceIsClean(): void {
	const changed = execFileSync(
		"git",
		[
			"status",
			"--porcelain",
			"--untracked-files=no",
			"--",
			"modules",
			"templates",
		],
		{
			cwd: WORKSPACE_ROOT,
			encoding: "utf-8",
		},
	).trim();

	if (changed) {
		throw new Error(
			"Refusing to pin registry entries to HEAD while tracked Module or template source differs from that commit. Commit the source first, then regenerate.",
		);
	}
}

function storeRuntimeVersion(): string | undefined {
	const pkgPath = join(WORKSPACE_ROOT, "package.json");
	if (!existsSync(pkgPath)) return undefined;
	try {
		return JSON.parse(readFileSync(pkgPath, "utf-8")).version as string;
	} catch {
		return undefined;
	}
}

/** Read what a Module declares by loading it, not by matching its source. */
async function loadDeclarations(): Promise<Record<string, ModuleDeclarations>> {
	const declarations: Record<string, ModuleDeclarations> = {};
	const names = readdirSync(MODULES_ROOT, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	for (const name of names) {
		const entry = join(MODULES_ROOT, name, "src", "index.ts");
		if (!existsSync(entry)) continue;
		try {
			const loaded = (await import(pathToFileURL(entry).href)) as {
				default?: (options?: unknown) => Module;
			};
			if (typeof loaded.default !== "function") continue;
			const mod = loaded.default({});

			declarations[name] = {
				id: mod.id,
				version: mod.version,
				category: mod.admin?.pages
					?.find((page) => page.group)
					?.group?.toLowerCase(),
				requires: Array.isArray(mod.requires)
					? mod.requires
					: Object.keys(mod.requires ?? {}),
				hasStorePages: (mod.store?.pages?.length ?? 0) > 0,
				providesCapabilities: (mod.capabilities?.provides ?? []).map(
					(provider) => ({
						name: provider.definition.name,
						owner: provider.definition.owner,
						versions: [provider.definition.version],
					}),
				),
				acceptsCapabilities: (mod.capabilities?.accepts ?? []).map(
					(acceptance) => ({
						name: acceptance.name,
						owner: acceptance.owner,
						versions: [...acceptance.versions],
					}),
				),
				emitsDurableEvents: (mod.durableEvents?.emits ?? []).map(
					(definition) => ({
						name: definition.name,
						owner: definition.owner,
						version: definition.version,
					}),
				),
				handlesDurableEvents: (mod.durableEvents?.handles ?? []).map(
					(consumer) => ({
						name: consumer.definition.name,
						owner: consumer.definition.owner,
						version: consumer.definition.version,
					}),
				),
			};
		} catch (error) {
			// A Module that cannot be loaded contributes no declarations. It still
			// appears in the manifest with its recorded maturity, which is
			// Experimental unless evidence says otherwise.
			console.warn(
				`  ! Could not load "${name}": ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return declarations;
}

assertTrackedSourceIsClean();
const commit = resolveCommit();
if (!commit) {
	throw new Error(
		"A resolved git commit is required to generate registry.json.",
	);
}
const storeRuntime = storeRuntimeVersion();
const declarations = await loadDeclarations();

const manifest = buildManifest(WORKSPACE_ROOT, {
	baseUrl: "https://github.com/86d-app/86d",
	defaultRef: "main",
	commit,
	...(storeRuntime
		? {
				storeRuntimeVersion: storeRuntime,
				moduleContractVersion: MODULE_CONTRACT_VERSION,
			}
		: {}),
	declarations,
});

const moduleCount = Object.keys(manifest.modules).length;
const templateCount = Object.keys(manifest.templates).length;
const byMaturity = Object.values(manifest.modules).reduce<
	Record<string, number>
>((totals, entry) => {
	totals[entry.maturity] = (totals[entry.maturity] ?? 0) + 1;
	return totals;
}, {});

writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, "\t")}\n`);
console.log(
	`✓ Generated registry.json with ${moduleCount} module(s) and ${templateCount} template(s)`,
);
console.log(`  commit: ${commit ?? "unresolved"}`);
console.log(
	`  maturity: ${Object.entries(byMaturity)
		.map(([level, count]) => `${level}=${count}`)
		.join(", ")}`,
);
