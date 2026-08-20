import type { ComponentType } from "react";

export type AdminRouteComponent = ComponentType<{
	params?: Record<string, string>;
}>;

function describeExportValue(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (typeof value === "object") {
		const constructorName = value.constructor?.name;
		return constructorName && constructorName !== "Object"
			? `object (${constructorName})`
			: "object";
	}
	return typeof value;
}

function listAvailableExports(moduleExports: Record<string, unknown>): string {
	const keys = Object.keys(moduleExports).sort();
	return keys.length > 0 ? keys.join(", ") : "(none)";
}

export function isRenderableAdminComponentExport(
	value: unknown,
): value is AdminRouteComponent {
	return (
		typeof value === "function" ||
		(typeof value === "object" && value !== null && "$$typeof" in value)
	);
}

export function resolveAdminRouteComponent(
	moduleExports: Record<string, unknown>,
	moduleId: string,
	componentName: string,
): AdminRouteComponent {
	const exportValue = moduleExports[componentName];
	const availableExports = listAvailableExports(moduleExports);

	if (exportValue == null) {
		throw new Error(
			`Component ${componentName} not found in module ${moduleId}. Available exports: ${availableExports}`,
		);
	}

	if (!isRenderableAdminComponentExport(exportValue)) {
		throw new Error(
			`Component ${componentName} in module ${moduleId} resolved to ${describeExportValue(exportValue)}. Available exports: ${availableExports}`,
		);
	}

	return exportValue;
}
