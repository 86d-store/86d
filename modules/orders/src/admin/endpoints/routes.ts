import { adminAddNote } from "./add-note";
import { adminBulkAction } from "./bulk-action";
import { adminCreateFulfillment } from "./create-fulfillment";
import { adminDeleteFulfillment } from "./delete-fulfillment";
import { adminDeleteNote } from "./delete-note";
import { adminDeleteOrder } from "./delete-order";
import { adminDeleteReturn } from "./delete-return";
import { adminExportOrders } from "./export-orders";
import { adminGetInvoice } from "./get-invoice";
import { adminGetOrder } from "./get-order";
import { adminGetReturn } from "./get-return";
import { adminListFulfillments } from "./list-fulfillments";
import { adminListNotes } from "./list-notes";
import { adminListOrderReturns } from "./list-order-returns";
import { adminListOrders } from "./list-orders";
import { adminListReturns } from "./list-returns";
import { adminUpdateFulfillment } from "./update-fulfillment";
import { adminUpdateOrder } from "./update-order";
import { adminUpdateReturn } from "./update-return";

export const adminEndpoints = {
	"/admin/orders": adminListOrders,
	"/admin/orders/bulk": adminBulkAction,
	"/admin/orders/export": adminExportOrders,
	"/admin/orders/:id": adminGetOrder,
	"/admin/orders/:id/update": adminUpdateOrder,
	"/admin/orders/:id/delete": adminDeleteOrder,
	"/admin/orders/:id/invoice": adminGetInvoice,
	"/admin/orders/:id/fulfillments": adminListFulfillments,
	"/admin/orders/:id/fulfillments/create": adminCreateFulfillment,
	"/admin/orders/:id/notes": adminListNotes,
	"/admin/orders/:id/notes/add": adminAddNote,
	"/admin/orders/notes/:id/delete": adminDeleteNote,
	"/admin/fulfillments/:id/update": adminUpdateFulfillment,
	"/admin/fulfillments/:id/delete": adminDeleteFulfillment,
	"/admin/orders/:id/returns": adminListOrderReturns,
	"/admin/orders/returns": adminListReturns,
	"/admin/orders/returns/:id": adminGetReturn,
	"/admin/orders/returns/:id/update": adminUpdateReturn,
	"/admin/orders/returns/:id/delete": adminDeleteReturn,
};
