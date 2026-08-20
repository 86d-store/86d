import { captureEndpoint } from "./capture";
import { listPublicPhotosEndpoint } from "./list-photos";
import { sendEndpoint } from "./send";
import { streamPhotosEndpoint } from "./stream-photos";

export const storeEndpoints = {
	"/photo-booth/capture": captureEndpoint,
	"/photo-booth/stream/:id": streamPhotosEndpoint,
	"/photo-booth/send": sendEndpoint,
	"/photo-booth/photos": listPublicPhotosEndpoint,
};
