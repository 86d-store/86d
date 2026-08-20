import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	AddItemParams,
	CreateRegistryParams,
	GiftRegistryController,
	ListRegistriesParams,
	PurchaseItemParams,
	Registry,
	RegistryItem,
	RegistryPurchase,
	RegistrySummary,
	UpdateItemParams,
	UpdateRegistryParams,
} from "./service";

function generateSlug(title: string): string {
	return `${title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createGiftRegistryController(
	data: ModuleDataService,
): GiftRegistryController {
	async function getRegistryRecord(id: string): Promise<Registry | null> {
		const raw = await data.get("registry", id);
		return raw ? (raw as unknown as Registry) : null;
	}

	async function updateRegistryRecord(
		id: string,
		updates: Record<string, unknown>,
	): Promise<Registry | null> {
		const existing = await data.get("registry", id);
		if (!existing) return null;
		const updated = {
			...(existing as Record<string, unknown>),
			...updates,
			updatedAt: new Date(),
		};
		await data.upsert("registry", id, updated);
		return updated as unknown as Registry;
	}

	async function recalculateCounts(registryId: string): Promise<void> {
		const items = (await data.findMany("registryItem", {
			where: { registryId },
		})) as unknown as RegistryItem[];
		const itemCount = items.length;
		const purchasedCount = items.filter(
			(item) => item.quantityReceived >= item.quantityDesired,
		).length;
		await updateRegistryRecord(registryId, { itemCount, purchasedCount });
	}

	return {
		// ── Registry CRUD ────────────────────────────────────────────

		async createRegistry(params: CreateRegistryParams): Promise<Registry> {
			if (!params.title.trim()) {
				throw new Error("Registry title is required");
			}
			if (!params.customerId) {
				throw new Error("Customer ID is required");
			}

			const id = crypto.randomUUID();
			const now = new Date();
			const slug = params.slug || generateSlug(params.title);

			// Check slug uniqueness
			const existing = await data.findMany("registry", {
				where: { slug },
			});
			if (existing.length > 0) {
				throw new Error("Registry slug already in use");
			}

			const registry: Registry = {
				id,
				customerId: params.customerId,
				customerName: params.customerName,
				title: params.title.trim(),
				type: params.type,
				slug,
				visibility: params.visibility ?? "unlisted",
				status: "active",
				itemCount: 0,
				purchasedCount: 0,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
				...(params.eventDate != null && { eventDate: params.eventDate }),
				...(params.coverImageUrl != null && {
					coverImageUrl: params.coverImageUrl,
				}),
				...(params.shippingAddressId != null && {
					shippingAddressId: params.shippingAddressId,
				}),
				...(params.thankYouMessage != null && {
					thankYouMessage: params.thankYouMessage,
				}),
			};

			await data.upsert(
				"registry",
				id,
				registry as unknown as Record<string, unknown>,
			);
			return registry;
		},

		async updateRegistry(
			id: string,
			params: UpdateRegistryParams,
		): Promise<Registry | null> {
			const existing = await getRegistryRecord(id);
			if (!existing) return null;

			if (params.title !== undefined && !params.title.trim()) {
				throw new Error("Registry title cannot be empty");
			}

			const updates: Record<string, unknown> = {};
			if (params.title !== undefined) updates.title = params.title.trim();
			if (params.description !== undefined)
				updates.description = params.description;
			if (params.type !== undefined) updates.type = params.type;
			if (params.visibility !== undefined)
				updates.visibility = params.visibility;
			if (params.eventDate !== undefined) updates.eventDate = params.eventDate;
			if (params.coverImageUrl !== undefined)
				updates.coverImageUrl = params.coverImageUrl;
			if (params.shippingAddressId !== undefined)
				updates.shippingAddressId = params.shippingAddressId;
			if (params.thankYouMessage !== undefined)
				updates.thankYouMessage = params.thankYouMessage;

			return updateRegistryRecord(id, updates);
		},

		async getRegistry(id: string): Promise<Registry | null> {
			return getRegistryRecord(id);
		},

		async getRegistryBySlug(slug: string): Promise<Registry | null> {
			const results = await data.findMany("registry", {
				where: { slug },
			});
			return results.length > 0 ? (results[0] as unknown as Registry) : null;
		},

		async listRegistries(params?: ListRegistriesParams): Promise<Registry[]> {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.type) where.type = params.type;
			if (params?.status) where.status = params.status;
			if (params?.visibility) where.visibility = params.visibility;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { createdAt: "desc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("registry", query);
			return raw as unknown as Registry[];
		},

		async deleteRegistry(id: string): Promise<boolean> {
			const existing = await data.get("registry", id);
			if (!existing) return false;
			await data.delete("registry", id);
			return true;
		},

		async archiveRegistry(id: string): Promise<Registry | null> {
			const existing = await getRegistryRecord(id);
			if (!existing) return null;
			if (existing.status === "archived") {
				throw new Error("Registry is already archived");
			}
			return updateRegistryRecord(id, { status: "archived" });
		},

		// ── Registry items ───────────────────────────────────────────

		async addItem(params: AddItemParams): Promise<RegistryItem> {
			const registry = await getRegistryRecord(params.registryId);
			if (!registry) {
				throw new Error("Registry not found");
			}
			if (registry.status !== "active") {
				throw new Error("Cannot add items to an inactive registry");
			}
			if (params.priceInCents <= 0) {
				throw new Error("Price must be greater than zero");
			}
			if (params.quantityDesired !== undefined && params.quantityDesired <= 0) {
				throw new Error("Quantity desired must be at least 1");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const item: RegistryItem = {
				id,
				registryId: params.registryId,
				productId: params.productId,
				productName: params.productName,
				priceInCents: params.priceInCents,
				quantityDesired: params.quantityDesired ?? 1,
				quantityReceived: 0,
				priority: params.priority ?? "nice_to_have",
				createdAt: now,
				updatedAt: now,
				...(params.variantId != null && { variantId: params.variantId }),
				...(params.variantName != null && {
					variantName: params.variantName,
				}),
				...(params.imageUrl != null && { imageUrl: params.imageUrl }),
				...(params.note != null && { note: params.note }),
			};

			await data.upsert(
				"registryItem",
				id,
				item as unknown as Record<string, unknown>,
			);
			await recalculateCounts(params.registryId);
			return item;
		},

		async updateItem(
			id: string,
			params: UpdateItemParams,
		): Promise<RegistryItem | null> {
			const raw = await data.get("registryItem", id);
			if (!raw) return null;

			const existing = raw as unknown as RegistryItem;
			if (params.quantityDesired !== undefined && params.quantityDesired <= 0) {
				throw new Error("Quantity desired must be at least 1");
			}

			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (params.quantityDesired !== undefined)
				updates.quantityDesired = params.quantityDesired;
			if (params.priority !== undefined) updates.priority = params.priority;
			if (params.note !== undefined) updates.note = params.note;

			const updated = {
				...(raw as Record<string, unknown>),
				...updates,
			};
			await data.upsert("registryItem", id, updated);
			await recalculateCounts(existing.registryId);
			return updated as unknown as RegistryItem;
		},

		async removeItem(id: string): Promise<boolean> {
			const raw = await data.get("registryItem", id);
			if (!raw) return false;
			const item = raw as unknown as RegistryItem;
			await data.delete("registryItem", id);
			await recalculateCounts(item.registryId);
			return true;
		},

		async listItems(
			registryId: string,
			params?: { take?: number; skip?: number },
		): Promise<RegistryItem[]> {
			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where: { registryId },
				orderBy: { createdAt: "asc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("registryItem", query);
			return raw as unknown as RegistryItem[];
		},

		async getItem(id: string): Promise<RegistryItem | null> {
			const raw = await data.get("registryItem", id);
			return raw ? (raw as unknown as RegistryItem) : null;
		},

		// ── Purchases ────────────────────────────────────────────────

		async purchaseItem(params: PurchaseItemParams): Promise<RegistryPurchase> {
			const registry = await getRegistryRecord(params.registryId);
			if (!registry) {
				throw new Error("Registry not found");
			}
			if (registry.status !== "active") {
				throw new Error("Cannot purchase from an inactive registry");
			}

			const rawItem = await data.get("registryItem", params.registryItemId);
			if (!rawItem) {
				throw new Error("Registry item not found");
			}
			const item = rawItem as unknown as RegistryItem;

			if (item.registryId !== params.registryId) {
				throw new Error("Item does not belong to this registry");
			}

			if (params.quantity <= 0) {
				throw new Error("Purchase quantity must be at least 1");
			}

			const remaining = item.quantityDesired - item.quantityReceived;
			if (params.quantity > remaining) {
				throw new Error(`Only ${remaining} remaining for this item`);
			}

			const id = crypto.randomUUID();
			const purchase: RegistryPurchase = {
				id,
				registryId: params.registryId,
				registryItemId: params.registryItemId,
				purchaserName: params.purchaserName,
				quantity: params.quantity,
				amountInCents: params.amountInCents,
				isAnonymous: params.isAnonymous ?? false,
				createdAt: new Date(),
				...(params.purchaserId != null && {
					purchaserId: params.purchaserId,
				}),
				...(params.orderId != null && { orderId: params.orderId }),
				...(params.giftMessage != null && {
					giftMessage: params.giftMessage,
				}),
			};

			await data.upsert(
				"registryPurchase",
				id,
				purchase as unknown as Record<string, unknown>,
			);

			// Update item received count
			const newReceived = item.quantityReceived + params.quantity;
			await data.upsert("registryItem", item.id, {
				...(rawItem as Record<string, unknown>),
				quantityReceived: newReceived,
				updatedAt: new Date(),
			});

			await recalculateCounts(params.registryId);

			// Auto-complete registry if all items fulfilled
			const items = (await data.findMany("registryItem", {
				where: { registryId: params.registryId },
			})) as unknown as RegistryItem[];

			// Re-read updated items to check completion
			const allFulfilled = await Promise.all(
				items.map(async (i) => {
					const fresh = await data.get("registryItem", i.id);
					if (!fresh) return true;
					const f = fresh as unknown as RegistryItem;
					return f.quantityReceived >= f.quantityDesired;
				}),
			);
			if (allFulfilled.every(Boolean) && items.length > 0) {
				await updateRegistryRecord(params.registryId, {
					status: "completed",
				});
			}

			return purchase;
		},

		async listPurchases(
			registryId: string,
			params?: { take?: number; skip?: number },
		): Promise<RegistryPurchase[]> {
			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where: { registryId },
				orderBy: { createdAt: "desc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("registryPurchase", query);
			return raw as unknown as RegistryPurchase[];
		},

		async getPurchasesByItem(
			registryItemId: string,
		): Promise<RegistryPurchase[]> {
			const raw = await data.findMany("registryPurchase", {
				where: { registryItemId },
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as RegistryPurchase[];
		},

		// ── Customer queries ─────────────────────────────────────────

		async getCustomerRegistries(customerId: string): Promise<Registry[]> {
			const raw = await data.findMany("registry", {
				where: { customerId },
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as Registry[];
		},

		// ── Analytics ────────────────────────────────────────────────

		async getRegistrySummary(): Promise<RegistrySummary> {
			const allRegistries = (await data.findMany("registry", {
				where: {},
			})) as unknown as Registry[];
			const allPurchases = (await data.findMany("registryPurchase", {
				where: {},
			})) as unknown as RegistryPurchase[];
			const allItems = (await data.findMany("registryItem", {
				where: {},
			})) as unknown as RegistryItem[];

			return {
				totalRegistries: allRegistries.length,
				active: allRegistries.filter((r) => r.status === "active").length,
				completed: allRegistries.filter((r) => r.status === "completed").length,
				archived: allRegistries.filter((r) => r.status === "archived").length,
				totalItems: allItems.length,
				totalPurchased: allPurchases.reduce((sum, p) => sum + p.quantity, 0),
				totalRevenue: allPurchases.reduce((sum, p) => sum + p.amountInCents, 0),
			};
		},
	};
}
