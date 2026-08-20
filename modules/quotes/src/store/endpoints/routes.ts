import { acceptQuoteEndpoint } from "./accept-quote";
import { addCommentEndpoint } from "./add-comment";
import { addItemEndpoint } from "./add-item";
import { createQuoteEndpoint } from "./create-quote";
import { declineQuoteEndpoint } from "./decline-quote";
import { getQuoteEndpoint } from "./get-quote";
import { myQuotesEndpoint } from "./my-quotes";
import { removeItemEndpoint } from "./remove-item";
import { submitQuoteEndpoint } from "./submit-quote";
import { updateItemEndpoint } from "./update-item";

export const storeEndpoints = {
	"/quotes/create": createQuoteEndpoint,
	"/quotes/my": myQuotesEndpoint,
	"/quotes/:id": getQuoteEndpoint,
	"/quotes/:id/items/add": addItemEndpoint,
	"/quotes/:id/items/update": updateItemEndpoint,
	"/quotes/:id/items/remove": removeItemEndpoint,
	"/quotes/:id/submit": submitQuoteEndpoint,
	"/quotes/:id/accept": acceptQuoteEndpoint,
	"/quotes/:id/decline": declineQuoteEndpoint,
	"/quotes/:id/comments/add": addCommentEndpoint,
};
