import { exportTransactions } from "./export-transactions";
import { getStats } from "./get-stats";
import { listTransactions } from "./list-transactions";

export const adminEndpoints = {
	"/admin/revenue/stats": getStats,
	"/admin/revenue/transactions": listTransactions,
	"/admin/revenue/export": exportTransactions,
};
