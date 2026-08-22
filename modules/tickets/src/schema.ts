import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const ticketsTicketCategoryShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	position: z.int().default(0),
	isActive: z.boolean().default(true),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const ticketsTicketShape = z.object({
	id: z.string().register(col, { pk: true }),
	number: z.number().register(col, { unique: true }),
	categoryId: z
		.string()
		.register(col, {
			references: {
				table: "self.ticketCategory",
				column: "id",
				onDelete: "set null",
			},
		})
		.optional(),
	subject: z.string(),
	description: z.string(),
	status: z.string().default("open"),
	priority: z.string().default("normal"),
	customerEmail: z.string(),
	customerName: z.string(),
	customerId: z.string().optional(),
	orderId: z.string().optional(),
	assigneeId: z.string().optional(),
	assigneeName: z.string().optional(),
	tags: z.array(z.unknown()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
	closedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const ticketsTicketMessageShape = z.object({
	id: z.string().register(col, { pk: true }),
	ticketId: z.string().register(col, {
		references: { table: "self.ticket", column: "id", onDelete: "cascade" },
	}),
	body: z.string(),
	authorType: z.string(),
	authorId: z.string().optional(),
	authorName: z.string(),
	authorEmail: z.string().optional(),
	isInternal: z.boolean().default(false),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for tickets. */
export const ticketsStorage = {
	kind: "relational",
	tables: {
		ticketCategory: {
			shape: ticketsTicketCategoryShape,
		},
		ticket: {
			shape: ticketsTicketShape,
		},
		ticketMessage: {
			shape: ticketsTicketMessageShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
