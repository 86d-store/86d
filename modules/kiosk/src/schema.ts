import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const kioskKioskStationShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	location: z.string().optional(),
	isOnline: z.boolean().default(false),
	isActive: z.boolean().default(true),
	lastHeartbeat: z.coerce.date().optional(),
	currentSessionId: z.string().optional(),
	settings: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const kioskKioskSessionShape = z.object({
	id: z.string().register(col, { pk: true }),
	stationId: z.string(),
	status: z.string().default("active"),
	items: z.array(z.unknown()).default([]),
	subtotal: z.int().default(0),
	tax: z.int().default(0),
	tip: z.int().default(0),
	total: z.int().default(0),
	paymentMethod: z.string().optional(),
	paymentStatus: z.string().default("pending"),
	startedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for kiosk. */
export const kioskStorage = {
	kind: "relational",
	tables: {
		kioskStation: {
			shape: kioskKioskStationShape,
		},
		kioskSession: {
			shape: kioskKioskSessionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
