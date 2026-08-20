import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createConnection } from "node:net";
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

interface Check {
	label: string;
	status: "pass" | "warn" | "fail";
	message: string;
	fix?: string;
}

interface DoctorOptions {
	nodeVersion?: string;
}

const SUPPORTED_NODE_MAJORS = new Set([23, 24, 25]);
const NODE_VERSION_REQUIREMENT = "23, 24, or 25";

export async function doctor(options: DoctorOptions = {}) {
	const checks: Check[] = [];
	let root: string | undefined;

	heading("86d doctor");
	console.log();

	// 1. Runtime check
	const nodeVersion = options.nodeVersion ?? process.versions.node;
	const nodeMajor = Number.parseInt(nodeVersion.split(".")[0], 10);
	if (SUPPORTED_NODE_MAJORS.has(nodeMajor)) {
		checks.push({
			label: "Node.js",
			status: "pass",
			message: `v${nodeVersion}`,
		});
	} else {
		checks.push({
			label: "Node.js",
			status: "fail",
			message: `v${nodeVersion} (requires ${NODE_VERSION_REQUIREMENT})`,
			fix: `Upgrade Node.js to version ${NODE_VERSION_REQUIREMENT}`,
		});
	}

	// 2. Bun check
	try {
		const bunVersion = execSync("bun --version", { encoding: "utf-8" }).trim();
		checks.push({
			label: "Bun",
			status: "pass",
			message: `v${bunVersion}`,
		});
	} catch {
		checks.push({
			label: "Bun",
			status: "fail",
			message: "not found",
			fix: "Install Bun: https://bun.sh",
		});
	}

	// 3. Project root
	try {
		root = findProjectRoot();
		const hasTurbo = existsSync(join(root, "turbo.json"));
		if (hasTurbo) {
			checks.push({
				label: "Project root",
				status: "pass",
				message: root,
			});
		} else {
			checks.push({
				label: "Project root",
				status: "warn",
				message: `${root} (no turbo.json)`,
				fix: "Run this command from inside an 86d project",
			});
		}
	} catch {
		checks.push({
			label: "Project root",
			status: "fail",
			message: "could not detect project root",
			fix: "Run this command from inside an 86d project",
		});
	}

	if (!root) {
		printResults(checks);
		return;
	}

	// 4. Dependencies
	const hasNodeModules = existsSync(join(root, "node_modules"));
	const hasLockfile =
		existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"));

	if (hasNodeModules && hasLockfile) {
		checks.push({
			label: "Dependencies",
			status: "pass",
			message: "installed",
		});
	} else if (hasNodeModules) {
		checks.push({
			label: "Dependencies",
			status: "warn",
			message: "installed but no lockfile",
			fix: "Run: bun install",
		});
	} else {
		checks.push({
			label: "Dependencies",
			status: "fail",
			message: "not installed",
			fix: "Run: bun install",
		});
	}

	// 5. Active template
	const activeTemplate = detectActiveTemplate(root);

	if (activeTemplate) {
		const configPath = join(root, "templates", activeTemplate, "config.json");
		const templateConfig = readJson<TemplateConfig>(configPath);

		if (templateConfig) {
			checks.push({
				label: "Template",
				status: "pass",
				message: `${activeTemplate} (${templateConfig.name ?? "unnamed"})`,
			});
		} else {
			checks.push({
				label: "Template",
				status: "warn",
				message: `${activeTemplate} (config.json missing or invalid)`,
				fix: `Create templates/${activeTemplate}/config.json`,
			});
		}
	} else {
		checks.push({
			label: "Template",
			status: "warn",
			message: "no active template detected",
			fix: "Set template/* path alias in apps/store/tsconfig.json",
		});
	}

	// 6. Module integrity
	const modulesDir = join(root, "modules");
	if (existsSync(modulesDir)) {
		const allModules = readdirSync(modulesDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);

		const issues: string[] = [];
		for (const mod of allModules) {
			const modDir = join(modulesDir, mod);
			if (!existsSync(join(modDir, "package.json"))) {
				issues.push(`${mod}: missing package.json`);
			}
			if (!existsSync(join(modDir, "src/index.ts"))) {
				issues.push(`${mod}: missing src/index.ts`);
			}
		}

		// Check enabled modules exist
		if (activeTemplate) {
			const configPath = join(root, "templates", activeTemplate, "config.json");
			const templateConfig = readJson<TemplateConfig>(configPath);
			const enabledModules = templateConfig?.modules ?? [];
			for (const mod of enabledModules) {
				const modName = mod.replace(/^@86d-app\//, "");
				if (!allModules.includes(modName)) {
					issues.push(`${mod}: enabled in template but not found in modules/`);
				}
			}
		}

		if (issues.length === 0) {
			checks.push({
				label: "Modules",
				status: "pass",
				message: `${allModules.length} modules, all valid`,
			});
		} else {
			checks.push({
				label: "Modules",
				status: "warn",
				message: `${allModules.length} modules, ${issues.length} issue${issues.length === 1 ? "" : "s"}`,
				fix: issues.join("\n          "),
			});
		}
	} else {
		checks.push({
			label: "Modules",
			status: "warn",
			message: "no modules/ directory",
		});
	}

	// 7. Environment
	const envPath = join(root, ".env");
	if (existsSync(envPath)) {
		const vars = parseEnvFile(envPath);

		const required = ["DATABASE_URL", "STORE_ID", "BETTER_AUTH_SECRET"];
		const missing = required.filter(
			(k) =>
				!(k in vars) ||
				vars[k] === "" ||
				vars[k] === "change-me-to-a-random-string",
		);

		if (missing.length === 0) {
			checks.push({
				label: "Environment",
				status: "pass",
				message: "all required vars set",
			});
		} else {
			checks.push({
				label: "Environment",
				status: "fail",
				message: `missing: ${missing.join(", ")}`,
				fix: `Set these in .env — run 86d init to get started`,
			});
		}

		// Optional env checks
		const optional: [string, string][] = [
			["RESEND_API_KEY", "email sending"],
			["NEXT_PUBLIC_STORE_URL", "absolute URLs"],
			["NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID", "Google Tag Manager"],
		];
		const missingOptional = optional.filter(
			([k]) => !(k in vars) || vars[k] === "",
		);
		if (missingOptional.length > 0) {
			checks.push({
				label: "Optional env",
				status: "warn",
				message: missingOptional
					.map(([k, desc]) => `${k} (${desc})`)
					.join(", "),
			});
		}
	} else {
		checks.push({
			label: "Environment",
			status: "fail",
			message: "no .env file",
			fix: "Run: 86d init",
		});
	}

	// 8. Database connectivity
	const dbUrlVal = existsSync(join(root, ".env"))
		? parseEnvFile(join(root, ".env")).DATABASE_URL
		: process.env.DATABASE_URL;
	if (dbUrlVal) {
		try {
			const url = new URL(dbUrlVal);
			const host = url.hostname;
			const dbPort = Number.parseInt(url.port, 10) || 5432;
			await new Promise<void>((resolve, reject) => {
				const sock = createConnection({
					host,
					port: dbPort,
					timeout: 3000,
				});
				sock.on("connect", () => {
					sock.destroy();
					resolve();
				});
				sock.on("error", reject);
				sock.on("timeout", () => {
					sock.destroy();
					reject(new Error("timeout"));
				});
			});
			checks.push({
				label: "Database",
				status: "pass",
				message: `reachable at ${host}:${dbPort}`,
			});
		} catch {
			checks.push({
				label: "Database",
				status: "fail",
				message: "not reachable",
				fix: "Start your database or check DATABASE_URL in .env",
			});
		}
	}

	// 9a. Generation scripts
	const genModules = existsSync(
		join(root, "internals/generators/src/generate-modules.ts"),
	);
	const genDocs = existsSync(
		join(root, "internals/generators/src/generate-component-docs.ts"),
	);
	if (genModules && genDocs) {
		checks.push({
			label: "Code generation",
			status: "pass",
			message: "all scripts present",
		});
	} else {
		const missing: string[] = [];
		if (!genModules) missing.push("generate-modules.ts");
		if (!genDocs) missing.push("generate-component-docs.ts");
		checks.push({
			label: "Code generation",
			status: "warn",
			message: `missing: ${missing.join(", ")}`,
			fix: "These scripts should be in internals/generators/",
		});
	}

	// 9b. TypeScript config
	const storeTsconfig = join(root, "apps/store/tsconfig.json");
	const baseTsconfig = join(root, "tsconfig.base.json");
	if (existsSync(storeTsconfig) && existsSync(baseTsconfig)) {
		checks.push({
			label: "TypeScript",
			status: "pass",
			message: "configs present",
		});
	} else {
		const missing: string[] = [];
		if (!existsSync(storeTsconfig)) missing.push("apps/store/tsconfig.json");
		if (!existsSync(baseTsconfig)) missing.push("tsconfig.base.json");
		checks.push({
			label: "TypeScript",
			status: "warn",
			message: `missing: ${missing.join(", ")}`,
		});
	}

	printResults(checks);
}

function printResults(checks: Check[]) {
	for (const check of checks) {
		const icon =
			check.status === "pass"
				? c.green("✓")
				: check.status === "warn"
					? c.yellow("!")
					: c.red("✗");
		const label = c.dim(`${check.label}:`);
		const msg = check.status === "fail" ? c.red(check.message) : check.message;
		console.log(`  ${icon} ${label} ${msg}`);
		if (check.fix) {
			console.log(`          ${c.dim(`Fix: ${check.fix}`)}`);
		}
	}

	const fails = checks.filter((ch) => ch.status === "fail").length;
	const warns = checks.filter((ch) => ch.status === "warn").length;

	console.log();
	if (fails === 0 && warns === 0) {
		console.log(`  ${c.green("No issues found. Your project looks healthy.")}`);
	} else if (fails === 0) {
		console.log(
			`  ${c.yellow(`${warns} warning${warns === 1 ? "" : "s"}`)} — project is functional but could be improved`,
		);
	} else {
		console.log(
			`  ${c.red(`${fails} error${fails === 1 ? "" : "s"}`)}${warns > 0 ? `, ${c.yellow(`${warns} warning${warns === 1 ? "" : "s"}`)}` : ""} — fix errors before running the store`,
		);
	}
	console.log();
}
