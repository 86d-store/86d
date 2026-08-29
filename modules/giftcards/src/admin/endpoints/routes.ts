import { getGiftCard } from "./get-gift-card";
import { listGiftCardTransactions } from "./list-gift-card-transactions";
import { listGiftCards } from "./list-gift-cards";
import { getGiftCardStats } from "./stats";

export const adminEndpoints = {
	"/admin/gift-cards": listGiftCards,
	"/admin/gift-cards/stats": getGiftCardStats,
	"/admin/gift-cards/:id": getGiftCard,
	"/admin/gift-cards/:id/transactions": listGiftCardTransactions,
};
