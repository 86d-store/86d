import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const appointmentsServiceShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	duration: z.number(),
	price: z.number(),
	currency: z.string(),
	status: z.string(),
	maxCapacity: z.number(),
	sortOrder: z.number(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const appointmentsStaffShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	email: z.string().register(col, { unique: true }),
	bio: z.string().optional(),
	status: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const appointmentsStaffServiceShape = z.object({
	id: z.string().register(col, { pk: true }),
	staffId: z.string().register(col, { index: true }),
	serviceId: z.string().register(col, { index: true }),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const appointmentsScheduleShape = z.object({
	id: z.string().register(col, { pk: true }),
	staffId: z.string().register(col, { index: true }),
	dayOfWeek: z.number(),
	startTime: z.string(),
	endTime: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const appointmentsAppointmentShape = z.object({
	id: z.string().register(col, { pk: true }),
	serviceId: z.string().register(col, { index: true }),
	staffId: z.string().register(col, { index: true }),
	customerId: z.string().register(col, { index: true }).optional(),
	customerName: z.string(),
	customerEmail: z.string(),
	customerPhone: z.string().optional(),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	status: z.string(),
	notes: z.string().optional(),
	price: z.number(),
	currency: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for appointments. */
export const appointmentsStorage = {
	kind: "relational",
	tables: {
		service: {
			shape: appointmentsServiceShape,
		},
		staff: {
			shape: appointmentsStaffShape,
		},
		staffService: {
			shape: appointmentsStaffServiceShape,
		},
		schedule: {
			shape: appointmentsScheduleShape,
		},
		appointment: {
			shape: appointmentsAppointmentShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
