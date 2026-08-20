import type {
	ContractViolation,
	Module,
	ModuleExports,
	ModuleRequires,
} from "./types/module";

/**
 * Normalizes the `requires` field to the contract form (Record<string, { read?, readWrite? }>).
 * Handles both the simple string[] form and the full contract form.
 */
export function normalizeRequires(
	requires: string[] | ModuleRequires | undefined,
): ModuleRequires {
	if (!requires) return {};
	if (Array.isArray(requires)) {
		const result: ModuleRequires = {};
		for (const id of requires) {
			result[id] = {};
		}
		return result;
	}
	return requires;
}

/**
 * Extracts the list of required module IDs from either form of `requires`.
 * By default, only returns non-optional dependencies (used for init-order enforcement).
 * Pass `includeOptional: true` to get all dependency IDs.
 */
export function getRequiredModuleIds(
	requires: string[] | ModuleRequires | undefined,
	options?: { includeOptional?: boolean },
): string[] {
	if (!requires) return [];
	if (Array.isArray(requires)) return requires;
	if (options?.includeOptional) return Object.keys(requires);
	return Object.entries(requires)
		.filter(([, req]) => !req.optional)
		.map(([id]) => id);
}

/**
 * Validates that all inter-module contracts are satisfied.
 *
 * For each module that declares `requires` in contract form, checks that:
 * 1. The required module exists in the modules array
 * 2. The required fields are exported by the provider
 * 3. readWrite requirements are met with readWrite access (not just read)
 *
 * @returns Array of contract violations. Empty array means all contracts are satisfied.
 */
export function validateContracts(modules: Module[]): ContractViolation[] {
	const violations: ContractViolation[] = [];

	// Build a lookup of module exports by ID
	const exportsById = new Map<string, ModuleExports>();
	const moduleIds = new Set<string>();
	for (const mod of modules) {
		moduleIds.add(mod.id);
		if (mod.exports) {
			exportsById.set(mod.id, mod.exports);
		}
	}

	for (const consumer of modules) {
		const requires = normalizeRequires(consumer.requires);

		for (const [providerId, requirements] of Object.entries(requires)) {
			// Check if provider module exists
			if (!moduleIds.has(providerId)) {
				// Optional dependencies don't generate violations when the module isn't installed
				if (requirements.optional) continue;

				// Report each required field as a violation
				const allFields = [
					...(requirements.read ?? []),
					...(requirements.readWrite ?? []),
				];
				if (allFields.length === 0) {
					// Simple dependency - module not found
					violations.push({
						consumerId: consumer.id,
						providerId,
						field: "*",
						requestedAccess: "read",
						reason: "module_not_found",
					});
				} else {
					for (const field of allFields) {
						const requestedAccess = requirements.readWrite?.includes(field)
							? "readWrite"
							: "read";
						violations.push({
							consumerId: consumer.id,
							providerId,
							field,
							requestedAccess,
							reason: "module_not_found",
						});
					}
				}
				continue;
			}

			const providerExports = exportsById.get(providerId);

			// If consumer specifies field requirements but provider has no exports declaration
			const readFields = requirements.read ?? [];
			const readWriteFields = requirements.readWrite ?? [];

			if (
				(readFields.length > 0 || readWriteFields.length > 0) &&
				!providerExports
			) {
				for (const field of readFields) {
					violations.push({
						consumerId: consumer.id,
						providerId,
						field,
						requestedAccess: "read",
						reason: "field_not_exported",
					});
				}
				for (const field of readWriteFields) {
					violations.push({
						consumerId: consumer.id,
						providerId,
						field,
						requestedAccess: "readWrite",
						reason: "field_not_exported",
					});
				}
				continue;
			}

			if (!providerExports) continue;

			// All fields the provider makes available for reading (read + readWrite)
			const readableFields = new Set([
				...(providerExports.read ?? []),
				...(providerExports.readWrite ?? []),
			]);
			const writableFields = new Set(providerExports.readWrite ?? []);

			// Check read requirements
			for (const field of readFields) {
				if (!readableFields.has(field)) {
					violations.push({
						consumerId: consumer.id,
						providerId,
						field,
						requestedAccess: "read",
						reason: "field_not_exported",
					});
				}
			}

			// Check readWrite requirements
			for (const field of readWriteFields) {
				if (!readableFields.has(field)) {
					violations.push({
						consumerId: consumer.id,
						providerId,
						field,
						requestedAccess: "readWrite",
						reason: "field_not_exported",
					});
				} else if (!writableFields.has(field)) {
					violations.push({
						consumerId: consumer.id,
						providerId,
						field,
						requestedAccess: "readWrite",
						reason: "insufficient_access",
					});
				}
			}
		}
	}

	return violations;
}

/**
 * Computes a topological initialization order for modules based on their dependencies.
 * Throws if a circular dependency is detected.
 *
 * @returns Module IDs in valid initialization order (dependencies first)
 */
export function computeInitOrder(modules: Module[]): string[] {
	const moduleMap = new Map<string, Module>();
	for (const mod of modules) {
		moduleMap.set(mod.id, mod);
	}

	const visited = new Set<string>();
	const visiting = new Set<string>(); // cycle detection
	const order: string[] = [];

	function visit(id: string, path: string[]): void {
		if (visited.has(id)) return;
		if (visiting.has(id)) {
			const cycle = [...path.slice(path.indexOf(id)), id].join(" → ");
			throw new Error(`Circular dependency detected: ${cycle}`);
		}

		visiting.add(id);

		const mod = moduleMap.get(id);
		if (mod) {
			const deps = getRequiredModuleIds(mod.requires);
			for (const depId of deps) {
				if (moduleMap.has(depId)) {
					visit(depId, [...path, id]);
				}
			}
		}

		visiting.delete(id);
		visited.add(id);
		order.push(id);
	}

	for (const mod of modules) {
		visit(mod.id, []);
	}

	return order;
}

/**
 * Formats contract violations into human-readable error messages.
 */
export function formatViolations(violations: ContractViolation[]): string[] {
	return violations.map((v) => {
		switch (v.reason) {
			case "module_not_found":
				return v.field === "*"
					? `Module "${v.consumerId}" requires module "${v.providerId}" but it is not installed.`
					: `Module "${v.consumerId}" requires "${v.field}" from "${v.providerId}" but that module is not installed.`;
			case "field_not_exported":
				return `Module "${v.consumerId}" requires ${v.requestedAccess} access to "${v.field}" from "${v.providerId}", but "${v.providerId}" does not export that field.`;
			case "insufficient_access":
				return `Module "${v.consumerId}" requires readWrite access to "${v.field}" from "${v.providerId}", but "${v.providerId}" only exports it as read-only.`;
			default:
				return `Module "${v.consumerId}" has an unknown contract violation with "${v.providerId}".`;
		}
	});
}
