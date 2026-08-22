#!/usr/bin/env node

import { getVersion } from "./utils.js";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

async function main() {
	switch (command) {
		case "dev": {
			const { dev } = await import("./commands/dev.js");
			return dev(args.slice(1));
		}

		case "init": {
			const { init } = await import("./commands/init.js");
			return init(args.slice(1));
		}

		case "module": {
			// Keep `module build` free of registry/workspace imports so package
			// builds can run from the published bin without loading TS sources.
			if (subcommand === "build") {
				const { buildModule } = await import("./commands/module-build.js");
				return buildModule(args.slice(2));
			}
			const { moduleCommand } = await import("./commands/module.js");
			return moduleCommand(subcommand, args.slice(2));
		}

		case "template": {
			const { templateCommand } = await import("./commands/template.js");
			return templateCommand(subcommand, args.slice(2));
		}

		case "generate": {
			const { generate } = await import("./commands/generate.js");
			return generate(args.slice(1));
		}

		case "status": {
			const { status } = await import("./commands/status.js");
			return status();
		}

		case "doctor": {
			const { doctor } = await import("./commands/doctor.js");
			return doctor();
		}

		case "help":
		case "--help":
		case "-h":
		case undefined:
			return printHelp();

		case "version":
		case "--version":
		case "-v":
			return printVersion();

		default:
			console.error(`Unknown command: ${command}\n`);
			printHelp();
			process.exit(1);
	}
}

function printHelp() {
	const _v = getVersion();
}

function printVersion() {}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
