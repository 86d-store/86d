import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import {
	c,
	error,
	findProjectRoot,
	info,
	parseEnvFile,
	warn,
} from "../utils.js";

/**
 * Load .env files in standard precedence order (later files override).
 */
function loadEnvFiles(root: string): Record<string, string> {
	const files = [".env", ".env.local", ".env.development.local"];
	let vars: Record<string, string> = {};
	for (const file of files) {
		vars = { ...vars, ...parseEnvFile(join(root, file)) };
	}
	return vars;
}

export async function dev(args: string[]) {
	const root = findProjectRoot();

	let port: string | undefined;
	const portIdx = args.indexOf("--port");
	if (portIdx !== -1 && args[portIdx + 1]) {
		port = args[portIdx + 1];
	}

	console.log(`\n${c.bold("86d")} ${c.dim("dev")}\n`);

	// Load .env files into process.env
	const envVars = loadEnvFiles(root);

	// Pre-flight: check DATABASE_URL is set and reachable
	const mergedEnv = { ...envVars, ...process.env };
	const dbUrl = mergedEnv.DATABASE_URL;
	if (!dbUrl) {
		warn(
			"DATABASE_URL is not set. The store will fail to connect to a database.",
		);
		warn("Set it in .env or pass it as an environment variable.\n");
	} else {
		// Quick TCP connectivity check (non-blocking, 3s timeout)
		try {
			const url = new URL(dbUrl);
			const host = url.hostname;
			const dbPort = Number.parseInt(url.port, 10) || 5432;
			await new Promise<void>((resolve, reject) => {
				const sock = createConnection({ host, port: dbPort, timeout: 3000 });
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
			info(`Database reachable at ${c.dim(`${host}:${dbPort}`)}`);
		} catch {
			warn(
				`Database at ${dbUrl.replace(/\/\/[^@]*@/, "//***@")} is not reachable.`,
			);
			warn("Start your database or check DATABASE_URL.\n");
		}
	}

	// Check for turbo
	const turboLocal = join(root, "node_modules", ".bin", "turbo");
	const hasTurbo = existsSync(turboLocal);

	if (!hasTurbo) {
		error("turbo not found. Run `bun install` in the project root first.");
		process.exit(1);
	}

	const cmd = turboLocal;
	const cmdArgs = ["run", "dev", "--filter=store"];
	if (port) {
		cmdArgs.push("--", "--port", port);
	}

	info(`Starting store on ${c.cyan(`http://localhost:${port || "3000"}`)}`);
	console.log();

	const child = spawn(cmd, cmdArgs, {
		cwd: root,
		stdio: "inherit",
		env: { ...envVars, ...process.env },
	});

	// Forward signals for clean shutdown
	const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
	for (const sig of signals) {
		process.on(sig, () => {
			child.kill(sig);
		});
	}

	child.on("exit", (code) => {
		process.exit(code ?? 0);
	});
}
