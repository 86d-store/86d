import { activePromotions } from "./active-promotions";
import { evaluateCartRules } from "./evaluate-cart-rules";
import { validateCode } from "./validate-code";

export const storeEndpoints = {
	"/discounts/active": activePromotions,
	"/discounts/validate": validateCode,
	"/discounts/cart-rules/evaluate": evaluateCartRules,
};
