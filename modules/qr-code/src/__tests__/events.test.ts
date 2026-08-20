import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createQrCodeController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// qr.created
// ---------------------------------------------------------------------------

describe("qr.created event", () => {
	it("emits when a QR code is created", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		const qr = await ctrl.create({
			label: "Test QR",
			targetUrl: "https://example.com",
			targetType: "product",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("qr.created");
		expect(events.emitted[0].payload).toEqual({
			qrCodeId: qr.id,
			label: "Test QR",
			targetUrl: "https://example.com",
			targetType: "product",
		});
	});

	it("includes default targetType in payload", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		await ctrl.create({
			label: "Custom QR",
			targetUrl: "https://example.com",
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.targetType).toBe("custom");
	});
});

// ---------------------------------------------------------------------------
// qr.deleted
// ---------------------------------------------------------------------------

describe("qr.deleted event", () => {
	it("emits when a QR code is deleted", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		const qr = await ctrl.create({
			label: "Delete Me",
			targetUrl: "https://example.com",
		});
		events.emitted.length = 0;

		await ctrl.delete(qr.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("qr.deleted");
		expect(events.emitted[0].payload).toEqual({ qrCodeId: qr.id });
	});

	it("does not emit when deleting non-existent QR code", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		await ctrl.delete("non-existent");

		expect(events.emitted.filter((e) => e.type === "qr.deleted")).toHaveLength(
			0,
		);
	});
});

// ---------------------------------------------------------------------------
// qr.scanned
// ---------------------------------------------------------------------------

describe("qr.scanned event", () => {
	it("emits when a QR code is scanned", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		const qr = await ctrl.create({
			label: "Scannable",
			targetUrl: "https://example.com/product",
		});
		events.emitted.length = 0;

		const scan = await ctrl.recordScan(qr.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("qr.scanned");
		expect(events.emitted[0].payload).toEqual({
			qrCodeId: qr.id,
			scanId: scan?.id,
			targetUrl: "https://example.com/product",
		});
	});

	it("does not emit when scanning non-existent QR code", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		await ctrl.recordScan("non-existent");

		expect(events.emitted.filter((e) => e.type === "qr.scanned")).toHaveLength(
			0,
		);
	});

	it("emits for each scan", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		const qr = await ctrl.create({
			label: "Multi-scan",
			targetUrl: "https://example.com",
		});
		events.emitted.length = 0;

		await ctrl.recordScan(qr.id);
		await ctrl.recordScan(qr.id);
		await ctrl.recordScan(qr.id);

		const scanEvents = events.emitted.filter((e) => e.type === "qr.scanned");
		expect(scanEvents).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// qr.batch.created
// ---------------------------------------------------------------------------

describe("qr.batch.created event", () => {
	it("emits when batch is created", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		const results = await ctrl.createBatch([
			{ label: "B1", targetUrl: "https://example.com/1" },
			{ label: "B2", targetUrl: "https://example.com/2" },
		]);

		// Filter for batch event (individual creates also emit)
		const batchEvents = events.emitted.filter(
			(e) => e.type === "qr.batch.created",
		);
		expect(batchEvents).toHaveLength(1);
		expect(batchEvents[0].payload).toEqual({
			count: 2,
			ids: results.map((r) => r.id),
		});
	});

	it("batch also emits individual qr.created events", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		await ctrl.createBatch([
			{ label: "B1", targetUrl: "https://example.com/1" },
			{ label: "B2", targetUrl: "https://example.com/2" },
			{ label: "B3", targetUrl: "https://example.com/3" },
		]);

		const createEvents = events.emitted.filter((e) => e.type === "qr.created");
		expect(createEvents).toHaveLength(3);
	});

	it("empty batch emits with count 0", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		await ctrl.createBatch([]);

		const batchEvents = events.emitted.filter(
			(e) => e.type === "qr.batch.created",
		);
		expect(batchEvents).toHaveLength(1);
		expect(batchEvents[0].payload).toEqual({ count: 0, ids: [] });
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createQrCodeController(createMockDataService());

		const qr = await ctrl.create({
			label: "No Events",
			targetUrl: "https://example.com",
		});
		await ctrl.recordScan(qr.id);
		await ctrl.createBatch([
			{ label: "B", targetUrl: "https://example.com/b" },
		]);
		await ctrl.delete(qr.id);

		// No errors thrown
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle event sequence
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createQrCodeController(createMockDataService(), events);

		const qr = await ctrl.create({
			label: "Lifecycle",
			targetUrl: "https://example.com",
		});
		await ctrl.recordScan(qr.id);
		await ctrl.createBatch([
			{ label: "Batch", targetUrl: "https://example.com/batch" },
		]);
		await ctrl.delete(qr.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"qr.created",
			"qr.scanned",
			"qr.created",
			"qr.batch.created",
			"qr.deleted",
		]);
	});
});
