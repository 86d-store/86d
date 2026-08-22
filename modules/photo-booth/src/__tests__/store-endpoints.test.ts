import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPhotoBoothController } from "../service-impl";

/**
 * Store endpoint integration tests for the photo-booth module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. create-session: starts a photo session
 * 2. capture-photo: captures a photo in a session
 * 3. get-photo: retrieves a captured photo
 * 4. list-photos: lists photos for a session
 * 5. get-stream-photos: returns photos from a live stream
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateCreateSession(
	data: DataService,
	body: {
		name: string;
		description?: string;
		settings?: Record<string, unknown>;
	},
) {
	const controller = createPhotoBoothController(data);
	const session = await controller.createSession(body);
	return { session };
}

async function simulateCapturePhoto(
	data: DataService,
	body: { sessionId: string; imageUrl: string; caption?: string },
) {
	const controller = createPhotoBoothController(data);
	const session = await controller.getSession(body.sessionId);
	if (!session) {
		return { error: "Session not found", status: 404 };
	}
	const photo = await controller.capturePhoto(body);
	return { photo };
}

async function simulateGetPhoto(data: DataService, photoId: string) {
	const controller = createPhotoBoothController(data);
	const photo = await controller.getPhoto(photoId);
	if (!photo) {
		return { error: "Photo not found", status: 404 };
	}
	return { photo };
}

async function simulateGetStreamPhotos(data: DataService, streamId: string) {
	const controller = createPhotoBoothController(data);
	const stream = await controller.getStream(streamId);
	if (!stream) {
		return { error: "Stream not found", status: 404 };
	}
	const photos = await controller.getStreamPhotos(streamId);
	return { photos };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: create session", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates a photo session", async () => {
		const result = await simulateCreateSession(data, {
			name: "Grand Opening",
		});

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.id).toBeDefined();
	});
});

describe("store endpoint: capture photo", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("captures a photo in a session", async () => {
		const ctrl = createPhotoBoothController(data);
		const session = await ctrl.createSession({ name: "Party" });

		const result = await simulateCapturePhoto(data, {
			sessionId: session.id,
			imageUrl: "https://cdn.example.com/photo1.jpg",
			caption: "Smile!",
		});

		expect("photo" in result).toBe(true);
		if (!("photo" in result)) {
			throw new Error("expected 'photo' in result");
		}
		expect(result.photo.imageUrl).toBe("https://cdn.example.com/photo1.jpg");
	});

	it("returns 404 for nonexistent session", async () => {
		const result = await simulateCapturePhoto(data, {
			sessionId: "ghost_session",
			imageUrl: "https://cdn.example.com/x.jpg",
		});

		expect(result).toEqual({ error: "Session not found", status: 404 });
	});
});

describe("store endpoint: get photo", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns a photo by ID", async () => {
		const ctrl = createPhotoBoothController(data);
		const session = await ctrl.createSession({ name: "Gallery session" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://cdn.example.com/pic.jpg",
		});

		const result = await simulateGetPhoto(data, photo.id);

		expect("photo" in result).toBe(true);
		if (!("photo" in result)) {
			throw new Error("expected 'photo' in result");
		}
		expect(result.photo.imageUrl).toBe("https://cdn.example.com/pic.jpg");
	});

	it("returns 404 for nonexistent photo", async () => {
		const result = await simulateGetPhoto(data, "ghost_photo");

		expect(result).toEqual({ error: "Photo not found", status: 404 });
	});
});

describe("store endpoint: get stream photos", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns photos from a stream", async () => {
		const ctrl = createPhotoBoothController(data);
		const stream = await ctrl.createStream({ name: "Live Feed" });
		const session = await ctrl.createSession({ name: "Gallery session" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://cdn.example.com/stream1.jpg",
		});
		await ctrl.addToStream(stream.id, photo.id);

		const result = await simulateGetStreamPhotos(data, stream.id);

		expect("photos" in result).toBe(true);
		if (!("photos" in result)) {
			throw new Error("expected 'photos' in result");
		}
		expect(result.photos).toHaveLength(1);
	});

	it("returns 404 for nonexistent stream", async () => {
		const result = await simulateGetStreamPhotos(data, "ghost_stream");

		expect(result).toEqual({ error: "Stream not found", status: 404 });
	});
});

describe("store endpoint: list photos — public gallery", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns public photos", async () => {
		const ctrl = createPhotoBoothController(data);
		const session = await ctrl.createSession({ name: "Gallery" });
		await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://cdn.example.com/public1.jpg",
			isPublic: true,
		});
		await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://cdn.example.com/private1.jpg",
			isPublic: false,
		});

		const controller = createPhotoBoothController(data);
		const photos = await controller.listPhotos({ isPublic: true });
		expect(photos).toHaveLength(1);
		expect(photos[0].imageUrl).toBe("https://cdn.example.com/public1.jpg");
	});

	it("returns empty when no public photos exist", async () => {
		const controller = createPhotoBoothController(data);
		const photos = await controller.listPhotos({ isPublic: true });
		expect(photos).toHaveLength(0);
	});

	it("respects pagination", async () => {
		const ctrl = createPhotoBoothController(data);
		const session = await ctrl.createSession({ name: "Bulk" });
		for (let i = 0; i < 5; i++) {
			await ctrl.capturePhoto({
				sessionId: session.id,
				imageUrl: `https://cdn.example.com/photo${i}.jpg`,
				isPublic: true,
			});
		}

		const controller = createPhotoBoothController(data);
		const page1 = await controller.listPhotos({
			isPublic: true,
			take: 2,
			skip: 0,
		});
		const page2 = await controller.listPhotos({
			isPublic: true,
			take: 2,
			skip: 2,
		});

		expect(page1).toHaveLength(2);
		expect(page2).toHaveLength(2);
		expect(page1[0].id).not.toBe(page2[0].id);
	});
});

describe("store endpoint: send photo — deliver to email or phone", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("sends a photo to an email address", async () => {
		const ctrl = createPhotoBoothController(data);
		const session = await ctrl.createSession({ name: "Event" });
		const photo = await ctrl.capturePhoto({
			sessionId: session.id,
			imageUrl: "https://cdn.example.com/to-send.jpg",
		});

		const controller = createPhotoBoothController(data);
		const result = await controller.sendPhoto(photo.id, {
			email: "guest@example.com",
		});

		expect(result).not.toBeNull();
		if (!result) {
			throw new Error("expected result");
		}
		expect(result.sendStatus).toBe("sent");
		expect(result.email).toBe("guest@example.com");
	});

	it("returns null for nonexistent photo", async () => {
		const controller = createPhotoBoothController(data);
		const result = await controller.sendPhoto("ghost_photo", {
			email: "guest@example.com",
		});

		expect(result).toBeNull();
	});
});
