import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import digitalDownloads from "../index";

async function initModule(
	mod: ReturnType<typeof digitalDownloads>,
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

const baseCheckoutPayload = {
	sessionId: "sess-001",
	orderId: "order-001",
	email: "buyer@example.com",
	customerId: "cust-001",
	items: [
		{ productId: "prod-digital-1", name: "E-Book", quantity: 1, price: 1500 },
	],
	subtotal: 1500,
	taxAmount: 0,
	shippingAmount: 0,
	discountAmount: 0,
	giftCardAmount: 0,
	total: 1500,
	currency: "usd",
};

describe("checkout.completed event listener — digital downloads", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a checkout.completed listener on init", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");

		await initModule(digitalDownloads(), mockData, emitter);

		expect(bus.listenerCount("checkout.completed")).toBe(1);
	});

	it("creates download tokens for all active files linked to a purchased product", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(digitalDownloads(), mockData, emitter);

		// Pre-seed two active files for the purchased product
		await mockData.upsert("downloadableFile", "file-1", {
			id: "file-1",
			productId: "prod-digital-1",
			name: "guide.pdf",
			url: "https://cdn.example.com/guide.pdf",
			isActive: true,
		});
		await mockData.upsert("downloadableFile", "file-2", {
			id: "file-2",
			productId: "prod-digital-1",
			name: "bonus.mp4",
			url: "https://cdn.example.com/bonus.mp4",
			isActive: true,
		});

		await checkoutEmitter.emit("checkout.completed", baseCheckoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		const tokens = mockData.all("downloadToken");
		expect(tokens).toHaveLength(2);
		expect(tokens[0].email).toBe("buyer@example.com");
		expect(tokens[0].orderId).toBe("order-001");
	});

	it("does not create tokens for inactive files", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(digitalDownloads(), mockData, emitter);

		await mockData.upsert("downloadableFile", "file-inactive", {
			id: "file-inactive",
			productId: "prod-digital-1",
			name: "guide.pdf",
			url: "https://cdn.example.com/guide.pdf",
			isActive: false,
		});

		await checkoutEmitter.emit("checkout.completed", baseCheckoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		const tokens = mockData.all("downloadToken");
		expect(tokens).toHaveLength(0);
	});

	it("skips items without a productId", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(digitalDownloads(), mockData, emitter);

		await mockData.upsert("downloadableFile", "file-1", {
			id: "file-1",
			productId: "prod-digital-1",
			name: "guide.pdf",
			url: "https://cdn.example.com/guide.pdf",
			isActive: true,
		});

		const payloadWithoutProductId = {
			...baseCheckoutPayload,
			items: [{ name: "Physical Widget", quantity: 1, price: 500 }],
		};

		await checkoutEmitter.emit("checkout.completed", payloadWithoutProductId);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		expect(mockData.all("downloadToken")).toHaveLength(0);
	});

	it("handles multiple different products in a single order", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(digitalDownloads(), mockData, emitter);

		await mockData.upsert("downloadableFile", "file-a", {
			id: "file-a",
			productId: "prod-a",
			name: "ebook-a.pdf",
			url: "https://cdn.example.com/a.pdf",
			isActive: true,
		});
		await mockData.upsert("downloadableFile", "file-b", {
			id: "file-b",
			productId: "prod-b",
			name: "course-b.mp4",
			url: "https://cdn.example.com/b.mp4",
			isActive: true,
		});

		const multiItemPayload = {
			...baseCheckoutPayload,
			items: [
				{ productId: "prod-a", name: "E-Book A", quantity: 1, price: 1000 },
				{ productId: "prod-b", name: "Course B", quantity: 1, price: 2000 },
			],
		};

		await checkoutEmitter.emit("checkout.completed", multiItemPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		const tokens = mockData.all("downloadToken");
		expect(tokens).toHaveLength(2);
		const fileIds = (tokens as Array<{ fileId: string }>).map((t) => t.fileId);
		expect(new Set(fileIds).size).toBe(2);
	});

	it("applies defaultMaxDownloads option to created tokens", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(
			digitalDownloads({ defaultMaxDownloads: 3 }),
			mockData,
			emitter,
		);

		await mockData.upsert("downloadableFile", "file-1", {
			id: "file-1",
			productId: "prod-digital-1",
			name: "guide.pdf",
			url: "https://cdn.example.com/guide.pdf",
			isActive: true,
		});

		await checkoutEmitter.emit("checkout.completed", baseCheckoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		const tokens = mockData.all("downloadToken");
		expect(tokens).toHaveLength(1);
		expect(tokens[0].maxDownloads).toBe(3);
	});

	it("applies defaultTokenExpiryDays option to created tokens", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		const before = new Date();
		await initModule(
			digitalDownloads({ defaultTokenExpiryDays: 30 }),
			mockData,
			emitter,
		);

		await mockData.upsert("downloadableFile", "file-1", {
			id: "file-1",
			productId: "prod-digital-1",
			name: "guide.pdf",
			url: "https://cdn.example.com/guide.pdf",
			isActive: true,
		});

		await checkoutEmitter.emit("checkout.completed", baseCheckoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		const tokens = mockData.all("downloadToken");
		expect(tokens).toHaveLength(1);
		const expiresAt = new Date(tokens[0].expiresAt as string);
		const expectedMin = new Date(before.getTime() + 29 * 24 * 60 * 60 * 1000);
		const expectedMax = new Date(before.getTime() + 31 * 24 * 60 * 60 * 1000);
		expect(expiresAt >= expectedMin).toBe(true);
		expect(expiresAt <= expectedMax).toBe(true);
	});

	it("emits download.purchased for each product with active files", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		const emittedEvents: unknown[] = [];
		bus.on("download.purchased", (e) => {
			emittedEvents.push(e);
		});

		await initModule(digitalDownloads(), mockData, emitter);

		await mockData.upsert("downloadableFile", "file-1", {
			id: "file-1",
			productId: "prod-digital-1",
			name: "guide.pdf",
			url: "https://cdn.example.com/guide.pdf",
			isActive: true,
		});

		await checkoutEmitter.emit("checkout.completed", baseCheckoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		expect(emittedEvents).toHaveLength(1);
		const payload = (
			emittedEvents[0] as { payload: { orderId: string; productId: string } }
		).payload;
		expect(payload.orderId).toBe("order-001");
		expect(payload.productId).toBe("prod-digital-1");
	});

	it("does not emit download.purchased when no active files match", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "digital-downloads");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		const emittedEvents: unknown[] = [];
		bus.on("download.purchased", (e) => {
			emittedEvents.push(e);
		});

		await initModule(digitalDownloads(), mockData, emitter);

		// No files seeded — nothing to download
		await checkoutEmitter.emit("checkout.completed", baseCheckoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		expect(emittedEvents).toHaveLength(0);
		expect(mockData.all("downloadToken")).toHaveLength(0);
	});

	it("is resilient when no events bus is provided (no init crash)", async () => {
		const mod = digitalDownloads();
		const data = createMockDataService();
		const init = mod.init;
		if (init) {
			const ctx = createMockModuleContext({ data });
			await expect(init({ ...ctx, events: undefined })).resolves.not.toThrow();
		}
	});
});
