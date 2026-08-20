import { adminBulkUpdateRates } from "./bulk-update-rates";
import { adminCreateCurrency } from "./create-currency";
import { adminDeleteCurrency } from "./delete-currency";
import { adminDeletePriceOverride } from "./delete-price-override";
import { adminGetCurrency } from "./get-currency";
import { adminListCurrencies } from "./list-currencies";
import { adminListPriceOverrides } from "./list-price-overrides";
import { adminRateHistory } from "./rate-history";
import { adminSetBaseCurrency } from "./set-base-currency";
import { adminSetPriceOverride } from "./set-price-override";
import { adminUpdateCurrency } from "./update-currency";
import { adminUpdateRate } from "./update-rate";

export const adminEndpoints = {
	"/admin/currencies": adminListCurrencies,
	"/admin/currencies/create": adminCreateCurrency,
	"/admin/currencies/update-rate": adminUpdateRate,
	"/admin/currencies/bulk-update-rates": adminBulkUpdateRates,
	"/admin/currencies/rate-history": adminRateHistory,
	"/admin/currencies/price-override": adminSetPriceOverride,
	"/admin/currencies/price-overrides/:productId": adminListPriceOverrides,
	"/admin/currencies/price-overrides/:id/delete": adminDeletePriceOverride,
	"/admin/currencies/:id": adminGetCurrency,
	"/admin/currencies/:id/update": adminUpdateCurrency,
	"/admin/currencies/:id/delete": adminDeleteCurrency,
	"/admin/currencies/:id/set-base": adminSetBaseCurrency,
};
