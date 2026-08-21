import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
	c,
	error,
	findProjectRoot,
	heading,
	info,
	parseEnvFile,
	success,
	warn,
} from "../utils.js";

export async function init(args: string[]) {
	const yes = args.includes("--yes") || args.includes("-y");
	const root = findProjectRoot();

	heading("Initializing 86d store");
	console.log();

	// 1. Copy .env.example if .env doesn't exist
	const envPath = join(root, ".env");
	const envExamplePath = join(root, ".env.example");

	if (!existsSync(envPath) && existsSync(envExamplePath)) {
		copyFileSync(envExamplePath, envPath);
		success("Created .env from .env.example");
	} else if (existsSync(envPath)) {
		info(".env already exists, skipping");
	} else {
		warn("No .env.example found, skipping .env creation");
	}

	// 2. Generate a random auth secret if still placeholder
	if (existsSync(envPath)) {
		let envContent = readFileSync(envPath, "utf-8");
		if (envContent.includes("change-me-to-a-random-string")) {
			const secret = generateSecret();
			envContent = envContent.replace("change-me-to-a-random-string", secret);
			writeFileSync(envPath, envContent);
			success("Generated BETTER_AUTH_SECRET");
		}
	}

	// 3. Install dependencies
	info("Installing dependencies...");
	try {
		execSync("bun install", { cwd: root, stdio: "inherit" });
		success("Dependencies installed");
	} catch {
		error("Failed to install dependencies. Is bun installed?");
		process.exit(1);
	}

	// 4. Run code generation
	info("Running code generation...");
	const tsxPath = join(root, "node_modules", ".bin", "tsx");
	const generateScript = join(
		root,
		"internals/generators/src/generate-modules.ts",
	);

	if (existsSync(generateScript)) {
		try {
			const runner = existsSync(tsxPath) ? tsxPath : "tsx";
			execFileSync(runner, [generateScript], {
				cwd: root,
				stdio: "inherit",
			});
			success("Code generation complete");
		} catch {
			warn("Code generation failed — you can retry with: 86d generate");
		}
	} else {
		warn("generate-modules.ts not found, skipping code generation");
	}

	// 5. Optional database setup (migrate + seed)
	const envVars = existsSync(envPath) ? parseEnvFile(envPath) : {};
	const dbUrl = envVars.DATABASE_URL ?? process.env.DATABASE_URL ?? "";

	if (dbUrl.trim()) {
		const reachable = await checkDbReachable(dbUrl);
		if (reachable) {
			info(`Database reachable`);
			console.log();

			// 5a. Migrations
			const runMigrate = yes || (await confirm("Run database migrations?"));
			if (runMigrate) {
				const dbPkg = join(root, "packages/db");
				const hasMigrations = existsSync(join(dbPkg, "drizzle"));
				const migrateCmd = hasMigrations ? "bunx drizzle-kit migrate" : null;
				if (!migrateCmd) {
					warn("No Drizzle migrations found under packages/db/drizzle");
				} else {
					try {
						execSync(migrateCmd, { cwd: dbPkg, stdio: "inherit" });
						success("Database migrations applied");
					} catch {
						warn("Migration failed — retry with: bun run db:migrate");
					}
				}
			}

			// 5b. Seed demo data
			const runSeed = yes || (await confirm("Seed demo data?"));
			if (runSeed) {
				const seedScript = join(root, "packages/db/src/seed.ts");
				if (existsSync(seedScript)) {
					let adminEmail = "admin@86d.app";
					let adminPassword = "password123";

					if (!yes && process.stdin.isTTY) {
						console.log();
						info("Set admin credentials (press Enter to use defaults)");
						const inputEmail = await prompt(`Admin email [admin@86d.app]: `);
						if (inputEmail.trim()) adminEmail = inputEmail.trim();
						const inputPassword = await prompt(
							`Admin password [password123]: `,
						);
						if (inputPassword.trim()) adminPassword = inputPassword.trim();
					}

					try {
						execSync("bun run --filter db seed", {
							cwd: root,
							stdio: "inherit",
							env: {
								...process.env,
								DATABASE_URL: dbUrl,
								APP_ADMIN_EMAIL: adminEmail,
								APP_ADMIN_PASSWORD: adminPassword,
							},
						});
						success("Demo data seeded");
						if (
							adminEmail !== "admin@86d.app" ||
							adminPassword !== "password123"
						) {
							console.log();
							console.log(`  ${c.dim("Admin credentials:")}`);
							console.log(`    Email:    ${c.cyan(adminEmail)}`);
							console.log(`    Password: ${c.cyan("(as entered)")}`);
						}
					} catch {
						warn("Seeding failed — retry with: bun run db:seed");
					}
				} else {
					warn("packages/db/src/seed.ts not found, skipping seed");
				}
			}
		} else {
			warn(
				`Database at ${redactUrl(dbUrl)} is not reachable — skipping migrations and seed.`,
			);
			warn(
				"Start your database, then run: bun run db:migrate && bun run db:seed",
			);
		}
	} else {
		console.log();
		heading("Store initialized");
		console.log();
		console.log(`  Next steps:`);
		console.log(`  ${c.dim("1.")} Set ${c.cyan("DATABASE_URL")} in .env`);
		console.log(`  ${c.dim("2.")} Set ${c.cyan("STORE_ID")} in .env`);
		console.log(`  ${c.dim("3.")} Run: ${c.bold("86d dev")}`);
		console.log();
		return;
	}

	console.log();
	heading("Store initialized");
	console.log();
	console.log(`  Run: ${c.bold("86d dev")}`);
	console.log();
}

function generateSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Buffer.from(bytes).toString("base64url");
}

async function checkDbReachable(dbUrl: string): Promise<boolean> {
	try {
		const url = new URL(dbUrl);
		const host = url.hostname;
		const port = Number.parseInt(url.port, 10) || 5432;
		await new Promise<void>((resolve, reject) => {
			const sock = createConnection({ host, port, timeout: 3000 });
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
		return true;
	} catch {
		return false;
	}
}

/** Prompt user for a text value. Returns empty string in non-TTY. */
async function prompt(question: string): Promise<string> {
	if (!process.stdin.isTTY) return "";
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(`  ${question}`, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

/** Prompt user for yes/no (defaults to yes on Enter). Skips in non-TTY. */
async function confirm(question: string): Promise<boolean> {
	if (!process.stdin.isTTY) return false;
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(`  ${question} ${c.dim("[Y/n]")} `, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() !== "n");
		});
	});
}

function redactUrl(url: string): string {
	try {
		return url.replace(/\/\/[^@]*@/, "//***@");
	} catch {
		return "[url]";
	}
}
