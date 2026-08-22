import { actorReferenceSchema } from "@86d-app/contracts/command";
import { z } from "zod";
import type { ModuleDataService } from "./types/module";

export type DurableEventDefinition<
	Name extends string = string,
	Version extends number = number,
	Owner extends string = string,
	PayloadSchema extends z.ZodType = z.ZodType,
> = Readonly<{
	name: Name;
	version: Version;
	owner: Owner;
	payload: PayloadSchema;
}>;

export type AnyDurableEventDefinition = DurableEventDefinition<
	string,
	number,
	string,
	z.ZodType
>;

export type DurableEventPayload<D extends AnyDurableEventDefinition> = z.infer<
	D["payload"]
>;

export type DurableEventEnvelope<D extends AnyDurableEventDefinition> =
	Readonly<{
		id: string;
		name: D["name"];
		version: D["version"];
		storeId: string;
		sourceModule: D["owner"];
		aggregate: Readonly<{ type: string; id: string; sequence: number }>;
		occurredAt: Date;
		payload: DurableEventPayload<D>;
	}>;

export type DurableEventInput<D extends AnyDurableEventDefinition> = Readonly<{
	id?: string | undefined;
	aggregate: Readonly<{ type: string; id: string }>;
	occurredAt?: Date | undefined;
	payload: DurableEventPayload<D>;
}>;

export interface ModuleDataTransaction extends ModuleDataService {
	emit<D extends AnyDurableEventDefinition>(
		definition: D,
		event: DurableEventInput<D>,
	): Promise<DurableEventEnvelope<D>>;
}

/** Additive transaction contract for owner-local compare/mutate operations. */
export interface LockingModuleDataTransaction extends ModuleDataTransaction {
	/** Read and lock one owner-local entity until the surrounding transaction ends. */
	getForUpdate(
		entityType: string,
		entityId: string,
	): Promise<Record<string, unknown> | null>;
}

export interface ModuleTransactionRunner {
	transaction<T>(
		work: (transaction: ModuleDataTransaction) => Promise<T>,
	): Promise<T>;
}

export type DurableEventConsumerContext = Readonly<{
	data: ModuleDataService;
}>;

type DurableEventHandler<D extends AnyDurableEventDefinition> = {
	bivarianceHack(
		context: DurableEventConsumerContext,
		event: DurableEventEnvelope<D>,
	): Promise<void>;
}["bivarianceHack"];

export type DurableEventConsumer<D extends AnyDurableEventDefinition> =
	Readonly<{
		consumer: string;
		owner: string;
		definition: D;
		optional?: boolean | undefined;
		handle: DurableEventHandler<D>;
	}>;

export type AnyDurableEventConsumer =
	DurableEventConsumer<AnyDurableEventDefinition>;

export function defineDurableEvent<
	const Name extends string,
	const Version extends number,
	const Owner extends string,
	PayloadSchema extends z.ZodType,
>(definition: {
	name: Name;
	version: Version;
	owner: Owner;
	payload: PayloadSchema;
}): DurableEventDefinition<Name, Version, Owner, PayloadSchema> {
	assertIdentifier(definition.name, "Durable event name", 200);
	assertIdentifier(definition.owner, "Durable event owner", 100);
	if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
		throw new Error("Durable event version must be a positive safe integer.");
	}
	return Object.freeze({ ...definition });
}

export function consumeDurableEvent<D extends AnyDurableEventDefinition>(
	consumer: DurableEventConsumer<D>,
): DurableEventConsumer<D> {
	assertIdentifier(consumer.consumer, "Durable event consumer", 200);
	assertIdentifier(consumer.owner, "Durable event consumer owner", 100);
	return Object.freeze({ ...consumer });
}

export function durableEventKey(definition: AnyDurableEventDefinition): string {
	return `${definition.owner}:${definition.name}@${definition.version}`;
}

function assertIdentifier(value: string, label: string, maximum: number): void {
	if (value.length < 1 || value.length > maximum) {
		throw new Error(
			`${label} must contain between 1 and ${maximum} characters.`,
		);
	}
}

const inventoryStockAdjustedPayloadShape = {
	productId: z.string().min(1).max(255),
	variantId: z.string().min(1).max(255).optional(),
	locationId: z.string().min(1).max(255).optional(),
	delta: z.number().int(),
	quantity: z.number().int().nonnegative(),
	reserved: z.number().int().nonnegative(),
	available: z.number().int().nonnegative(),
};

/** Shared Store Runtime contract for the M1H Inventory durability tracer. */
export const inventoryStockAdjustedV1 = defineDurableEvent({
	name: "inventory.stock-adjusted",
	version: 1,
	owner: "inventory",
	payload: z.object(inventoryStockAdjustedPayloadShape).strict(),
});

/** Command-correlated Inventory adjustment fact. */
export const inventoryStockAdjustedV2 = defineDurableEvent({
	name: "inventory.stock-adjusted",
	version: 2,
	owner: "inventory",
	payload: z
		.object({
			...inventoryStockAdjustedPayloadShape,
			command: z
				.object({
					executionId: z.string().min(1).max(255),
					operationId: z.string().min(8).max(200),
					correlationId: z.string().min(1).max(255),
					causationId: z.string().min(1).max(255).optional(),
					actor: actorReferenceSchema,
					authorityId: z.string().min(1).max(255),
				})
				.strict(),
		})
		.strict(),
});

/** Products-owned fact emitted only when an immutable Catalog revision publishes. */
export const catalogPublishedV1 = defineDurableEvent({
	name: "catalog.published",
	version: 1,
	owner: "products",
	payload: z
		.object({
			revisionId: z.string().min(1).max(200),
			revisionSequence: z.number().int().positive(),
			baseRevisionId: z.string().min(1).max(200).optional(),
			contentVersion: z.literal(1),
			contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
			currency: z.string().regex(/^[A-Z]{3}$/),
			productCount: z.number().int().nonnegative(),
			variantCount: z.number().int().nonnegative(),
			categoryCount: z.number().int().nonnegative(),
			operationId: z.string().min(8).max(180),
			actor: actorReferenceSchema,
			authorityId: z.string().min(1).max(255),
		})
		.strict(),
});
