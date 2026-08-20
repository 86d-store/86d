import type { ModuleMaturity } from "./maturity.js";
import { parseSpecifier } from "./specifier.js";
import type { AdvancedStoreConfig, StoreConfig } from "./types.js";

export type ModuleAdmissionDecision =
	| { allowed: true }
	| {
			allowed: false;
			code:
				| "MODULE_NOT_SELECTED"
				| "DEPRECATED_MODULE_ENABLEMENT_BLOCKED"
				| "EXPERIMENTAL_MODULE_EXPLICIT_SELECTION_REQUIRED"
				| "EXPERIMENTAL_MODULE_ADVANCED_OPT_IN_REQUIRED";
			message: string;
	  };

export interface ModuleAdmissionInput {
	moduleName: string;
	maturity?: ModuleMaturity;
	modules: StoreConfig["modules"];
	advanced?: AdvancedStoreConfig;
}

/**
 * Decide whether one resolved Module may enter a generated or running Store.
 * Missing maturity evidence is Experimental and therefore fails closed.
 */
export function evaluateModuleAdmission(
	input: ModuleAdmissionInput,
): ModuleAdmissionDecision {
	const maturity = input.maturity ?? "experimental";
	if (
		Array.isArray(input.modules) &&
		!input.modules.some(
			(specifier) => parseSpecifier(specifier).packageName === input.moduleName,
		)
	) {
		return {
			allowed: false,
			code: "MODULE_NOT_SELECTED",
			message: `Module "${input.moduleName}" is not selected by config.modules and cannot be enabled.`,
		};
	}
	if (maturity === "deprecated") {
		return {
			allowed: false,
			code: "DEPRECATED_MODULE_ENABLEMENT_BLOCKED",
			message: `Deprecated Module "${input.moduleName}" cannot be newly enabled. Follow its documented transition before changing config.modules.`,
		};
	}
	if (maturity === "experimental" && !Array.isArray(input.modules)) {
		return {
			allowed: false,
			code: "EXPERIMENTAL_MODULE_EXPLICIT_SELECTION_REQUIRED",
			message: `Experimental Module "${input.moduleName}" must be explicitly named in config.modules before it can be enabled.`,
		};
	}
	if (
		maturity === "experimental" &&
		(input.advanced?.version !== 1 ||
			input.advanced.allowExperimentalModules !== true)
	) {
		return {
			allowed: false,
			code: "EXPERIMENTAL_MODULE_ADVANCED_OPT_IN_REQUIRED",
			message: `Experimental Module "${input.moduleName}" requires an explicit advanced opt-in before it can be enabled. Set advanced.version to 1 and advanced.allowExperimentalModules to true.`,
		};
	}

	return { allowed: true };
}
