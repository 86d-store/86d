import { createAdminEndpoint } from "@86d-store/core/api";
import {
	DEFAULT_CHECKOUT_SESSION_TTL_MINUTES,
	DEFAULT_CURRENCY,
	DEFAULT_FULFILLMENT_TYPE,
	FULFILLMENT_METHOD_VALUES,
	type FulfillmentMethod,
	SETTING_KEYS,
	type SettingsController,
} from "../../service";

export type CheckoutSettings = {
	fulfillmentMethodsOffered: FulfillmentMethod[];
	defaultFulfillmentType: FulfillmentMethod;
	sessionTtlMinutes: number;
	defaultCurrency: string;
	isConfigured: boolean;
	missingRequired: string[];
};

function parseFulfillmentMethods(value: string | null): FulfillmentMethod[] {
	if (value === null) {
		return [];
	}
	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((m): m is FulfillmentMethod =>
			FULFILLMENT_METHOD_VALUES.includes(m as FulfillmentMethod),
		);
	} catch {
		return [];
	}
}

function parseFulfillmentType(value: string | null): FulfillmentMethod {
	if (
		value !== null &&
		FULFILLMENT_METHOD_VALUES.includes(value as FulfillmentMethod)
	) {
		return value as FulfillmentMethod;
	}
	return DEFAULT_FULFILLMENT_TYPE;
}

function parseNumber(value: string | null, defaultValue: number): number {
	if (value === null) return defaultValue;
	const num = Number.parseInt(value, 10);
	return Number.isFinite(num) && num > 0 ? num : defaultValue;
}

export const getCheckoutSettingsEndpoint = createAdminEndpoint(
	"/admin/settings/checkout",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;

		const [
			fulfillmentMethodsOffered,
			defaultFulfillmentType,
			sessionTtlMinutes,
			defaultCurrency,
		] = await Promise.all([
			controller.getValue(SETTING_KEYS.fulfillmentMethodsOffered),
			controller.getValue(SETTING_KEYS.defaultFulfillmentType),
			controller.getValue(SETTING_KEYS.checkoutSessionTtlMinutes),
			controller.getValue(SETTING_KEYS.defaultCurrency),
		]);

		const methods = parseFulfillmentMethods(fulfillmentMethodsOffered);
		const currency = defaultCurrency;

		const missingRequired: string[] = [];
		if (methods.length === 0) {
			missingRequired.push("fulfillmentMethodsOffered");
		}
		if (currency === null) {
			missingRequired.push("defaultCurrency");
		}

		const settings: CheckoutSettings = {
			fulfillmentMethodsOffered:
				methods.length > 0 ? methods : [DEFAULT_FULFILLMENT_TYPE],
			defaultFulfillmentType: parseFulfillmentType(defaultFulfillmentType),
			sessionTtlMinutes: parseNumber(
				sessionTtlMinutes,
				DEFAULT_CHECKOUT_SESSION_TTL_MINUTES,
			),
			defaultCurrency: currency ?? DEFAULT_CURRENCY,
			isConfigured: missingRequired.length === 0,
			missingRequired,
		};

		return { settings };
	},
);
