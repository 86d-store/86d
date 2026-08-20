import { describe, expect, it } from "vitest";
import { evaluateModuleAdmission } from "../admission.js";

describe("evaluateModuleAdmission", () => {
	it("denies a generated Module that was not explicitly selected", () => {
		const decision = evaluateModuleAdmission({
			moduleName: "@86d-app/cart",
			maturity: "experimental",
			modules: ["@86d-app/products"],
			advanced: { version: 1, allowExperimentalModules: true },
		});

		expect(decision).toEqual({
			allowed: false,
			code: "MODULE_NOT_SELECTED",
			message:
				'Module "@86d-app/cart" is not selected by config.modules and cannot be enabled.',
		});
	});

	it("blocks new enablement of a Deprecated Module with transition guidance", () => {
		const decision = evaluateModuleAdmission({
			moduleName: "@86d-app/legacy-payments",
			maturity: "deprecated",
			modules: ["@86d-app/legacy-payments"],
		});

		expect(decision).toEqual({
			allowed: false,
			code: "DEPRECATED_MODULE_ENABLEMENT_BLOCKED",
			message:
				'Deprecated Module "@86d-app/legacy-payments" cannot be newly enabled. Follow its documented transition before changing config.modules.',
		});
	});
});
