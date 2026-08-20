import { describe, expect, it, vi } from "vitest";
import { assignLabel } from "../admin/endpoints/assign-label";
import { bulkAssign } from "../admin/endpoints/bulk-assign";
import { bulkUnassign } from "../admin/endpoints/bulk-unassign";
import { createLabel } from "../admin/endpoints/create-label";
import { deleteLabel } from "../admin/endpoints/delete-label";
import { labelStats } from "../admin/endpoints/label-stats";
import { adminListLabels } from "../admin/endpoints/list-labels";
import { adminProductLabels } from "../admin/endpoints/product-labels";
import { unassignLabel } from "../admin/endpoints/unassign-label";
import { updateLabel } from "../admin/endpoints/update-label";
import type {
	Label,
	LabelPosition,
	LabelStats,
	LabelType,
	ProductLabel,
	ProductLabelController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeLabel(overrides: Partial<Label> = {}): Label {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "New Arrival",
		slug: "new-arrival",
		displayText: "New",
		type: "badge" as LabelType,
		priority: 10,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeProductLabel(overrides: Partial<ProductLabel> = {}): ProductLabel {
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		labelId: "label_1",
		position: "top-left" as LabelPosition,
		assignedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<ProductLabelController> = {},
): ProductLabelController {
	return {
		createLabel: vi.fn().mockResolvedValue(makeLabel()),
		getLabel: vi.fn().mockResolvedValue(null),
		getLabelBySlug: vi.fn().mockResolvedValue(null),
		updateLabel: vi.fn().mockResolvedValue(null),
		deleteLabel: vi.fn().mockResolvedValue(false),
		listLabels: vi.fn().mockResolvedValue([]),
		countLabels: vi.fn().mockResolvedValue(0),
		assignLabel: vi.fn().mockResolvedValue(makeProductLabel()),
		unassignLabel: vi.fn().mockResolvedValue(false),
		getProductLabels: vi
			.fn()
			.mockResolvedValue({ productId: "prod_1", labels: [] }),
		getProductsForLabel: vi.fn().mockResolvedValue([]),
		countProductsForLabel: vi.fn().mockResolvedValue(0),
		bulkAssignLabel: vi.fn().mockResolvedValue(0),
		bulkUnassignLabel: vi.fn().mockResolvedValue(0),
		getActiveLabelsForProduct: vi.fn().mockResolvedValue([]),
		getLabelStats: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ProductLabelController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { productLabels: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(adminListLabels);
const createHandler = extractHandler(createLabel);
const updateHandler = extractHandler(updateLabel);
const deleteHandler = extractHandler(deleteLabel);
const assignHandler = extractHandler(assignLabel);
const unassignHandler = extractHandler(unassignLabel);
const bulkAssignHandler = extractHandler(bulkAssign);
const bulkUnassignHandler = extractHandler(bulkUnassign);
const statsHandler = extractHandler(labelStats);
const productLabelsHandler = extractHandler(adminProductLabels);

describe("admin GET /product-labels", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as {
			labels: Label[];
			total: number;
		};
		expect(result.labels).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards type filter", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { type: "badge" }, controller: ctrl });
		expect(ctrl.listLabels).toHaveBeenCalledWith(
			expect.objectContaining({ type: "badge" }),
		);
	});

	it("returns labels when present", async () => {
		const label = makeLabel({ name: "Sale" });
		const ctrl = makeController({
			listLabels: vi.fn().mockResolvedValue([label]),
			countLabels: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			labels: Label[];
			total: number;
		};
		expect(result.labels).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin POST /product-labels/create", () => {
	it("returns 400 when slug already exists", async () => {
		const ctrl = makeController({
			getLabelBySlug: vi.fn().mockResolvedValue(makeLabel()),
		});
		const result = (await call(createHandler, {
			body: { name: "X", slug: "new-arrival", displayText: "X", type: "badge" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/slug/i);
	});

	it("creates and returns the label", async () => {
		const label = makeLabel({ name: "Hot Deal" });
		const ctrl = makeController({
			getLabelBySlug: vi.fn().mockResolvedValue(null),
			createLabel: vi.fn().mockResolvedValue(label),
		});
		const result = (await call(createHandler, {
			body: {
				name: "Hot Deal",
				slug: "hot-deal",
				displayText: "Hot",
				type: "badge",
			},
			controller: ctrl,
		})) as { label: Label };
		expect(result.label.name).toBe("Hot Deal");
	});
});

describe("admin POST /product-labels/:id/update", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { name: "X" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates and returns the label", async () => {
		const label = makeLabel({ name: "Updated" });
		const ctrl = makeController({
			updateLabel: vi.fn().mockResolvedValue(label),
		});
		const result = (await call(updateHandler, {
			params: { id: label.id },
			body: { name: "Updated" },
			controller: ctrl,
		})) as { label: Label };
		expect(result.label.name).toBe("Updated");
	});
});

describe("admin POST /product-labels/:id/delete", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes and returns success", async () => {
		const ctrl = makeController({
			deleteLabel: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "label_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /product-labels/assign", () => {
	it("returns 400 when assign throws", async () => {
		const ctrl = makeController({
			assignLabel: vi.fn().mockRejectedValue(new Error("duplicate")),
		});
		const result = (await call(assignHandler, {
			body: { labelId: "label_1", productId: "prod_1" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});

	it("assigns and returns the assignment", async () => {
		const assignment = makeProductLabel({
			labelId: "label_1",
			productId: "prod_1",
		});
		const ctrl = makeController({
			assignLabel: vi.fn().mockResolvedValue(assignment),
		});
		const result = (await call(assignHandler, {
			body: { labelId: "label_1", productId: "prod_1" },
			controller: ctrl,
		})) as { assignment: ProductLabel };
		expect(result.assignment.labelId).toBe("label_1");
		expect(result.assignment.productId).toBe("prod_1");
	});
});

describe("admin POST /product-labels/unassign", () => {
	it("returns 404 when assignment not found", async () => {
		const result = (await call(unassignHandler, {
			body: { labelId: "label_1", productId: "prod_missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("unassigns and returns success", async () => {
		const ctrl = makeController({
			unassignLabel: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(unassignHandler, {
			body: { labelId: "label_1", productId: "prod_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /product-labels/bulk-assign", () => {
	it("returns 400 when bulk assign throws", async () => {
		const ctrl = makeController({
			bulkAssignLabel: vi.fn().mockRejectedValue(new Error("fail")),
		});
		const result = (await call(bulkAssignHandler, {
			body: { labelId: "label_1", productIds: ["prod_1", "prod_2"] },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});

	it("bulk assigns and returns count", async () => {
		const ctrl = makeController({
			bulkAssignLabel: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(bulkAssignHandler, {
			body: { labelId: "label_1", productIds: ["p1", "p2", "p3"] },
			controller: ctrl,
		})) as { assigned: number };
		expect(result.assigned).toBe(3);
	});
});

describe("admin POST /product-labels/bulk-unassign", () => {
	it("returns 400 when bulk unassign throws", async () => {
		const ctrl = makeController({
			bulkUnassignLabel: vi.fn().mockRejectedValue(new Error("fail")),
		});
		const result = (await call(bulkUnassignHandler, {
			body: { labelId: "label_1", productIds: ["prod_1"] },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});

	it("bulk unassigns and returns count", async () => {
		const ctrl = makeController({
			bulkUnassignLabel: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(bulkUnassignHandler, {
			body: { labelId: "label_1", productIds: ["p1", "p2"] },
			controller: ctrl,
		})) as { removed: number };
		expect(result.removed).toBe(2);
	});
});

describe("admin GET /product-labels/stats", () => {
	it("returns empty stats", async () => {
		const result = (await call(statsHandler)) as { stats: LabelStats[] };
		expect(result.stats).toHaveLength(0);
	});

	it("returns real stats", async () => {
		const stats: LabelStats[] = [
			{
				labelId: "label_1",
				name: "Sale",
				displayText: "Sale",
				type: "badge",
				isActive: true,
				productCount: 42,
			},
		];
		const ctrl = makeController({
			getLabelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: LabelStats[];
		};
		expect(result.stats).toHaveLength(1);
		expect(result.stats[0].productCount).toBe(42);
	});
});

describe("admin GET /product-labels/products/:productId", () => {
	it("returns product labels", async () => {
		const label = makeLabel({ id: "label_1" });
		const ctrl = makeController({
			getProductLabels: vi
				.fn()
				.mockResolvedValue({ productId: "prod_1", labels: [label] }),
		});
		const result = (await call(productLabelsHandler, {
			params: { productId: "prod_1" },
			controller: ctrl,
		})) as { productId: string; labels: Label[] };
		expect(result.productId).toBe("prod_1");
		expect(result.labels).toHaveLength(1);
	});

	it("returns empty labels for unknown product", async () => {
		const result = (await call(productLabelsHandler, {
			params: { productId: "prod_unknown" },
		})) as { productId: string; labels: Label[] };
		expect(result.labels).toHaveLength(0);
	});
});
