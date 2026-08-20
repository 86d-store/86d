import { calculatePoints } from "./calculate-points";
import { getBalance } from "./get-balance";
import { getTiers } from "./get-tiers";
import { listTransactions } from "./list-transactions";
import { redeem } from "./redeem";
import { storeSearch } from "./store-search";

export const storeEndpoints = {
	"/loyalty/store-search": storeSearch,
	"/loyalty/balance": getBalance,
	"/loyalty/transactions": listTransactions,
	"/loyalty/tiers": getTiers,
	"/loyalty/calculate": calculatePoints,
	"/loyalty/redeem": redeem,
};
