import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const kioskKioskStationShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	location: z.string().nullable().default(null),
	isOnline: z.boolean().default(false),
	isActive: z.boolean().default(true),
	lastHeartbeat: z.coerce.date().optional(),
	currentSessionId: z.string().nullable().optional(),
	settings: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const kioskItemShape = z.object({
	id: z.string(),
	name: z.string(),
	price: z.number().nonnegative(),
	quantity: z.number().int().positive(),
	modifiers: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const kioskKioskSessionShape = z.object({
	id: z.string().register(col, { pk: true }),
	stationId: z.string(),
	status: z
		.enum(["active", "completed", "abandoned", "timed-out"])
		.default("active"),
	items: z.array(kioskItemShape).default([]),
	subtotal: z.int().default(0),
	tax: z.int().default(0),
	tip: z.int().default(0),
	total: z.int().default(0),
	paymentMethod: z.string().optional(),
	paymentStatus: z.enum(["pending", "paid", "failed"]).default("pending"),
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
