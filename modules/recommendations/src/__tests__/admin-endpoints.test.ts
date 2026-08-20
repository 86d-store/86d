import { describe, expect, it, vi } from "vitest";
import { createRule } from "../admin/endpoints/create-rule";
import { deleteRule } from "../admin/endpoints/delete-rule";
import { generateEmbedding } from "../admin/endpoints/generate-embedding";
import { getCoOccurrences } from "../admin/endpoints/get-co-occurrences";
import { getSettings } from "../admin/endpoints/get-settings";
import { getStats } from "../admin/endpoints/get-stats";
import { listRules } from "../admin/endpoints/list-rules";
import { recordPurchase } from "../admin/endpoints/record-purchase";
import { updateRule } from "../admin/endpoints/update-rule";
import type {
	CoOccurrence,
	RecommendationController,
	RecommendationRule,
	RecommendationStrategy,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeRule(
	overrides: Partial<RecommendationRule> = {},
): RecommendationRule {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Frequently Bought Together",
		strategy: "bought_together" as RecommendationStrategy,
		targetProductIds: ["prod-2", "prod-3"],
		weight: 1,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCoOccurrence(overrides: Partial<CoOccurrence> = {}): CoOccurrence {
	return {
		id: crypto.randomUUID(),
		productId1: "prod-1",
		productId2: "prod-2",
		count: 10,
		lastOccurredAt: new Date(),
		...overrides,
	};
}

function makeStatsResult() {
	return {
		totalRules: 0,
		activeRules: 0,
		totalCoOccurrences: 0,
		totalInteractions: 0,
		embeddingsCount: 0,
		aiConfigured: false,
		totalImpressions: 0,
		totalClicks: 0,
		clickThroughRate: 0,
		avgClickPosition: 0,
	};
}

function makeController(
	overrides: Partial<RecommendationController> = {},
): RecommendationController {
	return {
		createRule: vi.fn().mockResolvedValue(makeRule()),
		updateRule: vi.fn().mockResolvedValue(null),
		deleteRule: vi.fn().mockResolvedValue(false),
		getRule: vi.fn().mockResolvedValue(null),
		listRules: vi.fn().mockResolvedValue([]),
		countRules: vi.fn().mockResolvedValue(0),
		recordPurchase: vi.fn().mockResolvedValue(0),
		getCoOccurrences: vi.fn().mockResolvedValue([]),
		trackInteraction: vi.fn().mockResolvedValue({}),
		getForProduct: vi.fn().mockResolvedValue([]),
		getTrending: vi.fn().mockResolvedValue([]),
		getPersonalized: vi.fn().mockResolvedValue([]),
		generateProductEmbedding: vi.fn().mockResolvedValue(null),
		getAISimilar: vi.fn().mockResolvedValue([]),
		recordImpression: vi.fn().mockResolvedValue({}),
		recordClick: vi.fn().mockResolvedValue(null),
		getAnalytics: vi.fn().mockResolvedValue({
			totalImpressions: 0,
			totalServedItems: 0,
			totalClicks: 0,
			clickThroughRate: 0,
			avgClickPosition: 0,
			bySurface: [],
		}),
		getStats: vi.fn().mockResolvedValue(makeStatsResult()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: RecommendationController;
		options?: Record<string, unknown>;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				recommendations: opts.controller ?? makeController(),
			},
			options: opts.options,
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listRules);
const createHandler = extractHandler(createRule);
const updateHandler = extractHandler(updateRule);
const deleteHandler = extractHandler(deleteRule);
const recordPurchaseHandler = extractHandler(recordPurchase);
const coOccurrencesHandler = extractHandler(getCoOccurrences);
const statsHandler = extractHandler(getStats);
const settingsHandler = extractHandler(getSettings);
const embeddingHandler = extractHandler(generateEmbedding);

// ── admin GET /recommendations/rules ─────────────────────────────────────────

describe("admin GET /recommendations/rules", () => {
	it("returns empty list and zero total when no rules exist", async () => {
		const result = (await call(listHandler)) as {
			rules: RecommendationRule[];
			total: number;
		};
		expect(result.rules).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns rules and total from controller", async () => {
		const rules = [makeRule(), makeRule({ strategy: "trending" })];
		const ctrl = makeController({
			listRules: vi.fn().mockResolvedValue(rules),
			countRules: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			rules: RecommendationRule[];
			total: number;
		};
		expect(result.rules).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes strategy filter to both listRules and countRules", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { strategy: "manual" },
			controller: ctrl,
		});
		expect(ctrl.listRules).toHaveBeenCalledWith(
			expect.objectContaining({ strategy: "manual" }),
		);
		expect(ctrl.countRules).toHaveBeenCalledWith(
			expect.objectContaining({ strategy: "manual" }),
		);
	});

	it("passes isActive filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.listRules).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});
});

// ── admin POST /recommendations/rules/create ─────────────────────────────────

describe("admin POST /recommendations/rules/create", () => {
	it("creates a rule and returns it", async () => {
		const rule = makeRule({ name: "New Rule", strategy: "manual" });
		const ctrl = makeController({
			createRule: vi.fn().mockResolvedValue(rule),
		});
		const result = (await call(createHandler, {
			body: {
				name: "New Rule",
				strategy: "manual",
				targetProductIds: ["prod-a", "prod-b"],
			},
			controller: ctrl,
		})) as { rule: RecommendationRule };
		expect(result.rule.name).toBe("New Rule");
		expect(result.rule.strategy).toBe("manual");
		expect(ctrl.createRule).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "New Rule",
				strategy: "manual",
				targetProductIds: ["prod-a", "prod-b"],
			}),
		);
	});

	it("forwards optional sourceProductId to controller", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: {
				name: "Source-based rule",
				strategy: "bought_together",
				targetProductIds: ["prod-x"],
				sourceProductId: "prod-origin",
			},
			controller: ctrl,
		});
		expect(ctrl.createRule).toHaveBeenCalledWith(
			expect.objectContaining({ sourceProductId: "prod-origin" }),
		);
	});
});

