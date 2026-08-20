import { createBatchEndpoint } from "./create-batch";
import { createQrCodeEndpoint } from "./create-qr-code";
import { deleteQrCodeEndpoint } from "./delete-qr-code";
import { getQrCodeEndpoint } from "./get-qr-code";
import { listQrCodesEndpoint } from "./list-qr-codes";
import { listScansEndpoint } from "./list-scans";
import { updateQrCodeEndpoint } from "./update-qr-code";

export const adminEndpoints = {
	"/admin/qr-codes": listQrCodesEndpoint,
	"/admin/qr-codes/create": createQrCodeEndpoint,
	"/admin/qr-codes/batch": createBatchEndpoint,
	"/admin/qr-codes/:id": getQrCodeEndpoint,
	"/admin/qr-codes/:id/update": updateQrCodeEndpoint,
	"/admin/qr-codes/:id/delete": deleteQrCodeEndpoint,
	"/admin/qr-codes/:id/scans": listScansEndpoint,
};
