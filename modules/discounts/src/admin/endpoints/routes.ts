import { adminCodeStats } from "./code-stats";
import { adminCreateCode } from "./create-code";
import { adminCreateDiscount } from "./create-discount";
import { adminCreatePriceRule } from "./create-price-rule";
import { adminDeleteCode } from "./delete-code";
import { adminDeleteDiscount } from "./delete-discount";
import { adminDeletePriceRule } from "./delete-price-rule";
import { adminDiscountAnalytics } from "./discount-analytics";
import { adminGenerateCodes } from "./generate-codes";
import { adminGetDiscount } from "./get-discount";
import { adminGetPriceRule } from "./get-price-rule";
import { adminListDiscounts } from "./list-discounts";
import { adminListPriceRules } from "./list-price-rules";
import { adminUpdateCode } from "./update-code";
import { adminUpdateDiscount } from "./update-discount";
import { adminUpdatePriceRule } from "./update-price-rule";

export const adminEndpoints = {
	"/admin/discounts": adminListDiscounts,
	"/admin/discounts/analytics": adminDiscountAnalytics,
	"/admin/discounts/create": adminCreateDiscount,
	"/admin/discounts/price-rules": adminListPriceRules,
	"/admin/discounts/price-rules/create": adminCreatePriceRule,
	"/admin/discounts/price-rules/:id": adminGetPriceRule,
	"/admin/discounts/price-rules/:id/update": adminUpdatePriceRule,
	"/admin/discounts/price-rules/:id/delete": adminDeletePriceRule,
	"/admin/discounts/:id": adminGetDiscount,
	"/admin/discounts/:id/update": adminUpdateDiscount,
	"/admin/discounts/:id/delete": adminDeleteDiscount,
	"/admin/discounts/:id/codes": adminCreateCode,
	"/admin/discounts/:id/generate-codes": adminGenerateCodes,
	"/admin/discounts/:id/code-stats": adminCodeStats,
	"/admin/discounts/codes/:id/delete": adminDeleteCode,
	"/admin/discounts/codes/:id/update": adminUpdateCode,
};
