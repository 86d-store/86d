#!/usr/bin/env tsx
/**
 * verify-publish-packs.ts
 *
 * Packs representative publishable packages and asserts tarball hygiene:
 * - ships dist (JS + d.ts), not src / tooling / tests / .turbo
 * - package.json inside the tarball has no workspace:/catalog: protocols
 * - every exports / bin target exists in the tarball
 *
 * Run after `bun run prepare-publish` (rewritten manifests + built dist).
 */

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { workspaceRootFromImportMeta } from "../../lib/workspace-root.ts";

const ROOT = workspaceRootFromImportMeta(import.meta.url);

type Sample = {
	dir: string;
	/** Paths that must never appear in the tarball (substring match). */
	forbidden: string[];
};

const SAMPLES: Sample[] = [
	{
		dir: "modules/stripe",
		forbidden: [
			".turbo",
			"vitest.config",
			"AGENTS.md",
			"__tests__",
			".test.ts",
			".test.tsx",
			".test.js",
			"tsconfig.json",
			"package/src/",
		],
	},
	{
		dir: "packages/core",
		forbidden: [
			".turbo",
			"vitest.config",
			"AGENTS.md",
			"__tests__",
			".test.ts",
			".test.tsx",
			".test.js",
			"tsconfig.json",
			"package/src/",
		],
	},
	{
		dir: "packages/contracts",
		forbidden: [
			".turbo",
			"vitest.config",
			"AGENTS.md",
			"__tests__",
			".test.ts",
			".test.js",
			"tsconfig.json",
			"package/src/",
		],
	},
	{
		dir: "packages/registry",
		forbidden: [
			".turbo",
			"vitest.config",
			"AGENTS.md",
			"__tests__",
			".test.ts",
			".test.js",
			"tsconfig.json",
			"package/src/",
		],
	},
	{
		dir: "packages/storage",
		forbidden: [
			".turbo",
			"vitest.config",
			"AGENTS.md",
			"__tests__",
			".test.ts",
			".test.js",
			"tsconfig.json",
			"package/src/",
		],
	},
	{
		dir: "packages/ui",
		forbidden: [
			".turbo",
			"vitest.config",
			"AGENTS.md",
			"__tests__",
			".test.ts",
			".test.tsx",
			".test.js",
			"tsconfig.json",
			"package/src/",
		],
	},
	{
		dir: "packages/cli",
		forbidden: [
			".turbo",
			"vitest.config",
			"AGENTS.md",
			"__tests__",
			".test.ts",
			".test.js",
			"tsconfig.json",
			"package/src/",
		],
	},
];

function containsProtocol(value: unknown): boolean {
	if (typeof value === "string") {
		return (
			value.startsWith("workspace:") ||
			value === "catalog:" ||
			value.startsWith("catalog:")
		);
	}
	if (!value || typeof value !== "object") return false;
	return Object.values(value as Record<string, unknown>).some(containsProtocol);
}

function collectExportTargets(exportsField: unknown, targets: string[]): void {
	if (typeof exportsField === "string") {
		if (exportsField.startsWith("./")) targets.push(exportsField.slice(2));
		return;
	}
	if (!exportsField || typeof exportsField !== "object") return;
	for (const value of Object.values(exportsField as Record<string, unknown>)) {
		if (typeof value === "string") {
			if (value.startsWith("./")) targets.push(value.slice(2));
			continue;
		}
		if (value && typeof value === "object") {
			const entry = value as {
				types?: string;
				default?: string;
				import?: string;
			};
			for (const key of ["types", "default", "import"] as const) {
				const path = entry[key];
				if (typeof path === "string" && path.startsWith("./")) {
					targets.push(path.slice(2));
				}
			}
			collectExportTargets(value, targets);
		}
	}
}

