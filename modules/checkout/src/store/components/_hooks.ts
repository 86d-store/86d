"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useCheckoutApi() {
	const client = useModuleClient();
	return {
		createSession: client.module("checkout").store["/checkout/sessions"],
		getSession: client.module("checkout").store["/checkout/sessions/:id"],
		updateSession:
			client.module("checkout").store["/checkout/sessions/:id/update"],
		confirmSession:
			client.module("checkout").store["/checkout/sessions/:id/confirm"],
		completeSession:
			client.module("checkout").store["/checkout/sessions/:id/complete"],
		abandonSession:
			client.module("checkout").store["/checkout/sessions/:id/abandon"],
		applyDiscount:
			client.module("checkout").store["/checkout/sessions/:id/discount"],
		removeDiscount:
			client.module("checkout").store["/checkout/sessions/:id/discount/remove"],
		removeGiftCard:
			client.module("checkout").store[
				"/checkout/sessions/:id/gift-card/remove"
			],
		applyStoreCredit:
			client.module("checkout").store["/checkout/sessions/:id/store-credit"],
		removeStoreCredit:
			client.module("checkout").store[
				"/checkout/sessions/:id/store-credit/remove"
			],
		createPayment:
			client.module("checkout").store["/checkout/sessions/:id/payment"],
		getPayment:
			client.module("checkout").store["/checkout/sessions/:id/payment/status"],
		getLineItems:
			client.module("checkout").store["/checkout/sessions/:id/items"],
		getShippingRates:
			client.module("checkout").store["/checkout/sessions/:id/shipping-rates"],
	};
}
