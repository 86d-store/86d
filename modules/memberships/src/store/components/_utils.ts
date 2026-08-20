"use client";

export function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

export function formatInterval(interval: string): string {
	switch (interval) {
		case "monthly":
			return "/mo";
		case "yearly":
			return "/yr";
		case "lifetime":
			return " one-time";
		default:
			return `/${interval}`;
	}
}

export function formatIntervalFull(interval: string): string {
	switch (interval) {
		case "monthly":
			return "per month";
		case "yearly":
			return "per year";
		case "lifetime":
			return "one-time payment";
		default:
			return interval;
	}
}

export function getBenefitIcon(type: string): string {
	switch (type) {
		case "discount_percentage":
			return "\u{1F3F7}\uFE0F";
		case "free_shipping":
			return "\u{1F4E6}";
		case "early_access":
			return "\u26A1";
		case "exclusive_products":
			return "\u{1F512}";
		case "priority_support":
			return "\u{1F6E1}\uFE0F";
		default:
			return "\u2728";
	}
}

export function getBenefitLabel(type: string): string {
	switch (type) {
		case "discount_percentage":
			return "Member Discount";
		case "free_shipping":
			return "Free Shipping";
		case "early_access":
			return "Early Access";
		case "exclusive_products":
			return "Exclusive Products";
		case "priority_support":
			return "Priority Support";
		default:
			return type;
	}
}

export function getStatusColor(status: string): {
	bg: string;
	text: string;
	ring: string;
} {
	switch (status) {
		case "active":
			return {
				bg: "bg-green-50 dark:bg-green-950/30",
				text: "text-green-700 dark:text-green-400",
				ring: "ring-green-600/20 dark:ring-green-400/30",
			};
		case "trial":
			return {
				bg: "bg-blue-50 dark:bg-blue-950/30",
				text: "text-blue-700 dark:text-blue-400",
				ring: "ring-blue-600/20 dark:ring-blue-400/30",
			};
		case "paused":
			return {
				bg: "bg-amber-50 dark:bg-amber-950/30",
				text: "text-amber-700 dark:text-amber-400",
				ring: "ring-amber-600/20 dark:ring-amber-400/30",
			};
		case "cancelled":
		case "expired":
			return {
				bg: "bg-gray-50 dark:bg-gray-800/50",
				text: "text-gray-600 dark:text-gray-400",
				ring: "ring-gray-500/20 dark:ring-gray-400/30",
			};
		default:
			return {
				bg: "bg-gray-50 dark:bg-gray-800/50",
				text: "text-gray-600 dark:text-gray-400",
				ring: "ring-gray-500/20 dark:ring-gray-400/30",
			};
	}
}
