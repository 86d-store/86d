import { listCustomerTransactions } from "./list-transactions";

export const storeEndpoints = {
	"/revenue/transactions": listCustomerTransactions,
};