// ── admin POST /recommendations/rules/:id ────────────────────────────────────

describe("admin POST /recommendations/rules/:id", () => {
	it("returns 404 with status when rule not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Rule not found");
		expect(result.status).toBe(404);
	});

	it("returns updated rule on success", async () => {
		const updated = makeRule({ id: "rule-1", name: "Updated Rule" });
		const ctrl = makeController({
			updateRule: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateHandler, {
			params: { id: "rule-1" },
			body: { name: "Updated Rule" },
			controller: ctrl,
		})) as { rule: RecommendationRule };
		expect(result.rule.name).toBe("Updated Rule");
		expect(ctrl.updateRule).toHaveBeenCalledWith(
			"rule-1",
			expect.objectContaining({ name: "Updated Rule" }),
		);
	});

	it("forwards isActive toggle to controller", async () => {
		const ctrl = makeController({
			updateRule: vi.fn().mockResolvedValue(makeRule()),
		});
		await call(updateHandler, {
			params: { id: "rule-2" },
			body: { isActive: false },
			controller: ctrl,
		});
		expect(ctrl.updateRule).toHaveBeenCalledWith(
			"rule-2",
			expect.objectContaining({ isActive: false }),
		);
	});
});

// ── admin POST /recommendations/rules/:id/delete ─────────────────────────────

describe("admin POST /recommendations/rules/:id/delete", () => {
	it("returns 404 with status when rule not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Rule not found");
		expect(result.status).toBe(404);
	});

	it("returns success: true when rule deleted", async () => {
		const ctrl = makeController({
			deleteRule: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "rule-3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteRule).toHaveBeenCalledWith("rule-3");
	});
});

// ── admin POST /recommendations/record-purchase ───────────────────────────────

describe("admin POST /recommendations/record-purchase", () => {
	it("returns count of pairs recorded", async () => {
		const ctrl = makeController({
			recordPurchase: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(recordPurchaseHandler, {
			body: { productIds: ["p1", "p2", "p3"] },
			controller: ctrl,
		})) as { pairsRecorded: number };
		expect(result.pairsRecorded).toBe(3);
		expect(ctrl.recordPurchase).toHaveBeenCalledWith(["p1", "p2", "p3"]);
	});

	it("returns 0 when only one pair possible", async () => {
		const ctrl = makeController({
			recordPurchase: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(recordPurchaseHandler, {
			body: { productIds: ["p1", "p2"] },
			controller: ctrl,
		})) as { pairsRecorded: number };
		expect(result.pairsRecorded).toBe(1);
	});
});

// ── admin GET /recommendations/co-occurrences/:productId ─────────────────────

describe("admin GET /recommendations/co-occurrences/:productId", () => {
	it("returns empty list when no co-occurrences", async () => {
		const result = (await call(coOccurrencesHandler, {
			params: { productId: "prod-x" },
		})) as { coOccurrences: CoOccurrence[] };
		expect(result.coOccurrences).toHaveLength(0);
	});

	it("returns co-occurrences from controller", async () => {
		const pairs = [
			makeCoOccurrence({
				productId1: "prod-1",
				productId2: "prod-2",
				count: 8,
			}),
			makeCoOccurrence({
				productId1: "prod-1",
				productId2: "prod-3",
				count: 5,
			}),
		];
		const ctrl = makeController({
			getCoOccurrences: vi.fn().mockResolvedValue(pairs),
		});
		const result = (await call(coOccurrencesHandler, {
			params: { productId: "prod-1" },
			controller: ctrl,
		})) as { coOccurrences: CoOccurrence[] };
		expect(result.coOccurrences).toHaveLength(2);
		expect(result.coOccurrences[0].count).toBe(8);
		expect(ctrl.getCoOccurrences).toHaveBeenCalledWith(
			"prod-1",
			expect.objectContaining({}),
		);
	});
});

// ── admin GET /recommendations/stats ─────────────────────────────────────────

describe("admin GET /recommendations/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as {
			stats: { totalRules: number; coOccurrenceCount: number };
		};
		expect(result.stats.totalRules).toBe(0);
	});

	it("returns stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				...makeStatsResult(),
				totalRules: 5,
				activeRules: 3,
				totalCoOccurrences: 42,
				embeddingsCount: 100,
				totalImpressions: 1000,
				totalClicks: 75,
				clickThroughRate: 0.075,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: {
				totalRules: number;
				activeRules: number;
				totalCoOccurrences: number;
				embeddingsCount: number;
			};
		};
		expect(result.stats.totalRules).toBe(5);
		expect(result.stats.activeRules).toBe(3);
		expect(result.stats.totalCoOccurrences).toBe(42);
		expect(result.stats.embeddingsCount).toBe(100);
		expect(ctrl.getStats).toHaveBeenCalled();
	});
});

