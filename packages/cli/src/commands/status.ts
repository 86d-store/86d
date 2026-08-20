import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
	c,
	detectActiveTemplate,
	findProjectRoot,
	heading,
	parseEnvFile,
	readJson,
	type TemplateConfig,
} from "../utils.js";

export function status() {
	const root = findProjectRoot();

	heading("86d project status");
	console.log();

	// 1. Project root
	console.log(`  ${c.dim("Root:")}      ${root}`);

	// 2. Active template
	const templatesDir = join(root, "templates");
	const activeTemplate = detectActiveTemplate(root);
	let templateConfig: TemplateConfig | undefined;

	if (activeTemplate) {
		templateConfig = readJson<TemplateConfig>(
			join(templatesDir, activeTemplate, "config.json"),
		);
		const themeName = templateConfig?.name ?? activeTemplate;
		console.log(
			`  ${c.dim("Template:")}  ${c.bold(activeTemplate)} ${c.dim(`— ${themeName}`)}`,
		);
	} else {
		console.log(`  ${c.dim("Template:")}  ${c.yellow("unknown")}`);
	}

	// 3. Modules
	const modulesDir = join(root, "modules");
	const allModules = existsSync(modulesDir)
		? readdirSync(modulesDir, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name)
				.sort()
		: [];

	const configModules = templateConfig?.modules;
	const enabledModules =
		configModules === "*"
			? allModules.map((m) => `@86d-app/${m}`)
			: (configModules ?? []);
	const enabledNames = new Set(
		enabledModules.map((m: string) => m.replace(/^@86d-app\//, "")),
	);
	const disabledModules = allModules.filter((m) => !enabledNames.has(m));

	console.log(
		`  ${c.dim("Modules:")}   ${c.green(`${enabledModules.length} enabled`)}${disabledModules.length > 0 ? `, ${c.yellow(`${disabledModules.length} available`)}` : ""}`,
	);

	// 4. Environment
	const envPath = join(root, ".env");
	if (existsSync(envPath)) {
		const vars = parseEnvFile(envPath);

		const required = ["DATABASE_URL", "STORE_ID", "BETTER_AUTH_SECRET"];
		const optional = [
			"RESEND_API_KEY",
			"NEXT_PUBLIC_STORE_URL",
			"NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID",
		];

		const missingRequired = required.filter(
			(k) =>
				!(k in vars) ||
				vars[k] === "" ||
				vars[k] === "change-me-to-a-random-string",
		);

		const setOptional = optional.filter((k) => k in vars && vars[k] !== "");

		if (missingRequired.length === 0) {
			console.log(
				`  ${c.dim("Env:")}       ${c.green("all required vars set")}`,
			);
		} else {
			console.log(
				`  ${c.dim("Env:")}       ${c.yellow(`missing: ${missingRequired.join(", ")}`)}`,
			);
		}

		if (setOptional.length > 0) {
			console.log(`  ${c.dim("Optional:")}  ${setOptional.join(", ")}`);
		}
	} else {
		console.log(
			`  ${c.dim("Env:")}       ${c.yellow("no .env file — run 86d init")}`,
		);
	}

	// 5. Dependencies
	const nodeModules = existsSync(join(root, "node_modules"));
	const lockFile =
		existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"));
	console.log(
		`  ${c.dim("Deps:")}      ${nodeModules ? c.green("installed") : c.yellow("not installed — run bun install")}${lockFile ? "" : ` ${c.dim("(no lockfile)")}`}`,
	);

	// 6. Disabled modules list
	if (disabledModules.length > 0) {
		console.log(`\n  ${c.dim("Available but not enabled:")}`);
		for (const mod of disabledModules) {
			console.log(`    ${c.dim("·")} ${mod}`);
		}
	}

	console.log();
}
