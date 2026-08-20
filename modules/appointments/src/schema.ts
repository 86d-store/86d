import type { ModuleSchema } from "@86d-app/core/types/schema";

export const appointmentsSchema = {
	service: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			description: { type: "string", required: false },
			duration: { type: "number", required: true },
			price: { type: "number", required: true },
			currency: { type: "string", required: true },
			status: { type: "string", required: true },
			maxCapacity: { type: "number", required: true },
			sortOrder: { type: "number", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	staff: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			email: { type: "string", required: true, unique: true },
			bio: { type: "string", required: false },
			status: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	staffService: {
		fields: {
			id: { type: "string", required: true },
			staffId: { type: "string", required: true, index: true },
			serviceId: { type: "string", required: true, index: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	schedule: {
		fields: {
			id: { type: "string", required: true },
			staffId: { type: "string", required: true, index: true },
			dayOfWeek: { type: "number", required: true },
			startTime: { type: "string", required: true },
			endTime: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	appointment: {
		fields: {
			id: { type: "string", required: true },
			serviceId: { type: "string", required: true, index: true },
			staffId: { type: "string", required: true, index: true },
			customerId: { type: "string", required: false, index: true },
			customerName: { type: "string", required: true },
			customerEmail: { type: "string", required: true },
			customerPhone: { type: "string", required: false },
			startsAt: { type: "date", required: true },
			endsAt: { type: "date", required: true },
			status: { type: "string", required: true },
			notes: { type: "string", required: false },
			price: { type: "number", required: true },
			currency: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
