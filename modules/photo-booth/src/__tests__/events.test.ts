import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createPhotoBoothController } from "../service-impl";

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
// photo.captured
// ---------------------------------------------------------------------------

describe("photo.captured event", () => {
	it("emits when a photo is captured", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const session = await ctrl.createSession({ name: "Event" });
		events.emitted.length = 0;

		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});

		const captured = events.emitted.filter((e) => e.type === "photo.captured");
		expect(captured).toHaveLength(1);
		expect(captured[0].payload).toEqual({
			photoId: photo.id,
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});
	});

	it("emits for each photo captured", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const session = await ctrl.createSession({ name: "Multi" });
		events.emitted.length = 0;

		await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/1.jpg",
		});
		await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/2.jpg",
		});

		const captured = events.emitted.filter((e) => e.type === "photo.captured");
		expect(captured).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// photo.sent
// ---------------------------------------------------------------------------

describe("photo.sent event", () => {
	it("emits when a photo is sent via email", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const session = await ctrl.createSession({ name: "Send" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});
		events.emitted.length = 0;

		await ctrl.sendPhoto(photo.id, { email: "user@test.com" });

		const sent = events.emitted.filter((e) => e.type === "photo.sent");
		expect(sent).toHaveLength(1);
		expect(sent[0].payload).toEqual({
			photoId: photo.id,
			email: "user@test.com",
			phoneNumber: undefined,
		});
	});

	it("emits when a photo is sent via phone", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const session = await ctrl.createSession({ name: "Phone" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});
		events.emitted.length = 0;

		await ctrl.sendPhoto(photo.id, { phoneNumber: "+1234567890" });

		const sent = events.emitted.filter((e) => e.type === "photo.sent");
		expect(sent).toHaveLength(1);
		const payload = sent[0].payload as Record<string, unknown>;
		expect(payload.phoneNumber).toBe("+1234567890");
	});

	it("does not emit when send fails (no email or phone)", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const session = await ctrl.createSession({ name: "Fail" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});
		events.emitted.length = 0;

		await ctrl.sendPhoto(photo.id, {});

		const sent = events.emitted.filter((e) => e.type === "photo.sent");
		expect(sent).toHaveLength(0);
	});

	it("does not emit when photo does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		await ctrl.sendPhoto("nonexistent", { email: "user@test.com" });

		const sent = events.emitted.filter((e) => e.type === "photo.sent");
		expect(sent).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// photo.deleted
// ---------------------------------------------------------------------------

describe("photo.deleted event", () => {
	it("emits when a photo is deleted", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const session = await ctrl.createSession({ name: "Del" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});
		events.emitted.length = 0;

		await ctrl.deletePhoto(photo.id);

		const deleted = events.emitted.filter((e) => e.type === "photo.deleted");
		expect(deleted).toHaveLength(1);
		expect(deleted[0].payload).toEqual({
			photoId: photo.id,
			sessionId: session.id,
		});
	});

	it("does not emit when photo does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		await ctrl.deletePhoto("nonexistent");

		const deleted = events.emitted.filter((e) => e.type === "photo.deleted");
		expect(deleted).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// stream.created
// ---------------------------------------------------------------------------

describe("stream.created event", () => {
	it("emits when a stream is created", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const stream = await ctrl.createStream({ name: "Live Wall" });

		const created = events.emitted.filter((e) => e.type === "stream.created");
		expect(created).toHaveLength(1);
		expect(created[0].payload).toEqual({
			streamId: stream.id,
			name: "Live Wall",
		});
	});
});

// ---------------------------------------------------------------------------
// stream.ended (toggle)
// ---------------------------------------------------------------------------

describe("stream.ended event", () => {
	it("emits when a stream is toggled", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const stream = await ctrl.createStream({ name: "Toggle" });
		events.emitted.length = 0;

		await ctrl.toggleStreamLive(stream.id);

		const ended = events.emitted.filter((e) => e.type === "stream.ended");
		expect(ended).toHaveLength(1);
		expect(ended[0].payload).toEqual({
			streamId: stream.id,
			isLive: true,
		});
	});

	it("does not emit when stream does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		await ctrl.toggleStreamLive("nonexistent");

		const ended = events.emitted.filter((e) => e.type === "stream.ended");
		expect(ended).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createPhotoBoothController(createMockDataService());

		const session = await ctrl.createSession({ name: "NoEvents" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});
		await ctrl.sendPhoto(photo.id, { email: "user@test.com" });
		await ctrl.deletePhoto(photo.id);
		const stream = await ctrl.createStream({ name: "Silent" });
		await ctrl.toggleStreamLive(stream.id);

		// No errors thrown
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createPhotoBoothController(createMockDataService(), events);

		const session = await ctrl.createSession({ name: "Lifecycle" });
		const stream = await ctrl.createStream({ name: "Wall" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://example.com/photo.jpg",
		});
		await ctrl.sendPhoto(photo.id, { email: "user@test.com" });
		await ctrl.toggleStreamLive(stream.id);
		await ctrl.deletePhoto(photo.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"stream.created",
			"photo.captured",
			"photo.sent",
			"stream.ended",
			"photo.deleted",
		]);
	});
});
