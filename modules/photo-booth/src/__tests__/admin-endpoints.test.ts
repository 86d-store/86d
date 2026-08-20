import { describe, expect, it, vi } from "vitest";
import { createSessionEndpoint } from "../admin/endpoints/create-session";
import { createStreamEndpoint } from "../admin/endpoints/create-stream";
import { deletePhotoEndpoint } from "../admin/endpoints/delete-photo";
import { endSessionEndpoint } from "../admin/endpoints/end-session";
import { listPhotosEndpoint } from "../admin/endpoints/list-photos";
import { listSessionsEndpoint } from "../admin/endpoints/list-sessions";
import { listStreamsEndpoint } from "../admin/endpoints/list-streams";
import { streamPhotosEndpoint } from "../admin/endpoints/stream-photos";
import { toggleStreamEndpoint } from "../admin/endpoints/toggle-stream";
import type {
	Photo,
	PhotoBoothController,
	PhotoSession,
	PhotoStream,
	SendStatus,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
	return {
		id: crypto.randomUUID(),
		sessionId: "session_1",
		imageUrl: "https://example.com/photo.jpg",
		sendStatus: "none" as SendStatus,
		tags: [],
		metadata: {},
		isPublic: true,
		createdAt: new Date(),
		...overrides,
	};
}

function makeSession(overrides: Partial<PhotoSession> = {}): PhotoSession {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Birthday Party",
		isActive: true,
		photoCount: 0,
		startedAt: now,
		settings: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeStream(overrides: Partial<PhotoStream> = {}): PhotoStream {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Live Stream",
		isLive: false,
		photoCount: 0,
		settings: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<PhotoBoothController> = {},
): PhotoBoothController {
	return {
		capturePhoto: vi.fn().mockResolvedValue(makePhoto()),
		getPhoto: vi.fn().mockResolvedValue(null),
		deletePhoto: vi.fn().mockResolvedValue(false),
		listPhotos: vi.fn().mockResolvedValue([]),
		sendPhoto: vi.fn().mockResolvedValue(null),
		createSession: vi.fn().mockResolvedValue(makeSession()),
		getSession: vi.fn().mockResolvedValue(null),
		endSession: vi.fn().mockResolvedValue(null),
		listSessions: vi.fn().mockResolvedValue([]),
		createStream: vi.fn().mockResolvedValue(makeStream()),
		getStream: vi.fn().mockResolvedValue(null),
		addToStream: vi.fn().mockResolvedValue(undefined),
		getStreamPhotos: vi.fn().mockResolvedValue([]),
		toggleStreamLive: vi.fn().mockResolvedValue(null),
		listStreams: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: PhotoBoothController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { photoBooth: opts.controller ?? makeController() },
		},
	});
}

const listPhotosHandler = extractHandler(listPhotosEndpoint);
const deletePhotoHandler = extractHandler(deletePhotoEndpoint);
const createSessionHandler = extractHandler(createSessionEndpoint);
const listSessionsHandler = extractHandler(listSessionsEndpoint);
const endSessionHandler = extractHandler(endSessionEndpoint);
const createStreamHandler = extractHandler(createStreamEndpoint);
const listStreamsHandler = extractHandler(listStreamsEndpoint);
const toggleStreamHandler = extractHandler(toggleStreamEndpoint);
const streamPhotosHandler = extractHandler(streamPhotosEndpoint);

