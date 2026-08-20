import type { ModuleSchema } from "@86d-app/core/types/schema";

export const affiliatesSchema = {
	affiliate: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			email: { type: "string", required: true },
			website: { type: "string", required: false },
			code: { type: "string", required: true },
			commissionRate: { type: "number", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			totalClicks: { type: "number", required: true, defaultValue: 0 },
			totalConversions: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			totalRevenue: { type: "number", required: true, defaultValue: 0 },
			totalCommission: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			totalPaid: { type: "number", required: true, defaultValue: 0 },
			customerId: { type: "string", required: false },
			notes: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	affiliateLink: {
		fields: {
			id: { type: "string", required: true },
			affiliateId: { type: "string", required: true },
			targetUrl: { type: "string", required: true },
			slug: { type: "string", required: true },
			clicks: { type: "number", required: true, defaultValue: 0 },
			conversions: { type: "number", required: true, defaultValue: 0 },
			revenue: { type: "number", required: true, defaultValue: 0 },
			active: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	affiliateConversion: {
		fields: {
			id: { type: "string", required: true },
			affiliateId: { type: "string", required: true },
			linkId: { type: "string", required: false },
			orderId: { type: "string", required: true },
			orderAmount: { type: "number", required: true },
			commissionRate: { type: "number", required: true },
			commissionAmount: { type: "number", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	affiliatePayout: {
		fields: {
			id: { type: "string", required: true },
			affiliateId: { type: "string", required: true },
			amount: { type: "number", required: true },
			method: { type: "string", required: true },
			reference: { type: "string", required: false },
			notes: { type: "string", required: false },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			paidAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
