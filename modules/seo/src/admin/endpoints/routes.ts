import { createRedirectEndpoint } from "./create-redirect";
import { deleteMetaEndpoint } from "./delete-meta";
import { deleteRedirectEndpoint } from "./delete-redirect";
import { listMetaEndpoint } from "./list-meta";
import { listRedirectsEndpoint } from "./list-redirects";
import { updateRedirectEndpoint } from "./update-redirect";
import { upsertMetaEndpoint } from "./upsert-meta";

export const adminEndpoints = {
	"/admin/seo/meta": listMetaEndpoint,
	"/admin/seo/meta/upsert": upsertMetaEndpoint,
	"/admin/seo/meta/:id/delete": deleteMetaEndpoint,
	"/admin/seo/redirects": listRedirectsEndpoint,
	"/admin/seo/redirects/create": createRedirectEndpoint,
	"/admin/seo/redirects/:id/update": updateRedirectEndpoint,
	"/admin/seo/redirects/:id/delete": deleteRedirectEndpoint,
};
