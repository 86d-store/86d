import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import search from "../index";

// ── helpers ──────────────────────────────────────────────────────────────────

async function initModule(
	mod: ReturnType<typeof search>,
	data: ReturnType<typeof createMockDataService>,
	events?: ReturnType<typeof createScopedEmitter>,
) {
	const init = mod.init;
	expect(init).toBeDefined();
	if (init) {
		const ctx = createMockModuleContext({ data });
		await init({ ...ctx, events });
	}
}

/** Wait briefly for fire-and-forget async handlers to complete. */
function flushAsync(): Promise<void> {
	return new Promise<void>((r) => {
		setTimeout(r, 50);
	});
}

// ── product.created ──────────────────────────────────────────────────────────

describe("product.created event listener", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a product.created listener on init", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");

		await initModule(search(), mockData, emitter);

		expect(bus.listenerCount("product.created")).toBe(1);
	});

	it("indexes an active product when created", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		await productsEmitter.emit("product.created", {
			productId: "prod-1",
			name: "Running Shoes",
			slug: "running-shoes",
			price: 7999,
			status: "active",
		});
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(1);
		expect(indexed[0]).toMatchObject({
			entityType: "product",
			entityId: "prod-1",
			title: "Running Shoes",
			url: "/products/running-shoes",
		});
	});

	it("indexes a product with no status (assumed active)", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		await productsEmitter.emit("product.created", {
			productId: "prod-2",
			name: "Wireless Headphones",
			slug: "wireless-headphones",
			price: 12999,
		});
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(1);
		expect(indexed[0]).toMatchObject({
			entityType: "product",
			entityId: "prod-2",
		});
	});

	it("does NOT index a product with status 'draft'", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		await productsEmitter.emit("product.created", {
			productId: "prod-draft",
			name: "Unreleased Product",
			slug: "unreleased-product",
			status: "draft",
		});
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(0);
	});

	it("does NOT index a product with status 'inactive'", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		await productsEmitter.emit("product.created", {
			productId: "prod-inactive",
			name: "Discontinued Product",
			slug: "discontinued-product",
			status: "inactive",
		});
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(0);
	});

	it("stores price and status in metadata", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		await productsEmitter.emit("product.created", {
			productId: "prod-meta",
			name: "Sneakers",
			slug: "sneakers",
			price: 5999,
			status: "active",
		});
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(1);
		expect(indexed[0]).toMatchObject({
			metadata: { price: 5999, status: "active" },
		});
	});

	it("indexes multiple products from sequential events", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		for (let i = 1; i <= 3; i++) {
			await productsEmitter.emit("product.created", {
				productId: `prod-${i}`,
				name: `Product ${i}`,
				slug: `product-${i}`,
				status: "active",
			});
		}
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(3);
	});
});

// ── product.updated ──────────────────────────────────────────────────────────

describe("product.updated event listener", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a product.updated listener on init", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");

		await initModule(search(), mockData, emitter);

		expect(bus.listenerCount("product.updated")).toBe(1);
	});

	it("re-indexes an active product when updated", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		// First index the product
		await productsEmitter.emit("product.created", {
			productId: "prod-update",
			name: "Old Name",
			slug: "old-name",
			status: "active",
		});
		await flushAsync();

		// Then update it
		await productsEmitter.emit("product.updated", {
			productId: "prod-update",
			name: "New Name",
			slug: "new-name",
			price: 3999,
			status: "active",
		});
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(1);
		expect(indexed[0]).toMatchObject({
			title: "New Name",
			url: "/products/new-name",
		});
	});

	it("removes an inactive product from the index when updated", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		// First index the product
		await productsEmitter.emit("product.created", {
			productId: "prod-deactivate",
			name: "Active Product",
			slug: "active-product",
			status: "active",
		});
		await flushAsync();

		expect(mockData.all("searchIndex")).toHaveLength(1);

		// Now deactivate it
		await productsEmitter.emit("product.updated", {
			productId: "prod-deactivate",
			name: "Active Product",
			slug: "active-product",
			status: "inactive",
		});
		await flushAsync();

		expect(mockData.all("searchIndex")).toHaveLength(0);
	});

	it("removes a draft product from the index when updated", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		// First index it as active
		await productsEmitter.emit("product.created", {
			productId: "prod-draft-update",
			name: "Test Product",
			slug: "test-product",
			status: "active",
		});
		await flushAsync();

		// Now mark it as draft
		await productsEmitter.emit("product.updated", {
			productId: "prod-draft-update",
			name: "Test Product",
			slug: "test-product",
			status: "draft",
		});
		await flushAsync();

		expect(mockData.all("searchIndex")).toHaveLength(0);
	});

	it("indexes a product with no status (assumed active)", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		await productsEmitter.emit("product.updated", {
			productId: "prod-nostatus",
			name: "No Status Product",
			slug: "no-status-product",
		});
		await flushAsync();

		const indexed = mockData.all("searchIndex");
		expect(indexed).toHaveLength(1);
		expect(indexed[0]).toMatchObject({ entityId: "prod-nostatus" });
	});
});

// ── product.deleted ──────────────────────────────────────────────────────────

describe("product.deleted event listener", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a product.deleted listener on init", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");

		await initModule(search(), mockData, emitter);

		expect(bus.listenerCount("product.deleted")).toBe(1);
	});

	it("removes a product from the search index when deleted", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		// Index a product first
		await productsEmitter.emit("product.created", {
			productId: "prod-delete",
			name: "To Be Deleted",
			slug: "to-be-deleted",
			status: "active",
		});
		await flushAsync();

		expect(mockData.all("searchIndex")).toHaveLength(1);

		// Delete the product
		await productsEmitter.emit("product.deleted", { productId: "prod-delete" });
		await flushAsync();

		expect(mockData.all("searchIndex")).toHaveLength(0);
	});

	it("does not throw when deleting a product not in the index", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		await expect(
			productsEmitter.emit("product.deleted", { productId: "nonexistent" }),
		).resolves.not.toThrow();

		expect(mockData.all("searchIndex")).toHaveLength(0);
	});

	it("removes only the deleted product when multiple are indexed", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "search");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(search(), mockData, emitter);

		// Index three products
		for (let i = 1; i <= 3; i++) {
			await productsEmitter.emit("product.created", {
				productId: `prod-keep-${i}`,
				name: `Keep Product ${i}`,
				slug: `keep-product-${i}`,
				status: "active",
			});
		}
		await productsEmitter.emit("product.created", {
			productId: "prod-remove",
			name: "Remove This",
			slug: "remove-this",
			status: "active",
		});
		await flushAsync();

		expect(mockData.all("searchIndex")).toHaveLength(4);

		// Delete only one
		await productsEmitter.emit("product.deleted", { productId: "prod-remove" });
		await flushAsync();

		const remaining = mockData.all("searchIndex");
		expect(remaining).toHaveLength(3);
		expect(remaining.every((r) => r.entityId !== "prod-remove")).toBe(true);
	});
});

// ── no events emitter ─────────────────────────────────────────────────────────

describe("init without event emitter", () => {
	it("does not throw when no events are provided", async () => {
		const mockData = createMockDataService();
		const mod = search();
		const ctx = createMockModuleContext({ data: mockData });

		const init = mod.init;
		expect(init).toBeDefined();
		if (init) {
			await expect(init({ ...ctx, events: undefined })).resolves.toBeDefined();
		}
	});
});
