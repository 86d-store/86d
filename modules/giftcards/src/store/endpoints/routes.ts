import { checkGiftCardBalance } from "./check-balance";
import { listMyGiftCards } from "./my-cards";
import { sendGiftCard } from "./send";

export const storeEndpoints = {
	"/gift-cards/check": checkGiftCardBalance,
	"/gift-cards/send": sendGiftCard,
	"/gift-cards/my-cards": listMyGiftCards,
};
