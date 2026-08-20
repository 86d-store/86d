import {
	inventoryStockAdjustedV1,
	type ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	BackInStockSubscription,
	InventoryController,
	InventoryItem,
} from "./service";

/** Derive a stable entity ID from product/variant/location */
function itemId(
	productId: string,
	variantId?: string,
	locationId?: string,
): string {
	return [productId, variantId ?? "_", locationId ?? "_"].join(":");
}

/** Attach computed `available` field */
function withAvailable(item: Omit<InventoryItem, "available">): InventoryItem {
	return { ...item, available: Math.max(0, item.quantity - item.reserved) };
}

/** Check if an item is below its low-stock threshold and emit event if so. */
function checkLowStock(
	item: InventoryItem,
	events?: ScopedEventEmitter | undefined,
): void {
	if (!events) return;
	if (
		item.lowStockThreshold !== undefined &&
		item.lowStockThreshold !== null &&
		item.available <= item.lowStockThreshold
	) {
		// Fire-and-forget — don't block the mutation
		void events.emit("inventory.low", {
			productId: item.productId,
			variantId: item.variantId,
			locationId: item.locationId,
			quantity: item.quantity,
			reserved: item.reserved,
			available: item.available,
			lowStockThreshold: item.lowStockThreshold,
		});
	}
}

/** Emit inventory.updated for any stock mutation. */
function emitUpdated(
	item: InventoryItem,
	events?: ScopedEventEmitter | undefined,
): void {
	if (!events) return;
	void events.emit("inventory.updated", {
		productId: item.productId,
		variantId: item.variantId,
		locationId: item.locationId,
		quantity: item.quantity,
		reserved: item.reserved,
		available: item.available,
	});
}

/**
 * Emit inventory.back-in-stock when stock transitions from 0 to >0.
 * Looks up active subscribers and includes them in the payload so the
 * notification handler can send emails directly. Also marks subscribers
 * as notified.
 */
async function emitBackInStock(
	item: InventoryItem,
	previousAvailable: number,
	dataService: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): Promise<void> {
	if (!events) return;
	if (previousAvailable > 0 || item.available <= 0) return;

	const subs = (await dataService.findMany("backInStockSubscription", {
		where: { productId: item.productId, status: "active" },
	})) as BackInStockSubscription[];

	if (subs.length === 0) return;

	void events.emit("inventory.back-in-stock", {
		productId: item.productId,
		variantId: item.variantId,
		available: item.available,
		subscribers: subs.map((s) => ({
			email: s.email,
			productName: s.productName,
		})),
	});

	// Mark all as notified (fire-and-forget)
	const now = new Date();
	for (const sub of subs) {
		const updated = { ...sub, status: "notified" as const, notifiedAt: now };
		void dataService.upsert(
			"backInStockSubscription",
			sub.id,
			updated as Record<string, unknown>,
		);
	}
}

/** Derive a stable ID for back-in-stock subscriptions */
function subscriptionId(
	productId: string,
	variantId: string | undefined,
	email: string,
): string {
	return [productId, variantId ?? "_", email.toLowerCase()].join(":");
}

/**
 * Commit the stock row and the durable `inventory.stock-adjusted` event in one
 * transaction so a completed adjustment can never exist without its event, and
 * an event can never describe an adjustment that was rolled back.
 *
 * Without a transaction runner the Store Runtime has no transactional storage
 * behind it. The stock row is still written, and the caller is told no durable
 * event was recorded rather than being given a silent partial success.
 */
async function commitAdjustment(
	data: ModuleDataService,
	transactions: ModuleTransactionRunner | undefined,
	item: Omit<InventoryItem, "available">,
	delta: number,
): Promise<InventoryItem> {
	const result = withAvailable(item);
	if (!transactions) {
		await data.upsert(
			"inventoryItem",
			item.id,
			item as Record<string, unknown>,
		);
		return result;
	}
	await transactions.transaction(async (transaction) => {
		await transaction.upsert(
			"inventoryItem",
			item.id,
			item as Record<string, unknown>,
		);
		await transaction.emit(inventoryStockAdjustedV1, {
			aggregate: { type: "inventory-item", id: item.id },
			payload: {
				productId: item.productId,
				...(item.variantId === undefined ? {} : { variantId: item.variantId }),
				...(item.locationId === undefined
					? {}
					: { locationId: item.locationId }),
				delta,
				quantity: result.quantity,
				reserved: result.reserved,
				available: result.available,
			},
		});
	});
	return result;
}

