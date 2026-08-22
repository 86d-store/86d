import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Label,
	LabelPosition,
	LabelType,
	ProductLabel,
	ProductLabelController,
} from "./service";

export function createProductLabelController(
	data: ModuleDataService,
): ProductLabelController {
	return {
		// --- Label CRUD ---

		async createLabel(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const label: Label = {
				id,
				name: params.name,
				slug: params.slug,
				displayText: params.displayText,
				type: params.type,
				color: params.color,
				backgroundColor: params.backgroundColor,
				icon: params.icon,
				priority: params.priority ?? 0,
				isActive: params.isActive ?? true,
				startsAt: params.startsAt,
				endsAt: params.endsAt,
				conditions: params.conditions,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("label", id, label as Record<string, unknown>);
			return label;
		},

		async getLabel(id) {
			const raw = await data.get("label", id);
			return raw as unknown as Label;
		},

		async getLabelBySlug(slug) {
			const all = (await data.findMany("label", {
				where: { slug },
			})) as unknown as Label[];
			return all[0] ?? null;
		},

		async updateLabel(id, params) {
			const existing = await data.get("label", id);
			if (!existing) return null;

			const current = existing as unknown as Label;
			const updated: Label = {
				...current,
				name: params.name ?? current.name,
				displayText: params.displayText ?? current.displayText,
				type: (params.type ?? current.type) as LabelType,
				color: params.color ?? current.color,
				backgroundColor: params.backgroundColor ?? current.backgroundColor,
				icon: params.icon ?? current.icon,
				priority: params.priority ?? current.priority,
				isActive: params.isActive ?? current.isActive,
				startsAt:
					params.startsAt === null
						? undefined
						: (params.startsAt ?? current.startsAt),
				endsAt:
					params.endsAt === null
						? undefined
						: (params.endsAt ?? current.endsAt),
				conditions:
					params.conditions === null
						? undefined
						: (params.conditions ?? current.conditions),
				updatedAt: new Date(),
			};
			await data.upsert("label", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteLabel(id) {
			const existing = await data.get("label", id);
			if (!existing) return false;

			// Also remove all product assignments for this label
			const assignments = (await data.findMany("productLabel", {
				where: { labelId: id },
			})) as unknown as ProductLabel[];

			for (const assignment of assignments) {
				await data.delete("productLabel", assignment.id);
			}

			await data.delete("label", id);
			return true;
		},

		async listLabels(params) {
			const where: Record<string, unknown> = {};
			if (params?.type) where.type = params.type;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const labels = (await data.findMany("label", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			})) as unknown as Label[];

			// Sort by priority descending (higher priority first), then by name
			return labels.sort((a, b) => {
				if (b.priority !== a.priority) return b.priority - a.priority;
				return a.name.localeCompare(b.name);
			});
		},

		async countLabels(params) {
			const where: Record<string, unknown> = {};
			if (params?.type) where.type = params.type;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const labels = (await data.findMany("label", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as unknown as Label[];

			return labels.length;
		},

		// --- Product-Label assignments ---

		async assignLabel(params) {
			// Verify label exists
			const label = await data.get("label", params.labelId);
			if (!label) {
				throw new Error("Label not found");
			}

			// Check for existing assignment
			const existing = (await data.findMany("productLabel", {
				where: {
					productId: params.productId,
					labelId: params.labelId,
				},
			})) as unknown as ProductLabel[];

			if (existing.length > 0) {
				// Update position if different
				const updated: ProductLabel = {
					...existing[0],
					position: params.position,
				};
				await data.upsert(
					"productLabel",
					existing[0].id,
					updated as Record<string, unknown>,
				);
				return updated;
			}

			const id = crypto.randomUUID();
			const assignment: ProductLabel = {
				id,
				productId: params.productId,
				labelId: params.labelId,
				position: params.position,
				assignedAt: new Date(),
			};
			await data.upsert(
				"productLabel",
				id,
				assignment as Record<string, unknown>,
			);
			return assignment;
		},

		async unassignLabel(params) {
			const existing = (await data.findMany("productLabel", {
				where: {
					productId: params.productId,
					labelId: params.labelId,
				},
			})) as unknown as ProductLabel[];

			if (existing.length === 0) return false;

			for (const item of existing) {
				await data.delete("productLabel", item.id);
			}
			return true;
		},

		async getProductLabels(productId) {
			const assignments = (await data.findMany("productLabel", {
				where: { productId },
			})) as unknown as ProductLabel[];

			const labels: Array<Label & { position?: LabelPosition | undefined }> =
				[];

			for (const assignment of assignments) {
				const label = (await data.get(
					"label",
					assignment.labelId,
				)) as unknown as Label | null;
				if (label) {
					labels.push({
						...label,
						position: assignment.position as LabelPosition | undefined,
					});
				}
			}

			// Sort by priority descending
			labels.sort((a, b) => b.priority - a.priority);

			return { productId, labels };
		},

		async getProductsForLabel(params) {
			const assignments = (await data.findMany("productLabel", {
				where: { labelId: params.labelId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			})) as unknown as ProductLabel[];

			return assignments.sort(
				(a, b) =>
					new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
			);
		},

		async countProductsForLabel(labelId) {
			const assignments = (await data.findMany("productLabel", {
				where: { labelId },
			})) as unknown as ProductLabel[];

			return assignments.length;
		},

		async bulkAssignLabel(params) {
			const label = await data.get("label", params.labelId);
			if (!label) {
				throw new Error("Label not found");
			}

			let assigned = 0;

			for (const productId of params.productIds) {
				// Check for existing assignment
				const existing = (await data.findMany("productLabel", {
					where: { productId, labelId: params.labelId },
				})) as unknown as ProductLabel[];

				if (existing.length === 0) {
					const id = crypto.randomUUID();
					const assignment: ProductLabel = {
						id,
						productId,
						labelId: params.labelId,
						position: params.position,
						assignedAt: new Date(),
					};
					await data.upsert(
						"productLabel",
						id,
						assignment as Record<string, unknown>,
					);
					assigned += 1;
				}
			}

			return assigned;
		},

		async bulkUnassignLabel(params) {
			let removed = 0;

			for (const productId of params.productIds) {
				const existing = (await data.findMany("productLabel", {
					where: { productId, labelId: params.labelId },
				})) as unknown as ProductLabel[];

				for (const item of existing) {
					await data.delete("productLabel", item.id);
					removed += 1;
				}
			}

			return removed;
		},

		// --- Queries ---

		async getActiveLabelsForProduct(productId) {
			const assignments = (await data.findMany("productLabel", {
				where: { productId },
			})) as unknown as ProductLabel[];

			const now = new Date();
			const labels: Label[] = [];

			for (const assignment of assignments) {
				const label = (await data.get(
					"label",
					assignment.labelId,
				)) as unknown as Label | null;

				if (!label?.isActive) continue;

				// Check date range
				if (label.startsAt && new Date(label.startsAt) > now) continue;
				if (label.endsAt && new Date(label.endsAt) < now) continue;

				labels.push(label);
			}

			// Sort by priority descending
			return labels.sort((a, b) => b.priority - a.priority);
		},

		async getLabelStats(params) {
			const allLabels = (await data.findMany(
				"label",
				{},
			)) as unknown as Label[];

			const allAssignments = (await data.findMany(
				"productLabel",
				{},
			)) as unknown as ProductLabel[];

			// Count products per label
			const countMap = new Map<string, number>();
			for (const assignment of allAssignments) {
				const count = countMap.get(assignment.labelId) ?? 0;
				countMap.set(assignment.labelId, count + 1);
			}

			const stats = allLabels.map((label) => ({
				labelId: label.id,
				name: label.name,
				displayText: label.displayText,
				type: label.type as LabelType,
				isActive: label.isActive,
				productCount: countMap.get(label.id) ?? 0,
			}));

			// Sort by product count descending
			stats.sort((a, b) => b.productCount - a.productCount);

			const take = params?.take ?? 50;
			return stats.slice(0, take);
		},
	};
}
