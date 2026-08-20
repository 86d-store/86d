import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPhotoBoothController } from "../service-impl";

describe("photo booth controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPhotoBoothController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPhotoBoothController(mockData);
	});

	// ── Photo capture ──────────────────────────────────────────────────

	describe("capturePhoto", () => {
		it("captures a photo with all fields", async () => {
			const session = await controller.createSession({ name: "Event A" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
				thumbnailUrl: "https://example.com/thumb.jpg",
				caption: "Fun times",
				email: "user@test.com",
				phoneNumber: "+1234567890",
				tags: ["event", "fun"],
				metadata: { booth: "A1" },
				isPublic: true,
			});

			expect(photo.id).toBeDefined();
			expect(photo.sessionId).toBe(session.id);
			expect(photo.imageUrl).toBe("https://example.com/photo.jpg");
			expect(photo.thumbnailUrl).toBe("https://example.com/thumb.jpg");
			expect(photo.caption).toBe("Fun times");
			expect(photo.email).toBe("user@test.com");
			expect(photo.phoneNumber).toBe("+1234567890");
			expect(photo.sendStatus).toBe("none");
			expect(photo.tags).toEqual(["event", "fun"]);
			expect(photo.metadata).toEqual({ booth: "A1" });
			expect(photo.isPublic).toBe(true);
			expect(photo.createdAt).toBeInstanceOf(Date);
		});

		it("captures a photo with minimal fields and defaults", async () => {
			const session = await controller.createSession({ name: "Minimal" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(photo.tags).toEqual([]);
			expect(photo.metadata).toEqual({});
			expect(photo.isPublic).toBe(true);
			expect(photo.sendStatus).toBe("none");
			expect(photo.thumbnailUrl).toBeUndefined();
			expect(photo.caption).toBeUndefined();
			expect(photo.email).toBeUndefined();
			expect(photo.phoneNumber).toBeUndefined();
		});

		it("increments session photo count on capture", async () => {
			const session = await controller.createSession({ name: "Counter" });
			expect(session.photoCount).toBe(0);

			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/1.jpg",
			});
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/2.jpg",
			});

			const updated = await controller.getSession(session.id);
			expect(updated?.photoCount).toBe(2);
		});

		it("captures photo with isPublic false", async () => {
			const session = await controller.createSession({ name: "Private" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/private.jpg",
				isPublic: false,
			});

			expect(photo.isPublic).toBe(false);
		});
	});

	// ── Get photo ──────────────────────────────────────────────────────

	describe("getPhoto", () => {
		it("returns a photo by id", async () => {
			const session = await controller.createSession({ name: "Get" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const found = await controller.getPhoto(photo.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(photo.id);
		});

		it("returns null for non-existent photo", async () => {
			const result = await controller.getPhoto("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Delete photo ───────────────────────────────────────────────────

	describe("deletePhoto", () => {
		it("deletes an existing photo", async () => {
			const session = await controller.createSession({ name: "Del" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.deletePhoto(photo.id);
			expect(result).toBe(true);

			const check = await controller.getPhoto(photo.id);
			expect(check).toBeNull();
		});

		it("returns false for non-existent photo", async () => {
			const result = await controller.deletePhoto("nonexistent");
			expect(result).toBe(false);
		});

		it("double deletion returns false on second attempt", async () => {
			const session = await controller.createSession({ name: "Double" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(await controller.deletePhoto(photo.id)).toBe(true);
			expect(await controller.deletePhoto(photo.id)).toBe(false);
		});
	});

	// ── List photos ────────────────────────────────────────────────────

	describe("listPhotos", () => {
		it("lists all photos", async () => {
			const session = await controller.createSession({ name: "List" });
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/1.jpg",
			});
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/2.jpg",
			});

			const photos = await controller.listPhotos();
			expect(photos).toHaveLength(2);
		});

		it("filters by sessionId", async () => {
			const s1 = await controller.createSession({ name: "S1" });
			const s2 = await controller.createSession({ name: "S2" });
			await controller.capturePhoto({
				sessionId: s1.id,
				imageUrl: "https://example.com/1.jpg",
			});
			await controller.capturePhoto({
				sessionId: s2.id,
				imageUrl: "https://example.com/2.jpg",
			});
			await controller.capturePhoto({
				sessionId: s1.id,
				imageUrl: "https://example.com/3.jpg",
			});

			const photos = await controller.listPhotos({ sessionId: s1.id });
			expect(photos).toHaveLength(2);
		});

		it("filters by isPublic", async () => {
			const session = await controller.createSession({ name: "Pub" });
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/public.jpg",
				isPublic: true,
			});
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/private.jpg",
				isPublic: false,
			});

			const publicPhotos = await controller.listPhotos({ isPublic: true });
			expect(publicPhotos).toHaveLength(1);
			expect(publicPhotos[0].isPublic).toBe(true);

			const privatePhotos = await controller.listPhotos({ isPublic: false });
			expect(privatePhotos).toHaveLength(1);
			expect(privatePhotos[0].isPublic).toBe(false);
		});

		it("supports pagination with take and skip", async () => {
			const session = await controller.createSession({ name: "Page" });
			for (let i = 0; i < 5; i++) {
				await controller.capturePhoto({
					sessionId: session.id,
					imageUrl: `https://example.com/${i}.jpg`,
				});
			}

			const page = await controller.listPhotos({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("skip beyond total returns empty array", async () => {
			const session = await controller.createSession({ name: "Skip" });
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/only.jpg",
			});

			const result = await controller.listPhotos({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── Send photo ─────────────────────────────────────────────────────

	describe("sendPhoto", () => {
		it("sends photo to email", async () => {
			const session = await controller.createSession({ name: "Send" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const sent = await controller.sendPhoto(photo.id, {
				email: "user@test.com",
			});
			expect(sent?.sendStatus).toBe("sent");
			expect(sent?.email).toBe("user@test.com");
		});

		it("sends photo to phone number", async () => {
			const session = await controller.createSession({ name: "Phone" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const sent = await controller.sendPhoto(photo.id, {
				phoneNumber: "+1234567890",
			});
			expect(sent?.sendStatus).toBe("sent");
			expect(sent?.phoneNumber).toBe("+1234567890");
		});

		it("sends photo to both email and phone", async () => {
			const session = await controller.createSession({ name: "Both" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const sent = await controller.sendPhoto(photo.id, {
				email: "user@test.com",
				phoneNumber: "+1234567890",
			});
			expect(sent?.sendStatus).toBe("sent");
			expect(sent?.email).toBe("user@test.com");
			expect(sent?.phoneNumber).toBe("+1234567890");
		});

		it("returns null when neither email nor phone provided", async () => {
			const session = await controller.createSession({ name: "None" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.sendPhoto(photo.id, {});
			expect(result).toBeNull();
		});

		it("returns null for non-existent photo", async () => {
			const result = await controller.sendPhoto("nonexistent", {
				email: "user@test.com",
			});
			expect(result).toBeNull();
		});

		it("updates send status in store", async () => {
			const session = await controller.createSession({ name: "Status" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			await controller.sendPhoto(photo.id, { email: "user@test.com" });
			const found = await controller.getPhoto(photo.id);
			expect(found?.sendStatus).toBe("sent");
		});
	});

	// ── Sessions ───────────────────────────────────────────────────────

	describe("createSession", () => {
		it("creates a session with all fields", async () => {
			const session = await controller.createSession({
				name: "Grand Opening",
				description: "Store grand opening event",
				settings: { watermark: true, overlay: "logo.png" },
			});

			expect(session.id).toBeDefined();
			expect(session.name).toBe("Grand Opening");
			expect(session.description).toBe("Store grand opening event");
			expect(session.isActive).toBe(true);
			expect(session.photoCount).toBe(0);
			expect(session.startedAt).toBeInstanceOf(Date);
			expect(session.settings).toEqual({
				watermark: true,
				overlay: "logo.png",
			});
			expect(session.createdAt).toBeInstanceOf(Date);
			expect(session.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a session with minimal fields", async () => {
			const session = await controller.createSession({ name: "Minimal" });

			expect(session.description).toBeUndefined();
			expect(session.settings).toEqual({});
		});
	});

	describe("getSession", () => {
		it("returns a session by id", async () => {
			const session = await controller.createSession({ name: "Get" });
			const found = await controller.getSession(session.id);
			expect(found?.id).toBe(session.id);
			expect(found?.name).toBe("Get");
		});

		it("returns null for non-existent session", async () => {
			const result = await controller.getSession("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("endSession", () => {
		it("ends an active session", async () => {
			const session = await controller.createSession({ name: "End" });
			const ended = await controller.endSession(session.id);

			expect(ended?.isActive).toBe(false);
			expect(ended?.endedAt).toBeInstanceOf(Date);
		});

		it("returns null for non-existent session", async () => {
			const result = await controller.endSession("nonexistent");
			expect(result).toBeNull();
		});

		it("returns null when ending an already ended session", async () => {
			const session = await controller.createSession({ name: "Double End" });
			await controller.endSession(session.id);
			const result = await controller.endSession(session.id);
			expect(result).toBeNull();
		});

		it("sets endedAt to approximately current time", async () => {
			const session = await controller.createSession({ name: "Time" });
			const before = new Date();
			const ended = await controller.endSession(session.id);
			const after = new Date();

			const endTime = ended?.endedAt?.getTime() ?? 0;
			expect(endTime).toBeGreaterThanOrEqual(before.getTime());
			expect(endTime).toBeLessThanOrEqual(after.getTime());
		});
	});

	describe("listSessions", () => {
		it("lists all sessions", async () => {
			await controller.createSession({ name: "S1" });
			await controller.createSession({ name: "S2" });
			await controller.createSession({ name: "S3" });

			const sessions = await controller.listSessions();
			expect(sessions).toHaveLength(3);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createSession({ name: `Session ${i}` });
			}

			const page = await controller.listSessions({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("skip beyond total returns empty array", async () => {
			await controller.createSession({ name: "Only" });
			const result = await controller.listSessions({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── Streams ────────────────────────────────────────────────────────

	describe("createStream", () => {
		it("creates a stream with all fields", async () => {
			const stream = await controller.createStream({
				name: "Live Wall",
				settings: { autoApprove: true, refreshInterval: 5000 },
			});

			expect(stream.id).toBeDefined();
			expect(stream.name).toBe("Live Wall");
			expect(stream.isLive).toBe(false);
			expect(stream.photoCount).toBe(0);
			expect(stream.settings).toEqual({
				autoApprove: true,
				refreshInterval: 5000,
			});
			expect(stream.createdAt).toBeInstanceOf(Date);
			expect(stream.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a stream with minimal fields", async () => {
			const stream = await controller.createStream({ name: "Simple" });
			expect(stream.settings).toEqual({});
		});
	});

	describe("getStream", () => {
		it("returns a stream by id", async () => {
			const stream = await controller.createStream({ name: "Get" });
			const found = await controller.getStream(stream.id);
			expect(found?.id).toBe(stream.id);
		});

		it("returns null for non-existent stream", async () => {
			const result = await controller.getStream("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("addToStream", () => {
		it("adds a photo to a stream", async () => {
			const session = await controller.createSession({ name: "Sess" });
			const stream = await controller.createStream({ name: "Stream" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.addToStream(stream.id, photo.id);
			expect(result).toBe(true);

			const updated = await controller.getStream(stream.id);
			expect(updated?.photoCount).toBe(1);
		});

		it("returns false for non-existent stream", async () => {
			const session = await controller.createSession({ name: "Sess" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.addToStream("nonexistent", photo.id);
			expect(result).toBe(false);
		});

		it("returns false for non-existent photo", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			const result = await controller.addToStream(stream.id, "nonexistent");
			expect(result).toBe(false);
		});

		it("increments stream photo count on each add", async () => {
			const session = await controller.createSession({ name: "Count" });
			const stream = await controller.createStream({ name: "Counter" });
			const p1 = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/1.jpg",
			});
			const p2 = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/2.jpg",
			});

			await controller.addToStream(stream.id, p1.id);
			await controller.addToStream(stream.id, p2.id);

			const updated = await controller.getStream(stream.id);
			expect(updated?.photoCount).toBe(2);
		});
	});

	describe("getStreamPhotos", () => {
		it("returns photos added to stream", async () => {
			const session = await controller.createSession({ name: "Sess" });
			const stream = await controller.createStream({ name: "Stream" });
			const p1 = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/1.jpg",
			});
			const p2 = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/2.jpg",
			});

			await controller.addToStream(stream.id, p1.id);
			await controller.addToStream(stream.id, p2.id);

			const photos = await controller.getStreamPhotos(stream.id);
			expect(photos).toHaveLength(2);
		});

		it("returns empty array for non-existent stream", async () => {
			const photos = await controller.getStreamPhotos("nonexistent");
			expect(photos).toEqual([]);
		});

		it("does not return photos from other streams", async () => {
			const session = await controller.createSession({ name: "Sess" });
			const s1 = await controller.createStream({ name: "Stream1" });
			const s2 = await controller.createStream({ name: "Stream2" });
			const p1 = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/1.jpg",
			});
			const p2 = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/2.jpg",
			});

			await controller.addToStream(s1.id, p1.id);
			await controller.addToStream(s2.id, p2.id);

			const s1Photos = await controller.getStreamPhotos(s1.id);
			expect(s1Photos).toHaveLength(1);
			expect(s1Photos[0].id).toBe(p1.id);
		});
	});

	describe("toggleStreamLive", () => {
		it("toggles stream from not live to live", async () => {
			const stream = await controller.createStream({ name: "Toggle" });
			expect(stream.isLive).toBe(false);

			const toggled = await controller.toggleStreamLive(stream.id);
			expect(toggled?.isLive).toBe(true);
		});

		it("toggles stream from live to not live", async () => {
			const stream = await controller.createStream({ name: "Toggle" });
			await controller.toggleStreamLive(stream.id);

			const toggled = await controller.toggleStreamLive(stream.id);
			expect(toggled?.isLive).toBe(false);
		});

		it("returns null for non-existent stream", async () => {
			const result = await controller.toggleStreamLive("nonexistent");
			expect(result).toBeNull();
		});

		it("double toggle returns to original state", async () => {
			const stream = await controller.createStream({ name: "Double" });

			await controller.toggleStreamLive(stream.id);
			await controller.toggleStreamLive(stream.id);

			const found = await controller.getStream(stream.id);
			expect(found?.isLive).toBe(false);
		});
	});

	describe("listStreams", () => {
		it("lists all streams", async () => {
			await controller.createStream({ name: "A" });
			await controller.createStream({ name: "B" });
			await controller.createStream({ name: "C" });

			const streams = await controller.listStreams();
			expect(streams).toHaveLength(3);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createStream({ name: `Stream ${i}` });
			}

			const page = await controller.listStreams({ take: 3 });
			expect(page).toHaveLength(3);
		});

		it("skip beyond total returns empty array", async () => {
			await controller.createStream({ name: "Only" });
			const result = await controller.listStreams({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── Data store consistency ──────────────────────────────────────────

	describe("data store consistency", () => {
		it("photo count in store matches listPhotos length", async () => {
			const session = await controller.createSession({ name: "Cons" });
			for (let i = 0; i < 3; i++) {
				await controller.capturePhoto({
					sessionId: session.id,
					imageUrl: `https://example.com/${i}.jpg`,
				});
			}
			await controller.deletePhoto((await controller.listPhotos())[0].id);

			expect(mockData.size("photo")).toBe(2);
			const all = await controller.listPhotos();
			expect(all).toHaveLength(2);
		});

		it("session count in store matches listSessions length", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createSession({ name: `S${i}` });
			}

			const sessions = await controller.listSessions();
			expect(sessions).toHaveLength(3);
			expect(mockData.size("photoSession")).toBe(3);
		});

		it("stream count in store matches listStreams length", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createStream({ name: `St${i}` });
			}

			const streams = await controller.listStreams();
			expect(streams).toHaveLength(3);
			expect(mockData.size("photoStream")).toBe(3);
		});

		it("concurrent photo captures produce distinct records", async () => {
			const session = await controller.createSession({ name: "Conc" });
			const promises = Array.from({ length: 10 }, (_, i) =>
				controller.capturePhoto({
					sessionId: session.id,
					imageUrl: `https://example.com/${i}.jpg`,
				}),
			);
			const photos = await Promise.all(promises);
			const ids = new Set(photos.map((p) => p.id));
			expect(ids.size).toBe(10);
		});
	});
});
