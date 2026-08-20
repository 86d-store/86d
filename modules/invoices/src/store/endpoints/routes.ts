import { getMyInvoice } from "./get-my-invoice";
import { listMyInvoices } from "./list-my-invoices";
import { storeSearch } from "./store-search";
import { trackInvoice } from "./track-invoice";

export const storeEndpoints = {
	"/invoices/store-search": storeSearch,
	"/invoices/track": trackInvoice,
	"/invoices/me": listMyInvoices,
	"/invoices/me/:id": getMyInvoice,
};
