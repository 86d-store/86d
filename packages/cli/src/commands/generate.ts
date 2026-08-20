import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	c,
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
		case "backfill-report":
			return runBackfillReport();
		case "money-report":
			return runMoneyReport();
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
			console.log();
			printHelp();
			process.exit(1);
	}
}

function printHelp() {
	console.log(`
${c.bold("86d generate")} — Run code generation

${c.dim("Usage:")}
  86d generate               Run all generators
  86d generate modules       Generate module imports, API router, client, hooks
  86d generate registry      Generate registry.json manifest
  86d generate schema        Compile Module DDL report (stdout, report mode only)
  86d generate backfill-report  Backfill ModuleData into shadow tables (disposable DB only)
  86d generate money-report     Money invariant report from orders/payments JSON
  86d generate components    Generate component documentation
`);
}

function getRunner(root: string): string {
	const tsxPath = join(root, "node_modules", ".bin", "tsx");
	return existsSync(tsxPath) ? tsxPath : "tsx";
}

function runModuleGeneration() {
	const root = findProjectRoot();
	const script = join(root, "internals/generators/src/generate-modules.ts");

	if (!existsSync(script)) {
		error("internals/generators/src/generate-modules.ts not found");
		process.exit(1);
	}

	heading("Generating module code");
	console.log();

	try {
		execSync(`${getRunner(root)} ${script}`, {
			cwd: root,
			stdio: "inherit",
		});
		console.log();
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
	console.log();

	try {
		execSync(`${getRunner(root)} ${script}`, {
			cwd: root,
			stdio: "inherit",
		});
		console.log();
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
	console.log();

	try {
		execSync(`${getRunner(root)} ${script}`, {
			cwd: root,
			stdio: "inherit",
		});
		console.log();
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
	console.log();

	try {
		execSync(`${getRunner(root)} ${script} ${extraArgs.join(" ")}`.trim(), {
			cwd: root,
			stdio: "inherit",
		});
		console.log();
		success("Schema compile report complete");
	} catch {
		error("Schema compile failed");
		process.exit(1);
	}
}

function runBackfillReport() {
	const root = findProjectRoot();
	const script = join(root, "internals/generators/src/backfill-report.ts");

	if (!existsSync(script)) {
		error("internals/generators/src/backfill-report.ts not found");
		process.exit(1);
	}

	heading("Backfill ModuleData into shadow tables");
	console.log();

	try {
		execSync(`${getRunner(root)} ${script}`, {
			cwd: root,
			stdio: "inherit",
		});
		console.log();
		success("Backfill report complete");
	} catch {
		error("Backfill report failed");
		process.exit(1);
	}
}

function runMoneyReport() {
	const root = findProjectRoot();
	const script = join(root, "internals/generators/src/money-report.ts");

	if (!existsSync(script)) {
		error("internals/generators/src/money-report.ts not found");
		process.exit(1);
	}

	heading("Money invariant report");
	console.log();

	try {
		execSync(`${getRunner(root)} ${script}`, {
			cwd: root,
			stdio: "inherit",
		});
		console.log();
		success("Money report complete");
	} catch {
		error("Money report failed");
		process.exit(1);
	}
}
