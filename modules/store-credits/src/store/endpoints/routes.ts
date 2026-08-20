import { applyCredit } from "./apply-credit";
import { getBalance } from "./get-balance";
import { listTransactions } from "./list-transactions";

export const storeEndpoints = {
	"/store-credits/balance": getBalance,
	"/store-credits/transactions": listTransactions,
	"/store-credits/apply": applyCredit,
};
