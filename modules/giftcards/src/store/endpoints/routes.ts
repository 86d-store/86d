import { checkGiftCardBalance } from "./check-balance";
import { listMyGiftCards } from "./my-cards";
import { purchaseGiftCard } from "./purchase";
import { sendGiftCard } from "./send";
import { topUpGiftCard } from "./top-up";

export const storeEndpoints = {
	"/gift-cards/check": checkGiftCardBalance,
	"/gift-cards/purchase": purchaseGiftCard,
	"/gift-cards/send": sendGiftCard,
	"/gift-cards/my-cards": listMyGiftCards,
	"/gift-cards/top-up": topUpGiftCard,
};
