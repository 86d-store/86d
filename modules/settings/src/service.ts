import type { ModuleController } from "@86d-store/core/types/module";

export type SettingGroup =
	| "general"
	| "contact"
	| "social"
	| "legal"
	| "commerce"
	| "appearance"
	| "pickup"
	| "checkout";

/**
 * Store ordering status determines whether the store accepts orders:
 * - coming_soon: default for new stores, storefront visible with banner, checkout refused
 * - paused: temporarily unavailable, storefront visible, checkout refused
 * - open: normal ordering, subject to business hours
 */
export type StoreStatus = "coming_soon" | "paused" | "open";

export const STORE_STATUS_VALUES: readonly StoreStatus[] = [
	"coming_soon",
	"paused",
	"open",
] as const;

export const DEFAULT_STORE_STATUS: StoreStatus = "coming_soon";

/**
 * A single time window with open and close times in HH:MM format.
 * Supports midnight crossing: if close < open, the window extends past midnight.
 * Example: { open: "18:00", close: "02:00" } means 6pm to 2am next day.
 */
export type TimeWindow = {
	open: string;
	close: string;
};

/**
 * Schedule for a single day. Supports multiple windows per day.
 * Example: morning and evening windows with a midday break.
 */
export type DaySchedule = {
	closed?: boolean;
	windows?: TimeWindow[];
};

/**
 * Weekly schedule keyed by day name.
 */
export type WeeklySchedule = {
	sunday?: DaySchedule;
	monday?: DaySchedule;
	tuesday?: DaySchedule;
	wednesday?: DaySchedule;
	thursday?: DaySchedule;
	friday?: DaySchedule;
	saturday?: DaySchedule;
};

/**
 * Business hours with timezone and weekly schedule.
 * Stored as JSON in general.business_hours setting.
 */
export type BusinessHours = {
	timezone: string;
	schedule: WeeklySchedule;
};

/**
 * Pickup cancel lock state: which order status blocks customer cancellation.
 * - started: customer cannot cancel after staff starts preparing (default)
 * - preparing: customer cannot cancel after prep begins
 * - ready: customer cannot cancel after order is ready
 * - none: customer can always cancel (staff can still cancel)
 */
export type PickupCancelLockState = "started" | "preparing" | "ready" | "none";

export const PICKUP_CANCEL_LOCK_VALUES: readonly PickupCancelLockState[] = [
	"started",
	"preparing",
	"ready",
	"none",
] as const;

export const DEFAULT_PICKUP_CANCEL_LOCK_STATE: PickupCancelLockState =
	"started";

/**
 * No-show outcome: what happens when a customer doesn't pick up their order.
 * - no_refund: order forfeited, no automatic refund (default)
 * - refund: full automatic refund to original payment method
 * - store_credit: refund issued as store credit
 */
export type PickupNoShowOutcome = "no_refund" | "refund" | "store_credit";

export const PICKUP_NO_SHOW_OUTCOME_VALUES: readonly PickupNoShowOutcome[] = [
	"no_refund",
	"refund",
	"store_credit",
] as const;

export const DEFAULT_PICKUP_NO_SHOW_OUTCOME: PickupNoShowOutcome = "no_refund";

/**
 * Refund method for pickup orders.
 * Currently only 'original_payment_method' is supported.
 */
export type PickupRefundMethod = "original_payment_method";

export const PICKUP_REFUND_METHOD_VALUES: readonly PickupRefundMethod[] = [
	"original_payment_method",
] as const;

export const DEFAULT_PICKUP_REFUND_METHOD: PickupRefundMethod =
	"original_payment_method";

/** Default no-show window in minutes */
export const DEFAULT_PICKUP_NO_SHOW_WINDOW_MINUTES = 30;

/** Default: late order refund is OFF */
export const DEFAULT_PICKUP_LATE_ORDER_REFUND_ENABLED = false;

