import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	CreateWrapOptionParams,
	GiftWrappingController,
	ListOptionsParams,
	OrderWrappingTotal,
	SelectWrappingParams,
	UpdateWrapOptionParams,
	WrapOption,
	WrapSelection,
	WrapSummary,
} from "./service";

export function createGiftWrappingController(
	data: ModuleDataService,
): GiftWrappingController {
	async function getOptionRecord(id: string): Promise<WrapOption | null> {
		const raw = await data.get("wrapOption", id);
		return raw ? (raw as unknown as WrapOption) : null;
	}

	async function updateOptionRecord(
		id: string,
		updates: Record<string, unknown>,
	): Promise<WrapOption | null> {
		const existing = await data.get("wrapOption", id);
		if (!existing) return null;
		const updated = {
			...(existing as Record<string, unknown>),
			...updates,
			updatedAt: new Date(),
		};
		await data.upsert("wrapOption", id, updated);
		return updated as unknown as WrapOption;
	}

	return {
		// ── Wrap option CRUD ──────────────────────────────────────────

		async createOption(params: CreateWrapOptionParams): Promise<WrapOption> {
			if (!params.name.trim()) {
				throw new Error("Option name is required");
			}
			if (params.priceInCents < 0) {
				throw new Error("Price cannot be negative");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const option: WrapOption = {
				id,
				name: params.name.trim(),
				priceInCents: params.priceInCents,
				active: params.active ?? true,
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
				...(params.imageUrl != null && { imageUrl: params.imageUrl }),
			};

			await data.upsert(
				"wrapOption",
				id,
				option as unknown as Record<string, unknown>,
			);
			return option;
		},

		async updateOption(
			id: string,
			params: UpdateWrapOptionParams,
		): Promise<WrapOption | null> {
			const existing = await getOptionRecord(id);
			if (!existing) return null;

			if (params.name !== undefined && !params.name.trim()) {
				throw new Error("Option name cannot be empty");
			}
			if (params.priceInCents !== undefined && params.priceInCents < 0) {
				throw new Error("Price cannot be negative");
			}

			const updates: Record<string, unknown> = {};
			if (params.name !== undefined) updates.name = params.name.trim();
			if (params.description !== undefined)
				updates.description = params.description;
			if (params.priceInCents !== undefined)
				updates.priceInCents = params.priceInCents;
			if (params.imageUrl !== undefined) updates.imageUrl = params.imageUrl;
			if (params.active !== undefined) updates.active = params.active;
			if (params.sortOrder !== undefined) updates.sortOrder = params.sortOrder;

			return updateOptionRecord(id, updates);
		},

		async getOption(id: string): Promise<WrapOption | null> {
			return getOptionRecord(id);
		},

		async listOptions(params?: ListOptionsParams): Promise<WrapOption[]> {
			const where: Record<string, unknown> = {};
			if (params?.active !== undefined) where.active = params.active;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { sortOrder: "asc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("wrapOption", query);
			return raw as unknown as WrapOption[];
		},

		async deleteOption(id: string): Promise<boolean> {
			const existing = await data.get("wrapOption", id);
			if (!existing) return false;
			await data.delete("wrapOption", id);
			return true;
		},

		// ── Wrap selections ───────────────────────────────────────────

		async selectWrapping(params: SelectWrappingParams): Promise<WrapSelection> {
			if (!params.orderId) {
				throw new Error("Order ID is required");
			}
			if (!params.orderItemId) {
				throw new Error("Order item ID is required");
			}

			const option = await getOptionRecord(params.wrapOptionId);
			if (!option) {
				throw new Error("Wrap option not found");
			}
			if (!option.active) {
				throw new Error("Wrap option is not available");
			}

			// Check if this order item already has wrapping
			const existingSelections = await data.findMany("wrapSelection", {
				where: { orderItemId: params.orderItemId },
			});
			if (existingSelections.length > 0) {
				throw new Error("Order item already has gift wrapping selected");
			}

			const id = crypto.randomUUID();

			const selection: WrapSelection = {
				id,
				orderId: params.orderId,
				orderItemId: params.orderItemId,
				wrapOptionId: params.wrapOptionId,
				wrapOptionName: option.name,
				priceInCents: option.priceInCents,
				createdAt: new Date(),
				...(params.recipientName != null && {
					recipientName: params.recipientName,
				}),
				...(params.giftMessage != null && {
					giftMessage: params.giftMessage,
				}),
				...(params.customerId != null && {
					customerId: params.customerId,
				}),
			};

			await data.upsert(
				"wrapSelection",
				id,
				selection as unknown as Record<string, unknown>,
			);
			return selection;
		},

		async removeSelection(id: string): Promise<boolean> {
			const existing = await data.get("wrapSelection", id);
			if (!existing) return false;
			await data.delete("wrapSelection", id);
			return true;
		},

		async getSelection(id: string): Promise<WrapSelection | null> {
			const raw = await data.get("wrapSelection", id);
			return raw ? (raw as unknown as WrapSelection) : null;
		},

		async getOrderSelections(orderId: string): Promise<WrapSelection[]> {
			const raw = await data.findMany("wrapSelection", {
				where: { orderId },
				orderBy: { createdAt: "asc" },
			});
			return raw as unknown as WrapSelection[];
		},

		async getOrderWrappingTotal(orderId: string): Promise<OrderWrappingTotal> {
			const selections = await this.getOrderSelections(orderId);
			const totalInCents = selections.reduce(
				(sum, s) => sum + s.priceInCents,
				0,
			);
			return { selections, totalInCents };
		},

		async getItemSelection(orderItemId: string): Promise<WrapSelection | null> {
			const raw = await data.findMany("wrapSelection", {
				where: { orderItemId },
			});
			return raw.length > 0 ? (raw[0] as unknown as WrapSelection) : null;
		},

		// ── Analytics ────────────────────────────────────────────────

		async getWrapSummary(): Promise<WrapSummary> {
			const allOptions = (await data.findMany("wrapOption", {
				where: {},
			})) as unknown as WrapOption[];
			const allSelections = (await data.findMany("wrapSelection", {
				where: {},
			})) as unknown as WrapSelection[];

			return {
				totalOptions: allOptions.length,
				activeOptions: allOptions.filter((o) => o.active).length,
				totalSelections: allSelections.length,
				totalRevenue: allSelections.reduce((sum, s) => sum + s.priceInCents, 0),
			};
		},
	};
}
