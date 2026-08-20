import type {
	AnyDurableEventDefinition,
	DurableEventEnvelope,
	DurableEventInput,
	LockingModuleDataTransaction,
	ModuleDataTransaction,
} from "@86d-app/core/durable-events";
import type { Prisma } from "@86d-app/core/prisma";

export interface DataServiceConfig {
	// biome-ignore lint/suspicious/noExplicitAny: PrismaClient at runtime
	db: any;
	storeId: string;
	/** Logical Module package ID (for durable event source identity). */
	moduleId: string;
	/** Persisted Module UUID. Defaults to moduleId for migration compatibility. */
	moduleDbId?: string | undefined;
}

type PrismaLikeTransaction = DataServiceConfig["db"];

/** Rows returned when a caller names no limit. */
const DEFAULT_PAGE_SIZE = 100;
/** Ceiling on any single read, so one Module cannot pull a whole table into memory. */
const MAX_PAGE_SIZE = 1_000;

/** Columns that exist on the table and can therefore order a query in Postgres. */
const ORDERABLE_COLUMNS = new Set(["createdAt", "updatedAt"]);

const reportedSortDrops = new Set<string>();

/**
 * A sort key that is not a real column cannot reach the database, so the query
 * comes back in `createdAt` order while the caller believes it is sorted. Say so
 * once per key rather than returning quietly wrong data. Ordering by a declared
 * field becomes possible when that field becomes a column.
 */
function reportUnsupportedSort(
	moduleId: string,
	entityType: string,
	column: string,
): void {
	const key = `${moduleId}:${entityType}:${column}`;
	if (reportedSortDrops.has(key)) return;
	reportedSortDrops.add(key);
	console.warn(
		`[86d] ${moduleId} asked to order ${entityType} by "${column}", which is not a column. Results are ordered by createdAt.`,
	);
}

function boundedTake(take: number | undefined): number {
	if (take === undefined) return DEFAULT_PAGE_SIZE;
	if (!Number.isInteger(take) || take < 1) {
		throw new Error("take must be a positive integer.");
	}
	if (take > MAX_PAGE_SIZE) {
		throw new Error(
			`take must be at most ${MAX_PAGE_SIZE}. Page through larger result sets with skip.`,
		);
	}
	return take;
}

function boundedText(value: string, label: string, maximum: number): void {
	if (value.length === 0 || value.length > maximum) {
		throw new Error(
			`${label} must contain between 1 and ${maximum} characters.`,
		);
	}
}

