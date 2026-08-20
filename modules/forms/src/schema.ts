import type { ModuleSchema } from "@86d-app/core/types/schema";

export const formsSchema = {
	form: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			name: {
				type: "string",
				required: true,
			},
			slug: {
				type: "string",
				required: true,
				unique: true,
			},
			description: {
				type: "string",
				required: false,
			},
			/** JSON array of FormField definitions */
			fields: {
				type: "json",
				required: true,
				defaultValue: [],
			},
			/** Submit button label */
			submitLabel: {
				type: "string",
				required: true,
				defaultValue: "Submit",
			},
			/** Message shown after successful submission */
			successMessage: {
				type: "string",
				required: true,
				defaultValue: "Thank you for your submission.",
			},
			/** Whether the form accepts new submissions */
			isActive: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			/** Optional email address to notify on submission */
			notifyEmail: {
				type: "string",
				required: false,
			},
			/** Enable honeypot spam protection */
			honeypotEnabled: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			/** Maximum submissions allowed (0 = unlimited) */
			maxSubmissions: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
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
	formSubmission: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			formId: {
				type: "string",
				required: true,
				references: {
					model: "form",
					field: "id",
					onDelete: "cascade",
				},
			},
			/** JSON object of field name → submitted value */
			values: {
				type: "json",
				required: true,
			},
			/** Submitter IP for rate limiting / spam detection */
			ipAddress: {
				type: "string",
				required: false,
			},
			/** read / unread / spam / archived */
			status: {
				type: "string",
				required: true,
				defaultValue: "unread",
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
