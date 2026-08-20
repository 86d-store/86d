export interface IconLogoVariant {
	light: string;
	dark: string;
}

export interface ThemeVariables {
	radius?: string;
	background: string;
	foreground: string;
	card: string;
	"card-foreground": string;
	popover: string;
	"popover-foreground": string;
	primary: string;
	"primary-foreground": string;
	secondary: string;
	"secondary-foreground": string;
	muted: string;
	"muted-foreground": string;
	accent: string;
	"accent-foreground": string;
	destructive: string;
	border: string;
	input: string;
	ring: string;
	"chart-1": string;
	"chart-2": string;
	"chart-3": string;
	"chart-4": string;
	"chart-5": string;
	sidebar: string;
	"sidebar-foreground": string;
	"sidebar-primary": string;
	"sidebar-primary-foreground": string;
	"sidebar-accent": string;
	"sidebar-accent-foreground": string;
	"sidebar-border": string;
	"sidebar-ring": string;
}

export interface NotificationSettings {
	fromAddress?: string;
	adminEmail?: string;
	events?: Record<string, boolean>;
}

export interface BillingInfo {
	plan: string;
	status:
		| "active"
		| "trialing"
		| "past_due"
		| "canceled"
		| "incomplete"
		| "incomplete_expired"
		| "unpaid"
		| "paused";
	isActive: boolean;
	periodEnd?: string;
}

export type StoreEntitlementPlan = "launch" | "premium" | "enterprise";

export type StoreEntitlementLifecycle =
	| "trialing"
	| "active"
	| "suspended"
	| "destroyed";

export interface StoreRuntimeEntitlement {
	version: 1;
	catalogVersion: number;
	plan: StoreEntitlementPlan;
	lifecycle: StoreEntitlementLifecycle;
	trialEndsAt?: string | undefined;
	premiumTransitionAt?: string | undefined;
	currentPeriodEndsAt?: string | undefined;
	suspendAt?: string | undefined;
	destroyAt?: string | undefined;
}

export type StoreCommerceAvailabilityReason =
	| "entitlement_trialing"
	| "entitlement_active"
	| "entitlement_suspended"
	| "entitlement_destroyed"
	| "entitlement_missing"
	| "entitlement_invalid"
	| "entitlement_reconciliation_required";

interface StoreCommerceAvailabilityBase {
	version: 1;
	evaluatedAt: string;
}

export type StoreCommerceAvailability = StoreCommerceAvailabilityBase &
	(
		| {
				available: true;
				reason: "entitlement_trialing" | "entitlement_active";
				recheckAt: string;
		  }
		| {
				available: false;
				reason: Exclude<
					StoreCommerceAvailabilityReason,
					"entitlement_trialing" | "entitlement_active"
				>;
				recheckAt?: string | undefined;
		  }
	);

export interface Config {
	$schema?: string;
	theme: string;
	name: string;
	favicon: string;
	icon: IconLogoVariant;
	logo: IconLogoVariant;
	modules?: string[];
	moduleOptions?: Record<string, unknown>;
	notificationSettings?: NotificationSettings;
	billing?: BillingInfo;
	variables: {
		light: ThemeVariables;
		dark: ThemeVariables;
	};
}

interface RemoteConfigBoundary {
	moduleOptions?: never;
	notificationSettings?: never;
}

/** Legacy managed configuration retained during the v2 rollout. */
export type RemoteStoreConfigV1 = Config &
	RemoteConfigBoundary & {
		contractVersion?: never;
		entitlement?: never;
		commerceAvailability?: never;
	};

/**
 * Versioned managed configuration that may cross the Control Plane-to-Runtime
 * seam. Store-owned Module and notification settings are deliberately absent.
 */
export type RemoteStoreConfigV2 = Omit<
	Config,
	"billing" | "favicon" | "modules" | "theme"
> &
	RemoteConfigBoundary & {
		theme: "brisa";
		favicon: "/assets/favicon.svg";
		modules: string[];
		contractVersion: 2;
		entitlement: StoreRuntimeEntitlement | null;
		commerceAvailability: StoreCommerceAvailability;
		billing?: never;
	};

export type RemoteStoreConfig = RemoteStoreConfigV1 | RemoteStoreConfigV2;