/** Default: partial refunds are enabled */
export const DEFAULT_PICKUP_PARTIAL_REFUNDS_ENABLED = true;

/** Default: item issue reporting is OFF */
export const DEFAULT_PICKUP_ITEM_ISSUE_REPORT_ENABLED = false;

/** Default item issue report window in hours (null = not configured) */
export const DEFAULT_PICKUP_ITEM_ISSUE_REPORT_WINDOW_HOURS: number | null =
	null;

/**
 * Item issue resolution options:
 * - remake: store remakes the item
 * - refund: store refunds the item
 * - remake_or_refund: customer chooses between remake or refund
 */
export type ItemIssueResolution = "remake" | "refund" | "remake_or_refund";

export const ITEM_ISSUE_RESOLUTION_VALUES: readonly ItemIssueResolution[] = [
	"remake",
	"refund",
	"remake_or_refund",
] as const;

/** Default item issue resolution (null = not configured) */
export const DEFAULT_PICKUP_ITEM_ISSUE_REPORT_RESOLUTION: ItemIssueResolution | null =
	null;

/**
 * Fulfillment methods that a store can offer.
 * - pickup: customer picks up at a location
 * - shipping: store ships to customer
 */
export type FulfillmentMethod = "pickup" | "shipping";

export const FULFILLMENT_METHOD_VALUES: readonly FulfillmentMethod[] = [
	"pickup",
	"shipping",
] as const;

/** Default: stores offer shipping only (conservative default) */
export const DEFAULT_FULFILLMENT_METHODS_OFFERED: FulfillmentMethod[] = [
	"shipping",
];

/** Default fulfillment type when checkout starts */
export const DEFAULT_FULFILLMENT_TYPE: FulfillmentMethod = "shipping";

/** Default checkout session TTL in minutes */
export const DEFAULT_CHECKOUT_SESSION_TTL_MINUTES = 30;

/** Default currency - must be configured per store */
export const DEFAULT_CURRENCY = "USD";

/** Default store status messages (customer-facing) */
export const DEFAULT_COMING_SOON_MESSAGE =
	"This store is not taking orders yet.";
export const DEFAULT_PAUSED_MESSAGE = "This store is temporarily closed.";

/** Default cancel blocked message for pickup orders */
export const DEFAULT_PICKUP_CANCEL_BLOCKED_MESSAGE =
	"Cannot cancel order after preparation has started. Please contact the store.";

export type StoreSetting = {
	id: string;
	key: string;
	value: string;
	group: SettingGroup;
	updatedAt: Date;
};

