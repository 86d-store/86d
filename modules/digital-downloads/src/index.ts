import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { digitalDownloadsStorage } from "./schema";
import { createDigitalDownloadsController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	DigitalDownloadsController,
	DownloadableFile,
	DownloadToken,
} from "./service";

export interface DigitalDownloadsOptions extends ModuleConfig {
	/** Default token expiry in days (0 = never) */
	defaultTokenExpiryDays?: number;
	/** Default max downloads per token (0 = unlimited) */
	defaultMaxDownloads?: number;
}

export default function digitalDownloads(
	options?: DigitalDownloadsOptions,
): Module {
	return {
		id: "digital-downloads",
		version: "0.0.1",
		storage: digitalDownloadsStorage,
		exports: {
			read: ["downloadFiles", "downloadTokens"],
		},
		events: {
			emits: ["download.purchased", "download.accessed"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createDigitalDownloadsController(ctx.data);

			ctx.events?.on("checkout.completed", async (event) => {
				const p = event.payload as {
					orderId: string;
					email: string;
					items: Array<{ productId?: string | undefined }>;
				};
				if (!p?.email || !p.items?.length) return;

				const expiryDays = options?.defaultTokenExpiryDays ?? 0;
				const expiresAt =
					expiryDays > 0
						? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
						: undefined;

				for (const item of p.items) {
					if (!item.productId) continue;
					const files = await controller
						.listFiles({ productId: item.productId })
						.catch(() => []);
					const activeFiles = files.filter((f) => f.isActive);
					if (!activeFiles.length) continue;

					await controller
						.createTokenBatch({
							fileIds: activeFiles.map((f) => f.id),
							email: p.email,
							orderId: p.orderId,
							...(expiresAt ? { expiresAt } : {}),
							...(options?.defaultMaxDownloads
								? { maxDownloads: options.defaultMaxDownloads }
								: {}),
						})
						.catch(() => {});

					void ctx.events?.emit("download.purchased", {
						orderId: p.orderId,
						email: p.email,
						productId: item.productId,
						fileCount: activeFiles.length,
					});
				}
			});

			return { controllers: { "digital-downloads": controller } };
		},
		search: { store: "/digital-downloads/store-search" },
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/downloads",
					component: "DownloadsAdmin",
					label: "Downloads",
					icon: "Download",
					group: "Sales",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/downloads",
					component: "MyDownloads",
				},
			],
		},
		options,
	};
}
