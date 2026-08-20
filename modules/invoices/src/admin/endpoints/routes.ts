import { adminApplyCreditNote } from "./apply-credit-note";
import { adminBulkAction } from "./bulk-action";
import { adminCreateCreditNote } from "./create-credit-note";
import { adminCreateInvoice } from "./create-invoice";
import { adminDeleteInvoice } from "./delete-invoice";
import { adminDeletePayment } from "./delete-payment";
import { adminFindOverdue } from "./find-overdue";
import { adminGetCreditNote } from "./get-credit-note";
import { adminGetInvoice } from "./get-invoice";
import { adminIssueCreditNote } from "./issue-credit-note";
import { adminListCreditNotes } from "./list-credit-notes";
import { adminListInvoices } from "./list-invoices";
import { adminListPayments } from "./list-payments";
import { adminRecordPayment } from "./record-payment";
import { adminSendInvoice } from "./send-invoice";
import { adminUpdateInvoice } from "./update-invoice";
import { adminVoidCreditNote } from "./void-credit-note";
import { adminVoidInvoice } from "./void-invoice";

export const adminEndpoints = {
	"/admin/invoices": adminListInvoices,
	"/admin/invoices/bulk": adminBulkAction,
	"/admin/invoices/overdue": adminFindOverdue,
	"/admin/invoices/create": adminCreateInvoice,
	"/admin/invoices/:id": adminGetInvoice,
	"/admin/invoices/:id/update": adminUpdateInvoice,
	"/admin/invoices/:id/delete": adminDeleteInvoice,
	"/admin/invoices/:id/send": adminSendInvoice,
	"/admin/invoices/:id/void": adminVoidInvoice,
	"/admin/invoices/:id/payments": adminListPayments,
	"/admin/invoices/:id/payments/record": adminRecordPayment,
	"/admin/invoices/payments/:id/delete": adminDeletePayment,
	"/admin/invoices/:id/credit-notes": adminListCreditNotes,
	"/admin/invoices/:id/credit-notes/create": adminCreateCreditNote,
	"/admin/credit-notes/:id": adminGetCreditNote,
	"/admin/credit-notes/:id/issue": adminIssueCreditNote,
	"/admin/credit-notes/:id/apply": adminApplyCreditNote,
	"/admin/credit-notes/:id/void": adminVoidCreditNote,
};