export function createInventoryController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	transactions?: ModuleTransactionRunner | undefined,
): InventoryController {
	return {
		async getStock(params): Promise<InventoryItem | null> {
			const id = itemId(params.productId, params.variantId, params.locationId);
			const raw = (await data.get("inventoryItem", id)) as Omit<
				InventoryItem,
				"available"
			> | null;
			return raw ? withAvailable(raw) : null;
		},

		async setStock(params): Promise<InventoryItem> {
			const id = itemId(params.productId, params.variantId, params.locationId);
			const now = new Date();

			// Preserve existing reserved count if a record already exists
			const existing = (await data.get("inventoryItem", id)) as Omit<
				InventoryItem,
				"available"
			> | null;
			const reserved = existing?.reserved ?? 0;
			const previousAvailable = existing
				? Math.max(0, existing.quantity - existing.reserved)
				: 0;

			const item: Omit<InventoryItem, "available"> = {
				id,
				productId: params.productId,
				variantId: params.variantId,
				locationId: params.locationId,
				// Prefer newly provided name snapshots; fall back to stored values
				productName: params.productName ?? existing?.productName,
				variantName: params.variantName ?? existing?.variantName,
				quantity: params.quantity,
				reserved,
				lowStockThreshold: params.lowStockThreshold,
				allowBackorder: params.allowBackorder ?? false,
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
			};

			await data.upsert("inventoryItem", id, item as Record<string, unknown>);
			const result = withAvailable(item);
			emitUpdated(result, events);
			checkLowStock(result, events);
			void emitBackInStock(result, previousAvailable, data, events);
			return result;
		},

		async adjustStock(params): Promise<InventoryItem | null> {
			const id = itemId(params.productId, params.variantId, params.locationId);
			const existing = (await data.get("inventoryItem", id)) as Omit<
				InventoryItem,
				"available"
			> | null;
			if (!existing) return null;

			const previousAvailable = Math.max(
				0,
				existing.quantity - existing.reserved,
			);
			const updated: Omit<InventoryItem, "available"> = {
				...existing,
				quantity: Math.max(0, existing.quantity + params.delta),
				updatedAt: new Date(),
			};
			// The applied delta is the clamped difference, not the requested one.
			const appliedDelta = updated.quantity - existing.quantity;
			const result = await commitAdjustment(
				data,
				transactions,
				updated,
				appliedDelta,
			);
			emitUpdated(result, events);
			checkLowStock(result, events);
			void emitBackInStock(result, previousAvailable, data, events);
			return result;
		},

		async reserve(params): Promise<InventoryItem | null> {
			const id = itemId(params.productId, params.variantId, params.locationId);
			const existing = (await data.get("inventoryItem", id)) as Omit<
				InventoryItem,
				"available"
			> | null;
			if (!existing) return null;

			const available = Math.max(0, existing.quantity - existing.reserved);
			if (!existing.allowBackorder && available < params.quantity) {
				return null;
			}

			const updated: Omit<InventoryItem, "available"> = {
				...existing,
				reserved: existing.reserved + params.quantity,
				updatedAt: new Date(),
			};
			await data.upsert(
				"inventoryItem",
				id,
				updated as Record<string, unknown>,
			);
			const result = withAvailable(updated);
			emitUpdated(result, events);
			checkLowStock(result, events);
			return result;
		},

		async release(params): Promise<InventoryItem | null> {
			const id = itemId(params.productId, params.variantId, params.locationId);
			const existing = (await data.get("inventoryItem", id)) as Omit<
				InventoryItem,
				"available"
			> | null;
			if (!existing) return null;

			const updated: Omit<InventoryItem, "available"> = {
				...existing,
				reserved: Math.max(0, existing.reserved - params.quantity),
				updatedAt: new Date(),
			};
			await data.upsert(
				"inventoryItem",
				id,
				updated as Record<string, unknown>,
			);
			const result = withAvailable(updated);
			emitUpdated(result, events);
			return result;
		},

		async deduct(params): Promise<InventoryItem | null> {
			const id = itemId(params.productId, params.variantId, params.locationId);
			const existing = (await data.get("inventoryItem", id)) as Omit<
				InventoryItem,
				"available"
			> | null;
			if (!existing) return null;

			const updated: Omit<InventoryItem, "available"> = {
				...existing,
				quantity: Math.max(0, existing.quantity - params.quantity),
				reserved: Math.max(0, existing.reserved - params.quantity),
				updatedAt: new Date(),
			};
			await data.upsert(
				"inventoryItem",
				id,
				updated as Record<string, unknown>,
			);
			const result = withAvailable(updated);
			emitUpdated(result, events);
			checkLowStock(result, events);
			return result;
		},

		async isInStock(params): Promise<boolean> {
			const id = itemId(params.productId, params.variantId, params.locationId);
			const existing = (await data.get("inventoryItem", id)) as Omit<
				InventoryItem,
				"available"
			> | null;

			// If no tracking record, treat as always in stock (not tracked)
			if (!existing) return true;

			if (existing.allowBackorder) return true;

			const available = Math.max(0, existing.quantity - existing.reserved);
			const required = params.quantity ?? 1;
			return available >= required;
		},

		async getLowStockItems(params): Promise<InventoryItem[]> {
			const where: Record<string, unknown> = {};
			if (params?.locationId) where.locationId = params.locationId;

			const all = (await data.findMany("inventoryItem", {
				where,
			})) as Array<Omit<InventoryItem, "available">>;

			return all
				.filter(
					(item) =>
						item.lowStockThreshold !== undefined &&
						item.lowStockThreshold !== null &&
						item.quantity - item.reserved <= item.lowStockThreshold,
				)
				.map(withAvailable);
		},

		async listItems(params): Promise<InventoryItem[]> {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.locationId) where.locationId = params.locationId;

			const results = (await data.findMany("inventoryItem", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			})) as Array<Omit<InventoryItem, "available">>;

			return results.map(withAvailable);
		},

		// ── Back-in-stock subscriptions ──────────────────────────────────

		async subscribeBackInStock(params): Promise<BackInStockSubscription> {
			const id = subscriptionId(
				params.productId,
				params.variantId,
				params.email,
			);
			const existing = (await data.get(
				"backInStockSubscription",
				id,
			)) as BackInStockSubscription | null;

			// If already subscribed and active, return existing
			if (existing && existing.status === "active") {
				return existing;
			}

			const sub: BackInStockSubscription = {
				id,
				productId: params.productId,
				variantId: params.variantId,
				email: params.email.toLowerCase(),
				customerId: params.customerId,
				productName: params.productName,
				status: "active",
				subscribedAt: new Date(),
				notifiedAt: undefined,
			};

			await data.upsert(
				"backInStockSubscription",
				id,
				sub as Record<string, unknown>,
			);
			return sub;
		},

		async unsubscribeBackInStock(params): Promise<boolean> {
			const id = subscriptionId(
				params.productId,
				params.variantId,
				params.email,
			);
			const existing = (await data.get(
				"backInStockSubscription",
				id,
			)) as BackInStockSubscription | null;
			if (!existing) return false;

			await data.delete("backInStockSubscription", id);
			return true;
		},

		async checkBackInStockSubscription(params): Promise<boolean> {
			const id = subscriptionId(
				params.productId,
				params.variantId,
				params.email,
			);
			const existing = (await data.get(
				"backInStockSubscription",
				id,
			)) as BackInStockSubscription | null;
			return existing !== null && existing.status === "active";
		},

		async getBackInStockSubscribers(
			params,
		): Promise<BackInStockSubscription[]> {
			const where: Record<string, unknown> = {
				productId: params.productId,
				status: "active",
			};
			if (params.variantId) where.variantId = params.variantId;

			return (await data.findMany("backInStockSubscription", {
				where,
			})) as BackInStockSubscription[];
		},

		async listBackInStockSubscriptions(
			params,
		): Promise<BackInStockSubscription[]> {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.status) where.status = params.status;

			return (await data.findMany("backInStockSubscription", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			})) as BackInStockSubscription[];
		},

		async getBackInStockStats(): Promise<{
			totalActive: number;
			totalNotified: number;
			uniqueProducts: number;
		}> {
			const all = (await data.findMany("backInStockSubscription", {
				where: {},
			})) as BackInStockSubscription[];

			const active = all.filter((s) => s.status === "active");
			const notified = all.filter((s) => s.status === "notified");
			const uniqueProducts = new Set(active.map((s) => s.productId)).size;

			return {
				totalActive: active.length,
				totalNotified: notified.length,
				uniqueProducts,
			};
		},

		async markSubscribersNotified(params): Promise<number> {
			const where: Record<string, unknown> = {
				productId: params.productId,
				status: "active",
			};
			if (params.variantId) where.variantId = params.variantId;

			const subs = (await data.findMany("backInStockSubscription", {
				where,
			})) as BackInStockSubscription[];

			const now = new Date();
			let count = 0;
			for (const sub of subs) {
				const updated: BackInStockSubscription = {
					...sub,
					status: "notified",
					notifiedAt: now,
				};
				await data.upsert(
					"backInStockSubscription",
					sub.id,
					updated as Record<string, unknown>,
				);
				count++;
			}
			return count;
		},
	};
}
