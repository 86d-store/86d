import {
	cpSync,
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { registryManifestPath } from "@86d-app/registry/paths";
import { readLocalManifest } from "@86d-app/registry/resolver";
import { parseSpecifier } from "@86d-app/registry/specifier";
import { fetchTemplate } from "@86d-app/registry/template";
import type { RegistryManifest } from "@86d-app/registry/types";
import {
	c,
	detectActiveTemplate,
	error,
	findProjectRoot,
	heading,
	info,
	readJson,
	success,
	warn,
} from "../utils.js";

const BASE_TEMPLATE = "brisa";

export function templateCommand(
	subcommand: string | undefined,
	args: string[],
) {
	switch (subcommand) {
		case "create":
			return createTemplate(args[0]);
		case "add":
		case "install":
			return addTemplate(args[0]);
		case "remove":
		case "rm":
			return removeTemplate(args[0]);
		case "activate":
		case "use":
			return activateTemplate(args[0]);
		case "list":
		case "ls":
			return listTemplates();
		case "help":
		case "--help":
		case undefined:
			return printHelp();
		default:
			error(`Unknown subcommand: ${subcommand}`);
			console.log();
			printHelp();
			process.exit(1);
	}
}

function printHelp() {
	console.log(`
${c.bold("86d template")} — Manage templates

${c.dim("Usage:")}
  86d template create <name>       Scaffold a new template from ${BASE_TEMPLATE}
  86d template add <specifier>     Add a template from GitHub or npm
  86d template remove <name>       Remove an installed template
  86d template activate <name>     Switch the store to use a template
  86d template list                List all templates

${c.dim("Template specifiers (for 'add'):")}
  github:owner/repo                Entire repository as a template
  github:owner/repo/templates/x    Specific template from a repository
  github:owner/repo#branch         Specific branch or tag
  npm:@scope/store-template        npm package
`);
}

// ── Manifest Helper ──────────────────────────────────────────────────

function loadManifest(root: string): RegistryManifest | undefined {
	return readLocalManifest(registryManifestPath(root));
}

function listTemplates() {
	const root = findProjectRoot();
	const templatesDir = join(root, "templates");

	if (!existsSync(templatesDir)) {
		warn("No templates directory found.");
		return;
	}

	const templates = readdirSync(templatesDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();

	const activeTemplate = detectActiveTemplate(root);

	heading(`Templates (${templates.length})`);
	console.log();

	for (const t of templates) {
		const config = readJson<{ name?: string; theme?: string }>(
			join(templatesDir, t, "config.json"),
		);
		const label = config?.name ? `${c.dim("—")} ${config.name}` : "";
		const isActive = t === activeTemplate ? c.green(" (active)") : "";
		console.log(`  ${c.bold(t)}${isActive} ${label}`);
	}
	console.log();
}

// ── Add Template ─────────────────────────────────────────────────────

async function addTemplate(specifier: string | undefined) {
	if (!specifier) {
		error("Template specifier is required.");
		console.log(`\n  Usage: 86d template add <specifier>`);
		console.log("  Examples:");
		console.log(`    ${c.dim("86d template add github:owner/repo")}`);
		console.log(
			`    ${c.dim("86d template add github:owner/repo/templates/custom")}`,
		);
		console.log(`    ${c.dim("86d template add npm:@acme/store-template")}`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const manifest = loadManifest(root);
	const spec = parseSpecifier(specifier);

	heading(`Adding template: ${spec.name}`);
	console.log();

	// Check if already installed locally
	const templateDir = join(root, "templates", spec.name);
	if (existsSync(join(templateDir, "config.json"))) {
		info(`Template "${spec.name}" already exists locally`);
		console.log(
			`\n  Run ${c.bold(`86d template activate ${spec.name}`)} to use it.\n`,
		);
		return;
	}

	// Fetch the template
	info(`Fetching ${spec.name} (source: ${spec.source})...`);
	const result = await fetchTemplate(spec, root, manifest);

	if (!result.success) {
		error(`Failed to add template: ${result.error}`);
		process.exit(1);
	}

	// A downloaded theme with no config.json has no module contract.
	// Do not invent `{ modules: "*" }` or copy Brisa's Experimental opt-in.
	const localPath = result.localPath as string;
	const configPath = join(localPath, "config.json");
	if (!existsSync(configPath)) {
		error(
			`Template "${spec.name}" is missing config.json. The theme must ship an explicit modules array.`,
		);
		console.log(
			`\n  Copy the shape of ${c.cyan("templates/brisa/config.json")}, then run ${c.bold("86d module enable")} for named selection.\n`,
		);
		process.exit(1);
	}

	success(`Added template ${c.bold(spec.name)}`);

	console.log(`\n  Next steps:`);
	console.log(
		`  ${c.dim("1.")} Run: ${c.bold(`86d template activate ${spec.name}`)}`,
	);
	console.log(
		`  ${c.dim("2.")} Edit ${c.cyan(`templates/${spec.name}/config.json`)} to customize`,
	);
	console.log(
		`  ${c.dim("3.")} Run: ${c.bold("86d generate")} to update generated code`,
	);
	console.log();
}

// ── Remove Template ──────────────────────────────────────────────────

function removeTemplate(name: string | undefined) {
	if (!name) {
		error("Template name is required.");
		console.log(`\n  Usage: 86d template remove <name>`);
		console.log(`  Example: ${c.dim("86d template remove my-custom-theme")}`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const templateDir = join(root, "templates", name);

	if (!existsSync(templateDir)) {
		error(`Template "${name}" not found at ${templateDir}`);
		process.exit(1);
	}

	// Prevent removing the base template
	if (name === BASE_TEMPLATE) {
		error(`Cannot remove the base template "${BASE_TEMPLATE}"`);
		process.exit(1);
	}

	// Prevent removing the active template
	const activeTemplate = detectActiveTemplate(root);
	if (activeTemplate === name) {
		error(
			`Cannot remove "${name}" — it is the active template. Switch to another template first.`,
		);
		console.log(`\n  Run ${c.bold("86d template activate <other>")} first.\n`);
		process.exit(1);
	}

	rmSync(templateDir, { recursive: true });
	success(`Removed template ${c.bold(name)}`);
	console.log();
}

// ── Create Template ──────────────────────────────────────────────────

function createTemplate(name: string | undefined) {
	if (!name) {
		error("Template name is required.");
		console.log(`\n  Usage: 86d template create <name>`);
		console.log(`  Example: ${c.dim("86d template create minimal")}`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const templatesDir = join(root, "templates");
	const templateDir = join(templatesDir, name);

	if (existsSync(templateDir)) {
		error(`Template "${name}" already exists at ${templateDir}`);
		process.exit(1);
	}

	const baseDir = join(templatesDir, BASE_TEMPLATE);
	if (!existsSync(baseDir)) {
		error(`Base template "${BASE_TEMPLATE}" not found at ${baseDir}`);
		process.exit(1);
	}

	heading(`Creating template "${name}"`);
	console.log();

	// Copy the base template
	cpSync(baseDir, templateDir, { recursive: true });
	success(`Copied ${BASE_TEMPLATE} → ${name}`);

	// Update config.json with new theme name
	const configPath = join(templateDir, "config.json");
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			config.theme = name;
			config.name = `86d ${name.charAt(0).toUpperCase() + name.slice(1)} Theme`;
			writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
			success("Updated config.json with new theme name");
		} catch {
			warn("Could not update config.json — edit it manually");
		}
	}

	console.log(`\n  Next steps:`);
	console.log(
		`  ${c.dim("1.")} Edit ${c.cyan(`templates/${name}/config.json`)} (colors, modules)`,
	);
	console.log(
		`  ${c.dim("2.")} Customize the MDX files in ${c.cyan(`templates/${name}/`)}`,
	);
	console.log(
		`  ${c.dim("3.")} Run: ${c.bold(`86d template activate ${name}`)}`,
	);
	console.log();
}

function activateTemplate(name: string | undefined) {
	if (!name) {
		error("Template name is required.");
		console.log(`\n  Usage: 86d template activate <name>`);
		console.log(`  Example: ${c.dim("86d template activate minimal")}`);
		process.exit(1);
	}

	const root = findProjectRoot();
	const templateDir = join(root, "templates", name);

	if (!existsSync(templateDir)) {
		error(`Template "${name}" not found at ${templateDir}`);
		process.exit(1);
	}

	const configPath = join(templateDir, "config.json");
	if (!existsSync(configPath)) {
		error(`Template "${name}" is missing config.json`);
		process.exit(1);
	}

	const activeTemplate = detectActiveTemplate(root);
	if (activeTemplate === name) {
		warn(`Template "${name}" is already active`);
		return;
	}

	// Update the template/* path alias in apps/store/tsconfig.json
	const tsconfigPath = join(root, "apps/store/tsconfig.json");
	if (!existsSync(tsconfigPath)) {
		error("apps/store/tsconfig.json not found");
		process.exit(1);
	}

	try {
		const content = readFileSync(tsconfigPath, "utf-8");
		const updated = content.replace(
			/(["']template\/\*["']\s*:\s*\[\s*["'])\.\.\/\.\.\/templates\/[^/]+\//,
			`$1../../templates/${name}/`,
		);

		if (updated === content) {
			error("Could not find template/* path alias in apps/store/tsconfig.json");
			process.exit(1);
		}

		writeFileSync(tsconfigPath, updated);
		success(
			`Activated template ${c.bold(name)}${activeTemplate ? ` (was ${activeTemplate})` : ""}`,
		);
		console.log(
			`\n  Run ${c.bold("86d generate")} to regenerate module code.\n`,
		);
	} catch (err) {
		error(`Failed to update tsconfig.json: ${err}`);
		process.exit(1);
	}
}
