/**
 * Demo Cafe Store Configuration
 *
 * Fictional cafe seed overlay for testing and demonstration.
 * Exercises all configurable features: multiple windows per day,
 * midnight-crossing hours, and pickup policy settings.
 *
 * No KYB, PII, tax IDs, or banking details are stored here.
 */

import type { BusinessHours } from "@86d-store/settings";

export const demoCafeStoreSummary = {
	displayName: "Demo Cafe",
	timezone: "America/Chicago",
};

/**
 * Demo Cafe business hours (America/Chicago):
 * - Every day: 07:00-15:00 and 18:00-24:00 (two windows)
 * - Friday/Saturday evening: 18:00-02:00 (crosses midnight into next day)
 */
export const demoCafeBusinessHours: BusinessHours = {
	timezone: "America/Chicago",
	schedule: {
		sunday: {
			windows: [
				{ open: "07:00", close: "15:00" },
				{ open: "18:00", close: "24:00" },
			],
		},
		monday: {
			windows: [
				{ open: "07:00", close: "15:00" },
				{ open: "18:00", close: "24:00" },
			],
		},
		tuesday: {
			windows: [
				{ open: "07:00", close: "15:00" },
				{ open: "18:00", close: "24:00" },
			],
		},
		wednesday: {
			windows: [
				{ open: "07:00", close: "15:00" },
				{ open: "18:00", close: "24:00" },
			],
		},
		thursday: {
			windows: [
				{ open: "07:00", close: "15:00" },
				{ open: "18:00", close: "24:00" },
			],
		},
		friday: {
			windows: [
				{ open: "07:00", close: "15:00" },
				{ open: "18:00", close: "02:00" }, // crosses midnight into Saturday
			],
		},
		saturday: {
			windows: [
				{ open: "07:00", close: "15:00" },
				{ open: "18:00", close: "02:00" }, // crosses midnight into Sunday
			],
		},
	},
};

/**
 * Demo Cafe store settings.
 * Store status is coming_soon for demonstration.
 */
export const demoCafeStoreSettings = [
	// General
	{ key: "general.store_name", value: "Demo Cafe", group: "general" },
	{ key: "general.timezone", value: "America/Chicago", group: "general" },

	// Contact
	{
		key: "contact.support_email",
		value: "demo@example.com",
		group: "contact",
	},

	// Commerce - coming_soon for demonstration
	{ key: "commerce.store_status", value: "coming_soon", group: "commerce" },

	// Checkout - pickup-focused
	{
		key: "checkout.fulfillment_methods_offered",
		value: JSON.stringify(["pickup"]),
		group: "checkout",
	},
	{
		key: "checkout.default_fulfillment_type",
		value: "pickup",
		group: "checkout",
	},

	// Business hours (JSON)
	{
		key: "general.business_hours",
		value: JSON.stringify(demoCafeBusinessHours),
		group: "general",
	},

	// Pickup Policy - platform defaults with required fields
	{ key: "pickup.prep_time_minutes", value: "15", group: "pickup" },
	{ key: "pickup.no_show_window_minutes", value: "30", group: "pickup" },
	{ key: "pickup.no_show_outcome", value: "no_refund", group: "pickup" },

	// Support
	{
		key: "pickup.support_contact",
		value: "demo@example.com",
		group: "pickup",
	},
] as const;
