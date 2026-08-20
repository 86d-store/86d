import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const photoBoothPhotoShape = z.object({
	id: z.string().register(col, { pk: true }),
	sessionId: z.string(),
	imageUrl: z.string(),
	thumbnailUrl: z.string().optional(),
	caption: z.string().optional(),
	email: z.string().optional(),
	phoneNumber: z.string().optional(),
	sendStatus: z.string().default("none"),
	tags: z.array(z.unknown()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
	isPublic: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const photoBoothPhotoSessionShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	isActive: z.boolean().default(true),
	photoCount: z.int().default(0),
	startedAt: z.coerce.date().default(() => new Date()),
	endedAt: z.coerce.date().optional(),
	settings: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const photoBoothPhotoStreamShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	isLive: z.boolean().default(false),
	photoCount: z.int().default(0),
	settings: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for photo-booth. */
export const photoBoothStorage = {
	kind: "relational",
	tables: {
		photo: {
			shape: photoBoothPhotoShape,
		},
		photoSession: {
			shape: photoBoothPhotoSessionShape,
		},
		photoStream: {
			shape: photoBoothPhotoStreamShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
