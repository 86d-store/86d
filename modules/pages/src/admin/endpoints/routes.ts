import { createPageEndpoint } from "./create-page";
import { deletePageEndpoint } from "./delete-page";
import { adminGetPageEndpoint } from "./get-page";
import { adminListPagesEndpoint } from "./list-pages";
import { updatePageEndpoint } from "./update-page";

export const adminEndpoints = {
	"/admin/pages": adminListPagesEndpoint,
	"/admin/pages/create": createPageEndpoint,
	"/admin/pages/:id": adminGetPageEndpoint,
	"/admin/pages/:id/update": updatePageEndpoint,
	"/admin/pages/:id/delete": deletePageEndpoint,
};
