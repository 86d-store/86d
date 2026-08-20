import type { Module } from "./types/module";

export type ModulePathKind =
	| "admin_page"
	| "store_page"
	| "admin_endpoint"
	| "store_endpoint";

export interface ModulePathSource {
	moduleId: string;
	adminPages?: string[];
	storePages?: string[];
	adminEndpoints?: string[];
	storeEndpoints?: string[];
}

export interface ModulePathConflict {
	kind: ModulePathKind;
	path: string;
	moduleIds: string[];
}

function isModule(value: Module | ModulePathSource): value is Module {
	return "version" in value;
}

function toPathSource(value: Module | ModulePathSource): ModulePathSource {
	if (!isModule(value)) return value;

	return {
		moduleId: value.id,
		adminPages: value.admin?.pages?.map((page) => page.path) ?? [],
		storePages: value.store?.pages?.map((page) => page.path) ?? [],
		adminEndpoints: Object.keys(value.endpoints?.admin ?? {}),
		storeEndpoints: Object.keys(value.endpoints?.store ?? {}),
	};
}

function collectConflicts(
	kind: ModulePathKind,
	getPaths: (source: ModulePathSource) => string[] | undefined,
	sources: ModulePathSource[],
): ModulePathConflict[] {
	const ownersByPath = new Map<string, string[]>();

	for (const source of sources) {
		for (const path of getPaths(source) ?? []) {
			const owners = ownersByPath.get(path);
			if (owners) {
				owners.push(source.moduleId);
			} else {
				ownersByPath.set(path, [source.moduleId]);
			}
		}
	}

	return [...ownersByPath.entries()]
		.filter(([, moduleIds]) => moduleIds.length > 1)
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([path, moduleIds]) => ({
			kind,
			path,
			moduleIds,
		}));
}

export function validateUniquePaths(
	input: Array<Module | ModulePathSource>,
): ModulePathConflict[] {
	const sources = input.map(toPathSource);

	return [
		...collectConflicts("admin_page", (source) => source.adminPages, sources),
		...collectConflicts("store_page", (source) => source.storePages, sources),
		...collectConflicts(
			"admin_endpoint",
			(source) => source.adminEndpoints,
			sources,
		),
		...collectConflicts(
			"store_endpoint",
			(source) => source.storeEndpoints,
			sources,
		),
	];
}

function describeKind(kind: ModulePathKind): string {
	switch (kind) {
		case "admin_page":
			return "admin page";
		case "store_page":
			return "store page";
		case "admin_endpoint":
			return "admin endpoint";
		case "store_endpoint":
			return "store endpoint";
	}
}

export function formatPathConflicts(conflicts: ModulePathConflict[]): string[] {
	return conflicts.map((conflict) => {
		const uniqueModuleIds = [...new Set(conflict.moduleIds)];
		const kind = describeKind(conflict.kind);

		if (uniqueModuleIds.length === 1) {
			return `Module "${uniqueModuleIds[0]}" declares ${kind} "${conflict.path}" multiple times.`;
		}

		return `Modules ${uniqueModuleIds.map((moduleId) => `"${moduleId}"`).join(", ")} all declare ${kind} "${conflict.path}".`;
	});
}