export function isRemoteStoreConfigV2(
	config: Config | RemoteStoreConfig,
): config is RemoteStoreConfigV2 {
	return "contractVersion" in config && config.contractVersion === 2;
}

export const DEFAULT_CONFIG: Config = {
	$schema: "https://86d.app/docs.json",
	theme: "brisa",
	name: "86d Starter Kit",
	favicon: "/assets/favicon.svg",
	icon: {
		light: "/assets/icon/light.svg",
		dark: "/assets/icon/dark.svg",
	},
	logo: {
		light: "/assets/logo/light.svg",
		dark: "/assets/logo/dark.svg",
	},
	modules: ["@86d-app/cart"],
	variables: {
		light: {
			radius: "0.625rem",
			background: "oklch(1 0 0)",
			foreground: "oklch(0.145 0 0)",
			card: "oklch(1 0 0)",
			"card-foreground": "oklch(0.145 0 0)",
			popover: "oklch(1 0 0)",
			"popover-foreground": "oklch(0.145 0 0)",
			primary: "oklch(0.205 0 0)",
			"primary-foreground": "oklch(0.985 0 0)",
			secondary: "oklch(0.97 0 0)",
			"secondary-foreground": "oklch(0.205 0 0)",
			muted: "oklch(0.97 0 0)",
			"muted-foreground": "oklch(0.556 0 0)",
			accent: "oklch(0.97 0 0)",
			"accent-foreground": "oklch(0.205 0 0)",
			destructive: "oklch(0.577 0.245 27.325)",
			border: "oklch(0.922 0 0)",
			input: "oklch(0.922 0 0)",
			ring: "oklch(0.708 0 0)",
			"chart-1": "oklch(0.646 0.222 41.116)",
			"chart-2": "oklch(0.6 0.118 184.704)",
			"chart-3": "oklch(0.398 0.07 227.392)",
			"chart-4": "oklch(0.828 0.189 84.429)",
			"chart-5": "oklch(0.769 0.188 70.08)",
			sidebar: "oklch(0.985 0 0)",
			"sidebar-foreground": "oklch(0.145 0 0)",
			"sidebar-primary": "oklch(0.205 0 0)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.97 0 0)",
			"sidebar-accent-foreground": "oklch(0.205 0 0)",
			"sidebar-border": "oklch(0.922 0 0)",
			"sidebar-ring": "oklch(0.708 0 0)",
		},
		dark: {
			background: "oklch(0.145 0 0)",
			foreground: "oklch(0.985 0 0)",
			card: "oklch(0.205 0 0)",
			"card-foreground": "oklch(0.985 0 0)",
			popover: "oklch(0.269 0 0)",
			"popover-foreground": "oklch(0.985 0 0)",
			primary: "oklch(0.922 0 0)",
			"primary-foreground": "oklch(0.205 0 0)",
			secondary: "oklch(0.269 0 0)",
			"secondary-foreground": "oklch(0.985 0 0)",
			muted: "oklch(0.269 0 0)",
			"muted-foreground": "oklch(0.708 0 0)",
			accent: "oklch(0.371 0 0)",
			"accent-foreground": "oklch(0.985 0 0)",
			destructive: "oklch(0.704 0.191 22.216)",
			border: "oklch(1 0 0 / 10%)",
			input: "oklch(1 0 0 / 15%)",
			ring: "oklch(0.556 0 0)",
			"chart-1": "oklch(0.488 0.243 264.376)",
			"chart-2": "oklch(0.696 0.17 162.48)",
			"chart-3": "oklch(0.769 0.188 70.08)",
			"chart-4": "oklch(0.627 0.265 303.9)",
			"chart-5": "oklch(0.645 0.246 16.439)",
			sidebar: "oklch(0.205 0 0)",
			"sidebar-foreground": "oklch(0.985 0 0)",
			"sidebar-primary": "oklch(0.488 0.243 264.376)",
			"sidebar-primary-foreground": "oklch(0.985 0 0)",
			"sidebar-accent": "oklch(0.269 0 0)",
			"sidebar-accent-foreground": "oklch(0.985 0 0)",
			"sidebar-border": "oklch(1 0 0 / 10%)",
			"sidebar-ring": "oklch(0.439 0 0)",
		},
	},
};