export const SETTING_KEYS = {
	// General
	storeName: "general.store_name",
	storeDescription: "general.store_description",
	storeTagline: "general.store_tagline",
	timezone: "general.timezone",
	locale: "general.locale",
	/** Business hours JSON (BusinessHours type) */
	businessHours: "general.business_hours",

	// Contact
	supportEmail: "contact.support_email",
	supportPhone: "contact.support_phone",
	businessAddress: "contact.business_address",
	businessCity: "contact.business_city",
	businessState: "contact.business_state",
	businessPostalCode: "contact.business_postal_code",
	businessCountry: "contact.business_country",

	// Social
	facebook: "social.facebook",
	instagram: "social.instagram",
	twitter: "social.twitter",
	tiktok: "social.tiktok",
	youtube: "social.youtube",
	pinterest: "social.pinterest",

	// Legal
	returnPolicy: "legal.return_policy",
	privacyPolicy: "legal.privacy_policy",
	termsOfService: "legal.terms_of_service",
	shippingPolicy: "legal.shipping_policy",

	// Commerce
	currency: "commerce.currency",
	weightUnit: "commerce.weight_unit",
	dimensionUnit: "commerce.dimension_unit",
	orderPrefix: "commerce.order_prefix",
	taxIncluded: "commerce.tax_included",
	/**
	 * Store ordering status:
	 * - coming_soon: storefront visible, checkout refused ("Not taking orders yet")
	 * - paused: storefront visible, checkout refused ("Temporarily closed")
	 * - open: normal ordering, subject to business hours
	 */
	storeStatus: "commerce.store_status",
	/** Customer-facing message when store status is coming_soon */
	comingSoonMessage: "commerce.coming_soon_message",
	/** Customer-facing message when store status is paused */
	pausedMessage: "commerce.paused_message",

	// Checkout
	/** Fulfillment methods offered: JSON array of 'pickup' and/or 'shipping' */
	fulfillmentMethodsOffered: "checkout.fulfillment_methods_offered",
	/** Default fulfillment type when multiple methods are offered */
	defaultFulfillmentType: "checkout.default_fulfillment_type",
	/** Checkout session TTL in minutes */
	checkoutSessionTtlMinutes: "checkout.session_ttl_minutes",
	/** Default currency code (ISO 4217) */
	defaultCurrency: "checkout.default_currency",

	// Appearance
	logoUrl: "appearance.logo_url",
	faviconUrl: "appearance.favicon_url",
	brandColor: "appearance.brand_color",
	announcementBar: "appearance.announcement_bar",
	announcementBarEnabled: "appearance.announcement_bar_enabled",

	// Pickup Policy
	/** REQUIRED: Default prep time in minutes for pickup orders */
	pickupPrepTimeMinutes: "pickup.prep_time_minutes",
	/** Cancel lock state: 'started' (default), 'preparing', 'ready', or 'none' */
	pickupCancelLockState: "pickup.cancel_lock_state",
	/** No-show window in minutes after ready time (default: 30) */
	pickupNoShowWindowMinutes: "pickup.no_show_window_minutes",
	/** No-show outcome: 'no_refund' (default), 'refund', 'store_credit' */
	pickupNoShowOutcome: "pickup.no_show_outcome",
	/** Late order refund enabled (default: false) */
	pickupLateOrderRefundEnabled: "pickup.late_order_refund_enabled",
	/** REQUIRED when late order refund enabled: grace minutes after promised ready time */
	pickupLateOrderGraceMinutes: "pickup.late_order_grace_minutes",
	/** Partial refunds enabled for per-item issues (default: true) */
	pickupPartialRefundsEnabled: "pickup.partial_refunds_enabled",
	/** Refund method: 'original_payment_method' (default and only option) */
	pickupRefundMethod: "pickup.refund_method",
	/** Item issue reporting enabled (default: false) */
	pickupItemIssueReportEnabled: "pickup.item_issue_report_enabled",
	/** Item issue report window in hours (REQUIRED when item issue reporting enabled) */
	pickupItemIssueReportWindowHours: "pickup.item_issue_report_window_hours",
	/** Item issue resolution: 'remake', 'refund', or 'remake_or_refund' (REQUIRED when enabled) */
	pickupItemIssueReportResolution: "pickup.item_issue_report_resolution",
	/** Support contact for pickup issues (customer-facing) */
	pickupSupportContact: "pickup.support_contact",
	/** Customer-facing pickup policy text */
	pickupPolicyCopy: "pickup.policy_copy",
	/** Customer-facing message when cancellation is blocked due to prep status */
	pickupCancelBlockedMessage: "pickup.cancel_blocked_message",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export type SettingsController = ModuleController & {
	get(key: string): Promise<StoreSetting | null>;

	getValue(key: string): Promise<string | null>;

	set(
		key: string,
		value: string,
		group?: SettingGroup | undefined,
	): Promise<StoreSetting>;

	setBulk(
		settings: Array<{
			key: string;
			value: string;
			group?: SettingGroup | undefined;
		}>,
	): Promise<StoreSetting[]>;

	getByGroup(group: SettingGroup): Promise<StoreSetting[]>;

	getAll(): Promise<StoreSetting[]>;

	getPublic(): Promise<Record<string, string>>;

	delete(key: string): Promise<boolean>;
};
