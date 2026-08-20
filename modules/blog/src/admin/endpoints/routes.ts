import { archivePostEndpoint } from "./archive-post";
import { bulkDeleteEndpoint } from "./bulk-delete";
import { bulkUpdateEndpoint } from "./bulk-update";
import { checkScheduledEndpoint } from "./check-scheduled";
import { createPostEndpoint } from "./create-post";
import { deletePostEndpoint } from "./delete-post";
import { duplicatePostEndpoint } from "./duplicate-post";
import { adminGetPostEndpoint } from "./get-post";
import { adminListPostsEndpoint } from "./list-posts";
import { publishPostEndpoint } from "./publish-post";
import { statsEndpoint } from "./stats";
import { unpublishPostEndpoint } from "./unpublish-post";
import { updatePostEndpoint } from "./update-post";

export const adminEndpoints = {
	"/admin/blog": adminListPostsEndpoint,
	"/admin/blog/create": createPostEndpoint,
	"/admin/blog/stats": statsEndpoint,
	"/admin/blog/bulk/status": bulkUpdateEndpoint,
	"/admin/blog/bulk/delete": bulkDeleteEndpoint,
	"/admin/blog/check-scheduled": checkScheduledEndpoint,
	"/admin/blog/:id": adminGetPostEndpoint,
	"/admin/blog/:id/update": updatePostEndpoint,
	"/admin/blog/:id/delete": deletePostEndpoint,
	"/admin/blog/:id/publish": publishPostEndpoint,
	"/admin/blog/:id/unpublish": unpublishPostEndpoint,
	"/admin/blog/:id/archive": archivePostEndpoint,
	"/admin/blog/:id/duplicate": duplicatePostEndpoint,
};
