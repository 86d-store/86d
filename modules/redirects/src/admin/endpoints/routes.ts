import { bulkDeleteRedirects } from "./bulk-delete";
import { createRedirect } from "./create-redirect";
import { deleteRedirect } from "./delete-redirect";
import { getRedirect } from "./get-redirect";
import { getStats } from "./get-stats";
import { listRedirects } from "./list-redirects";
import { testRedirect } from "./test-redirect";
import { updateRedirect } from "./update-redirect";

export const adminEndpoints = {
	"/admin/redirects": listRedirects,
	"/admin/redirects/stats": getStats,
	"/admin/redirects/create": createRedirect,
	"/admin/redirects/bulk-delete": bulkDeleteRedirects,
	"/admin/redirects/test": testRedirect,
	"/admin/redirects/:id": getRedirect,
	"/admin/redirects/:id/update": updateRedirect,
	"/admin/redirects/:id/delete": deleteRedirect,
};
