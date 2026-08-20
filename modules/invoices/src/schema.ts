import type { ModuleSchema } from "@86d-app/core/types/schema";

export const invoicesSchema = {
	invoice: {
		fields: {
			id: { type: "string", required: true },
			/** Auto-generated invoice number (e.g. INV-20260309-0001) */
			invoiceNumber: { type: "string", required: true, unique: true },
			/** Optional linked order ID */
			orderId: { type: "string", required: false, index: true },
			/** Registered customer ID */
			customerId: { type: "string", required: false, index: true },
			/** Guest email for non-registered customers */
			guestEmail: { type: "string", required: false },
			/** Customer display name */
			customerName: { type: "string", required: false },
			/** Invoice lifecycle status */
			status: {
				type: [
					"draft",
					"sent",
					"viewed",
					"paid",
					"partially_paid",
					"overdue",
					"void",
				] as const,
				required: true,
			},
			/** Payment terms for due date calculation */
			paymentTerms: {
				type: [
					"due_on_receipt",
					"net_7",
					"net_15",
					"net_30",
					"net_45",
					"net_60",
					"net_90",
				] as const,
				required: true,
			},
			/** Date the invoice was formally issued */
			issuedAt: { type: "date", required: false },
			/** Date payment is due */
			dueDate: { type: "date", required: false },
			/** Subtotal before tax/shipping/discounts (cents) */
			subtotal: { type: "number", required: true },
			/** Tax amount (cents) */
			taxAmount: { type: "number", required: true, defaultValue: 0 },
			/** Shipping amount (cents) */
			shippingAmount: { type: "number", required: true, defaultValue: 0 },
			/** Discount amount (cents) */
			discountAmount: { type: "number", required: true, defaultValue: 0 },
			/** Grand total (cents) */
			total: { type: "number", required: true },
			/** Amount paid so far (cents) */
			amountPaid: { type: "number", required: true, defaultValue: 0 },
			/** Amount still owed (cents) */
			amountDue: { type: "number", required: true },
			/** Currency code */
			currency: { type: "string", required: true },
			/** Billing address snapshot */
			billingAddress: { type: "json", required: false },
			/** Customer-facing notes */
			notes: { type: "string", required: false },
			/** Internal-only notes */
			internalNotes: { type: "string", required: false },
			/** Flexible metadata */
			metadata: { type: "json", required: false },
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
	invoiceLineItem: {
		fields: {
			id: { type: "string", required: true },
			invoiceId: {
				type: "string",
				required: true,
				references: {
					model: "invoice",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Line item description */
			description: { type: "string", required: true },
			/** Quantity */
			quantity: { type: "number", required: true },
			/** Unit price (cents) */
			unitPrice: { type: "number", required: true },
			/** Line total = quantity * unitPrice (cents) */
			amount: { type: "number", required: true },
			/** Optional SKU reference */
			sku: { type: "string", required: false },
			/** Optional product reference */
			productId: { type: "string", required: false },
			/** Display order */
			sortOrder: { type: "number", required: true, defaultValue: 0 },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	invoicePayment: {
		fields: {
			id: { type: "string", required: true },
			invoiceId: {
				type: "string",
				required: true,
				references: {
					model: "invoice",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Payment amount (cents) */
			amount: { type: "number", required: true },
			/** Payment method */
			method: {
				type: [
					"card",
					"bank_transfer",
					"cash",
					"check",
					"store_credit",
					"other",
				] as const,
				required: true,
			},
			/** External payment reference (transaction ID, check number) */
			reference: { type: "string", required: false },
			/** Payment notes */
			notes: { type: "string", required: false },
			/** When the payment was received */
			paidAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	creditNote: {
		fields: {
			id: { type: "string", required: true },
			/** Linked invoice */
			invoiceId: {
				type: "string",
				required: true,
				references: {
					model: "invoice",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Auto-generated credit note number (e.g. CN-20260309-0001) */
			creditNoteNumber: { type: "string", required: true, unique: true },
			/** Credit note status */
			status: {
				type: ["draft", "issued", "applied", "void"] as const,
				required: true,
			},
			/** Total credit amount (cents) */
			amount: { type: "number", required: true },
			/** Reason for credit */
			reason: { type: "string", required: false },
			/** Internal notes */
			notes: { type: "string", required: false },
			/** When the credit note was formally issued */
			issuedAt: { type: "date", required: false },
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
	creditNoteLineItem: {
		fields: {
			id: { type: "string", required: true },
			creditNoteId: {
				type: "string",
				required: true,
				references: {
					model: "creditNote",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Line item description */
			description: { type: "string", required: true },
			/** Quantity */
			quantity: { type: "number", required: true },
			/** Unit price (cents) */
			unitPrice: { type: "number", required: true },
			/** Line total (cents) */
			amount: { type: "number", required: true },
			/** Display order */
			sortOrder: { type: "number", required: true, defaultValue: 0 },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