function normalizeJson(value: unknown): unknown {
	let serialized: string | undefined;
	try {
		serialized = JSON.stringify(value);
	} catch {
		throw new Error("Durable event payload must be JSON serializable.");
	}
	if (serialized === undefined || serialized.length > 262_144) {
		throw new Error("Durable event payload must be bounded JSON.");
	}
	return JSON.parse(serialized) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Build a Prisma-compatible JSONB where clause from a flat key-value filter.
 * Single-key uses direct `data.path.equals`; multi-key uses AND.
 */
function buildJsonWhereFilters(
	// biome-ignore lint/suspicious/noExplicitAny: JSONB filter values can be any JSON-serializable type
	where: Record<string, any>,
	// biome-ignore lint/suspicious/noExplicitAny: returns Prisma where clause fragment
): Record<string, any> {
	const entries = Object.entries(where);
	if (entries.length === 0) return {};
	if (entries.length === 1) {
		return { data: { path: [entries[0][0]], equals: entries[0][1] } };
	}
	return {
		AND: entries.map(([key, val]) => ({
			data: { path: [key], equals: val },
		})),
	};
}

/**
 * Secure data access layer for modules
 * Only allows access to module's own data within a specific store
 */
export class UniversalDataService {
	/**
	 * A `#` field, not `private`: TypeScript erases `private` at compile time, so
	 * `(service as any).config.db` would hand a Module the raw database client and
	 * with it every table in the Store. The engine enforces this one.
	 */
	readonly #config: DataServiceConfig;

	constructor(config: DataServiceConfig) {
		this.#config = config;
	}

	private get moduleDbId(): string {
		return this.#config.moduleDbId ?? this.#config.moduleId;
	}

	private scoped(db: PrismaLikeTransaction): UniversalDataService {
		return new UniversalDataService({ ...this.#config, db });
	}

	/**
	 * Create or update an entity
	 */
	async upsert(
		entityType: string,
		entityId: string,
		// biome-ignore lint/suspicious/noExplicitAny: JSONB data accepts arbitrary values
		data: Record<string, any>,
		parentId?: string,
	) {
		const args = {
			where: {
				module_entity_unique: {
					moduleId: this.moduleDbId,
					entityType,
					entityId,
				},
			},
			create: {
				moduleId: this.moduleDbId,
				entityType,
				entityId,
				data,
				parentId: parentId ?? null,
			},
			update: {
				data,
				updatedAt: new Date(),
			},
		} satisfies Prisma.ModuleDataUpsertArgs;

		return this.#config.db.moduleData.upsert(args);
	}

	/**
	 * Get a single entity
	 */
	async get(entityType: string, entityId: string) {
		const args = {
			where: {
				module_entity_unique: {
					moduleId: this.moduleDbId,
					entityType,
					entityId,
				},
			},
		} satisfies Prisma.ModuleDataFindUniqueArgs;
		const result = await this.#config.db.moduleData.findUnique(args);
		// biome-ignore lint/suspicious/noExplicitAny: Prisma JSONB data field
		return (result?.data as Record<string, any>) ?? null;
	}

	/**
	 * Read and lock one owner-local entity inside the caller's transaction.
	 * The lock closes the read/modify/write race for Command adapters without
	 * exposing a raw database client to Modules.
	 */
	async getForUpdate(
		entityType: string,
		entityId: string,
	): Promise<Record<string, unknown> | null> {
		const rows: Array<{ data: unknown }> =
			await this.#config.db.$queryRawUnsafe(
				`SELECT "data"
			 FROM "ModuleData"
			 WHERE "moduleId" = $1::uuid
			   AND "entityType" = $2
			   AND "entityId" = $3
			 FOR UPDATE`,
				this.moduleDbId,
				entityType,
				entityId,
			);
		const value = rows[0]?.data;
		return isRecord(value) ? { ...value } : null;
	}

	/**
	 * Find entities by type with optional JSONB filtering, pagination, and ordering.
	 *
	 * - `where`: filter by JSONB data fields (exact equality, multi-key AND)
	 * - `take`/`skip`: Prisma-style pagination
	 * - `orderBy`: supports `createdAt` and `updatedAt` (DB columns); defaults to `createdAt: desc`
	 */
	async findMany(
		entityType: string,
		options?: {
			// biome-ignore lint/suspicious/noExplicitAny: JSONB filter values
			where?: Record<string, any>;
			orderBy?: Record<string, "asc" | "desc">;
			take?: number;
			skip?: number;
		},
	) {
		// biome-ignore lint/suspicious/noExplicitAny: Prisma where clause built dynamically
		const whereClause: Record<string, any> = {
			moduleId: this.moduleDbId,
			entityType,
		};

		if (options?.where) {
			Object.assign(whereClause, buildJsonWhereFilters(options.where));
		}

		// biome-ignore lint/suspicious/noExplicitAny: Prisma orderBy clause
		let orderBy: Record<string, any> = { createdAt: "desc" };
		if (options?.orderBy) {
			const supported: [string, "asc" | "desc"][] = [];
			for (const [column, direction] of Object.entries(options.orderBy)) {
				if (ORDERABLE_COLUMNS.has(column)) supported.push([column, direction]);
				else reportUnsupportedSort(this.#config.moduleId, entityType, column);
			}
			if (supported.length > 0) orderBy = Object.fromEntries(supported);
		}

		const args = {
			where: whereClause,
			take: boundedTake(options?.take),
			...(options?.skip !== undefined ? { skip: options.skip } : {}),
			orderBy,
		};

		const results = await this.#config.db.moduleData.findMany(args);
		// biome-ignore lint/suspicious/noExplicitAny: Prisma result contains JSONB data field
		return results.map((r: any) => r.data as Record<string, any>);
	}

	/**
	 * Get children of an entity
	 */
	async getChildren(parentInternalId: string) {
		const args = {
			where: {
				moduleId: this.moduleDbId,
				parentId: parentInternalId,
			},
			take: MAX_PAGE_SIZE,
		} satisfies Prisma.ModuleDataFindManyArgs;
		const results = await this.#config.db.moduleData.findMany(args);
		// biome-ignore lint/suspicious/noExplicitAny: Prisma result row
		return results.map((r: any) => ({
			id: r.id,
			entityType: r.entityType,
			entityId: r.entityId,
			// biome-ignore lint/suspicious/noExplicitAny: Prisma JSONB data field
			data: r.data as Record<string, any>,
		}));
	}

	/**
	 * Delete an entity
	 */
	async delete(entityType: string, entityId: string) {
		const args = {
			where: {
				module_entity_unique: {
					moduleId: this.moduleDbId,
					entityType,
					entityId,
				},
			},
		} satisfies Prisma.ModuleDataDeleteArgs;
		return this.#config.db.moduleData.delete(args);
	}

	/**
	 * Count entities by type with optional JSONB filtering.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: JSONB filter values
	async count(entityType: string, where?: Record<string, any>) {
		// biome-ignore lint/suspicious/noExplicitAny: Prisma where clause built dynamically
		const whereClause: Record<string, any> = {
			moduleId: this.moduleDbId,
			entityType,
		};

		if (where) {
			Object.assign(whereClause, buildJsonWhereFilters(where));
		}

		return this.#config.db.moduleData.count({ where: whereClause });
	}

	/**
	 * Batch operations
	 */
	async upsertMany(
		entities: Array<{
			entityType: string;
			entityId: string;
			// biome-ignore lint/suspicious/noExplicitAny: JSONB data accepts arbitrary values
			data: Record<string, any>;
		}>,
	) {
		const args = (entity: {
			entityType: string;
			entityId: string;
			// biome-ignore lint/suspicious/noExplicitAny: JSONB data accepts arbitrary values
			data: Record<string, any>;
		}) =>
			({
				where: {
					module_entity_unique: {
						moduleId: this.moduleDbId,
						entityType: entity.entityType,
						entityId: entity.entityId,
					},
				},
				create: {
					moduleId: this.moduleDbId,
					entityType: entity.entityType,
					entityId: entity.entityId,
					data: entity.data,
				},
				update: {
					data: entity.data,
					updatedAt: new Date(),
				},
			}) satisfies Prisma.ModuleDataUpsertArgs;

		const operations = entities.map((entity) =>
			this.#config.db.moduleData.upsert(args(entity)),
		);

		return this.#config.db.$transaction(operations);
	}

	/**
	 * Atomically commit owner-local state and validated durable events.
	 * Aggregate sequences are allocated by locking a database counter row; callers
	 * cannot guess or race a sequence.
	 */
	async transaction<T>(
		work: (transaction: ModuleDataTransaction) => Promise<T>,
	): Promise<T> {
		return this.#config.db.$transaction(async (db: PrismaLikeTransaction) => {
			return work(this.transactionContext(db));
		});
	}

	/**
	 * Bind owner-local ModuleData and outbox operations to a transaction already
	 * opened by the Store Runtime Command persistence layer.
	 */
	currentTransaction(): LockingModuleDataTransaction {
		return this.transactionContext(this.#config.db);
	}

	private transactionContext(
		db: PrismaLikeTransaction,
	): LockingModuleDataTransaction {
		const ownerData = this.scoped(db);
		return Object.assign(ownerData, {
			emit: <D extends AnyDurableEventDefinition>(
				definition: D,
				input: DurableEventInput<D>,
			): Promise<DurableEventEnvelope<D>> =>
				this.persistEvent(db, definition, input),
		});
	}

	private async persistEvent<D extends AnyDurableEventDefinition>(
		db: PrismaLikeTransaction,
		definition: D,
		input: DurableEventInput<D>,
	): Promise<DurableEventEnvelope<D>> {
		if (definition.owner !== this.#config.moduleId) {
			throw new Error(
				`Durable event "${definition.name}" is owned by Module "${definition.owner}", not "${this.#config.moduleId}".`,
			);
		}
		boundedText(definition.name, "Durable event name", 200);
		boundedText(input.aggregate.type, "Aggregate type", 100);
		boundedText(input.aggregate.id, "Aggregate ID", 255);
		if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
			throw new Error("Durable event version must be a positive integer.");
		}
		const payload = definition.payload.safeParse(input.payload);
		if (!payload.success) {
			throw new Error(
				`Durable event payload is invalid for ${definition.name}.`,
			);
		}
		const normalizedPayload = normalizeJson(payload.data);
		const normalized = definition.payload.safeParse(normalizedPayload);
		if (!normalized.success) {
			throw new Error(
				`Durable event payload is not stable JSON for ${definition.name}.`,
			);
		}
		const eventId = input.id ?? crypto.randomUUID();
		const occurredAt = input.occurredAt ?? new Date();
		const sequenceRows = (await db.$queryRawUnsafe(
			`INSERT INTO "ModuleEventSequence" (
				"storeId", "sourceModule", "aggregateType", "aggregateId", "lastSequence"
			) VALUES ($1::uuid, $2, $3, $4, 1)
			ON CONFLICT ("storeId", "sourceModule", "aggregateType", "aggregateId")
			DO UPDATE SET "lastSequence" = "ModuleEventSequence"."lastSequence" + 1
			RETURNING "lastSequence" AS "sequence"`,
			this.#config.storeId,
			this.#config.moduleId,
			input.aggregate.type,
			input.aggregate.id,
		)) as Array<{ sequence: bigint }>;
		const sequence = sequenceRows[0]?.sequence;
		if (
			sequence === undefined ||
			sequence < 1n ||
			sequence > BigInt(Number.MAX_SAFE_INTEGER)
		) {
			throw new Error("Could not allocate a durable event sequence.");
		}
		const persisted = {
			id: eventId,
			eventType: definition.name,
			schemaVersion: definition.version,
			storeId: this.#config.storeId,
			sourceModule: this.#config.moduleId,
			moduleId: this.moduleDbId,
			aggregateType: input.aggregate.type,
			aggregateId: input.aggregate.id,
			aggregateSequence: sequence,
			occurredAt,
			payload: normalized.data,
			deliveryState: "pending",
			attempts: 0,
			nextAttemptAt: occurredAt,
		};
		await db.moduleOutboxEvent.create({ data: persisted });
		return {
			id: eventId,
			name: definition.name,
			version: definition.version,
			storeId: this.#config.storeId,
			sourceModule: definition.owner,
			aggregate: {
				type: input.aggregate.type,
				id: input.aggregate.id,
				sequence: Number(sequence),
			},
			occurredAt,
			payload: normalized.data as DurableEventEnvelope<D>["payload"],
		};
	}
}
