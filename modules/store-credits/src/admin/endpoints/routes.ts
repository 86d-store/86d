import { adjustCredit } from "./adjust-credit";
import { creditSummary } from "./credit-summary";
import { freezeAccount } from "./freeze-account";
import { getAccount } from "./get-account";
import { listAccounts } from "./list-accounts";
import { listAllTransactions } from "./list-transactions";
import { unfreezeAccount } from "./unfreeze-account";

export const adminEndpoints = {
	"/admin/store-credits/accounts": listAccounts,
	"/admin/store-credits/accounts/:customerId": getAccount,
	"/admin/store-credits/accounts/:customerId/adjust": adjustCredit,
	"/admin/store-credits/accounts/:customerId/freeze": freezeAccount,
	"/admin/store-credits/accounts/:customerId/unfreeze": unfreezeAccount,
	"/admin/store-credits/summary": creditSummary,
	"/admin/store-credits/transactions": listAllTransactions,
};
