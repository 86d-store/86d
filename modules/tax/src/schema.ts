import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const taxSchema = {
	/**
	 * Effective-dated merchant-approved jurisdiction policy used by tax.quote v2.
	 * Policies are additive to the legacy v1 tax records during migration.
	 */
	taxPolicyV2: {
		fields: {
			id: { type: "string", required: true },
			version: { type: "string", required: true },
			country: { type: "string", required: true },
			state: { type: "string", required: true },
			city: { type: "string", required: false },
			postalCode: { type: "string", required: false },
			jurisdictionDecision: {
				type: ["COLLECT", "NO_NEXUS", "MARKETPLACE_COLLECTED", "BLOCKED"],
				required: true,
			},
			calculationSource: {
				type: ["RATE_PACK", "TAXJAR"],
				required: false,
			},
			ratePackId: { type: "string", required: false },
			sourceVersion: { type: "string", required: false },
			effectiveFrom: { type: "date", required: true },
			effectiveTo: { type: "date", required: false },
			quoteTtlSeconds: { type: "number", required: true },
			enabled: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},

	/** Versioned manual or provenance-labelled official-data rate pack. */
	taxRatePackV2: {
		fields: {
			id: { type: "string", required: true },
			version: { type: "string", required: true },
			sourceKind: {
				type: ["MANUAL", "OFFICIAL_DATA"],
				required: true,
			},
			sourceName: { type: "string", required: true },
			sourceReference: { type: "string", required: true },
			effectiveFrom: { type: "date", required: true },
			effectiveTo: { type: "date", required: false },
			enabled: { type: "boolean", required: true, defaultValue: true },
			rates: { type: "json", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},

	/** Effective-dated full or category exemption evidence for tax.quote v2. */
	taxExemptionV2: {
		fields: {
			id: { type: "string", required: true },
			version: { type: "string", required: true },
			customerId: { type: "string", required: true },
			taxCategoryId: { type: "string", required: false },
			reason: { type: "string", required: true },
			effectiveFrom: { type: "date", required: true },
			effectiveTo: { type: "date", required: false },
			enabled: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},

	/**
	 * Tax rates by jurisdiction.
	 * A jurisdiction is a combination of country + state/province + optional city/postal.
	 * Rates are stored as decimals (e.g. 0.0825 for 8.25%).
	 */
	taxRate: {
		fields: {
			id: { type: "string", required: true },
			/** Human-readable name, e.g. "California Sales Tax" */
			name: { type: "string", required: true },
			/** Two-letter ISO country code (e.g. "US", "GB", "DE") */
			country: { type: "string", required: true },
			/** State/province code (e.g. "CA", "NY") or "*" for country-wide */
			state: { type: "string", required: true, defaultValue: "*" },
			/** City name or "*" for state-wide */
			city: { type: "string", required: true, defaultValue: "*" },
			/** Postal/ZIP code pattern or "*" for all */
			postalCode: { type: "string", required: true, defaultValue: "*" },
			/** Tax rate as a decimal (e.g. 0.0825 for 8.25%) */
			rate: { type: "number", required: true },
			/** Rate type: "percentage" (of subtotal) or "fixed" (per-item flat) */
			type: {
				type: ["percentage", "fixed"],
				required: true,
				defaultValue: "percentage",
			},
			/** Tax category this rate applies to, or "default" for all */
			categoryId: {
				type: "string",
				required: true,
				defaultValue: "default",
			},
			/** Whether this rate is currently active */
			enabled: { type: "boolean", required: true, defaultValue: true },
			/** Priority for rate stacking (higher = applied first) */
			priority: { type: "number", required: true, defaultValue: 0 },
			/** Whether this rate compounds on top of lower-priority rates */
			compound: { type: "boolean", required: true, defaultValue: false },
			/** Whether to include tax in the displayed product price */
			inclusive: { type: "boolean", required: true, defaultValue: false },
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

	/**
	 * Tax categories for product classification.
	 * Products can be assigned a category to use different tax rates
	 * (e.g. "clothing" may be tax-exempt in some jurisdictions).
	 */
	taxCategory: {
		fields: {
			id: { type: "string", required: true },
			/** Name like "default", "clothing", "food", "digital", "services" */
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},

	/**
	 * Tax exemptions for specific customers.
	 * Allows B2B or government customers to be exempt from tax.
	 */
	taxExemption: {
		fields: {
			id: { type: "string", required: true },
			/** Customer ID that is exempt */
			customerId: { type: "string", required: true },
			/** Exemption type: "full" (no tax), "category" (exempt from specific category) */
			type: {
				type: ["full", "category"],
				required: true,
				defaultValue: "full",
			},
			/** For category exemptions, which category is exempt */
			categoryId: { type: "string", required: false },
			/** Tax ID / VAT number for verification */
			taxIdNumber: { type: "string", required: false },
			/** Reason for exemption */
			reason: { type: "string", required: false },
			/** Expiration date for the exemption */
			expiresAt: { type: "date", required: false },
			enabled: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},

	/**
	 * Tax nexus — jurisdictions where the store has tax collection obligations.
	 * Only rates matching a nexus jurisdiction will be applied during calculation.
	 */
	taxNexus: {
		fields: {
			id: { type: "string", required: true },
			/** Two-letter ISO country code */
			country: { type: "string", required: true },
			/** State/province code or "*" for entire country */
			state: { type: "string", required: true, defaultValue: "*" },
			/** Nexus type: physical presence, economic activity, or voluntary registration */
			type: {
				type: ["physical", "economic", "voluntary"],
				required: true,
				defaultValue: "physical",
			},
			/** Whether this nexus is currently active */
			enabled: { type: "boolean", required: true, defaultValue: true },
			/** Optional notes (e.g. "warehouse in Dallas", "exceeded $100k threshold") */
			notes: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},

	/**
	 * Tax transaction log — immutable audit trail of every tax calculation.
	 * Records the full calculation result and context for compliance reporting.
	 */
	taxTransaction: {
		fields: {
			id: { type: "string", required: true },
			/** Associated order ID (set after checkout completes) */
			orderId: { type: "string", required: false },
			/** Customer ID if authenticated */
			customerId: { type: "string", required: false },
			/** Shipping address used for jurisdiction matching */
			country: { type: "string", required: true },
			state: { type: "string", required: true },
			city: { type: "string", required: false },
			postalCode: { type: "string", required: false },
			/** Taxable subtotal (sum of line item amounts) */
			subtotal: { type: "number", required: true },
			/** Shipping amount that was taxed */
			shippingAmount: { type: "number", required: true, defaultValue: 0 },
			/** Total tax collected */
			totalTax: { type: "number", required: true },
			/** Tax on shipping */
			shippingTax: { type: "number", required: true, defaultValue: 0 },
			/** Effective combined rate */
			effectiveRate: { type: "number", required: true },
			/** Whether prices were tax-inclusive */
			inclusive: { type: "boolean", required: true, defaultValue: false },
			/** Whether customer was fully exempt */
			exempt: { type: "boolean", required: true, defaultValue: false },
			/** JSON snapshot of per-line breakdown */
			lineDetails: { type: "json", required: true },
			/** JSON snapshot of rate names applied */
			rateNames: { type: "json", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const taxTables = transcodeModuleSchema(taxSchema);
