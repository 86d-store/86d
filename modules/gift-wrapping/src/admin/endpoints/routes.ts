import { createOption } from "./create-option";
import { deleteOption } from "./delete-option";
import { getOption } from "./get-option";
import { listOptions } from "./list-options";
import { orderSelections } from "./order-selections";
import { updateOption } from "./update-option";
import { wrapSummary } from "./wrap-summary";

export const adminEndpoints = {
	"/admin/gift-wrapping": listOptions,
	"/admin/gift-wrapping/create": createOption,
	"/admin/gift-wrapping/summary": wrapSummary,
	"/admin/gift-wrapping/:id": getOption,
	"/admin/gift-wrapping/:id/update": updateOption,
	"/admin/gift-wrapping/:id/delete": deleteOption,
	"/admin/gift-wrapping/order/:orderId": orderSelections,
};
