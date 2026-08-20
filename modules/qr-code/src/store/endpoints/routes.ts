import { getQrCodeEndpoint } from "./get-qr-code";
import { recordScanEndpoint } from "./record-scan";

export const storeEndpoints = {
	"/qr-codes/:id": getQrCodeEndpoint,
	"/qr-codes/:id/scan": recordScanEndpoint,
};
