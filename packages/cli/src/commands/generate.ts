import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	error,
	findProjectRoot,
	heading,
	info,
	success,
	warn,
} from "../utils.js";

export function generate(args: string[]) {
	const subcommand = args[0];

	switch (subcommand) {
		case "modules":
			return runModuleGeneration();
		case "registry":
			return runRegistryGeneration();
		case "components":
		case "component-docs":
			return runComponentDocs();
		case "schema":
			return runSchemaCompile(args.slice(1));
		case "all":
		case undefined:
			runRegistryGeneration();
			runModuleGeneration();
			runComponentDocs();
			return;
		case "help":
		case "--help":
			return printHelp();
		default:
			error(`Unknown generate target: ${subcommand}`);
			printHelp();
			process.exit(1);
	}
}

function printHelp() {}

function getRunner(root: string): string {
	const tsxPath = join(root, "node_modules", ".bin", "tsx");
	return existsSync(tsxPath) ? tsxPath : "tsx";
}

function runScript(root: string, script: string, extraArgs: string[] = []) {
	execFileSync(getRunner(root), [script, ...extraArgs], {
		cwd: root,
		stdio: "inherit",
	});
}

function runModuleGeneration() {
	const root = findProjectRoot();
	const script = join(root, "internals/generators/src/generate-modules.ts");

	if (!existsSync(script)) {
		error("internals/generators/src/generate-modules.ts not found");
		process.exit(1);
	}

	heading("Generating module code");

	try {
		runScript(root, script);
		success("Module generation complete");
	} catch {
		error("Module generation failed");
		process.exit(1);
	}
}

function runRegistryGeneration() {
	const root = findProjectRoot();
	const script = join(root, "apps/registry/src/generate-manifest.ts");

	if (!existsSync(script)) {
		info("apps/registry/src/generate-manifest.ts not found, skipping");
		return;
	}

	heading("Generating registry manifest");

	try {
		runScript(root, script);
		success("Registry generation complete");
	} catch {
		warn("Registry generation failed (non-fatal)");
	}
}

function runComponentDocs() {
	const root = findProjectRoot();
	const script = join(
		root,
		"internals/generators/src/generate-component-docs.ts",
	);

	if (!existsSync(script)) {
		info(
			"internals/generators/src/generate-component-docs.ts not found, skipping",
		);
		return;
	}

	heading("Generating component documentation");

	try {
		runScript(root, script);
		success("Component docs generation complete");
	} catch {
		warn("Component docs generation failed (non-fatal)");
	}
}

function runSchemaCompile(extraArgs: string[]) {
	const root = findProjectRoot();
	const script = join(
		root,
		"internals/generators/src/compile-module-schema.ts",
	);

	if (!existsSync(script)) {
		error("internals/generators/src/compile-module-schema.ts not found");
		process.exit(1);
	}

	heading("Compiling Module schema DDL (report mode)");

	try {
		runScript(root, script, extraArgs);
		success("Schema compile report complete");
	} catch {
		error("Schema compile failed");
		process.exit(1);
	}
}
