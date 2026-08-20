import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Photo,
	PhotoBoothController,
	PhotoSession,
	PhotoStream,
} from "./service";

export function createPhotoBoothController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): PhotoBoothController {
	return {
		async capturePhoto(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const photo: Photo = {
				id,
				sessionId: params.sessionId,
				imageUrl: params.imageUrl,
				thumbnailUrl: params.thumbnailUrl,
				caption: params.caption,
				email: params.email,
				phoneNumber: params.phoneNumber,
				sendStatus: "none",
				tags: params.tags ?? [],
				metadata: params.metadata ?? {},
				isPublic: params.isPublic ?? true,
				createdAt: now,
			};

			await data.upsert("photo", id, photo as Record<string, unknown>);

			// Increment session photo count
			const sessionRaw = await data.get("photoSession", params.sessionId);
			if (sessionRaw) {
				const session = sessionRaw as unknown as PhotoSession;
				const updated = {
					...session,
					photoCount: session.photoCount + 1,
					updatedAt: now,
				};
				await data.upsert(
					"photoSession",
					params.sessionId,
					updated as Record<string, unknown>,
				);
			}

			void events?.emit("photo.captured", {
				photoId: photo.id,
				sessionId: photo.sessionId,
				imageUrl: photo.imageUrl,
			});

			return photo;
		},

		async getPhoto(id) {
			const raw = await data.get("photo", id);
			if (!raw) return null;
			return raw as unknown as Photo;
		},

		async deletePhoto(id) {
			const existing = await data.get("photo", id);
			if (!existing) return false;
			await data.delete("photo", id);

			const photo = existing as unknown as Photo;
			void events?.emit("photo.deleted", {
				photoId: id,
				sessionId: photo.sessionId,
			});

			return true;
		},

		async listPhotos(params) {
			const where: Record<string, unknown> = {};
			if (params?.sessionId) where.sessionId = params.sessionId;
			if (params?.isPublic !== undefined) where.isPublic = params.isPublic;

			const all = await data.findMany("photo", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Photo[];
		},

		async sendPhoto(id, params) {
			const existing = await data.get("photo", id);
			if (!existing) return null;

			if (!params.email && !params.phoneNumber) return null;

			const photo = existing as unknown as Photo;

			const updated: Photo = {
				...photo,
				...(params.email !== undefined ? { email: params.email } : {}),
				...(params.phoneNumber !== undefined
					? { phoneNumber: params.phoneNumber }
					: {}),
				sendStatus: "sent",
			};

			await data.upsert("photo", id, updated as Record<string, unknown>);

			void events?.emit("photo.sent", {
				photoId: id,
				email: updated.email,
				phoneNumber: updated.phoneNumber,
			});

			return updated;
		},

		async createSession(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const session: PhotoSession = {
				id,
				name: params.name,
				description: params.description,
				isActive: true,
				photoCount: 0,
				startedAt: now,
				settings: params.settings ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("photoSession", id, session as Record<string, unknown>);
			return session;
		},

		async getSession(id) {
			const raw = await data.get("photoSession", id);
			if (!raw) return null;
			return raw as unknown as PhotoSession;
		},

		async endSession(id) {
			const existing = await data.get("photoSession", id);
			if (!existing) return null;

			const session = existing as unknown as PhotoSession;
			if (!session.isActive) return null;

			const now = new Date();
			const updated: PhotoSession = {
				...session,
				isActive: false,
				endedAt: now,
				updatedAt: now,
			};

			await data.upsert("photoSession", id, updated as Record<string, unknown>);
			return updated;
		},

		async listSessions(params) {
			const all = await data.findMany("photoSession", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as PhotoSession[];
		},

		async createStream(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const stream: PhotoStream = {
				id,
				name: params.name,
				isLive: false,
				photoCount: 0,
				settings: params.settings ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("photoStream", id, stream as Record<string, unknown>);

			void events?.emit("stream.created", {
				streamId: stream.id,
				name: stream.name,
			});

			return stream;
		},

		async getStream(id) {
			const raw = await data.get("photoStream", id);
			if (!raw) return null;
			return raw as unknown as PhotoStream;
		},

		async addToStream(streamId, photoId) {
			const stream = await data.get("photoStream", streamId);
			if (!stream) return false;

			const photo = await data.get("photo", photoId);
			if (!photo) return false;

			const s = stream as unknown as PhotoStream;
			const p = photo as unknown as Photo;

			// Store stream-photo mapping in photo metadata
			const updatedPhoto: Photo = {
				...p,
				metadata: { ...p.metadata, streamId },
			};
			await data.upsert(
				"photo",
				photoId,
				updatedPhoto as Record<string, unknown>,
			);

			// Increment stream photo count
			const updatedStream: PhotoStream = {
				...s,
				photoCount: s.photoCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert(
				"photoStream",
				streamId,
				updatedStream as Record<string, unknown>,
			);

			return true;
		},

		async getStreamPhotos(streamId, params) {
			const stream = await data.get("photoStream", streamId);
			if (!stream) return [];

			const all = await data.findMany("photo", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			const photos = all as unknown as Photo[];

			// Filter photos that belong to this stream via metadata
			return photos.filter(
				(p) => (p.metadata as Record<string, unknown>).streamId === streamId,
			);
		},

		async toggleStreamLive(id) {
			const existing = await data.get("photoStream", id);
			if (!existing) return null;

			const stream = existing as unknown as PhotoStream;
			const now = new Date();
			const updated: PhotoStream = {
				...stream,
				isLive: !stream.isLive,
				updatedAt: now,
			};

			await data.upsert("photoStream", id, updated as Record<string, unknown>);

			void events?.emit("stream.ended", {
				streamId: id,
				isLive: updated.isLive,
			});

			return updated;
		},

		async listStreams(params) {
			const all = await data.findMany("photoStream", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as PhotoStream[];
		},
	};
}
