#!/usr/bin/env node

import { dev } from "./commands/dev.js";
import { doctor } from "./commands/doctor.js";
import { generate } from "./commands/generate.js";
import { init } from "./commands/init.js";
import { moduleCommand } from "./commands/module.js";
import { status } from "./commands/status.js";
import { templateCommand } from "./commands/template.js";
import { c, getVersion } from "./utils.js";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

async function main() {
	switch (command) {
		case "dev":
			return dev(args.slice(1));

		case "init":
			return init(args.slice(1));

		case "module":
			return moduleCommand(subcommand, args.slice(2));

		case "template":
			return templateCommand(subcommand, args.slice(2));

		case "generate":
			return generate(args.slice(1));

		case "status":
			return status();

		case "doctor":
			return doctor();

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
${c.bold("86d")} ${c.dim(`v${v}`)} — Modular commerce platform

${c.dim("Usage:")} 86d <command> [options]

${c.bold("Commands:")}
  ${c.cyan("dev")}                     Start the store development server
  ${c.cyan("init")} ${c.dim("[--yes]")}             Configure a local store (env, deps, migrate, seed)
  ${c.cyan("status")}                  Show project health and configuration
  ${c.cyan("doctor")}                  Diagnose project issues with fix suggestions
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