function listTarball(tgzPath: string): string[] {
	const out = execFileSync("tar", ["-tzf", tgzPath], { encoding: "utf8" });
	return out
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

function packPackage(absDir: string, outDir: string): string {
	const packed = execFileSync("npm", ["pack", "--pack-destination", outDir], {
		cwd: absDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	})
		.trim()
		.split("\n")
		.filter(Boolean)
		.at(-1);
	if (!packed) {
		throw new Error(`npm pack produced no tarball in ${absDir}`);
	}
	const tgzPath = join(outDir, basename(packed));
	if (!existsSync(tgzPath)) {
		throw new Error(`Expected tarball at ${tgzPath}`);
	}
	return tgzPath;
}

function assertSample(sample: Sample, staging: string): void {
	const absDir = join(ROOT, sample.dir);
	if (!existsSync(join(absDir, "package.json"))) {
		throw new Error(`Missing package at ${sample.dir}`);
	}
	if (!existsSync(join(absDir, "dist"))) {
		throw new Error(
			`${sample.dir}: missing dist/ — build before verify-publish-packs`,
		);
	}

	const tgzPath = packPackage(absDir, staging);
	const entries = listTarball(tgzPath);
	const relEntries = entries.map((e) => e.replace(/^package\//, ""));

	for (const needle of sample.forbidden) {
		const hit = entries.find((e) => e.includes(needle));
		if (hit) {
			throw new Error(
				`${sample.dir}: forbidden path in tarball: ${hit} (matched "${needle}")`,
			);
		}
	}

	const hasDist = entries.some(
		(e) => e.includes("/dist/") || e === "package/dist",
	);
	if (!hasDist) {
		throw new Error(`${sample.dir}: tarball has no dist/ contents`);
	}

	const extractRoot = join(staging, `${basename(sample.dir)}-pkg`);
	rmSync(extractRoot, { recursive: true, force: true });
	execFileSync("mkdir", ["-p", extractRoot]);
	execFileSync("tar", ["-xzf", tgzPath, "-C", extractRoot]);
	const pkgPath = join(extractRoot, "package", "package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
		dependencies?: unknown;
		devDependencies?: unknown;
		peerDependencies?: unknown;
		optionalDependencies?: unknown;
		exports?: unknown;
		bin?: unknown;
		files?: unknown;
	};

	if (
		containsProtocol(pkg.dependencies) ||
		containsProtocol(pkg.devDependencies) ||
		containsProtocol(pkg.peerDependencies) ||
		containsProtocol(pkg.optionalDependencies)
	) {
		throw new Error(
			`${sample.dir}: packed package.json still contains workspace:/catalog: protocols`,
		);
	}

	const files = pkg.files;
	if (Array.isArray(files) && files.includes("src")) {
		throw new Error(`${sample.dir}: packed files still includes src`);
	}

	const targets: string[] = [];
	collectExportTargets(pkg.exports, targets);
	if (typeof pkg.bin === "string") {
		targets.push(pkg.bin.startsWith("./") ? pkg.bin.slice(2) : pkg.bin);
	} else if (pkg.bin && typeof pkg.bin === "object") {
		for (const binPath of Object.values(pkg.bin as Record<string, string>)) {
			targets.push(binPath.startsWith("./") ? binPath.slice(2) : binPath);
		}
	}

	const entrySet = new Set(relEntries);
	for (const target of new Set(targets)) {
		if (target.includes("*")) continue;
		if (target.startsWith("src/")) {
			throw new Error(
				`${sample.dir}: packed exports still point at source: ${target}`,
			);
		}
		const present =
			entrySet.has(target) ||
			relEntries.some((e) => e === target || e.startsWith(`${target}/`));
		if (!present) {
			throw new Error(
				`${sample.dir}: exports/bin target missing from tarball: ${target}`,
			);
		}
	}

	console.log(
		`✓ ${sample.dir}: ${entries.length} files, dist exports ok, no protocols`,
	);
	rmSync(extractRoot, { recursive: true, force: true });
}

function main(): void {
	const staging = mkdtempSync(join(tmpdir(), "86d-verify-packs-"));
	writeFileSync(join(staging, ".keep"), "");
	try {
		for (const sample of SAMPLES) {
			assertSample(sample, staging);
		}
		console.log(
			`Verified ${SAMPLES.length} publish packs (${SAMPLES.map((s) => s.dir).join(", ")}).`,
		);
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
}

main();
