import { createSessionEndpoint } from "./create-session";
import { createStreamEndpoint } from "./create-stream";
import { deletePhotoEndpoint } from "./delete-photo";
import { endSessionEndpoint } from "./end-session";
import { listPhotosEndpoint } from "./list-photos";
import { listSessionsEndpoint } from "./list-sessions";
import { listStreamsEndpoint } from "./list-streams";
import { streamPhotosEndpoint } from "./stream-photos";
import { toggleStreamEndpoint } from "./toggle-stream";

export const adminEndpoints = {
	"/admin/photo-booth/photos": listPhotosEndpoint,
	"/admin/photo-booth/photos/:id/delete": deletePhotoEndpoint,
	"/admin/photo-booth/sessions/create": createSessionEndpoint,
	"/admin/photo-booth/sessions": listSessionsEndpoint,
	"/admin/photo-booth/sessions/:id/end": endSessionEndpoint,
	"/admin/photo-booth/streams/create": createStreamEndpoint,
	"/admin/photo-booth/streams": listStreamsEndpoint,
	"/admin/photo-booth/streams/:id/toggle": toggleStreamEndpoint,
	"/admin/photo-booth/streams/:id/photos": streamPhotosEndpoint,
};
