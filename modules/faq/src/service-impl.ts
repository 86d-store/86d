import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { FaqCategory, FaqController, FaqItem } from "./service";

export function createFaqControllers(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): FaqController {
	return {
		async createCategory(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const category: FaqCategory = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description ?? undefined,
				icon: params.icon ?? undefined,
				position: params.position ?? 0,
				isVisible: true,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("faqCategory", id, category as Record<string, unknown>);
			void events?.emit("faq.category.created", {
				categoryId: category.id,
				name: category.name,
				slug: category.slug,
			});

			return category;
		},

		async getCategory(id: string) {
			return (await data.get("faqCategory", id)) as FaqCategory | null;
		},

		async getCategoryBySlug(slug: string) {
			const categories = (await data.findMany("faqCategory", {
				where: { slug },
			})) as FaqCategory[];

			return categories[0] ?? null;
		},

		async listCategories(opts = {}) {
			const { visibleOnly = false } = opts;

			const where: Record<string, unknown> = {};
			if (visibleOnly) where.isVisible = true;

			const categories = (await data.findMany("faqCategory", {
				where,
			})) as FaqCategory[];

			return categories.sort((a, b) => a.position - b.position);
		},

		async updateCategory(id, updateData) {
			const existing = (await data.get(
				"faqCategory",
				id,
			)) as FaqCategory | null;
			if (!existing) {
				throw new Error(`FAQ category ${id} not found`);
			}

			const updated: FaqCategory = {
				...existing,
				...(updateData.name !== undefined && { name: updateData.name }),
				...(updateData.slug !== undefined && { slug: updateData.slug }),
				...(updateData.description !== undefined && {
					description: updateData.description,
				}),
				...(updateData.icon !== undefined && { icon: updateData.icon }),
				...(updateData.position !== undefined && {
					position: updateData.position,
				}),
				...(updateData.isVisible !== undefined && {
					isVisible: updateData.isVisible,
				}),
				updatedAt: new Date(),
			};

			await data.upsert("faqCategory", id, updated as Record<string, unknown>);
			void events?.emit("faq.category.updated", {
				categoryId: updated.id,
				name: updated.name,
				slug: updated.slug,
			});

			return updated;
		},

		async deleteCategory(id: string) {
			// Delete all items in this category first
			const items = (await data.findMany("faqItem", {
				where: { categoryId: id },
			})) as FaqItem[];

			for (const item of items) {
				await data.delete("faqItem", item.id);
			}

			await data.delete("faqCategory", id);
			void events?.emit("faq.category.deleted", { categoryId: id });
		},

		async createItem(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const item: FaqItem = {
				id,
				categoryId: params.categoryId,
				question: params.question,
				answer: params.answer,
				slug: params.slug,
				position: params.position ?? 0,
				isVisible: true,
				tags: params.tags ?? [],
				helpfulCount: 0,
				notHelpfulCount: 0,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("faqItem", id, item as Record<string, unknown>);
			void events?.emit("faq.item.created", {
				itemId: item.id,
				categoryId: item.categoryId,
				question: item.question,
				slug: item.slug,
			});

			return item;
		},

		async getItem(id: string) {
			return (await data.get("faqItem", id)) as FaqItem | null;
		},

		async getItemBySlug(slug: string) {
			const items = (await data.findMany("faqItem", {
				where: { slug },
			})) as FaqItem[];

			return items[0] ?? null;
		},

		async listItems(opts = {}) {
			const { categoryId, visibleOnly = false } = opts;

			const where: Record<string, unknown> = {};
			if (categoryId) where.categoryId = categoryId;
			if (visibleOnly) where.isVisible = true;

			const items = (await data.findMany("faqItem", {
				where,
			})) as FaqItem[];

			return items.sort((a, b) => a.position - b.position);
		},

		async updateItem(id, updateData) {
			const existing = (await data.get("faqItem", id)) as FaqItem | null;
			if (!existing) {
				throw new Error(`FAQ item ${id} not found`);
			}

			const updated: FaqItem = {
				...existing,
				...(updateData.categoryId !== undefined && {
					categoryId: updateData.categoryId,
				}),
				...(updateData.question !== undefined && {
					question: updateData.question,
				}),
				...(updateData.answer !== undefined && {
					answer: updateData.answer,
				}),
				...(updateData.slug !== undefined && { slug: updateData.slug }),
				...(updateData.position !== undefined && {
					position: updateData.position,
				}),
				...(updateData.isVisible !== undefined && {
					isVisible: updateData.isVisible,
				}),
				...(updateData.tags !== undefined && { tags: updateData.tags }),
				updatedAt: new Date(),
			};

			await data.upsert("faqItem", id, updated as Record<string, unknown>);
			void events?.emit("faq.item.updated", {
				itemId: updated.id,
				categoryId: updated.categoryId,
				question: updated.question,
				slug: updated.slug,
			});

			return updated;
		},

		async deleteItem(id: string) {
			await data.delete("faqItem", id);
			void events?.emit("faq.item.deleted", { itemId: id });
		},

		async search(query, opts = {}) {
			const { categoryId, limit = 20 } = opts;
			const normalizedQuery = query.toLowerCase().trim();

			if (!normalizedQuery) return [];

			const where: Record<string, unknown> = { isVisible: true };
			if (categoryId) where.categoryId = categoryId;

			const items = (await data.findMany("faqItem", {
				where,
			})) as FaqItem[];

			const scored = items
				.map((item) => {
					let score = 0;
					const q = item.question.toLowerCase();
					const a = item.answer.toLowerCase();
					const tags = (item.tags ?? []).map((t) => t.toLowerCase());

					// Exact question match scores highest
					if (q.includes(normalizedQuery)) score += 10;
					// Answer match
					if (a.includes(normalizedQuery)) score += 5;
					// Tag match
					if (tags.some((t) => t.includes(normalizedQuery))) score += 8;

					// Word-level matching for partial queries
					const words = normalizedQuery.split(/\s+/);
					for (const word of words) {
						if (word.length < 2) continue;
						if (q.includes(word)) score += 3;
						if (a.includes(word)) score += 1;
						if (tags.some((t) => t.includes(word))) score += 2;
					}

					return { item, score };
				})
				.filter((r) => r.score > 0)
				.sort((a, b) => b.score - a.score)
				.slice(0, limit);

			return scored.map((r) => r.item);
		},

		async vote(itemId, helpful) {
			const item = (await data.get("faqItem", itemId)) as FaqItem | null;
			if (!item) {
				throw new Error(`FAQ item ${itemId} not found`);
			}

			const updated: FaqItem = {
				...item,
				helpfulCount: helpful ? item.helpfulCount + 1 : item.helpfulCount,
				notHelpfulCount: helpful
					? item.notHelpfulCount
					: item.notHelpfulCount + 1,
				updatedAt: new Date(),
			};

			await data.upsert("faqItem", itemId, updated as Record<string, unknown>);

			return updated;
		},

		async getStats() {
			const categories = (await data.findMany(
				"faqCategory",
				{},
			)) as FaqCategory[];
			const items = (await data.findMany("faqItem", {})) as FaqItem[];

			return {
				totalCategories: categories.length,
				totalItems: items.length,
				totalHelpful: items.reduce((sum, i) => sum + i.helpfulCount, 0),
				totalNotHelpful: items.reduce((sum, i) => sum + i.notHelpfulCount, 0),
			};
		},
	};
}
