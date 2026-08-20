import type { ModuleController } from "@86d-app/core/types/module";

export type SendStatus = "pending" | "sent" | "failed" | "none";

export type Photo = {
	id: string;
	sessionId: string;
	imageUrl: string;
	thumbnailUrl?: string | undefined;
	caption?: string | undefined;
	email?: string | undefined;
	phoneNumber?: string | undefined;
	sendStatus: SendStatus;
	tags: string[];
	metadata: Record<string, unknown>;
	isPublic: boolean;
	createdAt: Date;
};

export type PhotoSession = {
	id: string;
	name: string;
	description?: string | undefined;
	isActive: boolean;
	photoCount: number;
	startedAt: Date;
	endedAt?: Date | undefined;
	settings: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type PhotoStream = {
	id: string;
	name: string;
	isLive: boolean;
	photoCount: number;
	settings: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type PhotoBoothController = ModuleController & {
	capturePhoto(params: {
		sessionId: string;
		imageUrl: string;
		thumbnailUrl?: string | undefined;
		caption?: string | undefined;
		email?: string | undefined;
		phoneNumber?: string | undefined;
		tags?: string[] | undefined;
		metadata?: Record<string, unknown> | undefined;
		isPublic?: boolean | undefined;
	}): Promise<Photo>;

	getPhoto(id: string): Promise<Photo | null>;

	deletePhoto(id: string): Promise<boolean>;

	listPhotos(params?: {
		sessionId?: string | undefined;
		isPublic?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Photo[]>;

	sendPhoto(
		id: string,
		params: {
			email?: string | undefined;
			phoneNumber?: string | undefined;
		},
	): Promise<Photo | null>;

	createSession(params: {
		name: string;
		description?: string | undefined;
		settings?: Record<string, unknown> | undefined;
	}): Promise<PhotoSession>;

	getSession(id: string): Promise<PhotoSession | null>;

	endSession(id: string): Promise<PhotoSession | null>;

	listSessions(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<PhotoSession[]>;

	createStream(params: {
		name: string;
		settings?: Record<string, unknown> | undefined;
	}): Promise<PhotoStream>;

	getStream(id: string): Promise<PhotoStream | null>;

	addToStream(streamId: string, photoId: string): Promise<boolean>;

	getStreamPhotos(
		streamId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<Photo[]>;

	toggleStreamLive(id: string): Promise<PhotoStream | null>;

	listStreams(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<PhotoStream[]>;
};
