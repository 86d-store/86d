export const MERCHANT_SCREEN_STATES = [
	"empty",
	"loading",
	"error",
	"permission",
	"provider",
] as const;

export type MerchantScreenState = (typeof MERCHANT_SCREEN_STATES)[number];
