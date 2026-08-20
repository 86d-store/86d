import type {
	ModuleDataService,
	ModuleEntityMap,
} from "@86d-app/core/types/module";
import type { z } from "@86d-app/core/zod";

export type DualReadMetrics = Readonly<{
	mismatches: number;
	shadowSkips: number;
}>;

export type MutableDualReadMetrics = {
	mismatches: number;
	shadowSkips: number;
};

export type EntityShapeMap = Readonly<
	Record<string, z.ZodObject<z.ZodRawShape>>
>;

export type ShadowReader = Readonly<{
	hasTable(moduleId: string, entityType: string): boolean;
	get(
		moduleId: string,
		entityType: string,
		entityId: string,
	): Promise<Record<string, unknown> | null>;
	insert(
		moduleId: string,
		entityType: string,
		entityId: string,
		row: Record<string, unknown>,
	): Promise<void>;
	delete(moduleId: string, entityType: string, entityId: string): Promise<void>;
}>;

export type DualReadDataServiceConfig<E extends ModuleEntityMap> = Readonly<{
	moduleId: string;
	primary: ModuleDataService<E>;
	shadow: ShadowReader;
	shapes: EntityShapeMap;
	metrics: MutableDualReadMetrics;
}>;

function normalizeValue(value: unknown): unknown {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (!Number.isNaN(parsed) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
			return new Date(parsed).toISOString();
		}
	}
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		const sorted = Object.keys(value as Record<string, unknown>)
			.sort((a, b) => a.localeCompare(b))
			.reduce<Record<string, unknown>>((acc, key) => {
				acc[key] = normalizeValue((value as Record<string, unknown>)[key]);
				return acc;
			}, {});
		return sorted;
	}
	if (Array.isArray(value)) {
		return value.map(normalizeValue);
	}
	return value;
}

function valuesEqual(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
): boolean {
	const keysA = Object.keys(a).sort((x, y) => x.localeCompare(y));
	const keysB = Object.keys(b).sort((x, y) => x.localeCompare(y));
	if (keysA.length !== keysB.length) {
		return false;
	}
	for (const key of keysA) {
		if (!keysB.includes(key)) {
			return false;
		}
		if (
			JSON.stringify(normalizeValue(a[key])) !==
			JSON.stringify(normalizeValue(b[key]))
		) {
			return false;
		}
	}
	return true;
}

/**
 * Compare JSON authority reads against compiled shadow tables.
 * Not wired in production; JSON UniversalDataService remains authoritative.
 */
export class DualReadModuleDataService<
	E extends ModuleEntityMap = ModuleEntityMap,
> implements ModuleDataService<E>
{
	readonly #moduleId: string;
	readonly #primary: ModuleDataService<E>;
	readonly #shadow: ShadowReader;
	readonly #shapes: EntityShapeMap;
	readonly #metrics: MutableDualReadMetrics;

	constructor(config: DualReadDataServiceConfig<E>) {
		this.#moduleId = config.moduleId;
		this.#primary = config.primary;
		this.#shadow = config.shadow;
		this.#shapes = config.shapes;
		this.#metrics = config.metrics;
	}

	get metrics(): DualReadMetrics {
		return this.#metrics;
	}

	async get<K extends keyof E & string>(
		entityType: K,
		entityId: string,
	): Promise<E[K] | null> {
		const json = await this.#primary.get(entityType, entityId);
		if (json === null) {
			return null;
		}
		await this.#compareShadow(
			entityType,
			entityId,
			json as Record<string, unknown>,
		);
		return json;
	}

	async upsert<K extends keyof E & string>(
		entityType: K,
		entityId: string,
		data: E[K],
	): Promise<void> {
		await this.#primary.upsert(entityType, entityId, data);
		const shape = this.#shapes[entityType];
		if (!shape) {
			this.#metrics.shadowSkips += 1;
			return;
		}
		const parsed = shape.safeParse(data);
		if (!parsed.success) {
			this.#metrics.shadowSkips += 1;
			return;
		}
		try {
			await this.#shadow.insert(
				this.#moduleId,
				entityType,
				entityId,
				parsed.data as Record<string, unknown>,
			);
		} catch {
			this.#metrics.shadowSkips += 1;
		}
	}

	async delete(entityType: keyof E & string, entityId: string): Promise<void> {
		await this.#primary.delete(entityType, entityId);
		await this.#shadow.delete(this.#moduleId, entityType, entityId);
	}

	async findMany<K extends keyof E & string>(
		entityType: K,
		options?: Parameters<ModuleDataService<E>["findMany"]>[1],
	): Promise<E[K][]> {
		const rows = await this.#primary.findMany(entityType, options);
		for (const row of rows) {
			const record = row as Record<string, unknown>;
			const entityId = readEntityId(record);
			if (entityId) {
				await this.#compareShadow(entityType, entityId, record);
			}
		}
		return rows;
	}

	async #compareShadow(
		entityType: string,
		entityId: string,
		json: Record<string, unknown>,
	): Promise<void> {
		if (!this.#shadow.hasTable(this.#moduleId, entityType)) {
			this.#metrics.mismatches += 1;
			return;
		}
		const shadowRow = await this.#shadow.get(
			this.#moduleId,
			entityType,
			entityId,
		);
		if (!shadowRow) {
			this.#metrics.mismatches += 1;
			return;
		}
		if (!valuesEqual(json, shadowRow)) {
			this.#metrics.mismatches += 1;
		}
	}
}

function readEntityId(record: Record<string, unknown>): string | null {
	return typeof record.id === "string" ? record.id : null;
}

export function isDualReadEnabled(): boolean {
	return process.env.MODULE_STORAGE_DUAL_READ === "1";
}
