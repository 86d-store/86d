import type { ModulePathSource } from "./paths";

export type ModuleClientEndpointSurface = "admin" | "store";

export interface ModuleClientEndpointReference {
	moduleId: string;
	filePath: string;
	surface: ModuleClientEndpointSurface;
	path: string;
}

export interface ModuleClientEndpointReferenceConflict {
	moduleId: string;
	filePath: string;
	surface: ModuleClientEndpointSurface;
	path: string;
}

function getAvailablePaths(
	source: ModulePathSource,
	surface: ModuleClientEndpointSurface,
): string[] {
	return surface === "admin"
		? (source.adminEndpoints ?? [])
		: (source.storeEndpoints ?? []);
}

export function validateModuleClientEndpointReferences(
	source: ModulePathSource,
	references: ModuleClientEndpointReference[],
): ModuleClientEndpointReferenceConflict[] {
	const seen = new Set<string>();
	const conflicts: ModuleClientEndpointReferenceConflict[] = [];

	for (const reference of references) {
		if (reference.moduleId !== source.moduleId) continue;

		const availablePaths = new Set(
			getAvailablePaths(source, reference.surface),
		);
		if (availablePaths.has(reference.path)) continue;

		const key = [
			reference.moduleId,
			reference.filePath,
			reference.surface,
			reference.path,
		].join("\0");
		if (seen.has(key)) continue;
		seen.add(key);

		conflicts.push({
			moduleId: reference.moduleId,
			filePath: reference.filePath,
			surface: reference.surface,
			path: reference.path,
		});
	}

	return conflicts.sort((a, b) => {
		const fileComparison = a.filePath.localeCompare(b.filePath);
		if (fileComparison !== 0) return fileComparison;

		const surfaceComparison = a.surface.localeCompare(b.surface);
		if (surfaceComparison !== 0) return surfaceComparison;

		return a.path.localeCompare(b.path);
	});
}

function describeSurface(surface: ModuleClientEndpointSurface): string {
	return surface === "admin" ? "admin endpoint" : "store endpoint";
}

export function formatModuleClientEndpointReferenceConflicts(
	conflicts: ModuleClientEndpointReferenceConflict[],
): string[] {
	return conflicts.map((conflict) => {
		return `Module "${conflict.moduleId}" references missing ${describeSurface(conflict.surface)} "${conflict.path}" in "${conflict.filePath}".`;
	});
}
