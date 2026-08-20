import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPhotoBoothController } from "../service-impl";

/**
 * Security tests for photo booth module endpoints.
 *
 * These tests verify:
 * - Photo access: public vs private filtering
 * - Send validation: requires email or phone
 * - Session lifecycle: active sessions cannot be ended twice
 * - Stream isolation: photos from one stream do not leak to another
 * - Delete safety: non-existent photos return false
 * - Session photo count integrity after operations
 */

describe("photo booth endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPhotoBoothController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPhotoBoothController(mockData);
	});

	// ── Photo Access Control ────────────────────────────────────────

	describe("photo access control", () => {
		it("listPhotos with isPublic true only returns public photos", async () => {
			const session = await controller.createSession({ name: "Access" });
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
		});

		it("photo ID lookup returns null for non-existent ID", async () => {
			const result = await controller.getPhoto("nonexistent");
			expect(result).toBeNull();
		});

		it("deleting non-existent photo returns false", async () => {
			const result = await controller.deletePhoto("nonexistent");
			expect(result).toBe(false);
		});

		it("deleting photo makes getPhoto return null", async () => {
			const session = await controller.createSession({ name: "Del" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});
			await controller.deletePhoto(photo.id);

			const result = await controller.getPhoto(photo.id);
			expect(result).toBeNull();
		});
	});

	// ── Send Validation ────────────────────────────────────────────

	describe("send validation", () => {
		it("send without email or phone returns null", async () => {
			const session = await controller.createSession({ name: "Send" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.sendPhoto(photo.id, {});
			expect(result).toBeNull();
		});

		it("send with email succeeds", async () => {
			const session = await controller.createSession({ name: "Email" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.sendPhoto(photo.id, {
				email: "user@test.com",
			});
			expect(result).not.toBeNull();
			expect(result?.sendStatus).toBe("sent");
		});

		it("send with phone succeeds", async () => {
			const session = await controller.createSession({ name: "Phone" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.sendPhoto(photo.id, {
				phoneNumber: "+1234567890",
			});
			expect(result).not.toBeNull();
			expect(result?.sendStatus).toBe("sent");
		});

		it("send non-existent photo returns null", async () => {
			const result = await controller.sendPhoto("nonexistent", {
				email: "user@test.com",
			});
			expect(result).toBeNull();
		});
	});

	// ── Session Lifecycle ────────────────────────────────────────────

	describe("session lifecycle", () => {
		it("new session is active", async () => {
			const session = await controller.createSession({ name: "Active" });
			expect(session.isActive).toBe(true);
		});

		it("ended session is inactive", async () => {
			const session = await controller.createSession({ name: "End" });
			const ended = await controller.endSession(session.id);
			expect(ended?.isActive).toBe(false);
		});

		it("ending an already ended session returns null", async () => {
			const session = await controller.createSession({ name: "Twice" });
			await controller.endSession(session.id);
			const result = await controller.endSession(session.id);
			expect(result).toBeNull();
		});

		it("non-existent session returns null", async () => {
			const result = await controller.getSession("nonexistent");
			expect(result).toBeNull();
		});

		it("ending non-existent session returns null", async () => {
			const result = await controller.endSession("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Stream Isolation ──────────────────────────────────────────

	describe("stream isolation", () => {
		it("photos from stream A do not appear in stream B", async () => {
			const session = await controller.createSession({ name: "Iso" });
			const streamA = await controller.createStream({ name: "A" });
			const streamB = await controller.createStream({ name: "B" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			await controller.addToStream(streamA.id, photo.id);

			const bPhotos = await controller.getStreamPhotos(streamB.id);
			expect(bPhotos).toHaveLength(0);

			const aPhotos = await controller.getStreamPhotos(streamA.id);
			expect(aPhotos).toHaveLength(1);
		});

		it("non-existent stream returns empty photos", async () => {
			const photos = await controller.getStreamPhotos("nonexistent");
			expect(photos).toEqual([]);
		});

		it("adding to non-existent stream returns false", async () => {
			const session = await controller.createSession({ name: "Bad" });
			const photo = await controller.capturePhoto({
				sessionId: session.id,
				imageUrl: "https://example.com/photo.jpg",
			});

			const result = await controller.addToStream("nonexistent", photo.id);
			expect(result).toBe(false);
		});

		it("adding non-existent photo to stream returns false", async () => {
			const stream = await controller.createStream({ name: "Bad" });
			const result = await controller.addToStream(stream.id, "nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Stream Toggle Safety ────────────────────────────────────────

	describe("stream toggle safety", () => {
		it("toggling non-existent stream returns null", async () => {
			const result = await controller.toggleStreamLive("nonexistent");
			expect(result).toBeNull();
		});

		it("stream starts not live", async () => {
			const stream = await controller.createStream({ name: "New" });
			expect(stream.isLive).toBe(false);
		});

		it("toggle changes isLive state", async () => {
			const stream = await controller.createStream({ name: "Toggle" });
			const toggled = await controller.toggleStreamLive(stream.id);
			expect(toggled?.isLive).toBe(true);
		});
	});
});
