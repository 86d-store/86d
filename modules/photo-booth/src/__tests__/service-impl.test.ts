import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPhotoBoothController } from "../service-impl";

function defined<T>(val: T | null | undefined, label = "value"): T {
	if (val == null) throw new Error(`Expected ${label} to be defined`);
	return val;
}

const mockEvents = {
	emit: vi.fn(),
};

describe("photo-booth service-impl", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPhotoBoothController>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();
		controller = createPhotoBoothController(mockData, mockEvents as never);
	});

	// ── Photo CRUD ──────────────────────────────────────────────────

	describe("capturePhoto", () => {
		it("creates a photo with all provided fields", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
				thumbnailUrl: "https://example.com/thumb.jpg",
				caption: "Say cheese!",
				email: "user@example.com",
				phoneNumber: "+15551234567",
				tags: ["fun", "event"],
				metadata: { booth: "A" },
				isPublic: false,
			});

			expect(photo.id).toBeTruthy();
			expect(photo.sessionId).toBe("session-1");
			expect(photo.imageUrl).toBe("https://example.com/photo.jpg");
			expect(photo.thumbnailUrl).toBe("https://example.com/thumb.jpg");
			expect(photo.caption).toBe("Say cheese!");
			expect(photo.email).toBe("user@example.com");
			expect(photo.phoneNumber).toBe("+15551234567");
			expect(photo.sendStatus).toBe("none");
			expect(photo.tags).toEqual(["fun", "event"]);
			expect(photo.metadata).toEqual({ booth: "A" });
			expect(photo.isPublic).toBe(false);
			expect(photo.createdAt).toBeInstanceOf(Date);
		});

		it("applies default values for optional fields", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(photo.tags).toEqual([]);
			expect(photo.metadata).toEqual({});
			expect(photo.isPublic).toBe(true);
			expect(photo.sendStatus).toBe("none");
		});

		it("increments session photoCount when session exists", async () => {
			const session = await controller.createSession({ name: "Event" });

			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/1.jpg",
			});

			const updated = await controller.getSession(session.id);
			expect(defined(updated, "session").photoCount).toBe(1);
		});

		it("increments photoCount for each captured photo", async () => {
			const session = await controller.createSession({ name: "Event" });

			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/1.jpg",
			});
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/2.jpg",
			});
			await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/3.jpg",
			});

			const updated = await controller.getSession(session.id);
			expect(defined(updated, "session").photoCount).toBe(3);
		});

		it("does not fail when session does not exist", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "nonexistent-session",
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(photo.id).toBeTruthy();
			expect(photo.sessionId).toBe("nonexistent-session");
		});

		it("emits photo.captured event", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("photo.captured", {
				photoId: photo.id,
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
			});
		});

		it("persists photo to data store", async () => {
			await controller.capturePhoto({
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(mockData.size("photo")).toBe(1);
		});
	});

	describe("getPhoto", () => {
		it("returns null for nonexistent photo", async () => {
			expect(await controller.getPhoto("nonexistent")).toBeNull();
		});

		it("returns stored photo", async () => {
			const created = await controller.capturePhoto({
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
				caption: "Test",
			});

			const fetched = await controller.getPhoto(created.id);
			expect(defined(fetched, "photo").id).toBe(created.id);
			expect(defined(fetched, "photo").caption).toBe("Test");
		});
	});

	describe("deletePhoto", () => {
		it("deletes an existing photo", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(await controller.deletePhoto(photo.id)).toBe(true);
			expect(mockData.size("photo")).toBe(0);
		});

		it("returns false for nonexistent photo", async () => {
			expect(await controller.deletePhoto("nonexistent")).toBe(false);
		});

		it("emits photo.deleted event with photoId and sessionId", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "session-1",
				imageUrl: "https://example.com/photo.jpg",
			});
			vi.clearAllMocks();

			await controller.deletePhoto(photo.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("photo.deleted", {
				photoId: photo.id,
				sessionId: "session-1",
			});
		});

		it("does not emit event when photo does not exist", async () => {
			vi.clearAllMocks();
			await controller.deletePhoto("nonexistent");
			expect(mockEvents.emit).not.toHaveBeenCalled();
		});
	});

	describe("listPhotos", () => {
		it("lists all photos when no filters provided", async () => {
			await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/1.jpg",
			});
			await controller.capturePhoto({
				sessionId: "s2",
				imageUrl: "https://example.com/2.jpg",
			});

			const photos = await controller.listPhotos();
			expect(photos).toHaveLength(2);
		});

		it("filters by sessionId", async () => {
			await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/1.jpg",
			});
			await controller.capturePhoto({
				sessionId: "s2",
				imageUrl: "https://example.com/2.jpg",
			});

			const photos = await controller.listPhotos({ sessionId: "s1" });
			expect(photos).toHaveLength(1);
			expect(photos[0].sessionId).toBe("s1");
		});

		it("filters by isPublic", async () => {
			await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/1.jpg",
				isPublic: true,
			});
			await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/2.jpg",
				isPublic: false,
			});

			const publicPhotos = await controller.listPhotos({ isPublic: true });
			expect(publicPhotos).toHaveLength(1);
			expect(publicPhotos[0].isPublic).toBe(true);

			const privatePhotos = await controller.listPhotos({ isPublic: false });
			expect(privatePhotos).toHaveLength(1);
			expect(privatePhotos[0].isPublic).toBe(false);
		});

		it("supports take and skip pagination", async () => {
			await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/1.jpg",
			});
			await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/2.jpg",
			});
			await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/3.jpg",
			});

			const page = await controller.listPhotos({ take: 2 });
			expect(page).toHaveLength(2);

			const skipped = await controller.listPhotos({ skip: 2, take: 10 });
			expect(skipped).toHaveLength(1);
		});

		it("returns empty array when no photos exist", async () => {
			const photos = await controller.listPhotos();
			expect(photos).toEqual([]);
		});
	});

	// ── Send Photo ──────────────────────────────────────────────────

	describe("sendPhoto", () => {
		it("updates email and sets sendStatus to sent", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			const sent = await controller.sendPhoto(photo.id, {
				email: "user@example.com",
			});

			expect(defined(sent, "sent photo").email).toBe("user@example.com");
			expect(defined(sent, "sent photo").sendStatus).toBe("sent");
		});

		it("updates phoneNumber and sets sendStatus to sent", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			const sent = await controller.sendPhoto(photo.id, {
				phoneNumber: "+15559876543",
			});

			expect(defined(sent, "sent photo").phoneNumber).toBe("+15559876543");
			expect(defined(sent, "sent photo").sendStatus).toBe("sent");
		});

		it("updates both email and phoneNumber", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			const sent = await controller.sendPhoto(photo.id, {
				email: "user@example.com",
				phoneNumber: "+15559876543",
			});

			expect(defined(sent, "sent photo").email).toBe("user@example.com");
			expect(defined(sent, "sent photo").phoneNumber).toBe("+15559876543");
		});

		it("returns null if photo not found", async () => {
			const result = await controller.sendPhoto("nonexistent", {
				email: "user@example.com",
			});
			expect(result).toBeNull();
		});

		it("returns null if neither email nor phoneNumber provided", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.sendPhoto(photo.id, {});
			expect(result).toBeNull();
		});

		it("emits photo.sent event", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});
			vi.clearAllMocks();

			await controller.sendPhoto(photo.id, {
				email: "user@example.com",
				phoneNumber: "+15551234567",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("photo.sent", {
				photoId: photo.id,
				email: "user@example.com",
				phoneNumber: "+15551234567",
			});
		});

		it("does not emit event when returning null for missing photo", async () => {
			vi.clearAllMocks();
			await controller.sendPhoto("nonexistent", {
				email: "user@example.com",
			});
			expect(mockEvents.emit).not.toHaveBeenCalled();
		});

		it("does not emit event when neither email nor phone provided", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});
			vi.clearAllMocks();

			await controller.sendPhoto(photo.id, {});
			expect(mockEvents.emit).not.toHaveBeenCalled();
		});

		it("preserves existing photo fields when sending", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
				caption: "Nice shot",
				tags: ["event"],
				isPublic: false,
			});

			const sent = await controller.sendPhoto(photo.id, {
				email: "user@example.com",
			});

			expect(defined(sent, "sent photo").caption).toBe("Nice shot");
			expect(defined(sent, "sent photo").tags).toEqual(["event"]);
			expect(defined(sent, "sent photo").isPublic).toBe(false);
			expect(defined(sent, "sent photo").imageUrl).toBe(
				"https://example.com/photo.jpg",
			);
		});
	});

	// ── Session lifecycle ───────────────────────────────────────────

	describe("createSession", () => {
		it("creates a session with required fields", async () => {
			const session = await controller.createSession({ name: "Party Event" });

			expect(session.id).toBeTruthy();
			expect(session.name).toBe("Party Event");
			expect(session.isActive).toBe(true);
			expect(session.photoCount).toBe(0);
			expect(session.settings).toEqual({});
			expect(session.createdAt).toBeInstanceOf(Date);
			expect(session.updatedAt).toBeInstanceOf(Date);
			expect(session.startedAt).toBeInstanceOf(Date);
		});

		it("stores description and custom settings", async () => {
			const session = await controller.createSession({
				name: "Wedding",
				description: "Reception photo booth",
				settings: { overlay: "hearts", timer: 5 },
			});

			expect(session.description).toBe("Reception photo booth");
			expect(session.settings).toEqual({ overlay: "hearts", timer: 5 });
		});

		it("persists session to data store", async () => {
			await controller.createSession({ name: "Event" });
			expect(mockData.size("photoSession")).toBe(1);
		});
	});

	describe("getSession", () => {
		it("returns null for nonexistent session", async () => {
			expect(await controller.getSession("nonexistent")).toBeNull();
		});

		it("returns stored session", async () => {
			const session = await controller.createSession({
				name: "Event",
				description: "Fun times",
			});

			const fetched = await controller.getSession(session.id);
			expect(defined(fetched, "session").name).toBe("Event");
			expect(defined(fetched, "session").description).toBe("Fun times");
		});
	});

	describe("endSession", () => {
		it("sets isActive to false and records endedAt", async () => {
			const session = await controller.createSession({ name: "Event" });

			const ended = await controller.endSession(session.id);

			expect(defined(ended, "ended session").isActive).toBe(false);
			expect(defined(ended, "ended session").endedAt).toBeInstanceOf(Date);
			expect(defined(ended, "ended session").updatedAt).toBeInstanceOf(Date);
		});

		it("returns null for nonexistent session", async () => {
			expect(await controller.endSession("nonexistent")).toBeNull();
		});

		it("returns null for already-ended session", async () => {
			const session = await controller.createSession({ name: "Event" });
			await controller.endSession(session.id);

			expect(await controller.endSession(session.id)).toBeNull();
		});

		it("persists the ended state", async () => {
			const session = await controller.createSession({ name: "Event" });
			await controller.endSession(session.id);

			const fetched = await controller.getSession(session.id);
			expect(defined(fetched, "session").isActive).toBe(false);
		});
	});

	describe("listSessions", () => {
		it("lists all sessions", async () => {
			await controller.createSession({ name: "Session A" });
			await controller.createSession({ name: "Session B" });

			const sessions = await controller.listSessions();
			expect(sessions).toHaveLength(2);
		});

		it("supports take and skip pagination", async () => {
			await controller.createSession({ name: "A" });
			await controller.createSession({ name: "B" });
			await controller.createSession({ name: "C" });

			const page = await controller.listSessions({ take: 2 });
			expect(page).toHaveLength(2);

			const skipped = await controller.listSessions({ skip: 2, take: 10 });
			expect(skipped).toHaveLength(1);
		});

		it("returns empty array when no sessions exist", async () => {
			const sessions = await controller.listSessions();
			expect(sessions).toEqual([]);
		});
	});

	// ── Stream lifecycle ────────────────────────────────────────────

	describe("createStream", () => {
		it("creates a stream with defaults", async () => {
			const stream = await controller.createStream({ name: "Live Feed" });

			expect(stream.id).toBeTruthy();
			expect(stream.name).toBe("Live Feed");
			expect(stream.isLive).toBe(false);
			expect(stream.photoCount).toBe(0);
			expect(stream.settings).toEqual({});
			expect(stream.createdAt).toBeInstanceOf(Date);
			expect(stream.updatedAt).toBeInstanceOf(Date);
		});

		it("stores custom settings", async () => {
			const stream = await controller.createStream({
				name: "Gallery",
				settings: { layout: "grid", columns: 3 },
			});

			expect(stream.settings).toEqual({ layout: "grid", columns: 3 });
		});

		it("emits stream.created event", async () => {
			const stream = await controller.createStream({ name: "Live Feed" });

			expect(mockEvents.emit).toHaveBeenCalledWith("stream.created", {
				streamId: stream.id,
				name: "Live Feed",
			});
		});

		it("persists stream to data store", async () => {
			await controller.createStream({ name: "Stream" });
			expect(mockData.size("photoStream")).toBe(1);
		});
	});

	describe("getStream", () => {
		it("returns null for nonexistent stream", async () => {
			expect(await controller.getStream("nonexistent")).toBeNull();
		});

		it("returns stored stream", async () => {
			const stream = await controller.createStream({ name: "Live Feed" });

			const fetched = await controller.getStream(stream.id);
			expect(defined(fetched, "stream").name).toBe("Live Feed");
		});
	});

	describe("addToStream", () => {
		it("adds a photo to a stream and increments photoCount", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.addToStream(stream.id, photo.id);
			expect(result).toBe(true);

			const updatedStream = await controller.getStream(stream.id);
			expect(defined(updatedStream, "stream").photoCount).toBe(1);
		});

		it("sets streamId in photo metadata", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			await controller.addToStream(stream.id, photo.id);

			const updatedPhoto = await controller.getPhoto(photo.id);
			expect(
				(defined(updatedPhoto, "photo").metadata as Record<string, unknown>)
					.streamId,
			).toBe(stream.id);
		});

		it("returns false when stream does not exist", async () => {
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(await controller.addToStream("nonexistent", photo.id)).toBe(false);
		});

		it("returns false when photo does not exist", async () => {
			const stream = await controller.createStream({ name: "Stream" });

			expect(await controller.addToStream(stream.id, "nonexistent")).toBe(
				false,
			);
		});

		it("increments photoCount for each added photo", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			const photo1 = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/1.jpg",
			});
			const photo2 = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/2.jpg",
			});

			await controller.addToStream(stream.id, photo1.id);
			await controller.addToStream(stream.id, photo2.id);

			const updatedStream = await controller.getStream(stream.id);
			expect(defined(updatedStream, "stream").photoCount).toBe(2);
		});

		it("preserves existing photo metadata when adding streamId", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			const photo = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
				metadata: { booth: "A", effect: "sepia" },
			});

			await controller.addToStream(stream.id, photo.id);

			const updatedPhoto = await controller.getPhoto(photo.id);
			const metadata = defined(updatedPhoto, "photo").metadata as Record<
				string,
				unknown
			>;
			expect(metadata.booth).toBe("A");
			expect(metadata.effect).toBe("sepia");
			expect(metadata.streamId).toBe(stream.id);
		});
	});

	describe("getStreamPhotos", () => {
		it("returns photos belonging to the stream", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			const photo1 = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/1.jpg",
			});
			const photo2 = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/2.jpg",
			});

			await controller.addToStream(stream.id, photo1.id);
			await controller.addToStream(stream.id, photo2.id);

			const photos = await controller.getStreamPhotos(stream.id);
			expect(photos).toHaveLength(2);
		});

		it("does not return photos from other streams", async () => {
			const streamA = await controller.createStream({ name: "Stream A" });
			const streamB = await controller.createStream({ name: "Stream B" });

			const photoA = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/a.jpg",
			});
			const photoB = await controller.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/b.jpg",
			});

			await controller.addToStream(streamA.id, photoA.id);
			await controller.addToStream(streamB.id, photoB.id);

			const photosA = await controller.getStreamPhotos(streamA.id);
			expect(photosA).toHaveLength(1);
			expect(photosA[0].id).toBe(photoA.id);

			const photosB = await controller.getStreamPhotos(streamB.id);
			expect(photosB).toHaveLength(1);
			expect(photosB[0].id).toBe(photoB.id);
		});

		it("returns empty array when stream does not exist", async () => {
			const result = await controller.getStreamPhotos("nonexistent");
			expect(result).toEqual([]);
		});

		it("returns empty array when stream has no photos", async () => {
			const stream = await controller.createStream({ name: "Empty Stream" });

			const photos = await controller.getStreamPhotos(stream.id);
			expect(photos).toEqual([]);
		});

		it("supports take and skip pagination", async () => {
			const stream = await controller.createStream({ name: "Stream" });

			for (let i = 0; i < 5; i++) {
				const photo = await controller.capturePhoto({
					sessionId: "s1",
					imageUrl: `https://example.com/${i}.jpg`,
				});
				await controller.addToStream(stream.id, photo.id);
			}

			const page = await controller.getStreamPhotos(stream.id, { take: 3 });
			expect(page.length).toBeLessThanOrEqual(3);
		});
	});

	describe("toggleStreamLive", () => {
		it("toggles isLive from false to true", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			expect(stream.isLive).toBe(false);

			const toggled = await controller.toggleStreamLive(stream.id);
			expect(defined(toggled, "toggled stream").isLive).toBe(true);
		});

		it("toggles isLive from true to false", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			await controller.toggleStreamLive(stream.id);

			const toggled = await controller.toggleStreamLive(stream.id);
			expect(defined(toggled, "toggled stream").isLive).toBe(false);
		});

		it("returns null for nonexistent stream", async () => {
			expect(await controller.toggleStreamLive("nonexistent")).toBeNull();
		});

		it("emits stream.ended event", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			vi.clearAllMocks();

			await controller.toggleStreamLive(stream.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("stream.ended", {
				streamId: stream.id,
				isLive: true,
			});
		});

		it("emits stream.ended with correct isLive state on each toggle", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			vi.clearAllMocks();

			await controller.toggleStreamLive(stream.id);
			expect(mockEvents.emit).toHaveBeenCalledWith("stream.ended", {
				streamId: stream.id,
				isLive: true,
			});

			vi.clearAllMocks();
			await controller.toggleStreamLive(stream.id);
			expect(mockEvents.emit).toHaveBeenCalledWith("stream.ended", {
				streamId: stream.id,
				isLive: false,
			});
		});

		it("persists the toggled state", async () => {
			const stream = await controller.createStream({ name: "Stream" });
			await controller.toggleStreamLive(stream.id);

			const fetched = await controller.getStream(stream.id);
			expect(defined(fetched, "stream").isLive).toBe(true);
		});
	});

	describe("listStreams", () => {
		it("lists all streams", async () => {
			await controller.createStream({ name: "Stream A" });
			await controller.createStream({ name: "Stream B" });

			const streams = await controller.listStreams();
			expect(streams).toHaveLength(2);
		});

		it("supports take and skip pagination", async () => {
			await controller.createStream({ name: "A" });
			await controller.createStream({ name: "B" });
			await controller.createStream({ name: "C" });

			const page = await controller.listStreams({ take: 2 });
			expect(page).toHaveLength(2);

			const skipped = await controller.listStreams({ skip: 2, take: 10 });
			expect(skipped).toHaveLength(1);
		});

		it("returns empty array when no streams exist", async () => {
			const streams = await controller.listStreams();
			expect(streams).toEqual([]);
		});
	});

	// ── Controller without events ───────────────────────────────────

	describe("without events emitter", () => {
		it("works when events are not provided", async () => {
			const ctrl = createPhotoBoothController(mockData);

			const photo = await ctrl.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});

			expect(photo.id).toBeTruthy();

			const deleted = await ctrl.deletePhoto(photo.id);
			expect(deleted).toBe(true);
		});

		it("createStream works without events", async () => {
			const ctrl = createPhotoBoothController(mockData);

			const stream = await ctrl.createStream({ name: "No Events" });
			expect(stream.id).toBeTruthy();
		});

		it("toggleStreamLive works without events", async () => {
			const ctrl = createPhotoBoothController(mockData);

			const stream = await ctrl.createStream({ name: "Stream" });
			const toggled = await ctrl.toggleStreamLive(stream.id);
			expect(defined(toggled, "toggled stream").isLive).toBe(true);
		});

		it("sendPhoto works without events", async () => {
			const ctrl = createPhotoBoothController(mockData);

			const photo = await ctrl.capturePhoto({
				sessionId: "s1",
				imageUrl: "https://example.com/photo.jpg",
			});
			const sent = await ctrl.sendPhoto(photo.id, {
				email: "user@example.com",
			});
			expect(defined(sent, "sent photo").sendStatus).toBe("sent");
		});
	});
});
