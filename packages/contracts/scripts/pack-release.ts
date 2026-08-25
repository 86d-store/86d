/**
 * Build a dist-only release tarball installable outside the workspace.
 * Workspace package.json keeps src exports and catalog: deps for monorepo DX;
 * this script stages a publish-shaped package.json so the pack never ships
 * catalog: protocols or src entry points (the failure mode that burned 0.0.42).
 */
import { createHash } from "node:crypto";
import {
	copyFileSync,
	cpSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const ZOD_VERSION = "4.4.3";
const root = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(root, "..");
const stageRoot = join(pkgRoot, ".release-pack");

const workspacePkg = JSON.parse(
	readFileSync(join(pkgRoot, "package.json"), "utf8"),
) as {
	name: string;
	version: string;
	description: string;
	homepage: string;
	repository: unknown;
	license: string;
	author: string;
	type: string;
	files: string[];
	publishConfig: {
		access: string;
		exports: Record<string, { types: string; default: string }>;
	};
};

await $`bun run build`.cwd(pkgRoot);

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stageRoot, { recursive: true });
cpSync(join(pkgRoot, "dist"), join(stageRoot, "dist"), { recursive: true });
copyFileSync(join(pkgRoot, "README.md"), join(stageRoot, "README.md"));

const releasePkg = {
	name: workspacePkg.name,
	version: workspacePkg.version,
	description: workspacePkg.description,
	homepage: workspacePkg.homepage,
	repository: workspacePkg.repository,
	license: workspacePkg.license,
	author: workspacePkg.author,
	type: workspacePkg.type,
	exports: workspacePkg.publishConfig.exports,
	files: ["dist", "README.md"],
	dependencies: {
		zod: ZOD_VERSION,
	},
	publishConfig: {
		access: workspacePkg.publishConfig.access,
	},
};

writeFileSync(
	join(stageRoot, "package.json"),
	`${JSON.stringify(releasePkg, null, "\t")}\n`,
	"utf8",
);

const packedName = await $`bun pm pack --quiet`.cwd(stageRoot).text();
const tarballName = packedName.trim();
if (!tarballName.endsWith(".tgz")) {
	throw new Error(`Unexpected pack output: ${packedName}`);
}

const stagedTarball = join(stageRoot, tarballName);
const destTarball = join(pkgRoot, tarballName);
copyFileSync(stagedTarball, destTarball);

const sha256 = createHash("sha256")
	.update(readFileSync(destTarball))
	.digest("hex");

const pkgJson = JSON.parse(
	readFileSync(join(stageRoot, "package.json"), "utf8"),
);
if (JSON.stringify(pkgJson).includes("catalog:")) {
	throw new Error(
		"Release pack package.json still contains catalog: protocols.",
	);
}
if (JSON.stringify(pkgJson.exports).includes("./src/")) {
	throw new Error("Release pack exports still point at ./src.");
}

process.stdout.write(
	`${destTarball}\nTARBALL_SHA256=${sha256}\nPACKAGE_VERSION=${workspacePkg.version}\n`,
);
