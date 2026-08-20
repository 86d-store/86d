import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { qrCodeStorage } from "./schema";
import { createQrCodeController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	QrCode,
	QrCodeController,
	QrCodeFormat,
	QrCodeTargetType,
	QrScan,
} from "./service";

export interface QrCodeOptions extends ModuleConfig {
	/** Default QR code size in pixels (default: 256) */
	defaultSize?: string; // numeric string
	/** Default output format (default: "svg") */
	defaultFormat?: string; // "svg" | "png"
	/** Default error correction level (default: "M") */
	errorCorrection?: string; // "L" | "M" | "Q" | "H"
}

export default function qrCode(options?: QrCodeOptions): Module {
	return {
		id: "qr-code",
		version: "0.0.1",
		storage: qrCodeStorage,
		exports: {
			read: ["qrCodeTargetUrl", "qrCodeTargetType"],
		},
		events: {
			emits: ["qr.created", "qr.scanned", "qr.deleted", "qr.batch.created"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createQrCodeController(ctx.data, ctx.events);
			return { controllers: { qrCode: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		store: {
			pages: [{ path: "/qr/:id", component: "QrRedirect" }],
		},
		admin: {
			pages: [
				{
					path: "/admin/qr-codes",
					component: "QrCodeList",
					label: "QR Codes",
					icon: "QrCode",
					group: "Marketing",
				},
				{
					path: "/admin/qr-codes/:id",
					component: "QrCodeDetail",
				},
			],
		},
		options,
	};
}
