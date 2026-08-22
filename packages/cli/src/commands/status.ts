import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
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

	// 2. Active template
	const templatesDir = join(root, "templates");
	const activeTemplate = detectActiveTemplate(root);
	let templateConfig: TemplateConfig | undefined;

	if (activeTemplate) {
		templateConfig = readJson<TemplateConfig>(
			join(templatesDir, activeTemplate, "config.json"),
		);
		const _themeName = templateConfig?.name ?? activeTemplate;
	} else {
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
		} else {
		}

		if (setOptional.length > 0) {
		}
	} else {
	}

	// 5. Dependencies
	const _nodeModules = existsSync(join(root, "node_modules"));
	const _lockFile =
		existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"));

	// 6. Disabled modules list
	if (disabledModules.length > 0) {
		for (const _mod of disabledModules) {
		}
	}
}
