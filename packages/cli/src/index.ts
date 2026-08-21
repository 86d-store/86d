#!/usr/bin/env node

import { c, getVersion } from "./utils.js";

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
	const v = getVersion();
	console.log(`
${c.bold("86d")} ${c.dim(`v${v}`)} — The Modern Foundation for Commerce

${c.dim("Usage:")} 86d <command> [options]

${c.bold("Commands:")}
  ${c.cyan("dev")}                     Start the store development server
  ${c.cyan("init")} ${c.dim("[--yes]")}             Configure a local store (env, deps, migrate, seed)
  ${c.cyan("status")}                  Show project health and configuration
  ${c.cyan("doctor")}                  Diagnose project issues with fix suggestions
  ${c.cyan("module build")} ${c.dim("[dir]")}       Compile a module to dist/ (+ copy assets)
  ${c.cyan("module create")} <name>    Scaffold a new module
  ${c.cyan("module add")} <specifier>  Add a module from registry, GitHub, or npm
  ${c.cyan("module list")}             List all local modules
  ${c.cyan("module search")} [query]   Search the registry for modules
  ${c.cyan("module info")} <name>      Show module details
  ${c.cyan("module enable")} <name>    Enable a module in the active template
  ${c.cyan("module disable")} <name>   Disable a module in the active template
  ${c.cyan("template create")} <name>  Scaffold a new template from brisa
  ${c.cyan("template activate")} <name> Switch the store to use a template
  ${c.cyan("template list")}           List all templates
  ${c.cyan("generate")}                Run all code generation
  ${c.cyan("generate modules")}        Generate module imports and API router
  ${c.cyan("generate components")}     Generate component documentation

${c.bold("Options:")}
  ${c.dim("-h, --help")}             Show this help message
  ${c.dim("-v, --version")}          Show version

${c.dim("Examples:")}
  ${c.gray("$")} 86d init
  ${c.gray("$")} 86d status
  ${c.gray("$")} 86d dev --port 4000
  ${c.gray("$")} 86d module build
  ${c.gray("$")} 86d module create loyalty-points
  ${c.gray("$")} 86d module enable loyalty-points
  ${c.gray("$")} 86d template activate minimal
  ${c.gray("$")} 86d generate
`);
}

function printVersion() {
	console.log(`86d v${getVersion()}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
