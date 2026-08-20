import type { ModuleController } from "@86d-app/core/types/module";

export type SettingGroup =
	| "general"
	| "contact"
	| "social"
	| "legal"
	| "commerce"
	| "appearance";

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

	// Appearance
	logoUrl: "appearance.logo_url",
	faviconUrl: "appearance.favicon_url",
	brandColor: "appearance.brand_color",
	announcementBar: "appearance.announcement_bar",
	announcementBarEnabled: "appearance.announcement_bar_enabled",
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
