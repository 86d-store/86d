import { abandonSession } from "./abandon-session";
import {
	capturePaymentUnavailable as capturePayment,
	confirmSessionUnavailable as confirmSession,
	createPaymentUnavailable as createPayment,
	getPaymentUnavailable as getPayment,
} from "./activation-unavailable";
import { applyDiscount } from "./apply-discount";
import { applyStoreCredit } from "./apply-store-credit";
import { completeSession } from "./complete-session";
import { createCheckoutRequest } from "./create-checkout-request";
import { createSession } from "./create-session";
import { getCheckoutRequest } from "./get-checkout-request";
import { getLineItems } from "./get-line-items";
import { getSession } from "./get-session";
import { getShippingRates } from "./get-shipping-rates";
import { removeDiscount } from "./remove-discount";
import { removeGiftCard } from "./remove-gift-card";
import { removeStoreCredit } from "./remove-store-credit";
import { updateSession } from "./update-session";

export const storeEndpoints = {
	"/checkout/requests": createCheckoutRequest,
	"/checkout/requests/:id": getCheckoutRequest,
	"/checkout/sessions": createSession,
	"/checkout/sessions/:id": getSession,
	"/checkout/sessions/:id/update": updateSession,
	"/checkout/sessions/:id/confirm": confirmSession,
	"/checkout/sessions/:id/complete": completeSession,
	"/checkout/sessions/:id/abandon": abandonSession,
	"/checkout/sessions/:id/discount": applyDiscount,
	"/checkout/sessions/:id/discount/remove": removeDiscount,
	"/checkout/sessions/:id/gift-card/remove": removeGiftCard,
	"/checkout/sessions/:id/store-credit": applyStoreCredit,
	"/checkout/sessions/:id/store-credit/remove": removeStoreCredit,
	"/checkout/sessions/:id/payment": createPayment,
	"/checkout/sessions/:id/payment/capture": capturePayment,
	"/checkout/sessions/:id/payment/status": getPayment,
	"/checkout/sessions/:id/items": getLineItems,
	"/checkout/sessions/:id/shipping-rates": getShippingRates,
};
