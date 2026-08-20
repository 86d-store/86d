import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { mediaSchema, mediaTables } from "./schema";
import { createMediaController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type { Asset, Folder, MediaController, MediaStats } from "./service";

export interface MediaOptions extends ModuleConfig {
	/** Maximum file size in bytes (default: "10485760" = 10MB) */
	maxFileSize?: string;
	/** Comma-separated list of allowed MIME types (default: all) */
	allowedMimeTypes?: string;
}

export default function media(options?: MediaOptions): Module {
	return {
		id: "media",
		version: "0.0.1",
		schema: mediaSchema,
		tables: mediaTables,
		exports: {
			read: ["assetUrl", "assetAltText", "assetMimeType"],
		},
		events: {
			emits: ["media.uploaded", "media.deleted", "media.moved"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createMediaController(ctx.data);
			return { controllers: { media: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/media",
					component: "MediaAdmin",
					label: "Media",
					icon: "Image",
					group: "Content",
				},
			],
		},
		options,
	};
}