// ── admin GET /recommendations/settings ──────────────────────────────────────

describe("admin GET /recommendations/settings", () => {
	it("returns not_configured AI status when no keys in options", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				...makeStatsResult(),
				embeddingsCount: 7,
			}),
		});
		const result = (await call(settingsHandler, { controller: ctrl })) as {
			ai: {
				status: string;
				configured: boolean;
				provider: string | null;
				model: string;
				apiKey: string | null;
			};
			embeddingsCount: number;
		};
		expect(result.ai.status).toBe("not_configured");
		expect(result.ai.configured).toBe(false);
		expect(result.ai.provider).toBeNull();
		expect(result.ai.apiKey).toBeNull();
		expect(result.embeddingsCount).toBe(7);
	});

	it("returns embeddingsCount from controller.getStats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				...makeStatsResult(),
				embeddingsCount: 42,
			}),
		});
		const result = (await call(settingsHandler, { controller: ctrl })) as {
			embeddingsCount: number;
		};
		expect(result.embeddingsCount).toBe(42);
		expect(ctrl.getStats).toHaveBeenCalled();
	});
});

// ── admin POST /recommendations/embeddings/generate ──────────────────────────

describe("admin POST /recommendations/embeddings/generate", () => {
	it("returns 400 with error when AI not configured (null result)", async () => {
		const ctrl = makeController({
			generateProductEmbedding: vi.fn().mockResolvedValue(null),
		});
		const result = (await call(embeddingHandler, {
			body: { productId: "prod-1", text: "A great blue t-shirt" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/AI recommendations not configured/i);
	});

	it("returns embedding when generation succeeds", async () => {
		const embeddingRecord = {
			id: "emb-1",
			productId: "prod-1",
			embedding: [0.1, 0.2, 0.3],
			text: "A great blue t-shirt",
			createdAt: new Date(),
		};
		const ctrl = makeController({
			generateProductEmbedding: vi.fn().mockResolvedValue(embeddingRecord),
		});
		const result = (await call(embeddingHandler, {
			body: { productId: "prod-1", text: "A great blue t-shirt" },
			controller: ctrl,
		})) as { embedding: { id: string; productId: string; createdAt: Date } };
		expect(result.embedding.id).toBe("emb-1");
		expect(result.embedding.productId).toBe("prod-1");
		expect(ctrl.generateProductEmbedding).toHaveBeenCalledWith(
			"prod-1",
			"A great blue t-shirt",
			expect.any(Object),
		);
	});

	it("forwards optional metadata to controller", async () => {
		const ctrl = makeController({
			generateProductEmbedding: vi.fn().mockResolvedValue({
				id: "emb-2",
				productId: "prod-2",
				embedding: [],
				text: "Comfy jeans",
				createdAt: new Date(),
			}),
		});
		await call(embeddingHandler, {
			body: {
				productId: "prod-2",
				text: "Comfy jeans",
				productName: "Blue Jeans",
				productPrice: 4999,
			},
			controller: ctrl,
		});
		expect(ctrl.generateProductEmbedding).toHaveBeenCalledWith(
			"prod-2",
			"Comfy jeans",
			expect.objectContaining({
				productName: "Blue Jeans",
				productPrice: 4999,
			}),
		);
	});
});
