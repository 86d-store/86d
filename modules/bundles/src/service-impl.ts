import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	AddBundleItemParams,
	Bundle,
	BundleController,
	BundleItem,
	BundleWithItems,
	CreateBundleParams,
} from "./service";

function isActive(bundle: Bundle): boolean {
	if (bundle.status !== "active") return false;
	const now = new Date();
	if (bundle.startsAt && new Date(bundle.startsAt) > now) return false;
	if (bundle.endsAt && new Date(bundle.endsAt) < now) return false;
	return true;
}

export function createBundleController(
	data: ModuleDataService,
): BundleController {
	async function getItems(bundleId: string): Promise<BundleItem[]> {
		const results = await data.findMany("bundleItem", {
			where: { bundleId },
		});
		return results as unknown as BundleItem[];
	}

	return {
		async create(params: CreateBundleParams): Promise<Bundle> {
			const id = crypto.randomUUID();
			const now = new Date();

			const bundle: Bundle = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description,
				status: "draft",
				discountType: params.discountType,
				discountValue: params.discountValue,
				minQuantity: params.minQuantity,
				maxQuantity: params.maxQuantity,
				startsAt: params.startsAt,
				endsAt: params.endsAt,
				imageUrl: params.imageUrl,
				sortOrder: params.sortOrder,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("bundle", id, bundle as Record<string, unknown>);
			return bundle;
		},

		async get(id: string): Promise<Bundle | null> {
			const raw = await data.get("bundle", id);
			if (!raw) return null;
			return raw as unknown as Bundle;
		},

		async getBySlug(slug: string): Promise<Bundle | null> {
			const results = await data.findMany("bundle", {
				where: { slug },
				take: 1,
			});
			const bundles = results as unknown as Bundle[];
			return bundles.length > 0 ? bundles[0] : null;
		},

		async list(params): Promise<Bundle[]> {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const results = await data.findMany("bundle", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as Bundle[];
		},

		async update(id, updates): Promise<Bundle | null> {
			const existing = await data.get("bundle", id);
			if (!existing) return null;

			const bundle = existing as unknown as Bundle;
			const updated: Bundle = { ...bundle, updatedAt: new Date() };

			if (updates.name !== undefined) updated.name = updates.name;
			if (updates.slug !== undefined) updated.slug = updates.slug;
			if (updates.description !== undefined)
				updated.description = updates.description;
			if (updates.status !== undefined) updated.status = updates.status;
			if (updates.discountType !== undefined)
				updated.discountType = updates.discountType;
			if (updates.discountValue !== undefined)
				updated.discountValue = updates.discountValue;
			if (updates.minQuantity !== undefined)
				updated.minQuantity = updates.minQuantity;
			if (updates.maxQuantity !== undefined)
				updated.maxQuantity = updates.maxQuantity;
			if (updates.startsAt !== undefined) updated.startsAt = updates.startsAt;
			if (updates.endsAt !== undefined) updated.endsAt = updates.endsAt;
			if (updates.imageUrl !== undefined) updated.imageUrl = updates.imageUrl;
			if (updates.sortOrder !== undefined)
				updated.sortOrder = updates.sortOrder;

			await data.upsert("bundle", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id: string): Promise<boolean> {
			const existing = await data.get("bundle", id);
			if (!existing) return false;

			// Delete associated items first
			const items = await getItems(id);
			for (const item of items) {
				await data.delete("bundleItem", item.id);
			}

			await data.delete("bundle", id);
			return true;
		},

		async addItem(params: AddBundleItemParams): Promise<BundleItem> {
			const id = crypto.randomUUID();
			const now = new Date();

			const item: BundleItem = {
				id,
				bundleId: params.bundleId,
				productId: params.productId,
				variantId: params.variantId,
				quantity: params.quantity,
				sortOrder: params.sortOrder,
				productName: params.productName,
				productSlug: params.productSlug,
				productImageUrl: params.productImageUrl,
				createdAt: now,
			};

			await data.upsert("bundleItem", id, item as Record<string, unknown>);
			return item;
		},

		async removeItem(itemId: string): Promise<boolean> {
			const existing = await data.get("bundleItem", itemId);
			if (!existing) return false;
			await data.delete("bundleItem", itemId);
			return true;
		},

		async listItems(bundleId: string): Promise<BundleItem[]> {
			return getItems(bundleId);
		},

		async updateItem(itemId, updates): Promise<BundleItem | null> {
			const existing = await data.get("bundleItem", itemId);
			if (!existing) return null;

			const item = existing as unknown as BundleItem;
			const updated: BundleItem = { ...item };

			if (updates.quantity !== undefined) updated.quantity = updates.quantity;
			if (updates.sortOrder !== undefined)
				updated.sortOrder = updates.sortOrder;

			await data.upsert(
				"bundleItem",
				itemId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async getWithItems(id: string): Promise<BundleWithItems | null> {
			const bundle = await data.get("bundle", id);
			if (!bundle) return null;
			const items = await getItems(id);
			return { ...(bundle as unknown as Bundle), items };
		},

		async getActiveBySlug(slug: string): Promise<BundleWithItems | null> {
			const results = await data.findMany("bundle", {
				where: { slug },
				take: 1,
			});
			const bundles = results as unknown as Bundle[];
			if (bundles.length === 0) return null;

			const bundle = bundles[0];
			if (!isActive(bundle)) return null;

			const items = await getItems(bundle.id);
			return { ...bundle, items };
		},

		async listActive(params): Promise<BundleWithItems[]> {
			const results = await data.findMany("bundle", {
				where: { status: "active" },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			const bundles = results as unknown as Bundle[];

			const active: BundleWithItems[] = [];
			for (const bundle of bundles) {
				if (isActive(bundle)) {
					const items = await getItems(bundle.id);
					active.push({ ...bundle, items });
				}
			}
			return active;
		},

		async countAll(): Promise<number> {
			const all = await data.findMany("bundle", {});
			return (all as unknown as Bundle[]).length;
		},
	};
}
