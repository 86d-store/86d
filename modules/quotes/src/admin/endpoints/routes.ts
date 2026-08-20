import { addCommentAdminEndpoint } from "./add-comment";
import { addItemEndpoint } from "./add-item";
import { approveQuoteEndpoint } from "./approve-quote";
import { convertToOrderEndpoint } from "./convert-to-order";
import { counterQuoteEndpoint } from "./counter-quote";
import { createQuoteEndpoint } from "./create-quote";
import { deleteQuoteEndpoint } from "./delete-quote";
import { expireQuoteEndpoint } from "./expire-quote";
import { getQuoteAdminEndpoint } from "./get-quote";
import { listQuotesEndpoint } from "./list-quotes";
import { rejectQuoteEndpoint } from "./reject-quote";
import { removeItemEndpoint } from "./remove-item";
import { reviewQuoteEndpoint } from "./review-quote";
import { statsEndpoint } from "./stats";
import { updateItemEndpoint } from "./update-item";

export const adminEndpoints = {
	"/admin/quotes": listQuotesEndpoint,
	"/admin/quotes/create": createQuoteEndpoint,
	"/admin/quotes/stats": statsEndpoint,
	"/admin/quotes/:id": getQuoteAdminEndpoint,
	"/admin/quotes/:id/delete": deleteQuoteEndpoint,
	"/admin/quotes/:id/review": reviewQuoteEndpoint,
	"/admin/quotes/:id/counter": counterQuoteEndpoint,
	"/admin/quotes/:id/approve": approveQuoteEndpoint,
	"/admin/quotes/:id/reject": rejectQuoteEndpoint,
	"/admin/quotes/:id/convert": convertToOrderEndpoint,
	"/admin/quotes/:id/expire": expireQuoteEndpoint,
	"/admin/quotes/:id/comments/add": addCommentAdminEndpoint,
	"/admin/quotes/:id/items": addItemEndpoint,
	"/admin/quotes/:id/items/:itemId": updateItemEndpoint,
	"/admin/quotes/:id/items/:itemId/remove": removeItemEndpoint,
};