describe("admin GET /photo-booth/photos", () => {
	it("returns empty list", async () => {
		const result = (await call(listPhotosHandler)) as {
			photos: Photo[];
			total: number;
		};
		expect(result.photos).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards sessionId filter", async () => {
		const ctrl = makeController();
		await call(listPhotosHandler, {
			query: { sessionId: "session_1" },
			controller: ctrl,
		});
		expect(ctrl.listPhotos).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: "session_1" }),
		);
	});

	it("returns photos", async () => {
		const photo = makePhoto({ id: "photo_1" });
		const ctrl = makeController({
			listPhotos: vi.fn().mockResolvedValue([photo]),
		});
		const result = (await call(listPhotosHandler, {
			controller: ctrl,
		})) as { photos: Photo[]; total: number };
		expect(result.photos).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin DELETE /photo-booth/photos/:id/delete", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deletePhotoHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes photo and returns deleted=true", async () => {
		const ctrl = makeController({
			deletePhoto: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deletePhotoHandler, {
			params: { id: "photo_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

describe("admin POST /photo-booth/sessions/create", () => {
	it("creates and returns a session", async () => {
		const session = makeSession({ name: "Wedding Booth" });
		const ctrl = makeController({
			createSession: vi.fn().mockResolvedValue(session),
		});
		const result = (await call(createSessionHandler, {
			body: { name: "Wedding Booth" },
			controller: ctrl,
		})) as { session: PhotoSession };
		expect(result.session.name).toBe("Wedding Booth");
	});

	it("passes description to controller", async () => {
		const ctrl = makeController();
		await call(createSessionHandler, {
			body: { name: "Party", description: "New Year Party" },
			controller: ctrl,
		});
		expect(ctrl.createSession).toHaveBeenCalledWith(
			expect.objectContaining({ description: "New Year Party" }),
		);
	});
});

describe("admin GET /photo-booth/sessions", () => {
	it("returns empty list", async () => {
		const result = (await call(listSessionsHandler)) as {
			sessions: PhotoSession[];
			total: number;
		};
		expect(result.sessions).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns sessions", async () => {
		const session = makeSession({ id: "session_1" });
		const ctrl = makeController({
			listSessions: vi.fn().mockResolvedValue([session]),
		});
		const result = (await call(listSessionsHandler, {
			controller: ctrl,
		})) as { sessions: PhotoSession[]; total: number };
		expect(result.sessions).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin PUT /photo-booth/sessions/:id/end", () => {
	it("returns null session when not found", async () => {
		const result = (await call(endSessionHandler, {
			params: { id: "missing" },
		})) as { session: PhotoSession | null };
		expect(result.session).toBeNull();
	});

	it("ends session and returns it", async () => {
		const session = makeSession({ id: "session_1", isActive: false });
		const ctrl = makeController({
			endSession: vi.fn().mockResolvedValue(session),
		});
		const result = (await call(endSessionHandler, {
			params: { id: "session_1" },
			controller: ctrl,
		})) as { session: PhotoSession };
		expect(result.session.isActive).toBe(false);
		expect(ctrl.endSession).toHaveBeenCalledWith("session_1");
	});
});

describe("admin POST /photo-booth/streams/create", () => {
	it("creates and returns a stream", async () => {
		const stream = makeStream({ name: "Gallery Stream" });
		const ctrl = makeController({
			createStream: vi.fn().mockResolvedValue(stream),
		});
		const result = (await call(createStreamHandler, {
			body: { name: "Gallery Stream" },
			controller: ctrl,
		})) as { stream: PhotoStream };
		expect(result.stream.name).toBe("Gallery Stream");
	});
});

describe("admin GET /photo-booth/streams", () => {
	it("returns empty list", async () => {
		const result = (await call(listStreamsHandler)) as {
			streams: PhotoStream[];
			total: number;
		};
		expect(result.streams).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns streams", async () => {
		const stream = makeStream({ id: "stream_1" });
		const ctrl = makeController({
			listStreams: vi.fn().mockResolvedValue([stream]),
		});
		const result = (await call(listStreamsHandler, {
			controller: ctrl,
		})) as { streams: PhotoStream[]; total: number };
		expect(result.streams).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin PUT /photo-booth/streams/:id/toggle", () => {
	it("returns null stream when not found", async () => {
		const result = (await call(toggleStreamHandler, {
			params: { id: "missing" },
		})) as { stream: PhotoStream | null };
		expect(result.stream).toBeNull();
	});

	it("toggles stream live and returns it", async () => {
		const stream = makeStream({ id: "stream_1", isLive: true });
		const ctrl = makeController({
			toggleStreamLive: vi.fn().mockResolvedValue(stream),
		});
		const result = (await call(toggleStreamHandler, {
			params: { id: "stream_1" },
			controller: ctrl,
		})) as { stream: PhotoStream };
		expect(result.stream.isLive).toBe(true);
		expect(ctrl.toggleStreamLive).toHaveBeenCalledWith("stream_1");
	});
});

describe("admin GET /photo-booth/streams/:id/photos", () => {
	it("returns empty list", async () => {
		const result = (await call(streamPhotosHandler, {
			params: { id: "stream_1" },
		})) as { photos: Photo[]; total: number };
		expect(result.photos).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns photos for stream", async () => {
		const photo = makePhoto({ id: "photo_1" });
		const ctrl = makeController({
			getStreamPhotos: vi.fn().mockResolvedValue([photo]),
		});
		const result = (await call(streamPhotosHandler, {
			params: { id: "stream_1" },
			controller: ctrl,
		})) as { photos: Photo[]; total: number };
		expect(result.photos).toHaveLength(1);
		expect(result.total).toBe(1);
		// After the fix, take/skip are applied in-memory; controller receives only the stream id
		expect(ctrl.getStreamPhotos).toHaveBeenCalledWith(
			"stream_1",
			expect.not.objectContaining({ take: expect.anything() }),
		);
	});
});
